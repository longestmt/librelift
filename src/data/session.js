/**
 * session.js — Persist active workout session across app closures
 * Uses localStorage so state survives full app kills and device restarts.
 */

const SESSION_KEY = 'librelift_activeSession';

/**
 * Save the active workout to localStorage.
 * @param {object} workout - The activeWorkout object
 */
export function saveSession(workout) {
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(workout));
    } catch (e) {
        console.warn('Failed to save workout session:', e);
    }
}

/**
 * Load a previously saved workout session.
 * @returns {object|null} The saved workout, or null if none exists
 */
export function loadSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
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
