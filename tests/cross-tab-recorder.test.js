import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import {
    IndexedDbSecretStorage,
    LibreSyncClient,
} from '@libresync/client';

globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

const dbModule = await import('../src/data/db.js');
const { applyMaterializedEntities } = await import('../src/data/sync-schema.js');
const { registerSyncBackend } = await import('../src/data/sync.js');

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

after(reset);

function sharedClient(db, transport) {
    return new LibreSyncClient({
        applicationId: 'org.libresuite.librelift',
        appSchemaVersion: 1,
        deviceId: 'shared-browser-device',
        deviceLabel: 'Shared browser',
        db,
        domainStores: ['exercises', 'plans', 'workouts', 'sets', 'bodyWeight', 'settings'],
        applyMaterialized: applyMaterializedEntities,
        secretStorage: new IndexedDbSecretStorage(db, 'cross-tab-test'),
        transportFactory: () => transport,
        readLocalEntities: async () => [],
    });
}

test('recorder observes a vault connected by another already-open tab', async () => {
    await reset();
    const db = await dbModule.openDB();
    const transport = {
        serverUrl: 'http://127.0.0.1:8787',
        async createVault() {
            return { vaultId: 'shared-vault', credential: 'high-entropy-test-credential' };
        },
        async deleteVault() {},
    };
    // Tab B is constructed and registers its transaction recorder while the
    // shared app database is still disconnected.
    const tabB = sharedClient(db, transport);
    registerSyncBackend({
        async recordLocalOperation(input) {
            const result = await tabB.recordLocalOperation(input);
            if (!result) return null;
            await applyMaterializedEntities({
                transaction: input.transaction,
                entities: result.projections,
                operation: result.operation,
                source: 'local',
            });
            return result.operation;
        },
        startAutomaticSync() {},
    });

    await dbModule.put('exercises', { id: 'before-connect', name: 'Local only for now' });
    assert.equal(
        (await requestResult(db.transaction('libresync_outbox').objectStore('libresync_outbox').getAll())).length,
        0,
        'disconnected recording returns null without orphaned causal metadata'
    );

    // Tab A connects after Tab B was initialized. No facade re-registration in
    // Tab B occurs; its next transaction must still see the shared connection.
    const tabA = sharedClient(db, transport);
    await tabA.createVault({ serverUrl: transport.serverUrl, bootstrap: false });
    await dbModule.put('exercises', { id: 'after-connect', name: 'Must enter shared outbox' });
    const outbox = await requestResult(
        db.transaction('libresync_outbox').objectStore('libresync_outbox').getAll()
    );
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].operation.changes[0].entityId, 'after-connect');
});
