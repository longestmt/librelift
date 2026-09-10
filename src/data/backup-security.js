import { SYNCED_SETTING_KEYS } from './sync-config.js';

/** Known device-only settings are documented here for UI and migration code. */
export const PRIVATE_SETTING_KEYS = new Set([
    'githubPAT',
    'githubGistId',
    'webdavUrl',
    'webdavUsername',
    'webdavPassword',
]);

export const LOCAL_OPERATIONAL_SETTING_KEYS = new Set([
    'exercisesSeeded',
    'cardioSeedVersion',
    'libreliftIdentityMigrationVersion',
    'settingsDefaultsInitialized',
    'lastUsedPlanId',
    'webdavLastBackup',
    'libresyncDeviceId',
    'libresyncDeviceLabel',
    'libresyncConsent',
    'libresyncServerUrl',
]);

// Portable settings use a positive allowlist. An unknown future setting is
// therefore device-local until it is deliberately classified, and can never
// become a credential leak merely because a denylist was not updated.
export const PORTABLE_BACKUP_SETTING_KEYS = new Set(SYNCED_SETTING_KEYS);

/**
 * Return a backup-shaped copy containing only approved portable settings.
 * The source object is never mutated.
 */
export function sanitizeBackupData(data) {
    if (!data || typeof data !== 'object' || !data.stores || typeof data.stores !== 'object') {
        return data;
    }

    const settings = data.stores.settings;
    if (!Array.isArray(settings)) {
        return data;
    }

    return {
        ...data,
        stores: {
            ...data.stores,
            settings: settings.filter(setting => PORTABLE_BACKUP_SETTING_KEYS.has(setting?.key)),
        },
    };
}
