import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import {
    ALL_SYNC_STORE_NAMES,
    LibreSyncClient,
    MemorySecretStorage,
    installLibreSyncStores,
} from '@libresync/client';
import { decryptEnvelope, encryptOperation } from '@libresync/protocol';
import { MemoryRelay } from '@libresync/testkit';

import { applyMaterializedEntities } from '../src/data/sync-schema.js';
import { LIBRELIFT_APP_ID, SYNCED_SETTING_KEYS } from '../src/data/sync-config.js';
import { readSynchronizedLocalEntities } from '../src/data/sync-local.js';

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
        for (const storeName of DOMAIN_STORES) {
            db.createObjectStore(storeName, { keyPath: storeName === 'settings' ? 'key' : 'id' });
        }
        installLibreSyncStores(db, request.transaction);
    };
    return { db: await requestResult(request), deviceId, client: null };
}

async function records(profile, storeName) {
    return requestResult(profile.db.transaction(storeName).objectStore(storeName).getAll());
}

async function recordById(profile, storeName, id) {
    return requestResult(profile.db.transaction(storeName).objectStore(storeName).get(id));
}

function payload(record) {
    const copy = structuredClone(record);
    delete copy.updatedAt;
    delete copy.deleted;
    return copy;
}

class RelayClientTransport {
    constructor(relay) {
        this.relay = relay;
        this.serverUrl = 'http://127.0.0.1:8787';
        this.session = null;
        this.failAfterPush = false;
    }

    async createVault(request) {
        this.session = await this.relay.createVault(request);
        return { vaultId: this.session.vaultId, credential: this.session.credential };
    }

    async consumeInvitation(request) {
        this.session = await this.relay.consumeInvitation(request);
        return { vaultId: this.session.vaultId, credential: this.session.credential };
    }

    async push(_authorization, envelopes) {
        const result = await this.relay.push(this.session, envelopes);
        if (this.failAfterPush) {
            this.failAfterPush = false;
            throw new Error('simulated lost response after relay commit');
        }
        return result;
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
        const invitation = await this.relay.createInvitation(
            this.session,
            ttlSeconds === undefined ? undefined : ttlSeconds * 1000
        );
        return {
            invitationToken: invitation.invitationToken,
            expiresAt: invitation.expiresAt,
        };
    }

    async listDevices() {
        const devices = await this.relay.listDevices(this.session);
        return devices.map(device => ({
            ...device,
            current: device.deviceId === this.session.deviceId,
        }));
    }

    revokeDevice(_authorization, deviceId) {
        return this.relay.revokeDevice(this.session, deviceId);
    }

    deleteVault(_authorization, confirmation) {
        return this.relay.deleteVault(this.session, confirmation);
    }
}

function attachClient(profile, transport, options = {}) {
    const secretStorage = new MemorySecretStorage();
    profile.client = new LibreSyncClient({
        applicationId: LIBRELIFT_APP_ID,
        appSchemaVersion: 1,
        deviceId: profile.deviceId,
        deviceLabel: profile.deviceId,
        db: profile.db,
        domainStores: DOMAIN_STORES,
        applyMaterialized: applyMaterializedEntities,
        secretStorage,
        transportFactory: () => transport,
        readLocalEntities: options.readLocalEntities || (async () => []),
        createSafetyBackup: options.createSafetyBackup || (async () => ({ verified: true })),
        pullPageSize: 1,
    });
    return secretStorage;
}

async function localOperation(profile, writes, changes) {
    const stores = [...new Set([...writes.map(write => write.store), ...ALL_SYNC_STORE_NAMES])];
    const transaction = profile.db.transaction(stores, 'readwrite');
    const completion = transactionDone(transaction);
    for (const write of writes) {
        transaction.objectStore(write.store).put(write.record);
    }
    const result = await profile.client.recordLocalOperation({ transaction, changes });
    assert.ok(result, 'connected local mutation records a LibreSync operation');
    await applyMaterializedEntities({
        transaction,
        entities: result.projections,
        operation: result.operation,
        source: 'local',
    });
    await completion;
    return result.operation;
}

test('actual lifecycle clients synchronize complete LibreLift profiles through an encrypted relay', async () => {
    const profileAName = `librelift-high-a-${crypto.randomUUID()}`;
    const profileBName = `librelift-high-b-${crypto.randomUUID()}`;
    const rejectedProfileName = `librelift-high-rejected-${crypto.randomUUID()}`;
    const deletedProfileName = `librelift-high-deleted-${crypto.randomUUID()}`;
    const profileA = await openProfile(profileAName, 'device-a');
    const profileB = await openProfile(profileBName, 'device-b');
    const rejectedProfile = await openProfile(rejectedProfileName, 'device-rejected');
    const deletedProfile = await openProfile(deletedProfileName, 'device-with-local-delete');
    const relay = new MemoryRelay({ maxPageOperations: 1 });
    const transportA = new RelayClientTransport(relay);
    const transportB = new RelayClientTransport(relay);
    const rejectedTransport = new RelayClientTransport(relay);
    const deletedTransport = new RelayClientTransport(relay);
    attachClient(profileA, transportA);
    attachClient(profileB, transportB);
    attachClient(rejectedProfile, rejectedTransport, {
        readLocalEntities: async () => [{
            entityType: 'exercises',
            entityId: 'local-before-join',
            kind: 'put',
            payload: { id: 'local-before-join', name: 'Local before join' },
        }],
        createSafetyBackup: async () => ({ verified: false }),
    });
    attachClient(deletedProfile, deletedTransport, {
        readLocalEntities: () => readSynchronizedLocalEntities(deletedProfile.db),
        createSafetyBackup: async () => ({ verified: true }),
    });

    try {
        const connection = await profileA.client.createVault({
            serverUrl: transportA.serverUrl,
            bootstrap: false,
        });
        const time = '2026-09-01T10:00:00.000Z';
        const exercise = {
            id: 'exercise-private', name: 'PRIVATE EXERCISE SENTINEL',
            createdAt: time, updatedAt: time, deleted: false,
        };
        const plan = {
            id: 'plan-private', name: 'PRIVATE PLAN SENTINEL', currentDayIndex: 0,
            days: [
                { dayId: 'day-a', name: 'A', exercises: [{
                    planExerciseId: 'row-a', exerciseId: exercise.id, sets: 2, reps: 5,
                }] },
                { dayId: 'day-b', name: 'B', exercises: [] },
            ],
            createdAt: time, updatedAt: time, deleted: false,
        };
        const approvedSettings = {
            unit: 'lb', barWeight: 45, restTimer: 90, autoPauseMin: 15,
            maxWorkoutMin: 120, distanceUnit: 'mi', plateInventory: { 45: 4 }, theme: 'dark',
        };
        assert.deepEqual(new Set(Object.keys(approvedSettings)), SYNCED_SETTING_KEYS);
        const settingWrites = Object.entries(approvedSettings).map(([key, value]) => ({
            store: 'settings', record: { key, value, updatedAt: time },
        }));
        await localOperation(profileA, [
            { store: 'exercises', record: exercise },
            { store: 'plans', record: plan },
            ...settingWrites,
            { store: 'settings', record: { key: 'githubPAT', value: 'LOCAL CREDENTIAL SENTINEL' } },
        ], [
            { entityType: 'exercises', entityId: exercise.id, kind: 'put', payload: payload(exercise) },
            { entityType: 'plans', entityId: plan.id, kind: 'put', payload: payload(plan) },
            ...settingWrites.map(({ record }) => ({
                entityType: 'settings', entityId: record.key, kind: 'put', payload: payload(record),
            })),
        ]);

        const progressedPlan = { ...plan, currentDayIndex: 1 };
        const workout = {
            id: 'workout-private', date: '2026-09-01', planId: plan.id, dayName: 'A',
            notes: 'PRIVATE WORKOUT SENTINEL', createdAt: time, updatedAt: time, deleted: false,
        };
        const sets = [1, 2].map(setNumber => ({
            id: `set-${setNumber}`, workoutId: workout.id, exerciseId: exercise.id,
            setNumber, weight: 200, reps: 5, completed: true,
            createdAt: time, updatedAt: time, deleted: false,
        }));
        const weightA = {
            id: 'weight-a', date: '2026-09-01', value: 180, unit: 'lb',
            createdAt: time, updatedAt: time, deleted: false,
        };
        await localOperation(profileA, [
            { store: 'workouts', record: workout },
            ...sets.map(record => ({ store: 'sets', record })),
            { store: 'plans', record: progressedPlan },
            { store: 'bodyWeight', record: weightA },
        ], [
            { entityType: 'workouts', entityId: workout.id, kind: 'put', payload: payload(workout) },
            ...sets.map(record => ({ entityType: 'sets', entityId: record.id, kind: 'put', payload: payload(record) })),
            { entityType: 'plans', entityId: plan.id, kind: 'put', payload: payload(progressedPlan) },
            { entityType: 'bodyWeight', entityId: weightA.id, kind: 'put', payload: payload(weightA) },
        ]);
        const weightB = {
            ...weightA, id: 'weight-b', value: 181,
        };
        await localOperation(
            profileA,
            [{ store: 'bodyWeight', record: weightB }],
            [{ entityType: 'bodyWeight', entityId: weightB.id, kind: 'put', payload: payload(weightB) }]
        );

        // Encryption is persisted before upload. A relay commit whose response
        // is lost retries byte-for-byte and does not duplicate an operation.
        transportA.failAfterPush = true;
        await assert.rejects(profileA.client.sync(), /lost response/);
        const encryptedOutbox = await records(profileA, 'libresync_outbox');
        assert.ok(encryptedOutbox.every(record => record.envelope));
        const persistedEnvelopes = encryptedOutbox
            .map(record => structuredClone(record.envelope))
            .sort((left, right) => left.opId.localeCompare(right.opId));
        const committedBeforeRetry = relay.inspectVault(connection.vaultId).rawEnvelopeBytes;
        assert.deepEqual(
            committedBeforeRetry.map(JSON.parse).sort((left, right) => left.opId.localeCompare(right.opId)),
            persistedEnvelopes
        );
        await profileA.client.sync();
        assert.deepEqual(relay.inspectVault(connection.vaultId).rawEnvelopeBytes, committedBeforeRetry);

        const relayText = relay.inspectVault(connection.vaultId).rawEnvelopeBytes.join('\n');
        for (const sentinel of [
            'PRIVATE EXERCISE SENTINEL', 'PRIVATE PLAN SENTINEL',
            'PRIVATE WORKOUT SENTINEL', 'LOCAL CREDENTIAL SENTINEL',
        ]) assert.equal(relayText.includes(sentinel), false);

        const invitation = await profileA.client.createInvitation(600);
        assert.match(invitation.uri, /^libresync:/);
        await assert.rejects(
            rejectedProfile.client.joinVault(invitation.json),
            /safety backup could not be verified/
        );
        assert.equal(
            (await profileA.client.listDevices()).length,
            1,
            'a failed portable-backup verification does not consume the invitation'
        );
        await profileB.client.joinVault(invitation.json);
        assert.equal((await profileA.client.listDevices()).length, 2);
        assert.equal((await records(profileB, 'exercises')).length, 1);
        assert.equal((await records(profileB, 'workouts')).filter(item => !item.deleted).length, 1);
        assert.equal((await records(profileB, 'sets')).filter(item => !item.deleted).length, 2);
        assert.equal((await records(profileB, 'bodyWeight')).filter(item => !item.deleted).length, 2);
        assert.equal((await recordById(profileB, 'plans', plan.id)).currentDayIndex, 1);
        assert.deepEqual(
            Object.fromEntries((await records(profileB, 'settings'))
                .filter(item => SYNCED_SETTING_KEYS.has(item.key))
                .map(item => [item.key, item.value])),
            approvedSettings
        );
        assert.equal(await recordById(profileB, 'settings', 'githubPAT'), undefined);
        assert.equal((await records(profileB, 'libresync_outbox')).length, 0);

        // A disconnected local tombstone is part of the pre-join snapshot.
        // Same-ID remote live data remains visible, while both alternatives are
        // retained as a normal recoverable delete-versus-edit conflict.
        const localDeleteTransaction = deletedProfile.db.transaction('exercises', 'readwrite');
        const localDeleteCompletion = transactionDone(localDeleteTransaction);
        localDeleteTransaction.objectStore('exercises').put({
            id: exercise.id,
            deleted: true,
            updatedAt: '2026-08-31T12:00:00.000Z',
        });
        await localDeleteCompletion;
        const deletedInvitation = await profileA.client.createInvitation(600);
        await deletedProfile.client.joinVault(deletedInvitation.json);
        assert.equal(
            (await recordById(deletedProfile, 'exercises', exercise.id)).name,
            exercise.name
        );
        const deletedConflict = (await deletedProfile.client.listConflicts('exercises'))
            .find(conflict => conflict.entityId === exercise.id);
        assert.ok(deletedConflict);
        assert.equal(
            deletedConflict.projection.alternatives.some(alternative => alternative.kind === 'delete'),
            true
        );
        const liveAlternative = deletedConflict.projection.alternatives
            .find(alternative => alternative.kind === 'put');
        await deletedProfile.client.resolveConflict('exercises', exercise.id, {
            kind: 'put',
            payload: liveAlternative.payload,
        });
        await deletedProfile.client.sync();
        assert.equal((await deletedProfile.client.listConflicts('exercises')).length, 0);

        // Offline concurrent plan edits remain recoverable and materialize the
        // exact same deterministic projection on each profile.
        const planA = { ...(await recordById(profileA, 'plans', plan.id)), name: 'Plan A edit' };
        const planB = { ...(await recordById(profileB, 'plans', plan.id)), name: 'Plan B edit' };
        await localOperation(profileA, [{ store: 'plans', record: planA }], [
            { entityType: 'plans', entityId: plan.id, kind: 'put', payload: payload(planA) },
        ]);
        await localOperation(profileB, [{ store: 'plans', record: planB }], [
            { entityType: 'plans', entityId: plan.id, kind: 'put', payload: payload(planB) },
        ]);
        await profileA.client.sync();
        await profileB.client.sync();
        await profileA.client.sync();
        const [conflictA] = await profileA.client.listConflicts('plans');
        const [conflictB] = await profileB.client.listConflicts('plans');
        assert.deepEqual(conflictA.projection, conflictB.projection);
        assert.equal(conflictA.projection.alternatives.length, 2);
        assert.equal(
            (await recordById(profileA, 'plans', plan.id)).name,
            (await recordById(profileB, 'plans', plan.id)).name
        );

        await profileB.client.resolveConflict('plans', plan.id, {
            kind: 'put',
            payload: { ...(await recordById(profileB, 'plans', plan.id)), name: 'Intentional merge' },
        });
        await profileB.client.sync();
        await profileA.client.sync();
        assert.equal((await profileA.client.listConflicts()).length, 0);
        assert.equal((await recordById(profileA, 'plans', plan.id)).name, 'Intentional merge');

        const deletedAt = '2026-09-01T13:00:00.000Z';
        await localOperation(profileA, [
            { store: 'workouts', record: { id: workout.id, deleted: true, updatedAt: deletedAt } },
            ...sets.map(record => ({
                store: 'sets', record: { id: record.id, deleted: true, updatedAt: deletedAt },
            })),
        ], [
            { entityType: 'workouts', entityId: workout.id, kind: 'delete' },
            ...sets.map(record => ({ entityType: 'sets', entityId: record.id, kind: 'delete' })),
        ]);
        await profileA.client.sync();
        await profileB.client.sync();
        assert.equal((await recordById(profileB, 'workouts', workout.id)).deleted, true);
        assert.equal((await records(profileB, 'sets')).filter(item => !item.deleted).length, 0);

        // The delete-everywhere workflow must pull first. Profile B starts
        // stale, learns A's unseen live head, and only then authors a tombstone
        // whose causal context dominates that head on every replica.
        const unseenExercise = {
            id: 'unseen-before-global-delete',
            name: 'Unseen remote head',
            createdAt: time,
            updatedAt: time,
            deleted: false,
        };
        await localOperation(
            profileA,
            [{ store: 'exercises', record: unseenExercise }],
            [{
                entityType: 'exercises', entityId: unseenExercise.id,
                kind: 'put', payload: payload(unseenExercise),
            }]
        );
        await profileA.client.sync();
        assert.equal(await recordById(profileB, 'exercises', unseenExercise.id), undefined);
        await profileB.client.sync();
        const pulledExercise = await recordById(profileB, 'exercises', unseenExercise.id);
        assert.equal(pulledExercise.name, unseenExercise.name);
        await localOperation(
            profileB,
            [{
                store: 'exercises',
                record: { ...pulledExercise, deleted: true, updatedAt: deletedAt },
            }],
            [{ entityType: 'exercises', entityId: unseenExercise.id, kind: 'delete' }]
        );
        await profileB.client.sync();
        await profileA.client.sync();
        assert.equal((await recordById(profileA, 'exercises', unseenExercise.id)).deleted, true);
        assert.equal((await recordById(profileB, 'exercises', unseenExercise.id)).deleted, true);
        assert.equal(
            (await profileB.client.listConflicts('exercises'))
                .some(conflict => conflict.entityId === unseenExercise.id),
            false
        );

        // An authorized replica can upload syntactically valid encrypted data
        // with an invalid app payload. It must be quarantined durably without
        // creating even a partial domain projection.
        const malformedChanges = [
            {
                entityType: 'workouts',
                entityId: 'malformed-workout',
                context: {},
                kind: 'put',
                payload: { id: 'malformed-workout', date: '2026-99-99' },
            },
            {
                entityType: 'plans',
                entityId: 'malformed-plan',
                context: {},
                kind: 'put',
                payload: {
                    id: 'malformed-plan', name: 'Malformed', currentDayIndex: 0,
                    days: [
                        { dayId: 'day-a', name: 'A', exercises: [{
                            planExerciseId: 'duplicate-row', exerciseId: exercise.id,
                        }] },
                        { dayId: 'day-b', name: 'B', exercises: [{
                            planExerciseId: 'duplicate-row', exerciseId: exercise.id,
                        }] },
                    ],
                },
            },
            {
                entityType: 'sets',
                entityId: 'malformed-set',
                context: {},
                kind: 'put',
                payload: {
                    id: 'malformed-set', workoutId: 'malformed-workout',
                    exerciseId: exercise.id, setNumber: 0,
                    weight: 'heavy', reps: 5.5, completed: 'yes',
                },
            },
        ];
        const malformedOperations = malformedChanges.map((change, index) => ({
            protocolVersion: 1,
            appSchemaVersion: 1,
            opId: crypto.randomUUID(),
            dot: { deviceId: 'authorized-malformed-replica', counter: index + 1 },
            changes: [change],
            authoredAt: `2026-09-01T14:00:0${index}.000Z`,
        }));
        const malformedEnvelopes = await Promise.all(malformedOperations.map(operation =>
            encryptOperation(
                operation,
                invitation.payload.vaultSecret,
                { vaultId: connection.vaultId, applicationId: LIBRELIFT_APP_ID }
            )
        ));
        await transportA.push(null, malformedEnvelopes);
        const malformedSync = await profileB.client.sync();
        assert.equal(malformedSync.quarantined, malformedOperations.length);
        assert.equal(await recordById(profileB, 'workouts', 'malformed-workout'), undefined);
        assert.equal(await recordById(profileB, 'plans', 'malformed-plan'), undefined);
        assert.equal(await recordById(profileB, 'sets', 'malformed-set'), undefined);
        const inbox = await records(profileB, 'libresync_inbox');
        for (const operation of malformedOperations) {
            assert.equal(
                inbox.find(record => record.opId === operation.opId)?.status,
                'quarantined'
            );
        }

        const decryptedTypes = new Set();
        for (const bytes of relay.inspectVault(connection.vaultId).rawEnvelopeBytes) {
            const operation = await decryptEnvelope(JSON.parse(bytes), invitation.payload.vaultSecret, {
                vaultId: connection.vaultId,
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
        profileA.client.stopAutomaticSync();
        profileB.client.stopAutomaticSync();
        rejectedProfile.client.stopAutomaticSync();
        deletedProfile.client.stopAutomaticSync();
        profileA.db.close();
        profileB.db.close();
        rejectedProfile.db.close();
        deletedProfile.db.close();
        await requestResult(indexedDB.deleteDatabase(profileAName));
        await requestResult(indexedDB.deleteDatabase(profileBName));
        await requestResult(indexedDB.deleteDatabase(rejectedProfileName));
        await requestResult(indexedDB.deleteDatabase(deletedProfileName));
    }
});
