/**
 * db.js — IndexedDB wrapper for LibreLift
 * Every record: id (UUID), createdAt, updatedAt, deleted (soft-delete)
 */

import {
    BACKUP_STORE_NAMES,
    CURRENT_BACKUP_VERSION,
    validateBackupData,
} from './backup-validation.js';
import { PRIVATE_SETTING_KEYS, sanitizeBackupData } from './backup-security.js';

const DB_NAME = 'librelift';
const DB_VERSION = CURRENT_BACKUP_VERSION;

let dbInstance = null;

function uuid() {
    return crypto.randomUUID ? crypto.randomUUID() :
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
}

function now() {
    return new Date().toISOString();
}

function openDB() {
    if (dbInstance) return Promise.resolve(dbInstance);
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

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
        };

        req.onsuccess = (e) => {
            dbInstance = e.target.result;
            resolve(dbInstance);
        };

        req.onerror = (e) => reject(e.target.error);
    });
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
    const store = await getStore(storeName, 'readwrite');
    const timestamp = now();
    const record = {
        ...data,
        id: data.id || uuid(),
        createdAt: data.createdAt || timestamp,
        updatedAt: timestamp,
        deleted: false,
    };
    await promisifyRequest(store.put(record));
    return record;
}

export async function putMany(storeName, items) {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const timestamp = now();
    const records = [];
    for (const data of items) {
        const record = {
            ...data,
            id: data.id || uuid(),
            createdAt: data.createdAt || timestamp,
            updatedAt: timestamp,
            deleted: data.deleted || false,
        };
        store.put(record);
        records.push(record);
    }
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(records);
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Save a completed workout and all of its sets in one transaction.
 * If any write fails, IndexedDB rolls the entire transaction back.
 */
export async function saveCompletedWorkout(workout, sets) {
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

    const db = await openDB();
    const tx = db.transaction(['workouts', 'sets'], 'readwrite');
    tx.objectStore('workouts').put(workoutRecord);
    for (const setRecord of setRecords) {
        tx.objectStore('sets').put(setRecord);
    }

    await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(
            tx.error || new Error('The database rejected the workout transaction.')
        );
    }).catch(error => {
        throw new Error(
            `Workout could not be saved. Your active draft is still available. ${error.message}`
        );
    });

    return { workout: workoutRecord, sets: setRecords };
}

export async function softDelete(storeName, id) {
    const store = await getStore(storeName, 'readwrite');
    const item = await promisifyRequest(store.get(id));
    if (item) {
        item.deleted = true;
        item.updatedAt = now();
        await promisifyRequest(store.put(item));
    }
}

export async function hardDeleteAll(storeName) {
    const store = await getStore(storeName, 'readwrite');
    await promisifyRequest(store.clear());
}

// ---- Settings helpers ----

export async function getSetting(key, defaultValue = null) {
    const store = await getStore('settings');
    const item = await promisifyRequest(store.get(key));
    return item ? item.value : defaultValue;
}

export async function setSetting(key, value) {
    const store = await getStore('settings', 'readwrite');
    await promisifyRequest(store.put({ key, value, updatedAt: now() }));
}

// ---- Export / Import ----

export async function exportAllData() {
    const db = await openDB();
    const storeNames = BACKUP_STORE_NAMES.filter(name => db.objectStoreNames.contains(name));
    const tx = db.transaction(storeNames, 'readonly');
    const data = { version: DB_VERSION, exportedAt: now(), stores: {} };

    const entries = await Promise.all(storeNames.map(async name => {
        const records = await promisifyRequest(tx.objectStore(name).getAll());
        return [name, records];
    }));
    data.stores = Object.fromEntries(entries);

    return data;
}

export async function importAllData(data, merge = false) {
    const safeData = sanitizeBackupData(data);

    // Validation intentionally happens before opening a write transaction.
    validateBackupData(safeData);

    const db = await openDB();
    const storeNames = BACKUP_STORE_NAMES.filter(name => db.objectStoreNames.contains(name));

    // Connection credentials are device-local and must survive a full restore.
    let preservedSettings = [];
    if (!merge && db.objectStoreNames.contains('settings')) {
        const settingsTx = db.transaction('settings', 'readonly');
        const settingsStore = settingsTx.objectStore('settings');
        preservedSettings = (await Promise.all(
            [...PRIVATE_SETTING_KEYS].map(key => promisifyRequest(settingsStore.get(key)))
        )).filter(Boolean);
    }

    const tx = db.transaction(storeNames, 'readwrite');
    const completion = new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(
            tx.error || new Error('The database rejected the restore transaction.')
        );
    });

    try {
        for (const storeName of storeNames) {
            const store = tx.objectStore(storeName);
            if (!merge) store.clear();

            for (const record of safeData.stores[storeName] || []) {
                store.put(record);
            }

            if (!merge && storeName === 'settings') {
                for (const setting of preservedSettings) {
                    store.put(setting);
                }
            }
        }
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
    for (const name of BACKUP_STORE_NAMES) {
        await hardDeleteAll(name);
    }
}

export { uuid, now, openDB };
