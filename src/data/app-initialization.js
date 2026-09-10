import { getSetting, setSetting, setSettings } from './db.js';

export const DEFAULT_SETTING_VALUES = Object.freeze({
    unit: 'lb',
    barWeight: 45,
    restTimer: 90,
    distanceUnit: 'mi',
    theme: 'dark',
});

const DEFAULTS_INITIALIZED_KEY = 'settingsDefaultsInitialized';

/**
 * Seed synchronized defaults exactly once on a genuinely local/pre-sync
 * installation. Missing settings on a registered replica may be causal
 * tombstones, so startup must leave them absent until a user chooses a value.
 */
export async function ensureInitialDefaultSettings({ hasRegisteredSyncDevice }) {
    if (await getSetting(DEFAULTS_INITIALIZED_KEY, false)) return false;

    if (!hasRegisteredSyncDevice) {
        const missing = {};
        for (const [key, value] of Object.entries(DEFAULT_SETTING_VALUES)) {
            if (await getSetting(key) === null) missing[key] = value;
        }
        if (Object.keys(missing).length > 0) await setSettings(missing);
    }

    await setSetting(DEFAULTS_INITIALIZED_KEY, true);
    return !hasRegisteredSyncDevice;
}
