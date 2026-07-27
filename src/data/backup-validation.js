/**
 * The current portable backup format. Version 1 remains supported so backups
 * created before the body-weight store migration can still be restored.
 */
export const CURRENT_BACKUP_VERSION = 2;
export const MINIMUM_BACKUP_VERSION = 1;

export const BACKUP_STORE_NAMES = Object.freeze([
    'exercises',
    'plans',
    'workouts',
    'sets',
    'bodyWeight',
    'settings',
]);

function requiredStoresForVersion(version) {
    if (version === 1) {
        return BACKUP_STORE_NAMES.filter(name => name !== 'bodyWeight');
    }
    return BACKUP_STORE_NAMES;
}

function primaryKeyForStore(storeName) {
    return storeName === 'settings' ? 'key' : 'id';
}

/**
 * Validate the portable structure without over-constraining optional workout
 * fields that have evolved over time.
 */
export function validateBackupData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Invalid backup: expected a LibreLift data object.');
    }

    if (!Number.isInteger(data.version)) {
        throw new Error('Invalid backup: the data version is missing.');
    }

    if (data.version > CURRENT_BACKUP_VERSION) {
        throw new Error(
            `This backup uses data version ${data.version}. Update LibreLift before restoring it.`
        );
    }

    if (data.version < MINIMUM_BACKUP_VERSION) {
        throw new Error(`Unsupported backup data version: ${data.version}.`);
    }

    if (!data.stores || typeof data.stores !== 'object' || Array.isArray(data.stores)) {
        throw new Error('Invalid backup: the data stores are missing.');
    }

    for (const storeName of requiredStoresForVersion(data.version)) {
        if (!Object.hasOwn(data.stores, storeName)) {
            throw new Error(`Invalid backup: missing "${storeName}" data.`);
        }
    }

    const counts = {};
    for (const storeName of BACKUP_STORE_NAMES) {
        if (!Object.hasOwn(data.stores, storeName)) {
            counts[storeName] = 0;
            continue;
        }

        const records = data.stores[storeName];
        if (!Array.isArray(records)) {
            throw new Error(`Invalid backup: "${storeName}" must be a list.`);
        }

        const primaryKey = primaryKeyForStore(storeName);
        const seenKeys = new Set();
        records.forEach((record, index) => {
            if (!record || typeof record !== 'object' || Array.isArray(record)) {
                throw new Error(
                    `Invalid backup: "${storeName}" record ${index + 1} is not an object.`
                );
            }

            const key = record[primaryKey];
            if (typeof key !== 'string' || key.trim() === '') {
                throw new Error(
                    `Invalid backup: "${storeName}" record ${index + 1} has no ${primaryKey}.`
                );
            }

            if (seenKeys.has(key)) {
                throw new Error(
                    `Invalid backup: "${storeName}" contains duplicate ${primaryKey} "${key}".`
                );
            }
            seenKeys.add(key);
        });
        counts[storeName] = records.length;
    }

    return { version: data.version, counts };
}
