import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

const dbModule = await import('../src/data/db.js');
const { readSynchronizedLocalEntities } = await import('../src/data/sync-local.js');
const { ensureInitialDefaultSettings } = await import('../src/data/app-initialization.js');
const {
    closeDatabase,
    configureSyncRecorder,
    clearThisDeviceData,
    deleteSynchronizedDataEverywhere,
    deleteWorkoutCascade,
    getAll,
    getById,
    getOrCreateLocalSetting,
    getSetting,
    openDB,
    importAllData,
    runIdentityMigrations,
    saveCompletedWorkout,
    setSetting,
    toSynchronizedPayload,
    updateRecord,
} = dbModule;

function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function deleteTestDatabase() {
    closeDatabase();
    return requestResult(indexedDB.deleteDatabase('librelift'));
}

async function allRaw(storeName) {
    const db = await openDB();
    return requestResult(db.transaction(storeName).objectStore(storeName).getAll());
}

function completedSet(id, setNumber = 1) {
    return {
        id,
        exerciseId: 'exercise-a',
        setNumber,
        weight: 100,
        reps: 5,
        completed: true,
    };
}

beforeEach(async () => {
    configureSyncRecorder(null);
    await deleteTestDatabase();
});

afterEach(async () => {
    configureSyncRecorder(null);
    await deleteTestDatabase();
});

test('schema migration decouples DB version and atomically remaps legacy references', async () => {
    const legacyOpen = indexedDB.open('librelift', 2);
    legacyOpen.onupgradeneeded = () => {
        const db = legacyOpen.result;
        db.createObjectStore('exercises', { keyPath: 'id' });
        db.createObjectStore('plans', { keyPath: 'id' });
        db.createObjectStore('workouts', { keyPath: 'id' });
        const sets = db.createObjectStore('sets', { keyPath: 'id' });
        sets.createIndex('workoutId', 'workoutId');
        sets.createIndex('exerciseId', 'exerciseId');
        db.createObjectStore('bodyWeight', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'key' });
    };
    const legacy = await requestResult(legacyOpen);
    const tx = legacy.transaction(['exercises', 'plans', 'sets'], 'readwrite');
    tx.objectStore('exercises').put({
        id: 'seed-0',
        name: 'My edited bench label',
        instructions: 'Keep my custom setup cue',
        mediaUrl: 'https://example.test/my-bench-video',
        createdAt: '2025-02-03T04:05:06.000Z',
    });
    tx.objectStore('sets').put({ id: 'set-a', workoutId: 'workout-a', exerciseId: 'seed-0' });
    tx.objectStore('plans').put({
        id: 'plan-a',
        days: [{ name: 'A', exercises: [{ exerciseId: 'seed-0', sets: 3, reps: 5 }] }],
    });
    await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error);
    });
    legacy.close();

    await runIdentityMigrations();
    const exerciseId = 'builtin-exercise-v1-barbell-bench-press';
    const migratedExercise = await getById('exercises', exerciseId);
    assert.equal(migratedExercise.name, 'My edited bench label');
    assert.equal(migratedExercise.instructions, 'Keep my custom setup cue');
    assert.equal(migratedExercise.mediaUrl, 'https://example.test/my-bench-video');
    assert.equal(migratedExercise.createdAt, '2025-02-03T04:05:06.000Z');
    assert.equal(await getById('exercises', 'seed-0'), null);
    assert.equal((await getById('sets', 'set-a')).exerciseId, exerciseId);
    const plan = await getById('plans', 'plan-a');
    assert.equal(plan.days[0].exercises[0].exerciseId, exerciseId);
    assert.ok(plan.days[0].dayId);
    assert.ok(plan.days[0].exercises[0].planExerciseId);
    assert.equal(await getSetting('libreliftIdentityMigrationVersion'), 1);

    const db = await openDB();
    assert.equal(db.version, 5);
    for (const storeName of [
        'libresync_outbox',
        'libresync_inbox',
        'libresync_entity_heads',
        'libresync_conflicts',
        'libresync_state',
    ]) {
        assert.equal(db.objectStoreNames.contains(storeName), true);
    }
});

test('workout, sets, plan progress, body weight, and one operation commit together', async () => {
    await openDB();
    await dbModule.put('plans', {
        id: 'plan-a',
        name: 'Plan',
        currentDayIndex: 0,
        days: [
            { dayId: 'day-a', name: 'A', exercises: [] },
            { dayId: 'day-b', name: 'B', exercises: [] },
        ],
    });

    configureSyncRecorder(({ transaction, changes }) => {
        transaction.objectStore('libresync_outbox').put({
            opId: 'atomic-completion',
            changes,
        });
    });

    await saveCompletedWorkout(
        { id: 'workout-a', date: '2026-09-01' },
        [
            completedSet('set-a', 1),
            completedSet('set-b', 2),
        ],
        {
            planProgress: { planId: 'plan-a', completedDayId: 'day-a' },
            bodyWeight: { id: 'weight-a', date: '2026-09-01', value: 180, unit: 'lb' },
        }
    );

    assert.ok(await getById('workouts', 'workout-a'));
    assert.equal((await getAll('sets')).length, 2);
    assert.equal((await getById('plans', 'plan-a')).currentDayIndex, 1);
    assert.equal((await getById('bodyWeight', 'weight-a')).value, 180);
    const outbox = await allRaw('libresync_outbox');
    assert.equal(outbox.length, 1);
    assert.deepEqual(
        outbox[0].changes.map(change => change.entityType),
        ['workouts', 'sets', 'sets', 'plans', 'bodyWeight']
    );
});

test('repeating a completed workout ID never advances plan progress twice or backward', async () => {
    await openDB();
    await dbModule.put('plans', {
        id: 'plan-a',
        name: 'Plan',
        currentDayIndex: 0,
        days: [
            { dayId: 'day-a', name: 'A', exercises: [] },
            { dayId: 'day-b', name: 'B', exercises: [] },
            { dayId: 'day-c', name: 'C', exercises: [] },
        ],
    });
    let operationNumber = 0;
    configureSyncRecorder(({ transaction, changes }) => {
        operationNumber += 1;
        transaction.objectStore('libresync_outbox').put({
            opId: `repeat-${operationNumber}`,
            changes,
        });
    });

    const completion = () => saveCompletedWorkout(
        { id: 'stable-workout', date: '2026-09-01' },
        [completedSet('stable-set')],
        {
            planProgress: { planId: 'plan-a', completedDayId: 'day-a' },
            bodyWeight: {
                date: '2026-09-01',
                value: 180,
                unit: 'lb',
            },
        }
    );

    await completion();
    const committedWorkout = await getById('workouts', 'stable-workout');
    const committedOutboxCount = (await allRaw('libresync_outbox')).length;
    assert.equal((await getById('plans', 'plan-a')).currentDayIndex, 1);
    const repeated = await completion();
    assert.equal((await getById('plans', 'plan-a')).currentDayIndex, 1);
    assert.equal(repeated.alreadyCommitted, true);
    assert.equal(
        (await getById('workouts', 'stable-workout')).createdAt,
        committedWorkout.createdAt
    );
    assert.equal((await allRaw('libresync_outbox')).length, committedOutboxCount);
    assert.equal((await getAll('bodyWeight')).length, 1);

    await updateRecord('plans', 'plan-a', current => ({ ...current, currentDayIndex: 2 }));
    const beforeStaleRetryOutboxCount = (await allRaw('libresync_outbox')).length;
    await completion();
    assert.equal((await getById('plans', 'plan-a')).currentDayIndex, 2);
    assert.equal((await allRaw('libresync_outbox')).length, beforeStaleRetryOutboxCount);
    const repeatedChanges = (await allRaw('libresync_outbox'))
        .filter(operation => operation.changes.some(change =>
            change.entityType === 'workouts' && change.entityId === 'stable-workout'
        ))
        .slice(1)
        .flatMap(operation => operation.changes);
    assert.equal(repeatedChanges.some(change => change.entityType === 'plans'), false);
});

test('workout deletion cascades all set tombstones in one operation', async () => {
    await openDB();
    await saveCompletedWorkout(
        { id: 'workout-a', date: '2026-09-01' },
        [
            completedSet('set-a', 1),
            completedSet('set-b', 2),
        ]
    );
    configureSyncRecorder(({ transaction, changes }) => {
        transaction.objectStore('libresync_outbox').put({ opId: 'atomic-delete', changes });
    });

    const result = await deleteWorkoutCascade('workout-a');
    assert.deepEqual(result.setIds.sort(), ['set-a', 'set-b']);
    assert.equal(await getById('workouts', 'workout-a'), null);
    assert.equal((await getAll('sets')).length, 0);
    const operation = (await allRaw('libresync_outbox'))[0];
    assert.deepEqual(
        operation.changes.map(change => `${change.kind}:${change.entityType}`).sort(),
        ['delete:sets', 'delete:sets', 'delete:workouts']
    );
});

test('only the positive settings allowlist reaches the outbox', async () => {
    await openDB();
    let sequence = 0;
    configureSyncRecorder(({ transaction, changes }) => {
        sequence += 1;
        transaction.objectStore('libresync_outbox').put({ opId: `setting-${sequence}`, changes });
    });
    await setSetting('theme', 'light');
    await setSetting('lastUsedPlanId', 'local-plan');
    await setSetting('webdavPassword', 'never-sync-me');

    const outbox = await allRaw('libresync_outbox');
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].changes[0].entityId, 'theme');
    assert.equal(JSON.stringify(outbox).includes('never-sync-me'), false);
});

test('device identity initialization is atomic across tabs', async () => {
    await openDB();
    const values = await Promise.all([
        getOrCreateLocalSetting('libresyncDeviceId', () => 'device-from-tab-a'),
        getOrCreateLocalSetting('libresyncDeviceId', () => 'device-from-tab-b'),
    ]);
    assert.equal(values[0], values[1]);
    assert.equal(await getSetting('libresyncDeviceId'), values[0]);
    assert.equal((await allRaw('libresync_outbox')).length, 0);
});

test('display-only timestamps do not turn identical values into conflicts', () => {
    assert.deepEqual(
        toSynchronizedPayload({ id: 'x', name: 'Same', updatedAt: '2026-01-01', deleted: false }),
        toSynchronizedPayload({ id: 'x', name: 'Same', updatedAt: '2030-01-01', deleted: false })
    );
    assert.deepEqual(
        toSynchronizedPayload({
            id: 'builtin-exercise-v1-barbell-bench-press',
            name: 'Bench',
            createdAt: '2020-01-01',
            updatedAt: '2026-01-01',
        }),
        toSynchronizedPayload({
            id: 'builtin-exercise-v1-barbell-bench-press',
            name: 'Bench',
            createdAt: '2030-01-01',
            updatedAt: '2030-01-01',
        })
    );
});

test('a failed outbox write rolls the domain transaction back', async () => {
    await openDB();
    configureSyncRecorder(() => {
        throw new Error('simulated outbox failure');
    });

    await assert.rejects(
        dbModule.put('exercises', { id: 'exercise-a', name: 'Rollback Press' }),
        /simulated outbox failure/
    );
    assert.equal(await getById('exercises', 'exercise-a'), null);

    await assert.rejects(
        saveCompletedWorkout(
            { id: 'workout-a', date: '2026-09-01' },
            [completedSet('set-a')]
        ),
        /simulated outbox failure/
    );
    assert.equal(await getById('workouts', 'workout-a'), null);
    assert.equal(await getById('sets', 'set-a'), null);
});

test('malformed local synchronized payloads are rejected before domain writes', async () => {
    await openDB();
    await assert.rejects(
        dbModule.put('workouts', { id: 'missing-date' }),
        /Workout date/
    );
    assert.equal(await getById('workouts', 'missing-date'), null);

    await assert.rejects(
        saveCompletedWorkout(
            { id: 'invalid-set-workout', date: '2026-09-01' },
            [{
                id: 'invalid-set', exerciseId: 'exercise-a', setNumber: 1,
                weight: '100', reps: 5, completed: true,
            }]
        ),
        /Set weight/
    );
    assert.equal(await getById('workouts', 'invalid-set-workout'), null);
    assert.equal(await getById('sets', 'invalid-set'), null);
});

test('merge imports become ordinary synchronized mutations without leaking local settings', async () => {
    await openDB();
    configureSyncRecorder(({ transaction, changes }) => {
        transaction.objectStore('libresync_outbox').put({ opId: 'merge-import', changes });
    });
    await importAllData({
        version: 2,
        stores: {
            exercises: [{ id: 'exercise-a', name: 'Imported Press' }],
            plans: [],
            workouts: [],
            sets: [],
            bodyWeight: [
                { id: 'weight-a', date: '2026-09-01', value: 180 },
                { id: 'weight-b', date: '2026-09-01', value: 181 },
            ],
            settings: [
                { key: 'theme', value: 'light' },
                { key: 'lastUsedPlanId', value: 'device-only' },
                { key: 'webdavPassword', value: 'secret' },
            ],
        },
    }, true);

    assert.equal((await getAll('bodyWeight')).length, 2, 'same-date UUIDs remain distinct');
    const operation = (await allRaw('libresync_outbox'))[0];
    assert.deepEqual(
        operation.changes.map(change => `${change.entityType}:${change.entityId}`).sort(),
        ['bodyWeight:weight-a', 'bodyWeight:weight-b', 'exercises:exercise-a', 'settings:theme']
    );
    assert.equal(JSON.stringify(operation).includes('device-only'), false);
    assert.equal(JSON.stringify(operation).includes('secret'), false);
});

test('full replacement emits tombstones instead of retaining stale causal records', async () => {
    await openDB();
    await dbModule.put('exercises', { id: 'old-exercise', name: 'Old' });
    await setSetting('theme', 'dark');
    await setSetting('futureProviderCredential', 'unknown-local-secret');
    configureSyncRecorder(({ transaction, changes }) => {
        transaction.objectStore('libresync_outbox').put({ opId: 'replace-import', changes });
    });
    await importAllData({
        version: 2,
        stores: {
            exercises: [{ id: 'new-exercise', name: 'New' }],
            plans: [],
            workouts: [],
            sets: [],
            bodyWeight: [],
            settings: [],
        },
    }, false);

    assert.equal(await getById('exercises', 'old-exercise'), null);
    assert.ok(await getById('exercises', 'new-exercise'));
    assert.equal(await getSetting('theme'), null);
    assert.equal(
        await getSetting('futureProviderCredential'),
        'unknown-local-secret',
        'unknown settings default to local and survive full replacement'
    );
    const changes = (await allRaw('libresync_outbox'))[0].changes;
    assert.ok(changes.some(change =>
        change.entityType === 'exercises' && change.entityId === 'old-exercise' && change.kind === 'delete'
    ));
    assert.ok(changes.some(change =>
        change.entityType === 'settings' && change.entityId === 'theme' && change.kind === 'delete'
    ));
});

test('scoped updates preserve unrelated fields from the freshest local projection', async () => {
    await openDB();
    await dbModule.put('workouts', {
        id: 'workout-a',
        date: '2026-09-01',
        notes: 'original',
        durationSec: 600,
    });
    const db = await openDB();
    const tx = db.transaction('workouts', 'readwrite');
    tx.objectStore('workouts').put({
        ...(await requestResult(tx.objectStore('workouts').get('workout-a'))),
        notes: 'remote projection',
    });
    await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error);
    });

    await updateRecord('workouts', 'workout-a', current => ({
        ...current,
        durationSec: 900,
    }));
    assert.deepEqual(
        (({ notes, durationSec }) => ({ notes, durationSec }))(await getById('workouts', 'workout-a')),
        { notes: 'remote projection', durationSec: 900 }
    );
});

test('clear workflows distinguish global tombstones from a complete local wipe', async () => {
    await openDB();
    await dbModule.put('exercises', { id: 'exercise-a', name: 'Press' });
    await setSetting('theme', 'light');
    await setSetting('githubPAT', 'local-secret');
    configureSyncRecorder(({ transaction, changes }) => {
        transaction.objectStore('libresync_outbox').put({ opId: 'delete-everywhere', changes });
    });
    const count = await deleteSynchronizedDataEverywhere();
    assert.equal(count, 2);
    assert.equal(await getById('exercises', 'exercise-a'), null);
    assert.equal(await getSetting('theme'), null);
    assert.equal(await getSetting('githubPAT'), 'local-secret');
    assert.equal((await allRaw('libresync_outbox')).length, 1);

    await dbModule.persistSafetySnapshot({
        filename: 'local-checkpoint.json',
        serialized: '{"local":true}',
    });
    configureSyncRecorder(null);
    await clearThisDeviceData();
    assert.equal((await allRaw('libresync_outbox')).length, 0);
    assert.equal(await getSetting('githubPAT'), null);
    assert.equal(await dbModule.readLatestSafetySnapshot(), null);
    for (const storeName of ['exercises', 'plans', 'workouts', 'sets', 'bodyWeight', 'settings']) {
        assert.equal((await allRaw(storeName)).length, 0);
    }
});

test('connected delete-everywhere tombstones are not recreated during reload defaults', async () => {
    await openDB();
    await ensureInitialDefaultSettings({ hasRegisteredSyncDevice: false });
    assert.equal(await getSetting('theme'), 'dark');
    configureSyncRecorder(({ transaction, changes }) => {
        transaction.objectStore('libresync_outbox').put({
            opId: 'startup-delete-everywhere',
            changes,
        });
    });
    await deleteSynchronizedDataEverywhere();
    const outboxCount = (await allRaw('libresync_outbox')).length;
    assert.equal(await getSetting('unit'), null);
    assert.equal(await getSetting('theme'), null);

    closeDatabase();
    await openDB();
    await ensureInitialDefaultSettings({ hasRegisteredSyncDevice: true });
    assert.equal(await getSetting('unit'), null);
    assert.equal(await getSetting('barWeight'), null);
    assert.equal(await getSetting('restTimer'), null);
    assert.equal(await getSetting('distanceUnit'), null);
    assert.equal(await getSetting('theme'), null);
    assert.equal((await allRaw('libresync_outbox')).length, outboxCount);
});

test('large imports chunk protocol operations without splitting the local transaction', async () => {
    await openDB();
    let sequence = 0;
    configureSyncRecorder(({ transaction, changes }) => {
        sequence += 1;
        transaction.objectStore('libresync_outbox').put({
            opId: `bulk-${sequence}`,
            changes,
        });
    });
    const exercises = Array.from({ length: 450 }, (_, index) => ({
        id: `exercise-${index}`,
        name: `Exercise ${index}`,
    }));
    await importAllData({
        version: 2,
        stores: {
            exercises,
            plans: [], workouts: [], sets: [], bodyWeight: [], settings: [],
        },
    }, true);

    assert.equal((await getAll('exercises')).length, 450);
    assert.deepEqual(
        (await allRaw('libresync_outbox')).map(operation => operation.changes.length),
        [200, 200, 50]
    );
});

test('bootstrap reads live records and tombstones while excluding credentials', async () => {
    await openDB();
    await dbModule.put('exercises', { id: 'exercise-a', name: 'Press' });
    await dbModule.put('bodyWeight', { id: 'weight-a', date: '2026-09-01', value: 180 });
    await dbModule.put('bodyWeight', { id: 'weight-deleted', date: '2026-08-31', value: 181 });
    await dbModule.softDelete('bodyWeight', 'weight-deleted');
    await setSetting('theme', 'dark');
    await setSetting('githubPAT', 'secret');

    const changes = await readSynchronizedLocalEntities();
    assert.deepEqual(
        changes.map(change => `${change.entityType}:${change.entityId}`).sort(),
        [
            'bodyWeight:weight-a',
            'bodyWeight:weight-deleted',
            'exercises:exercise-a',
            'settings:theme',
        ]
    );
    assert.equal(
        changes.find(change => change.entityId === 'weight-deleted').kind,
        'delete'
    );
    assert.equal(JSON.stringify(changes).includes('secret'), false);
});
