import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

const dbModule = await import('../src/data/db.js');
const {
    exportSafetySnapshot,
    importData,
} = await import('../src/data/io.js');
const { restoreFromGist } = await import('../src/data/gist-backup.js');
const { pullFromWebDav } = await import('../src/data/webdav.js');

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

function replacementBackup() {
    return {
        version: 2,
        exportedAt: '2026-09-01T12:00:00.000Z',
        stores: {
            exercises: [{ id: 'replacement-exercise', name: 'Replacement' }],
            plans: [],
            workouts: [],
            sets: [],
            bodyWeight: [],
            settings: [{ key: 'theme', value: 'light' }],
        },
    };
}

beforeEach(reset);
afterEach(reset);

test('safety export verifies exact device-local and portable read-backs without secrets', async () => {
    await dbModule.openDB();
    await dbModule.put('exercises', { id: 'exercise-a', name: 'Press' });
    await dbModule.setSetting('theme', 'dark');
    await dbModule.setSetting('githubPAT', 'github-secret-sentinel');
    await dbModule.setSetting('futureProviderCredential', 'unknown-secret-sentinel');

    const database = await dbModule.openDB();
    const syncTransaction = database.transaction('libresync_state', 'readwrite');
    syncTransaction.objectStore('libresync_state').put({
        key: 'connection-secret-sentinel',
        value: 'relay-credential-sentinel',
    });
    await dbModule.transactionDone(syncTransaction);

    let portableBytes = null;
    const result = await exportSafetySnapshot({
        download() {},
        writePortableSnapshot: async ({ serialized }) => {
            portableBytes = serialized;
            return serialized;
        },
    });
    assert.equal(result.verified, true);
    assert.equal(result.portable, true);

    const persisted = await dbModule.readLatestSafetySnapshot();
    assert.equal(persisted.serialized, portableBytes);
    const parsed = JSON.parse(persisted.serialized);
    assert.deepEqual(parsed.stores.settings.map(setting => setting.key), ['theme']);
    for (const sentinel of [
        'github-secret-sentinel',
        'unknown-secret-sentinel',
        'relay-credential-sentinel',
        'connection-secret-sentinel',
        'libresync_state',
    ]) assert.equal(persisted.serialized.includes(sentinel), false);
});

test('safety export never reports verified after a failed exact read-back', async () => {
    await dbModule.openDB();
    let portableWriteStarted = false;
    await assert.rejects(
        exportSafetySnapshot({
            persistSnapshot: async ({ filename, serialized }) => ({
                filename,
                serialized: `${serialized} `,
            }),
            download() {},
            writePortableSnapshot: async ({ serialized }) => {
                portableWriteStarted = true;
                return serialized;
            },
        }),
        /exact persisted read-back/
    );
    assert.equal(portableWriteStarted, false);

    await assert.rejects(
        exportSafetySnapshot({
            download() {},
            writePortableSnapshot: async ({ serialized }) => `${serialized}\n`,
        }),
        /portable safety-backup file failed exact read-back/
    );
});

test('portable, Gist, and WebDAV replacement all stop when safety verification fails', async () => {
    await dbModule.openDB();
    await dbModule.put('exercises', { id: 'existing-exercise', name: 'Keep me' });
    const data = replacementBackup();
    const failedSnapshot = async () => ({ verified: false });
    let imports = 0;
    const importer = async () => { imports += 1; };

    await assert.rejects(
        importData(null, false, {
            readJson: async () => data,
            createSafetySnapshot: failedSnapshot,
            importer,
        }),
        /could not be verified/
    );
    await assert.rejects(
        restoreFromGist({
            pull: async () => data,
            createSafetySnapshot: failedSnapshot,
            importer,
        }),
        /could not be verified/
    );

    await dbModule.setSetting('webdavUrl', 'https://dav.example.test/backups/');
    await dbModule.setSetting('webdavUsername', 'lifter');
    await dbModule.setSetting('webdavPassword', 'webdav-secret');
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        async json() { return data; },
    });
    try {
        await assert.rejects(
            pullFromWebDav({ createSafetySnapshot: failedSnapshot, importer }),
            /could not be verified/
        );
    } finally {
        globalThis.fetch = originalFetch;
    }

    assert.equal(imports, 0);
    assert.equal((await dbModule.getById('exercises', 'existing-exercise')).name, 'Keep me');
    assert.equal(await dbModule.getById('exercises', 'replacement-exercise'), null);
});
