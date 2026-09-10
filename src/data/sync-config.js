/** LibreSync's explicit LibreLift data classification. */

import {
    ALL_SYNC_STORE_NAMES as CLIENT_SYNC_STORE_LIST,
    SYNC_STORE_NAMES as CLIENT_SYNC_STORES,
} from '@libresync/client';

export const LIBRELIFT_APP_ID = 'org.libresuite.librelift';
export const LIBRELIFT_APP_SCHEMA_VERSION = 1;

export const SYNCED_ENTITY_STORES = Object.freeze([
    'exercises',
    'plans',
    'workouts',
    'sets',
    'bodyWeight',
]);

export const SYNCED_SETTING_KEYS = new Set([
    'unit',
    'barWeight',
    'restTimer',
    'autoPauseMin',
    'maxWorkoutMin',
    'distanceUnit',
    'plateInventory',
    'theme',
]);

export const SYNC_STORE_NAMES = CLIENT_SYNC_STORES;
export const ALL_SYNC_STORE_NAMES = CLIENT_SYNC_STORE_LIST;

export function isSynchronizedEntityType(entityType) {
    if (entityType === 'settings') return true;
    return SYNCED_ENTITY_STORES.includes(entityType);
}

export function isSynchronizedSetting(key) {
    return SYNCED_SETTING_KEYS.has(key);
}
