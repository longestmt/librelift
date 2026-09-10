/**
 * LibreLift adapter for the reusable LibreSync browser client.
 *
 * Domain schema, validation, and presentation stay in LibreLift. The package
 * owns credentials, encryption, relay transport, causal state, and lifecycle.
 */

import {
    IndexedDbSecretStorage,
    LibreSyncClient,
} from '@libresync/client';

import { getOrCreateLocalSetting, getSetting, openDB, setSettings, uuid } from './db.js';
import { exportSafetySnapshot } from './io.js';
import { readSynchronizedLocalEntities } from './sync-local.js';
import { applyMaterializedEntities } from './sync-schema.js';
import {
    LIBRELIFT_APP_ID,
    LIBRELIFT_APP_SCHEMA_VERSION,
    SYNCED_ENTITY_STORES,
} from './sync-config.js';

const PREFERENCE_KEYS = Object.freeze({
    consent: 'libresyncConsent',
    deviceId: 'libresyncDeviceId',
    deviceLabel: 'libresyncDeviceLabel',
    serverUrl: 'libresyncServerUrl',
});

async function getOrCreateDeviceId() {
    return getOrCreateLocalSetting(PREFERENCE_KEYS.deviceId, uuid);
}

async function savePreferences({ consent, deviceLabel, serverUrl } = {}) {
    const values = {};
    if (consent !== undefined) values[PREFERENCE_KEYS.consent] = consent === true;
    if (typeof deviceLabel === 'string' && deviceLabel.trim()) {
        values[PREFERENCE_KEYS.deviceLabel] = deviceLabel.trim();
    }
    if (typeof serverUrl === 'string' && serverUrl) {
        values[PREFERENCE_KEYS.serverUrl] = serverUrl;
    }
    if (Object.keys(values).length > 0) await setSettings(values);
}

/** Create the application-specific lifecycle backend during LibreLift startup. */
export async function createLibreLiftSyncBackend(options = {}) {
    let currentDeviceId = options.deviceId || await getOrCreateDeviceId();
    const savedDeviceLabel = await getSetting(PREFERENCE_KEYS.deviceLabel, 'LibreLift device');
    const deviceLabel = options.deviceLabel || savedDeviceLabel || 'LibreLift device';
    const databaseProvider = options.databaseProvider || openDB;
    const secretStorage = options.secretStorage
        || new IndexedDbSecretStorage(databaseProvider, LIBRELIFT_APP_ID);
    const createDeviceId = options.createDeviceId || uuid;
    const buildClient = deviceId => new LibreSyncClient({
        applicationId: LIBRELIFT_APP_ID,
        appSchemaVersion: LIBRELIFT_APP_SCHEMA_VERSION,
        deviceId,
        deviceLabel,
        db: databaseProvider,
        domainStores: [...SYNCED_ENTITY_STORES, 'settings'],
        applyMaterialized: applyMaterializedEntities,
        secretStorage,
        readLocalEntities: options.readLocalEntities || readSynchronizedLocalEntities,
        createSafetyBackup: options.createSafetyBackup || exportSafetySnapshot,
        supportedAppSchemaVersions: [LIBRELIFT_APP_SCHEMA_VERSION],
        maxChangesPerOperation: 200,
        maxPushBatchOperations: 100,
        pullPageSize: 100,
        debounceMs: 800,
        ...(options.transportFactory ? { transportFactory: options.transportFactory } : {}),
    });
    let client = buildClient(currentDeviceId);

    function replaceClient(deviceId) {
        if (!deviceId || deviceId === currentDeviceId) return;
        client.stopAutomaticSync();
        currentDeviceId = deviceId;
        client = buildClient(deviceId);
    }

    async function ensureCurrentClient() {
        const persistedDeviceId = await getSetting(PREFERENCE_KEYS.deviceId, currentDeviceId);
        replaceClient(persistedDeviceId);
    }

    async function ensureTransactionClient(transaction) {
        if (!transaction.objectStoreNames.contains('settings')) return;
        const request = transaction.objectStore('settings').get(PREFERENCE_KEYS.deviceId);
        const record = await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        replaceClient(record?.value);
    }

    async function rotateDisconnectedDeviceId() {
        let nextDeviceId = createDeviceId();
        while (nextDeviceId === currentDeviceId) nextDeviceId = createDeviceId();
        await setSettings({ [PREFERENCE_KEYS.deviceId]: nextDeviceId });
        replaceClient(nextDeviceId);
    }

    const backend = {
        async recordLocalOperation(input) {
            await ensureTransactionClient(input.transaction);
            const result = await client.recordLocalOperation(input);
            if (!result) return null;

            // A local write made while an entity already has concurrent heads
            // must use the same deterministic projection as every other replica.
            await applyMaterializedEntities({
                transaction: input.transaction,
                entities: result.projections,
                operation: result.operation,
                source: 'local',
            });
            return result.operation;
        },

        async createVault({ consent, serverUrl, deviceLabel: nextLabel }) {
            await ensureCurrentClient();
            if (consent !== true) throw new Error('Remote-data consent is required.');
            await savePreferences({ consent, serverUrl, deviceLabel: nextLabel });
            return client.createVault({ serverUrl, deviceLabel: nextLabel });
        },

        async joinVault(pairingPayload, { consent, deviceLabel: nextLabel } = {}) {
            await ensureCurrentClient();
            if (consent !== true) throw new Error('Remote-data consent is required.');
            await savePreferences({ consent, deviceLabel: nextLabel });
            const metadata = await client.joinVault(pairingPayload, { deviceLabel: nextLabel });
            await savePreferences({ serverUrl: metadata.serverUrl });
            return metadata;
        },

        async getStatus() {
            await ensureCurrentClient();
            const [status, consent, savedLabel, savedServer] = await Promise.all([
                client.getStatus(),
                getSetting(PREFERENCE_KEYS.consent, false),
                getSetting(PREFERENCE_KEYS.deviceLabel, deviceLabel),
                getSetting(PREFERENCE_KEYS.serverUrl, ''),
            ]);
            return {
                ...status,
                consent: consent === true,
                deviceLabel: status.deviceLabel || savedLabel || deviceLabel,
                serverUrl: status.serverUrl || savedServer || '',
            };
        },

        async sync() {
            await ensureCurrentClient();
            return client.sync();
        },
        async createInvitation(options) {
            await ensureCurrentClient();
            return client.createInvitation(options?.ttlSeconds);
        },
        async listDevices() {
            await ensureCurrentClient();
            return client.listDevices();
        },
        async revokeDevice(targetDeviceId) {
            await ensureCurrentClient();
            return client.revokeDevice(targetDeviceId);
        },
        async listConflicts(entityType) {
            await ensureCurrentClient();
            return client.listConflicts(entityType);
        },
        async resolveConflict(entityType, entityId, resolution) {
            await ensureCurrentClient();
            return client.resolveConflict(
                entityType,
                entityId,
                { kind: resolution.kind, ...(resolution.kind === 'put' ? { payload: resolution.payload } : {}) }
            );
        },
        async disconnect() {
            await ensureCurrentClient();
            client.stopAutomaticSync();
            await client.disconnect();
            // The relay deliberately retains disconnected/revoked device rows.
            // Rejoining the same vault must therefore register a fresh device
            // ID, while reloads during one connected lifecycle keep it stable.
            await rotateDisconnectedDeviceId();
        },
        async deleteVault(confirmation) {
            await ensureCurrentClient();
            return client.deleteVault(confirmation);
        },
        startAutomaticSync: () => client.startAutomaticSync(),
        stopAutomaticSync: () => client.stopAutomaticSync(),
        subscribeStatus: listener => client.subscribeStatus(listener),
        get client() { return client; },
    };
    return backend;
}
