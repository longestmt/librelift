/**
 * session.js — Persist active workout session across app closures
 * Uses localStorage so state survives full app kills and device restarts.
 */

const SESSION_KEY = 'librelift_activeSession';
const SESSION_VERSION = 1;

function isWorkoutDraft(workout) {
    return !!workout
        && typeof workout === 'object'
        && !Array.isArray(workout)
        && typeof workout.id === 'string'
        && workout.id.length > 0
        && Number.isFinite(workout.startTime)
        && Array.isArray(workout.exercises);
}

export function serializeSession(workout, savedAt = new Date().toISOString()) {
    return JSON.stringify({
        version: SESSION_VERSION,
        savedAt,
        workout,
    });
}

export function parseSession(raw) {
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

        if (parsed.version === SESSION_VERSION && isWorkoutDraft(parsed.workout)) {
            return {
                workout: parsed.workout,
                savedAt: parsed.savedAt || null,
                legacy: false,
            };
        }

        // Older LibreLift versions stored the workout object directly.
        if (isWorkoutDraft(parsed)) {
            return { workout: parsed, savedAt: null, legacy: true };
        }
    } catch (e) {
        console.warn('Failed to parse workout session:', e);
    }

    return null;
}

/**
 * Save the active workout to localStorage.
 * @param {object} workout - The activeWorkout object
 */
export function saveSession(workout) {
    try {
        localStorage.setItem(SESSION_KEY, serializeSession(workout));
        return true;
    } catch (e) {
        console.warn('Failed to save workout session:', e);
        return false;
    }
}

/**
 * Load a previously saved workout session.
 * @returns {object|null} The saved workout, or null if none exists
 */
export function loadSession() {
    return loadSessionRecord()?.workout || null;
}

export function loadSessionRecord() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        const session = parseSession(raw);
        if (raw && !session) localStorage.removeItem(SESSION_KEY);
        return session;
    } catch (e) {
        console.warn('Failed to load workout session:', e);
        return null;
    }
}

/**
 * Clear the saved workout session.
 */
export function clearSession() {
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch (e) {
        console.warn('Failed to clear workout session:', e);
    }
}
