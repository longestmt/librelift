import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import {
    ALL_SYNC_STORE_NAMES,
    applyRemoteBatch,
    installLibreSyncStores,
    recordLocalOperation,
} from '@libresync/client';
import {
    contextForHeads,
    decryptEnvelope,
    encryptOperation,
    entityKey,
    generateEncodedVaultSecret,
} from '@libresync/protocol';
import { MemoryRelay, MemoryTransport } from '@libresync/testkit';

import { applyMaterializedEntities } from '../src/data/sync-schema.js';
import {
    LIBRELIFT_APP_ID,
    SYNCED_SETTING_KEYS,
} from '../src/data/sync-config.js';

globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

const DOMAIN_STORES = ['exercises', 'plans', 'workouts', 'sets', 'bodyWeight', 'settings'];

function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
        transaction.onerror = () => reject(transaction.error || new Error('Transaction failed'));
    });
}

async function openProfile(name, deviceId) {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('exercises', { keyPath: 'id' });
        db.createObjectStore('plans', { keyPath: 'id' });
        const workouts = db.createObjectStore('workouts', { keyPath: 'id' });
        workouts.createIndex('date', 'date');
        workouts.createIndex('planId', 'planId');
        const sets = db.createObjectStore('sets', { keyPath: 'id' });
        sets.createIndex('workoutId', 'workoutId');
        sets.createIndex('exerciseId', 'exerciseId');
        const weights = db.createObjectStore('bodyWeight', { keyPath: 'id' });
        weights.createIndex('date', 'date');
        db.createObjectStore('settings', { keyPath: 'key' });
        installLibreSyncStores(db, request.transaction);
    };
    return {
        db: await requestResult(request),
        deviceId,
        continuation: undefined,
    };
}

async function deleteProfile(profile, name) {
    profile.db.close();
    await requestResult(indexedDB.deleteDatabase(name));
}

async function raw(profile, storeName) {
    return requestResult(profile.db.transaction(storeName).objectStore(storeName).getAll());
}

function syncPayload(record) {
    const value = structuredClone(record);
    delete value.updatedAt;
    delete value.deleted;
    return value;
}

async function localOperation(profile, writes, changes) {
    const domainStores = [...new Set(writes.map(write => write.store))];
    const transaction = profile.db.transaction(
        [...new Set([...domainStores, ...ALL_SYNC_STORE_NAMES])],
        'readwrite'
    );
    const completion = transactionDone(transaction);
    for (const write of writes) {
        const store = transaction.objectStore(write.store);
        if (write.deleteKey !== undefined) store.delete(write.deleteKey);
        else store.put(write.record);
    }
    const operation = await recordLocalOperation({
        transaction,
        deviceId: profile.deviceId,
        appSchemaVersion: 1,
        changes,
    });
    await completion;
    return operation;
}

async function persistEnvelopes(profile, vaultSecret, vaultId) {
    const records = await raw(profile, 'libresync_outbox');
    const envelopes = [];
    for (const record of records) {
        let envelope = record.envelope;
        if (!envelope) {
            envelope = await encryptOperation(record.operation, vaultSecret, {
                vaultId,
                applicationId: LIBRELIFT_APP_ID,
            });
            const transaction = profile.db.transaction('libresync_outbox', 'readwrite');
            const completion = transactionDone(transaction);
            transaction.objectStore('libresync_outbox').put({
                ...record,
                envelope,
                status: 'encrypted',
            });
            await completion;
        }
        envelopes.push(envelope);
    }
    return envelopes;
}

async function pushAll(profile, transport, vaultSecret, vaultId) {
    const envelopes = await persistEnvelopes(profile, vaultSecret, vaultId);
    if (envelopes.length) await transport.push(envelopes);
    return envelopes;
}

async function pullAll(profile, transport, vaultSecret, { limit = 100 } = {}) {
    let applied = 0;
    let quarantined = 0;
    while (true) {
        const page = await transport.pull(profile.continuation, limit);
        const items = await Promise.all(page.envelopes.map(async envelope => ({
            envelope,
            operation: await decryptEnvelope(envelope, vaultSecret, {
                vaultId: transport.session.vaultId,
                applicationId: LIBRELIFT_APP_ID,
            }),
        })));
        const transaction = profile.db.transaction(
            [...DOMAIN_STORES, ...ALL_SYNC_STORE_NAMES],
            'readwrite'
        );
        const completion = transactionDone(transaction);
        const result = await applyRemoteBatch({
            transaction,
            items,
            continuationToken: page.continuation,
            applyMaterialized: applyMaterializedEntities,
        });
        await completion;
        profile.continuation = page.continuation;
        applied += result.applied;
        quarantined += result.quarantined;
        if (!page.hasMore) return { applied, quarantined };
    }
}

async function recordById(profile, storeName, id) {
    return requestResult(profile.db.transaction(storeName).objectStore(storeName).get(id));
}

test('two encrypted LibreLift profiles converge across every synchronized family', async () => {
    const profileAName = `librelift-profile-a-${crypto.randomUUID()}`;
    const profileBName = `librelift-profile-b-${crypto.randomUUID()}`;
    const profileA = await openProfile(profileAName, 'device-a');
    const profileB = await openProfile(profileBName, 'device-b');
    const relay = new MemoryRelay();
    const transportA = new MemoryTransport(relay);
    const transportB = new MemoryTransport(relay);
    const vaultSecret = generateEncodedVaultSecret();

    try {
        const sessionA = await transportA.createVault({
            applicationId: LIBRELIFT_APP_ID,
            deviceId: profileA.deviceId,
            deviceLabel: 'Profile A',
        });
        const vaultId = sessionA.vaultId;
        const baseTime = '2026-09-01T10:00:00.000Z';
        const exercise = {
            id: 'exercise-sentinel',
            name: 'PRIVATE EXERCISE SENTINEL',
            createdAt: baseTime,
            updatedAt: baseTime,
            deleted: false,
        };
        const initialPlan = {
            id: 'plan-sentinel',
            name: 'PRIVATE PLAN SENTINEL',
            currentDayIndex: 0,
            days: [
                { dayId: 'day-a', name: 'A', exercises: [{
                    planExerciseId: 'plan-row-a',
                    exerciseId: exercise.id,
                    sets: 2,
                    reps: 5,
                }] },
                { dayId: 'day-b', name: 'B', exercises: [] },
            ],
            createdAt: baseTime,
            updatedAt: baseTime,
            deleted: false,
        };
        const approvedSettings = {
            unit: 'lb',
            barWeight: 45,
            restTimer: 90,
            autoPauseMin: 15,
            maxWorkoutMin: 120,
            distanceUnit: 'mi',
            plateInventory: { 45: 4, 25: 2 },
            theme: 'dark',
        };
        assert.deepEqual(new Set(Object.keys(approvedSettings)), SYNCED_SETTING_KEYS);

        const settingWrites = Object.entries(approvedSettings).map(([key, value]) => ({
            store: 'settings',
            record: { key, value, updatedAt: baseTime },
        }));
        await localOperation(
            profileA,
            [
                { store: 'exercises', record: exercise },
                { store: 'plans', record: initialPlan },
                ...settingWrites,
                { store: 'settings', record: { key: 'githubPAT', value: 'LOCAL CREDENTIAL SENTINEL' } },
                { store: 'settings', record: { key: 'lastUsedPlanId', value: initialPlan.id } },
            ],
            [
                { entityType: 'exercises', entityId: exercise.id, kind: 'put', payload: syncPayload(exercise) },
                { entityType: 'plans', entityId: initialPlan.id, kind: 'put', payload: syncPayload(initialPlan) },
                ...settingWrites.map(({ record }) => ({
                    entityType: 'settings', entityId: record.key, kind: 'put', payload: syncPayload(record),
                })),
            ]
        );

        const progressedPlan = { ...initialPlan, currentDayIndex: 1, updatedAt: '2026-09-01T11:00:00.000Z' };
        const workout = {
            id: 'workout-sentinel',
            date: '2026-09-01',
            planId: initialPlan.id,
            dayName: 'A',
            notes: 'PRIVATE WORKOUT SENTINEL',
            createdAt: baseTime,
            updatedAt: baseTime,
            deleted: false,
        };
        const sets = [1, 2].map(number => ({
            id: `set-${number}`,
            workoutId: workout.id,
            exerciseId: exercise.id,
            setNumber: number,
            weight: 200,
            reps: 5,
            completed: true,
            createdAt: baseTime,
            updatedAt: baseTime,
            deleted: false,
        }));
        const firstWeight = {
            id: 'weight-a', date: '2026-09-01', value: 180, unit: 'lb',
            createdAt: baseTime, updatedAt: baseTime, deleted: false,
        };
        await localOperation(
            profileA,
            [
                { store: 'workouts', record: workout },
                ...sets.map(record => ({ store: 'sets', record })),
                { store: 'plans', record: progressedPlan },
                { store: 'bodyWeight', record: firstWeight },
            ],
            [
                { entityType: 'workouts', entityId: workout.id, kind: 'put', payload: syncPayload(workout) },
                ...sets.map(record => ({ entityType: 'sets', entityId: record.id, kind: 'put', payload: syncPayload(record) })),
                { entityType: 'plans', entityId: progressedPlan.id, kind: 'put', payload: syncPayload(progressedPlan) },
                { entityType: 'bodyWeight', entityId: firstWeight.id, kind: 'put', payload: syncPayload(firstWeight) },
            ]
        );
        const secondWeight = {
            id: 'weight-b', date: '2026-09-01', value: 181, unit: 'lb',
            createdAt: baseTime, updatedAt: baseTime, deleted: false,
        };
        await localOperation(
            profileA,
            [{ store: 'bodyWeight', record: secondWeight }],
            [{ entityType: 'bodyWeight', entityId: secondWeight.id, kind: 'put', payload: syncPayload(secondWeight) }]
        );

        const firstEnvelopes = await pushAll(profileA, transportA, vaultSecret, vaultId);
        const exactRetryBytes = firstEnvelopes.map(JSON.stringify);
        const retry = await transportA.push(firstEnvelopes);
        assert.equal(retry.every(result => result.duplicate), true);
        assert.deepEqual(
            (await persistEnvelopes(profileA, vaultSecret, vaultId)).map(JSON.stringify),
            exactRetryBytes,
            'retries reuse the exact persisted nonce and ciphertext'
        );

        const relayBytes = relay.inspectVault(vaultId).rawEnvelopeBytes.join('\n');
        for (const sentinel of [
            'PRIVATE EXERCISE SENTINEL',
            'PRIVATE PLAN SENTINEL',
            'PRIVATE WORKOUT SENTINEL',
            'LOCAL CREDENTIAL SENTINEL',
        ]) {
            assert.equal(relayBytes.includes(sentinel), false);
        }

        const invitation = await transportA.createInvitation(10 * 60 * 1000);
        await transportB.joinVault({
            vaultId,
            applicationId: LIBRELIFT_APP_ID,
            invitationToken: invitation.invitationToken,
            deviceId: profileB.deviceId,
            deviceLabel: 'Profile B',
        });
        assert.equal((await transportA.listDevices()).length, 2);
        const initialPull = await pullAll(profileB, transportB, vaultSecret, { limit: 1 });
        assert.equal(initialPull.quarantined, 0);
        assert.equal((await raw(profileB, 'exercises')).length, 1);
        assert.equal((await raw(profileB, 'workouts')).filter(record => !record.deleted).length, 1);
        assert.equal((await raw(profileB, 'sets')).filter(record => !record.deleted).length, 2);
        assert.equal((await raw(profileB, 'bodyWeight')).filter(record => !record.deleted).length, 2);
        assert.equal((await recordById(profileB, 'plans', initialPlan.id)).currentDayIndex, 1);
        assert.deepEqual(
            Object.fromEntries((await raw(profileB, 'settings'))
                .filter(record => SYNCED_SETTING_KEYS.has(record.key))
                .map(record => [record.key, record.value])),
            approvedSettings
        );
        assert.equal(await recordById(profileB, 'settings', 'githubPAT'), undefined);
        assert.equal((await raw(profileB, 'libresync_outbox')).length, 0, 'remote apply has no echo');

        // Both offline replicas edit the same stable plan ID without observing
        // the other dot. Pulling later retains both alternatives deterministically.
        const planA = { ...(await recordById(profileA, 'plans', initialPlan.id)), name: 'Plan A edit' };
        const planB = { ...(await recordById(profileB, 'plans', initialPlan.id)), name: 'Plan B edit' };
        await localOperation(
            profileA,
            [{ store: 'plans', record: planA }],
            [{ entityType: 'plans', entityId: planA.id, kind: 'put', payload: syncPayload(planA) }]
        );
        await localOperation(
            profileB,
            [{ store: 'plans', record: planB }],
            [{ entityType: 'plans', entityId: planB.id, kind: 'put', payload: syncPayload(planB) }]
        );
        await pushAll(profileA, transportA, vaultSecret, vaultId);
        await pushAll(profileB, transportB, vaultSecret, vaultId);
        await pullAll(profileA, transportA, vaultSecret);
        await pullAll(profileB, transportB, vaultSecret);
        const [conflictA] = await raw(profileA, 'libresync_conflicts');
        const [conflictB] = await raw(profileB, 'libresync_conflicts');
        assert.equal(conflictA.entityKey, conflictB.entityKey);
        assert.deepEqual(conflictA.projection, conflictB.projection);
        assert.equal(conflictA.projection.alternatives.length, 2);
        assert.equal(
            (await recordById(profileA, 'plans', initialPlan.id)).name,
            (await recordById(profileB, 'plans', initialPlan.id)).name
        );

        const heads = await recordById(
            profileB,
            'libresync_entity_heads',
            entityKey('plans', initialPlan.id)
        );
        const mergedPlan = {
            ...(await recordById(profileB, 'plans', initialPlan.id)),
            name: 'Intentional merged plan',
        };
        await localOperation(
            profileB,
            [{ store: 'plans', record: mergedPlan }],
            [{
                entityType: 'plans', entityId: mergedPlan.id, kind: 'put',
                payload: syncPayload(mergedPlan), context: contextForHeads(heads),
            }]
        );
        await pushAll(profileB, transportB, vaultSecret, vaultId);
        await pullAll(profileA, transportA, vaultSecret);
        await pullAll(profileB, transportB, vaultSecret);
        assert.equal((await raw(profileA, 'libresync_conflicts')).length, 0);
        assert.equal((await recordById(profileA, 'plans', initialPlan.id)).name, 'Intentional merged plan');

        // Workout and all child sets are one delete operation and therefore one
        // remote IndexedDB transaction.
        const deleteTime = '2026-09-01T13:00:00.000Z';
        await localOperation(
            profileA,
            [
                { store: 'workouts', record: { id: workout.id, deleted: true, updatedAt: deleteTime } },
                ...sets.map(record => ({
                    store: 'sets',
                    record: { id: record.id, deleted: true, updatedAt: deleteTime },
                })),
            ],
            [
                { entityType: 'workouts', entityId: workout.id, kind: 'delete' },
                ...sets.map(record => ({ entityType: 'sets', entityId: record.id, kind: 'delete' })),
            ]
        );
        await pushAll(profileA, transportA, vaultSecret, vaultId);
        await pullAll(profileB, transportB, vaultSecret);
        assert.equal((await recordById(profileB, 'workouts', workout.id)).deleted, true);
        assert.equal(
            (await raw(profileB, 'sets')).filter(record => !record.deleted && record.workoutId === workout.id).length,
            0
        );

        const decryptedTypes = new Set();
        for (const bytes of relay.inspectVault(vaultId).rawEnvelopeBytes) {
            const envelope = JSON.parse(bytes);
            const operation = await decryptEnvelope(envelope, vaultSecret, {
                vaultId,
                applicationId: LIBRELIFT_APP_ID,
            });
            for (const change of operation.changes) decryptedTypes.add(change.entityType);
        }
        assert.deepEqual(
            decryptedTypes,
            new Set(['exercises', 'plans', 'workouts', 'sets', 'bodyWeight', 'settings'])
        );
        assert.equal(decryptedTypes.has('activeWorkout'), false);
    } finally {
        await deleteProfile(profileA, profileAName);
        await deleteProfile(profileB, profileBName);
    }
});
