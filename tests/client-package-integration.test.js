import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import {
    ALL_SYNC_STORE_NAMES,
    applyRemoteOperation,
    recordLocalOperation,
} from '@libresync/client';
import { contextForHeads } from '@libresync/protocol';

globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

const dbModule = await import('../src/data/db.js');
const { applyMaterializedEntities } = await import('../src/data/sync-schema.js');

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

async function raw(storeName) {
    const db = await dbModule.openDB();
    return requestResult(db.transaction(storeName).objectStore(storeName).getAll());
}

beforeEach(reset);
afterEach(reset);

test('actual client records causality, applies remote data without echo, and resolves conflicts', async () => {
    await dbModule.openDB();
    const localRecorder = ({ transaction, changes }) => recordLocalOperation({
        transaction,
        changes,
        deviceId: 'device-a',
        appSchemaVersion: 1,
    });
    dbModule.configureSyncRecorder(localRecorder);
    await dbModule.put('exercises', { id: 'exercise-a', name: 'Local Press' });

    let outbox = await raw('libresync_outbox');
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].operation.dot.deviceId, 'device-a');
    assert.equal(outbox[0].operation.dot.counter, 1);
    assert.equal((await raw('libresync_entity_heads')).length, 1);

    // A concurrent remote edit is applied by the package directly to the app
    // transaction. The adapter writes the projection without invoking db.put.
    dbModule.configureSyncRecorder(null);
    const remoteOperation = {
        protocolVersion: 1,
        appSchemaVersion: 1,
        opId: 'remote-operation-1',
        dot: { deviceId: 'device-b', counter: 1 },
        changes: [{
            entityType: 'exercises',
            entityId: 'exercise-a',
            context: {},
            kind: 'put',
            payload: { id: 'exercise-a', name: 'Remote Press' },
        }],
        authoredAt: '2026-09-01T12:00:00.000Z',
    };
    const db = await dbModule.openDB();
    const transaction = db.transaction(['exercises', ...ALL_SYNC_STORE_NAMES], 'readwrite');
    const completion = dbModule.transactionDone(transaction);
    const applied = await applyRemoteOperation({
        transaction,
        operation: remoteOperation,
        applyMaterialized: applyMaterializedEntities,
    });
    await completion;
    assert.equal(applied.status, 'applied');
    assert.equal((await raw('libresync_conflicts')).length, 1);
    assert.equal((await raw('libresync_inbox')).length, 1);
    assert.equal((await raw('libresync_outbox')).length, 1, 'remote apply creates no echo');

    // A resolution explicitly observes every alternative and clears the
    // conflict while remaining a normal uploadable local operation.
    const headsRecord = (await raw('libresync_entity_heads'))[0];
    dbModule.configureSyncRecorder(({ transaction: tx, changes }) => recordLocalOperation({
        transaction: tx,
        changes: changes.map(change => ({
            ...change,
            context: contextForHeads(headsRecord),
        })),
        deviceId: 'device-a',
        appSchemaVersion: 1,
    }));
    await dbModule.put('exercises', { id: 'exercise-a', name: 'Merged Press' });
    assert.equal((await raw('libresync_conflicts')).length, 0);
    outbox = await raw('libresync_outbox');
    assert.equal(outbox.length, 2);
    assert.deepEqual(
        outbox.map(record => record.operation.dot.counter).sort((a, b) => a - b),
        [1, 2]
    );
});
