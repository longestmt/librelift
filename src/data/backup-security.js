/**
 * Settings that belong to the current device, not to a portable backup.
 *
 * Keeping this list at the backup boundary prevents credentials from leaking
 * through local exports or cloud backups, and prevents older backups from
 * replacing the credentials currently configured on this device.
 */
export const PRIVATE_SETTING_KEYS = new Set([
    'githubPAT',
    'githubGistId',
    'webdavUrl',
    'webdavUsername',
    'webdavPassword',
]);

/**
 * Return a backup-shaped copy with private connection settings removed.
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
            settings: settings.filter(setting => !PRIVATE_SETTING_KEYS.has(setting?.key)),
        },
    };
}
