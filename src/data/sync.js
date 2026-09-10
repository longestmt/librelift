/**
 * App-specific LibreSync lifecycle facade.
 *
 * The reusable package owns protocol, encryption, transport, and causal state.
 * LibreLift owns when synchronization runs and how materialized records and
 * conflicts are presented. The package backend is registered during app start.
 */

import { configureSyncRecorder } from './db.js';

const statusListeners = new Set();
let backend = null;
let initialized = false;
let debounceTimer = null;
let syncPromise = null;

const DISCONNECTED_STATUS = Object.freeze({
    connected: false,
    consent: false,
    serverUrl: '',
    vaultId: null,
    deviceId: null,
    deviceLabel: '',
    automaticSync: 'stopped',
    lastSuccessfulSync: null,
    pendingCount: 0,
    quarantinedCount: 0,
    conflictCount: 0,
    lastError: null,
});

function requireBackend() {
    if (!backend) throw new Error('LibreSync is not initialized on this device.');
    return backend;
}

async function emitStatus() {
    const status = await getStatus();
    for (const listener of statusListeners) {
        try { listener(status); } catch (error) {
            console.error('LibreSync status listener failed:', error);
        }
    }
    return status;
}

export function subscribeSyncStatus(listener) {
    statusListeners.add(listener);
    return () => statusListeners.delete(listener);
}

export function registerSyncBackend(nextBackend) {
    if (!nextBackend || typeof nextBackend.recordLocalOperation !== 'function') {
        throw new Error('The LibreSync backend is missing its transaction recorder.');
    }
    backend = nextBackend;
    configureSyncRecorder(async input => {
        const operation = await backend.recordLocalOperation(input);
        if (operation && typeof backend.startAutomaticSync === 'function') {
            // Another tab may have connected this shared database after this
            // tab initialized. Starting is idempotent and catches that case.
            backend.startAutomaticSync();
        } else if (typeof backend.startAutomaticSync !== 'function') {
            scheduleSync();
        }
        return operation;
    });
}

export async function initializeSync(createBackend) {
    if (initialized) return getStatus();
    initialized = true;
    if (createBackend) {
        const nextBackend = await createBackend();
        if (nextBackend) registerSyncBackend(nextBackend);
    }

    const packageOwnsAutomaticSync = typeof backend?.startAutomaticSync === 'function';
    if (typeof window !== 'undefined') {
        const useSyncOpportunity = () => {
            void getStatus().then(status => {
                if (!status.connected) return;
                if (packageOwnsAutomaticSync) backend.startAutomaticSync();
                else scheduleSync(0);
            }).catch(() => { /* Local writes stay available if status cannot load. */ });
        };
        window.addEventListener('online', useSyncOpportunity);
        window.addEventListener('pageshow', useSyncOpportunity);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') useSyncOpportunity();
        });
    }
    if ((await getStatus()).connected) {
        if (packageOwnsAutomaticSync) backend.startAutomaticSync();
        else scheduleSync(0);
    }
    return getStatus();
}

export function scheduleSync(delayMs = 800) {
    if (!backend) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        sync().catch(() => { /* Status exposes the failure without blocking writes. */ });
    }, delayMs);
}

export async function sync() {
    if (!backend) return null;
    if (syncPromise) return syncPromise;
    // LibreSyncClient owns cross-tab serialization through Web Locks with a
    // transactional IndexedDB fallback. This facade only coalesces duplicate
    // calls made concurrently inside this JavaScript context.
    syncPromise = (async () => {
        try {
            const result = await backend.sync();
            await emitStatus();
            return result;
        } catch (error) {
            await emitStatus();
            throw error;
        }
    })().finally(() => { syncPromise = null; });
    return syncPromise;
}

export async function getStatus() {
    if (!backend) return { ...DISCONNECTED_STATUS };
    return { ...DISCONNECTED_STATUS, ...(await backend.getStatus()) };
}

export async function createVault(options) {
    const result = await requireBackend().createVault(options);
    await emitStatus();
    if (typeof backend.startAutomaticSync === 'function') backend.startAutomaticSync();
    else scheduleSync(0);
    return result;
}

export async function joinVault(pairingPayload, options) {
    const result = await requireBackend().joinVault(pairingPayload, options);
    await emitStatus();
    if (typeof backend.startAutomaticSync === 'function') backend.startAutomaticSync();
    else scheduleSync(0);
    return result;
}

export async function createInvitation(options) {
    return requireBackend().createInvitation(options);
}

export async function listDevices() {
    return requireBackend().listDevices();
}

export async function revokeDevice(deviceId) {
    const result = await requireBackend().revokeDevice(deviceId);
    await emitStatus();
    return result;
}

export async function disconnect() {
    backend?.stopAutomaticSync?.();
    const result = await requireBackend().disconnect();
    await emitStatus();
    return result;
}

export async function deleteVault(confirmation) {
    backend?.stopAutomaticSync?.();
    const result = await requireBackend().deleteVault(confirmation);
    await emitStatus();
    return result;
}

export async function listConflicts() {
    return backend ? backend.listConflicts() : [];
}

export async function resolveConflict(entity, resolution) {
    const target = requireBackend();
    const result = entity && typeof entity === 'object'
        ? await target.resolveConflict(entity.entityType, entity.entityId, resolution)
        : await target.resolveConflict(entity, resolution);
    await emitStatus();
    if (typeof backend.startAutomaticSync === 'function') backend.startAutomaticSync();
    else scheduleSync();
    return result;
}
