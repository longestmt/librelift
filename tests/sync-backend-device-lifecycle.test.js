import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { ALL_SYNC_STORE_NAMES } from '@libresync/client';
import { MemoryRelay } from '@libresync/testkit';

globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

const dbModule = await import('../src/data/db.js');
const { createLibreLiftSyncBackend } = await import('../src/data/sync-backend.js');

function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function reset() {
    dbModule.configureSyncRecorder(null);
    dbModule.closeDatabase();
    await requestResult(indexedDB.deleteDatabase('librelift'));
}

class RelayTransport {
    constructor(relay) {
        this.relay = relay;
        this.session = null;
    }

    async createVault(request) {
        this.session = await this.relay.createVault(request);
        return this.session;
    }

    async consumeInvitation(request) {
        this.session = await this.relay.consumeInvitation(request);
        return this.session;
    }

    push(_authorization, envelopes) {
        return this.relay.push(this.session, envelopes);
    }

    async pull(_authorization, continuationToken, limit) {
        const page = await this.relay.pull(this.session, continuationToken, limit);
        return {
            envelopes: page.envelopes,
            continuationToken: page.continuation,
            hasMore: page.hasMore,
        };
    }

    async createInvitation(_authorization, ttlSeconds) {
        const invitation = await this.relay.createInvitation(this.session, ttlSeconds * 1000);
        return {
            invitationToken: invitation.invitationToken,
            expiresAt: invitation.expiresAt,
        };
    }

    listDevices() {
        return this.relay.listDevices(this.session);
    }

    revokeDevice(_authorization, deviceId) {
        return this.relay.revokeDevice(this.session, deviceId);
    }

    deleteVault(_authorization, confirmation) {
        return this.relay.deleteVault(this.session, confirmation);
    }
}

beforeEach(reset);
afterEach(reset);

test('explicit disconnect rotates identity so the same vault can be joined again', async () => {
    const relay = new MemoryRelay();
    const transport = new RelayTransport(relay);
    const rotatedId = 'device-after-explicit-disconnect';
    const backend = await createLibreLiftSyncBackend({
        transportFactory: () => transport,
        createDeviceId: () => rotatedId,
        createSafetyBackup: async () => ({ verified: true }),
    });

    await backend.createVault({
        consent: true,
        serverUrl: 'http://127.0.0.1:8787',
        deviceLabel: 'LibreLift test device',
    });
    const beforeDisconnect = await backend.getStatus();
    const invitation = await backend.createInvitation({ ttlSeconds: 600 });
    await backend.disconnect();
    const disconnected = await backend.getStatus();
    assert.equal(disconnected.connected, false);
    assert.notEqual(disconnected.deviceId, beforeDisconnect.deviceId);
    assert.equal(disconnected.deviceId, rotatedId);
    assert.equal(await dbModule.getSetting('libresyncDeviceId'), rotatedId);

    await backend.joinVault(invitation.json, {
        consent: true,
        deviceLabel: 'LibreLift rejoined device',
    });
    const rejoined = await backend.getStatus();
    assert.equal(rejoined.connected, true);
    assert.equal(rejoined.vaultId, beforeDisconnect.vaultId);
    assert.equal(rejoined.deviceId, rotatedId);
    assert.deepEqual(
        (await backend.listDevices()).map(device => device.deviceId).sort(),
        [beforeDisconnect.deviceId, rotatedId].sort()
    );

    // Reloading during the new registered lifecycle reuses the rotated ID and
    // therefore keeps operation dots aligned with the persisted credential.
    const reloaded = await createLibreLiftSyncBackend({
        transportFactory: () => transport,
        createSafetyBackup: async () => ({ verified: true }),
    });
    assert.equal((await reloaded.getStatus()).deviceId, rotatedId);

    dbModule.configureSyncRecorder(input => backend.recordLocalOperation(input));
    await dbModule.put('exercises', { id: 'relay-preserved-exercise', name: 'Relay copy' });
    await dbModule.setSetting('githubPAT', 'local-gist-secret');
    await dbModule.setSetting('futureUnknownCredential', 'local-future-secret');
    await dbModule.persistSafetySnapshot({
        filename: 'before-local-wipe.json',
        serialized: '{"checkpoint":true}',
    });
    await backend.sync();
    const relayBeforeWipe = relay.inspectVault(rejoined.vaultId);
    assert.equal(relayBeforeWipe.operationCount, 1);

    // This is the UI's local-wipe sequence. Disconnect changes only local
    // credential/state; clearing then removes every remaining local store.
    // The original instance represents the tab that was unloaded above. Use
    // the reloaded instance for the user-initiated disconnect so there is only
    // one live lifecycle owner for this registered device.
    await reloaded.disconnect();
    await dbModule.clearThisDeviceData();
    assert.equal(await dbModule.getSetting('githubPAT'), null);
    assert.equal(await dbModule.getSetting('futureUnknownCredential'), null);
    assert.equal(await dbModule.readLatestSafetySnapshot(), null);
    const database = await dbModule.openDB();
    for (const storeName of [
        'exercises', 'plans', 'workouts', 'sets', 'bodyWeight', 'settings',
        ...ALL_SYNC_STORE_NAMES,
    ]) {
        assert.equal(
            (await requestResult(database.transaction(storeName).objectStore(storeName).getAll())).length,
            0,
            `${storeName} is empty after a local-device wipe`
        );
    }
    assert.deepEqual(
        relay.inspectVault(rejoined.vaultId).rawEnvelopeBytes,
        relayBeforeWipe.rawEnvelopeBytes,
        'local wipe leaves encrypted relay operations untouched'
    );
    backend.stopAutomaticSync();
    reloaded.stopAutomaticSync();
});
