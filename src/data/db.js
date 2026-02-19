/**
 * db.js — IndexedDB wrapper for LibreLift
 * Every record: id (UUID), createdAt, updatedAt, deleted (soft-delete)
 */

const DB_NAME = 'librelift';
const DB_VERSION = 1;

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
    const stores = ['exercises', 'plans', 'workouts', 'sets', 'bodyWeight', 'settings'];
    const data = { version: DB_VERSION, exportedAt: now(), stores: {} };
    for (const name of stores) {
        const store = await getStore(name);
        data.stores[name] = await promisifyRequest(store.getAll());
    }
    return data;
}

export async function importAllData(data, merge = false) {
    const stores = ['exercises', 'plans', 'workouts', 'sets', 'bodyWeight', 'settings'];
    for (const name of stores) {
        if (!data.stores[name]) continue;
        if (!merge) {
            await hardDeleteAll(name);
        }
        await putMany(name, data.stores[name]);
    }
}

export async function clearAllData() {
    const stores = ['exercises', 'plans', 'workouts', 'sets', 'bodyWeight', 'settings'];
    for (const name of stores) {
        await hardDeleteAll(name);
    }
}

export { uuid, now, openDB };
