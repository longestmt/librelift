import { openDB, toSynchronizedPayload } from './db.js';
import {
    isSynchronizedSetting,
    SYNCED_ENTITY_STORES,
} from './sync-config.js';
import { validateSynchronizedPayload } from './sync-schema.js';

function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.addEventListener('success', () => resolve(request.result), { once: true });
        request.addEventListener(
            'error',
            () => reject(request.error || new Error('IndexedDB read failed.')),
            { once: true }
        );
    });
}

/** Read the post-migration local set used for first-vault bootstrap or safe join reconciliation. */
export async function readSynchronizedLocalEntities(databaseProvider = openDB) {
    const db = typeof databaseProvider === 'function'
        ? await databaseProvider()
        : databaseProvider;
    const storeNames = [...SYNCED_ENTITY_STORES, 'settings'];
    const tx = db.transaction(storeNames, 'readonly');
    const recordsByStore = Object.fromEntries(await Promise.all(storeNames.map(async storeName => [
        storeName,
        await requestResult(tx.objectStore(storeName).getAll()),
    ])));
    const changes = [];
    for (const storeName of SYNCED_ENTITY_STORES) {
        for (const record of recordsByStore[storeName]) {
            if (record.deleted) {
                changes.push({
                    entityType: storeName,
                    entityId: record.id,
                    kind: 'delete',
                });
                continue;
            }
            changes.push({
                entityType: storeName,
                entityId: record.id,
                kind: 'put',
                payload: validateSynchronizedPayload(
                    storeName,
                    record.id,
                    toSynchronizedPayload(record)
                ),
            });
        }
    }
    for (const record of recordsByStore.settings) {
        if (!isSynchronizedSetting(record.key)) continue;
        changes.push({
            entityType: 'settings',
            entityId: record.key,
            kind: 'put',
            payload: validateSynchronizedPayload(
                'settings',
                record.key,
                toSynchronizedPayload(record)
            ),
        });
    }
    return changes;
}
