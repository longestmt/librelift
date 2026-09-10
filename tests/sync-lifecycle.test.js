import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createInvitation,
    createVault,
    getStatus,
    listConflicts,
    registerSyncBackend,
    resolveConflict,
    sync,
} from '../src/data/sync.js';

test('LibreLift sync facade delegates device and conflict workflows', async () => {
    const calls = [];
    const backend = {
        recordLocalOperation() {},
        async getStatus() { return { connected: true, pendingCount: 2 }; },
        async createVault(options) { calls.push(['createVault', options]); return { vaultId: 'v1' }; },
        async createInvitation(options) { calls.push(['invite', options]); return { uri: 'libresync://pair' }; },
        async listConflicts() { return [{ entityKey: 'plans:p1' }]; },
        async resolveConflict(key, resolution) { calls.push(['resolve', key, resolution]); },
        startAutomaticSync() {},
    };
    registerSyncBackend(backend);

    assert.equal((await getStatus()).pendingCount, 2);
    assert.deepEqual(await createVault({ serverUrl: 'https://sync.example' }), { vaultId: 'v1' });
    assert.equal((await createInvitation({ ttlSeconds: 300 })).uri, 'libresync://pair');
    assert.deepEqual(await listConflicts(), [{ entityKey: 'plans:p1' }]);
    await resolveConflict('plans:p1', { headId: 'head-a' });
    assert.deepEqual(calls, [
        ['createVault', { serverUrl: 'https://sync.example' }],
        ['invite', { ttlSeconds: 300 }],
        ['resolve', 'plans:p1', { headId: 'head-a' }],
    ]);
});

test('sync facade coalesces same-tab calls without acquiring its own cross-tab lock', async () => {
    const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {
            locks: {
                request() {
                    throw new Error('the app facade must leave cross-tab locking to LibreSyncClient');
                },
            },
        },
    });
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem() {
                throw new Error('the app facade must not use a localStorage lease');
            },
        },
    });

    let releaseSync;
    const gate = new Promise(resolve => { releaseSync = resolve; });
    let syncCalls = 0;
    registerSyncBackend({
        recordLocalOperation() {},
        async getStatus() { return { connected: true }; },
        async sync() {
            syncCalls += 1;
            await gate;
            return { pushed: 1, pulled: 2 };
        },
        startAutomaticSync() {},
    });

    try {
        const first = sync();
        const second = sync();
        await Promise.resolve();
        assert.equal(syncCalls, 1);
        releaseSync();
        assert.deepEqual(await first, { pushed: 1, pulled: 2 });
        assert.deepEqual(await second, { pushed: 1, pulled: 2 });
        assert.equal(syncCalls, 1);
    } finally {
        if (navigatorDescriptor) {
            Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
        } else {
            delete globalThis.navigator;
        }
        if (storageDescriptor) {
            Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
        } else {
            delete globalThis.localStorage;
        }
    }
});
