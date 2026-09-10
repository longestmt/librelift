/**
 * db.js — IndexedDB wrapper for LibreLift
 * Every record: id (UUID), createdAt, updatedAt, deleted (soft-delete)
 */

import {
    BACKUP_STORE_NAMES,
    CURRENT_BACKUP_VERSION,
    validateBackupData,
} from './backup-validation.js';
import { sanitizeBackupData } from './backup-security.js';
import {
    canonicalBuiltinId,
    isCanonicalBuiltinExerciseId,
    normalizePortableIdentity,
    remapPlanExerciseReferences,
    withStablePlanIds,
} from './identity.js';
import {
    ALL_SYNC_STORE_NAMES,
    isSynchronizedSetting,
    SYNCED_ENTITY_STORES,
} from './sync-config.js';
import { validateSynchronizedPayload } from './sync-schema.js';
import { installLibreSyncStores } from '@libresync/client';

const DB_NAME = 'librelift';
// IndexedDB migrations and portable backup compatibility evolve independently.
// Never use CURRENT_BACKUP_VERSION here: changing a JSON format must not cause a
// browser schema upgrade (or vice versa).
export const INDEXED_DB_VERSION = 5;
const IDENTITY_MIGRATION_VERSION = 1;
export const SAFETY_SNAPSHOT_STORE = 'librelift_safety_snapshots';
export const MAX_SAFETY_SNAPSHOT_BYTES = 32 * 1024 * 1024;
const LATEST_SAFETY_SNAPSHOT_ID = 'latest';

let dbInstance = null;
let syncRecorder = null;
const MAX_CHANGES_PER_OPERATION = 200;

/**
 * The LibreSync adapter registers its transaction-aware recorder at startup.
 * The recorder itself observes connection state in the caller transaction, so
 * offline writes stay local while another tab can connect without a bypass.
 */
export function configureSyncRecorder(recorder) {
    syncRecorder = typeof recorder === 'function' ? recorder : null;
}

function transactionStores(domainStores, { synchronize = true } = {}) {
    const names = new Set(Array.isArray(domainStores) ? domainStores : [domainStores]);
    if (synchronize && syncRecorder) {
        // The adapter reads the shared device ID from this same transaction.
        // This lets a tab observe a disconnect/rejoin rotation without opening
        // a second settings transaction that could deadlock a settings write.
        names.add('settings');
        for (const name of ALL_SYNC_STORE_NAMES) names.add(name);
    }
    return [...names];
}

async function recordChanges(transaction, changes, { chunk = false } = {}) {
    if (!syncRecorder || changes.length === 0) return null;
    if (!chunk && changes.length > MAX_CHANGES_PER_OPERATION) {
        throw new Error(
            `This atomic command contains ${changes.length} changes; the safe limit is ${MAX_CHANGES_PER_OPERATION}.`
        );
    }
    const operations = [];
    for (let index = 0; index < changes.length; index += MAX_CHANGES_PER_OPERATION) {
        operations.push(await syncRecorder({
            transaction,
            changes: changes.slice(index, index + MAX_CHANGES_PER_OPERATION),
        }));
        if (!chunk) break;
    }
    return chunk ? operations : operations[0];
}

async function recordChangesOrAbort(transaction, completion, changes, options) {
    try {
        return await recordChanges(transaction, changes, options);
    } catch (error) {
        try { transaction.abort(); } catch { /* It may already be aborting. */ }
        try { await completion; } catch { /* Preserve the recorder error. */ }
        throw error;
    }
}

export function toSynchronizedPayload(record) {
    const payload = structuredClone(record);
    // Causality comes from dotted vectors, never this display-only timestamp.
    // Excluding it also makes concurrent semantically identical writes collapse.
    delete payload.updatedAt;
    delete payload.deleted;
    // Legacy installs assigned built-ins installation-time timestamps while
    // new installs use semantic IDs. Identity, not seed time, defines these
    // records; omitting createdAt lets pristine old/new seeds adopt silently.
    if (isCanonicalBuiltinExerciseId(payload.id)) delete payload.createdAt;
    return payload;
}

function putChange(entityType, record) {
    const entityId = entityType === 'settings' ? record.key : record.id;
    const payload = validateSynchronizedPayload(
        entityType,
        entityId,
        toSynchronizedPayload(record)
    );
    return { entityType, entityId, kind: 'put', payload };
}

function deleteChange(entityType, entityId) {
    return { entityType, entityId, kind: 'delete' };
}

function uuid() {
    if (!globalThis.crypto?.randomUUID) {
        throw new Error('This browser does not support secure random UUID generation.');
    }
    return crypto.randomUUID();
}

function now() {
    return new Date().toISOString();
}

function openDB() {
    if (dbInstance) return Promise.resolve(dbInstance);
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, INDEXED_DB_VERSION);

        req.onupgradeneeded = (e) => {
            const db = e.target.result;

            // Exercises
            if (!db.objectStoreNames.contains('exercises')) {
                const store = db.createObjectStore('exercises', { keyPath: 'id' });
                store.createIndex('name', 'name', { unique: false });
                store.createIndex('muscleGroup', 'muscleGroup', { unique: false });
                store.createIndex('category', 'category', { unique: false });
            }

            // Plans
            if (!db.objectStoreNames.contains('plans')) {
                db.createObjectStore('plans', { keyPath: 'id' });
            }

            // Workouts
            if (!db.objectStoreNames.contains('workouts')) {
                const store = db.createObjectStore('workouts', { keyPath: 'id' });
                store.createIndex('date', 'date', { unique: false });
                store.createIndex('planId', 'planId', { unique: false });
            }

            // Sets
            if (!db.objectStoreNames.contains('sets')) {
                const store = db.createObjectStore('sets', { keyPath: 'id' });
                store.createIndex('workoutId', 'workoutId', { unique: false });
                store.createIndex('exerciseId', 'exerciseId', { unique: false });
            }

            // Body weight
            if (!db.objectStoreNames.contains('bodyWeight')) {
                const store = db.createObjectStore('bodyWeight', { keyPath: 'id' });
                store.createIndex('date', 'date', { unique: false });
            }

            // Settings (key-value)
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }

            // Keep one bounded, device-local portable checkpoint outside the
            // domain and LibreSync stores. Full replacement restores leave it
            // intact, and ordinary/cloud backups cannot include it.
            if (!db.objectStoreNames.contains(SAFETY_SNAPSHOT_STORE)) {
                db.createObjectStore(SAFETY_SNAPSHOT_STORE, { keyPath: 'id' });
            }

            // LibreSync is intentionally installed in LibreLift's existing
            // database so domain materialization and causal state share one
            // IndexedDB transaction.
            installLibreSyncStores(db, e.target.transaction);
        };

        req.onsuccess = (e) => {
            dbInstance = e.target.result;
            resolve(dbInstance);
        };

        req.onerror = (e) => reject(e.target.error);
    });
}

export function closeDatabase() {
    dbInstance?.close();
    dbInstance = null;
}

function transactionDone(tx) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error || new Error('The database transaction was aborted.'));
        tx.onerror = () => reject(tx.error || new Error('The database transaction failed.'));
    });
}

/**
 * Atomically migrate legacy seed IDs and nested plan identity. The read phase
 * happens before the write transaction; this runs before the app renders, so no
 * application writer can race it. The migration marker and every remap commit
 * together.
 */
export async function runIdentityMigrations() {
    const db = await openDB();
    const markerTx = db.transaction('settings', 'readonly');
    const marker = await promisifyRequest(
        markerTx.objectStore('settings').get('libreliftIdentityMigrationVersion')
    );
    if ((marker?.value || 0) >= IDENTITY_MIGRATION_VERSION) return false;

    const readTx = db.transaction(['exercises', 'plans', 'sets'], 'readonly');
    const [exercises, plans, sets] = await Promise.all([
        promisifyRequest(readTx.objectStore('exercises').getAll()),
        promisifyRequest(readTx.objectStore('plans').getAll()),
        promisifyRequest(readTx.objectStore('sets').getAll()),
    ]);

    const exerciseIdMap = new Map();
    for (const exercise of exercises) {
        const canonicalId = canonicalBuiltinId(exercise);
        if (canonicalId && canonicalId !== exercise.id) {
            exerciseIdMap.set(exercise.id, canonicalId);
        }
    }

    const writeTx = db.transaction(['exercises', 'plans', 'sets', 'settings'], 'readwrite');
    const exerciseStore = writeTx.objectStore('exercises');
    const planStore = writeTx.objectStore('plans');
    const setStore = writeTx.objectStore('sets');
    for (const exercise of exercises) {
        const canonicalId = exerciseIdMap.get(exercise.id);
        if (!canonicalId) continue;
        // Preserve every user-visible field. The legacy ID itself carries the
        // built-in identity even when its display name/instructions were edited.
        exerciseStore.put({ ...exercise, id: canonicalId });
        exerciseStore.delete(exercise.id);
    }

    for (const set of sets) {
        const exerciseId = exerciseIdMap.get(set.exerciseId);
        if (exerciseId) setStore.put({ ...set, exerciseId });
    }

    for (const plan of plans) {
        planStore.put(remapPlanExerciseReferences(plan, exerciseIdMap));
    }

    writeTx.objectStore('settings').put({
        key: 'libreliftIdentityMigrationVersion',
        value: IDENTITY_MIGRATION_VERSION,
        updatedAt: now(),
    });
    await transactionDone(writeTx);
    return true;
}

async function getStore(storeName, mode = 'readonly') {
    const db = await openDB();
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
}

function promisifyRequest(req) {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ---- CRUD operations ----

export async function getAll(storeName) {
    const store = await getStore(storeName);
    const items = await promisifyRequest(store.getAll());
    return items.filter(i => !i.deleted);
}

export async function getById(storeName, id) {
    const store = await getStore(storeName);
    const item = await promisifyRequest(store.get(id));
    return item && !item.deleted ? item : null;
}

export async function getByIndex(storeName, indexName, value) {
    const store = await getStore(storeName);
    const index = store.index(indexName);
    const items = await promisifyRequest(index.getAll(value));
    return items.filter(i => !i.deleted);
}

export async function put(storeName, data) {
    const timestamp = now();
    let record = {
        ...data,
        id: data.id || uuid(),
        createdAt: data.createdAt || timestamp,
        updatedAt: timestamp,
        deleted: false,
    };
    if (storeName === 'plans') record = withStablePlanIds(record);
    const synchronize = SYNCED_ENTITY_STORES.includes(storeName);
    const changes = synchronize ? [putChange(storeName, record)] : [];
    const db = await openDB();
    const tx = db.transaction(transactionStores(storeName, { synchronize }), 'readwrite');
    const completion = transactionDone(tx);
    tx.objectStore(storeName).put(record);
    if (synchronize) {
        await recordChangesOrAbort(tx, completion, changes);
    }
    await completion;
    return record;
}

export async function putMany(storeName, items) {
    const synchronize = SYNCED_ENTITY_STORES.includes(storeName);
    const timestamp = now();
    const records = [];
    for (const data of items) {
        let record = {
            ...data,
            id: data.id || uuid(),
            createdAt: data.createdAt || timestamp,
            updatedAt: data.updatedAt || timestamp,
            deleted: data.deleted || false,
        };
        if (storeName === 'plans') record = withStablePlanIds(record);
        records.push(record);
    }
    const changes = synchronize
        ? records.map(record => putChange(storeName, record))
        : [];
    const db = await openDB();
    const tx = db.transaction(transactionStores(storeName, { synchronize }), 'readwrite');
    const completion = transactionDone(tx);
    const store = tx.objectStore(storeName);
    for (const record of records) store.put(record);
    if (synchronize) {
        await recordChangesOrAbort(tx, completion, changes);
    }
    await completion;
    return records;
}

/**
 * Save a completed workout and all of its sets in one transaction.
 * If any write fails, IndexedDB rolls the entire transaction back.
 */
export async function saveCompletedWorkout(workout, sets, {
    planProgress = null,
    bodyWeight = null,
} = {}) {
    if (!workout || typeof workout !== 'object' || Array.isArray(workout)) {
        throw new Error('A workout record is required.');
    }
    if (!Array.isArray(sets)) {
        throw new Error('Workout sets must be a list.');
    }

    const timestamp = now();
    const workoutId = workout.id || uuid();
    const workoutRecord = {
        ...workout,
        id: workoutId,
        createdAt: workout.createdAt || timestamp,
        updatedAt: timestamp,
        deleted: false,
    };

    const seenSetIds = new Set();
    const setRecords = sets.map(set => {
        if (!set || typeof set !== 'object' || Array.isArray(set)) {
            throw new Error('Every workout set must be a record.');
        }

        const id = set.id || uuid();
        if (seenSetIds.has(id)) {
            throw new Error(`Workout contains duplicate set id "${id}".`);
        }
        seenSetIds.add(id);

        return {
            ...set,
            id,
            workoutId,
            createdAt: set.createdAt || timestamp,
            updatedAt: timestamp,
            deleted: false,
        };
    });

    const bodyWeightRecord = bodyWeight ? {
        ...bodyWeight,
        id: bodyWeight.id || uuid(),
        createdAt: bodyWeight.createdAt || timestamp,
        updatedAt: timestamp,
        deleted: false,
    } : null;

    // Validate every caller-provided synchronized payload before opening the
    // write transaction. A rejected local payload cannot partially commit.
    const changes = [
        putChange('workouts', workoutRecord),
        ...setRecords.map(record => putChange('sets', record)),
    ];
    const bodyWeightChange = bodyWeightRecord
        ? putChange('bodyWeight', bodyWeightRecord)
        : null;

    const domainStores = ['workouts', 'sets'];
    if (planProgress?.planId) domainStores.push('plans');
    if (bodyWeightRecord) domainStores.push('bodyWeight');

    const db = await openDB();
    const tx = db.transaction(transactionStores(domainStores), 'readwrite');
    const completion = transactionDone(tx);
    const workoutStore = tx.objectStore('workouts');
    // A crash can happen after this atomic commit but before the device-local
    // draft is cleared. The stable workout ID makes a recovered second save a
    // retry, not a second plan completion.
    const existingWorkout = await promisifyRequest(workoutStore.get(workoutId));
    if (existingWorkout) {
        const existingSets = await promisifyRequest(
            tx.objectStore('sets').index('workoutId').getAll(workoutId)
        );
        const existingBodyWeight = bodyWeight?.id && domainStores.includes('bodyWeight')
            ? await promisifyRequest(tx.objectStore('bodyWeight').get(bodyWeight.id))
            : null;
        await completion;
        return {
            workout: existingWorkout,
            sets: existingSets,
            plan: null,
            bodyWeight: existingBodyWeight || null,
            alreadyCommitted: true,
        };
    }
    workoutStore.put(workoutRecord);
    for (const setRecord of setRecords) {
        tx.objectStore('sets').put(setRecord);
    }

    let planRecord = null;
    if (planProgress?.planId) {
        const planStore = tx.objectStore('plans');
        const currentPlan = await promisifyRequest(planStore.get(planProgress.planId));
        if (currentPlan && !currentPlan.deleted) {
            const completedIndex = currentPlan.days?.findIndex(day =>
                day.dayId === planProgress.completedDayId
            );
            const fallbackIndex = Number.isInteger(planProgress.completedDayIndex)
                ? planProgress.completedDayIndex
                : currentPlan.currentDayIndex || 0;
            const dayIndex = completedIndex >= 0 ? completedIndex : fallbackIndex;
            const currentDayIndex = currentPlan.currentDayIndex || 0;
            // If another completion already moved the plan beyond this draft,
            // never move it backward to the stale draft's successor.
            if (currentDayIndex === dayIndex) {
                planRecord = withStablePlanIds({
                    ...currentPlan,
                    currentDayIndex: currentPlan.days?.length
                        ? (dayIndex + 1) % currentPlan.days.length
                        : 0,
                    updatedAt: timestamp,
                    deleted: false,
                });
                try {
                    changes.push(putChange('plans', planRecord));
                } catch (error) {
                    tx.abort();
                    try { await completion; } catch { /* Preserve schema error. */ }
                    throw error;
                }
                planStore.put(planRecord);
            }
        }
    }

    if (bodyWeightRecord) {
        tx.objectStore('bodyWeight').put(bodyWeightRecord);
        changes.push(bodyWeightChange);
    }

    await recordChangesOrAbort(tx, completion, changes);

    await completion.catch(error => {
        throw new Error(
            `Workout could not be saved. Your active draft is still available. ${error.message}`
        );
    });

    return { workout: workoutRecord, sets: setRecords, plan: planRecord, bodyWeight: bodyWeightRecord };
}

export async function softDelete(storeName, id) {
    const db = await openDB();
    const synchronize = SYNCED_ENTITY_STORES.includes(storeName);
    const tx = db.transaction(transactionStores(storeName, { synchronize }), 'readwrite');
    const completion = transactionDone(tx);
    const store = tx.objectStore(storeName);
    const item = await promisifyRequest(store.get(id));
    if (item) {
        item.deleted = true;
        item.updatedAt = now();
        store.put(item);
        if (synchronize) {
            await recordChangesOrAbort(tx, completion, [deleteChange(storeName, id)]);
        }
    }
    await completion;
}

/** Atomically tombstone a workout and every set that belongs to it. */
export async function deleteWorkoutCascade(workoutId) {
    const db = await openDB();
    const tx = db.transaction(transactionStores(['workouts', 'sets']), 'readwrite');
    const completion = transactionDone(tx);
    const workoutStore = tx.objectStore('workouts');
    const setStore = tx.objectStore('sets');
    const [workout, sets] = await Promise.all([
        promisifyRequest(workoutStore.get(workoutId)),
        promisifyRequest(setStore.index('workoutId').getAll(workoutId)),
    ]);
    const timestamp = now();
    const changes = [];
    if (workout) {
        workoutStore.put({ ...workout, deleted: true, updatedAt: timestamp });
        changes.push(deleteChange('workouts', workoutId));
    }
    for (const set of sets) {
        setStore.put({ ...set, deleted: true, updatedAt: timestamp });
        changes.push(deleteChange('sets', set.id));
    }
    await recordChangesOrAbort(tx, completion, changes);
    await completion;
    return { workoutDeleted: Boolean(workout), setIds: sets.map(set => set.id) };
}

/** Apply a scoped edit to the freshest record to avoid stale UI field loss. */
export async function updateRecord(storeName, id, updater) {
    if (!SYNCED_ENTITY_STORES.includes(storeName)) {
        throw new Error(`Scoped record updates are not supported for ${storeName}.`);
    }
    const db = await openDB();
    const tx = db.transaction(transactionStores(storeName), 'readwrite');
    const completion = transactionDone(tx);
    const store = tx.objectStore(storeName);
    const current = await promisifyRequest(store.get(id));
    if (!current || current.deleted) {
        tx.abort();
        try { await completion; } catch { /* Expected abort. */ }
        return null;
    }
    let next;
    try {
        next = updater(structuredClone(current));
    } catch (error) {
        tx.abort();
        try { await completion; } catch { /* Preserve the updater error. */ }
        throw error;
    }
    if (!next || typeof next !== 'object') {
        tx.abort();
        try { await completion; } catch { /* Expected abort. */ }
        throw new Error('The record update did not produce a record.');
    }
    next = { ...next, id, createdAt: current.createdAt, updatedAt: now(), deleted: false };
    if (storeName === 'plans') next = withStablePlanIds(next);
    let change;
    try {
        change = putChange(storeName, next);
    } catch (error) {
        tx.abort();
        try { await completion; } catch { /* Preserve schema error. */ }
        throw error;
    }
    store.put(next);
    await recordChangesOrAbort(tx, completion, [change]);
    await completion;
    return next;
}

// ---- Settings helpers ----

export async function getSetting(key, defaultValue = null) {
    const store = await getStore('settings');
    const item = await promisifyRequest(store.get(key));
    return item ? item.value : defaultValue;
}

/** Atomically initialize device-local operational state across browser tabs. */
export async function getOrCreateLocalSetting(key, createValue) {
    if (isSynchronizedSetting(key)) {
        throw new Error(`Synchronized setting "${key}" cannot use a local-only initializer.`);
    }
    const db = await openDB();
    const tx = db.transaction('settings', 'readwrite');
    const completion = transactionDone(tx);
    const store = tx.objectStore('settings');
    const existing = await promisifyRequest(store.get(key));
    if (existing) {
        await completion;
        return existing.value;
    }
    const value = createValue();
    store.put({ key, value, updatedAt: now() });
    await completion;
    return value;
}

export async function setSetting(key, value) {
    const [record] = await setSettings({ [key]: value });
    return record;
}

export async function setSettings(values) {
    const records = Object.entries(values).map(([key, value]) => ({
        key,
        value,
        updatedAt: now(),
    }));
    const synchronizedRecords = records.filter(record => isSynchronizedSetting(record.key));
    const synchronize = synchronizedRecords.length > 0;
    const changes = synchronizedRecords.map(record => putChange('settings', record));
    const db = await openDB();
    const tx = db.transaction(transactionStores('settings', { synchronize }), 'readwrite');
    const completion = transactionDone(tx);
    const store = tx.objectStore('settings');
    for (const record of records) store.put(record);
    if (synchronize) {
        await recordChangesOrAbort(tx, completion, changes);
    }
    await completion;
    return records;
}

// ---- Export / Import ----

export async function exportAllData() {
    const db = await openDB();
    const storeNames = BACKUP_STORE_NAMES.filter(name => db.objectStoreNames.contains(name));
    const tx = db.transaction(storeNames, 'readonly');
    const data = { version: CURRENT_BACKUP_VERSION, exportedAt: now(), stores: {} };

    const entries = await Promise.all(storeNames.map(async name => {
        const records = await promisifyRequest(tx.objectStore(name).getAll());
        return [name, records];
    }));
    data.stores = Object.fromEntries(entries);

    return data;
}

/**
 * Persist one bounded safety snapshot and read it through a new transaction.
 * Returning only after the exact serialized bytes round-trip prevents callers
 * from treating an in-memory validation or an unobservable browser download as
 * a verified recovery point.
 */
export async function persistSafetySnapshot({ filename, serialized }) {
    if (typeof filename !== 'string' || filename.trim() === '') {
        throw new Error('The safety snapshot filename is missing.');
    }
    if (typeof serialized !== 'string') {
        throw new Error('The safety snapshot must be serialized JSON.');
    }
    const byteLength = new TextEncoder().encode(serialized).byteLength;
    if (byteLength > MAX_SAFETY_SNAPSHOT_BYTES) {
        throw new Error(
            `The safety snapshot is ${byteLength} bytes; the local limit is ${MAX_SAFETY_SNAPSHOT_BYTES} bytes.`
        );
    }

    const database = await openDB();
    const writeTransaction = database.transaction(SAFETY_SNAPSHOT_STORE, 'readwrite');
    writeTransaction.objectStore(SAFETY_SNAPSHOT_STORE).put({
        id: LATEST_SAFETY_SNAPSHOT_ID,
        filename,
        serialized,
        byteLength,
        createdAt: now(),
    });
    await transactionDone(writeTransaction);

    const readTransaction = database.transaction(SAFETY_SNAPSHOT_STORE, 'readonly');
    const persisted = await promisifyRequest(
        readTransaction.objectStore(SAFETY_SNAPSHOT_STORE).get(LATEST_SAFETY_SNAPSHOT_ID)
    );
    await transactionDone(readTransaction);
    if (persisted?.filename !== filename || persisted?.serialized !== serialized) {
        throw new Error('The persisted safety snapshot did not pass exact read-back verification.');
    }
    return persisted;
}

export async function readLatestSafetySnapshot() {
    const database = await openDB();
    const transaction = database.transaction(SAFETY_SNAPSHOT_STORE, 'readonly');
    const snapshot = await promisifyRequest(
        transaction.objectStore(SAFETY_SNAPSHOT_STORE).get(LATEST_SAFETY_SNAPSHOT_ID)
    );
    await transactionDone(transaction);
    return snapshot || null;
}

export async function importAllData(data, merge = false) {
    const safeData = sanitizeBackupData(data);

    // Validation intentionally happens before opening a write transaction.
    validateBackupData(safeData);
    const portableStores = normalizePortableIdentity(safeData.stores);

    const db = await openDB();
    const storeNames = BACKUP_STORE_NAMES.filter(name => db.objectStoreNames.contains(name));

    const readTx = db.transaction(storeNames, 'readonly');
    const existingEntries = await Promise.all(storeNames.map(async storeName => [
        storeName,
        await promisifyRequest(readTx.objectStore(storeName).getAll()),
    ]));
    const existingByStore = Object.fromEntries(existingEntries);

    const preservedSettings = (existingByStore.settings || [])
        .filter(setting => !isSynchronizedSetting(setting.key));

    const tx = db.transaction(transactionStores(storeNames), 'readwrite');
    const completion = transactionDone(tx);
    const changes = [];

    try {
        for (const storeName of storeNames) {
            const store = tx.objectStore(storeName);
            if (!merge) store.clear();

            const incoming = portableStores[storeName] || [];
            const incomingKeys = new Set();
            for (const sourceRecord of incoming) {
                let record = structuredClone(sourceRecord);
                const primaryKey = storeName === 'settings' ? record.key : record.id;
                incomingKeys.add(primaryKey);
                if (storeName === 'plans') record = withStablePlanIds(record);
                store.put(record);

                if (storeName === 'settings') {
                    if (isSynchronizedSetting(record.key)) {
                        changes.push(putChange('settings', record));
                    }
                } else if (SYNCED_ENTITY_STORES.includes(storeName)) {
                    changes.push(record.deleted
                        ? deleteChange(storeName, record.id)
                        : putChange(storeName, record));
                }
            }

            if (!merge && storeName !== 'settings') {
                for (const record of existingByStore[storeName] || []) {
                    if (!record.deleted && !incomingKeys.has(record.id)) {
                        store.put({ ...record, deleted: true, updatedAt: now() });
                        changes.push(deleteChange(storeName, record.id));
                    }
                }
            }

            if (!merge && storeName === 'settings') {
                for (const setting of preservedSettings) {
                    store.put(setting);
                }
                for (const setting of existingByStore.settings || []) {
                    if (isSynchronizedSetting(setting.key) && !incomingKeys.has(setting.key)) {
                        changes.push(deleteChange('settings', setting.key));
                    }
                }
            }
        }
        await recordChangesOrAbort(tx, completion, changes, { chunk: true });
    } catch (error) {
        tx.abort();
        try { await completion; } catch { /* The original error is more useful. */ }
        throw new Error(`Restore could not start; existing data was kept. ${error.message}`);
    }

    try {
        await completion;
    } catch (error) {
        throw new Error(`Restore failed; existing data was kept. ${error.message}`);
    }
}

export async function clearAllData() {
    throw new Error(
        'Ambiguous clear-all is disabled. Choose a device reset, synchronized deletion, or vault deletion.'
    );
}

/**
 * Tombstone every synchronized record in one atomic operation. Device-local
 * credentials, backup configuration, seed flags, and the active draft remain.
 */
export async function deleteSynchronizedDataEverywhere() {
    const db = await openDB();
    const domainStores = [...SYNCED_ENTITY_STORES, 'settings'];
    const readTx = db.transaction(domainStores, 'readonly');
    const entries = await Promise.all(domainStores.map(async storeName => [
        storeName,
        await promisifyRequest(readTx.objectStore(storeName).getAll()),
    ]));
    const existing = Object.fromEntries(entries);

    const tx = db.transaction(transactionStores(domainStores), 'readwrite');
    const completion = transactionDone(tx);
    const timestamp = now();
    const changes = [];
    for (const storeName of SYNCED_ENTITY_STORES) {
        const store = tx.objectStore(storeName);
        for (const record of existing[storeName]) {
            if (record.deleted) continue;
            store.put({ ...record, deleted: true, updatedAt: timestamp });
            changes.push(deleteChange(storeName, record.id));
        }
    }
    const settingsStore = tx.objectStore('settings');
    for (const setting of existing.settings) {
        if (!isSynchronizedSetting(setting.key)) continue;
        settingsStore.delete(setting.key);
        changes.push(deleteChange('settings', setting.key));
    }
    await recordChangesOrAbort(tx, completion, changes, { chunk: true });
    await completion;
    return changes.length;
}

/**
 * Erase LibreLift from this device only. The caller disconnects first; this
 * function never contacts or mutates the relay vault.
 */
export async function clearThisDeviceData() {
    const db = await openDB();
    const stores = [
        ...BACKUP_STORE_NAMES,
        ...ALL_SYNC_STORE_NAMES,
        SAFETY_SNAPSHOT_STORE,
    ];
    const tx = db.transaction(stores, 'readwrite');
    const completion = transactionDone(tx);
    for (const storeName of stores) tx.objectStore(storeName).clear();
    await completion;
}

export { uuid, now, openDB, transactionDone };
