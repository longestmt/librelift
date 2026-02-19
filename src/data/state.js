/**
 * state.js — Simple pub/sub reactive state for LibreLift
 */

const listeners = new Map();
const state = {};

export function getState(key) {
    return state[key];
}

export function setState(key, value) {
    state[key] = value;
    const subs = listeners.get(key);
    if (subs) {
        subs.forEach(fn => {
            try { fn(value); } catch (e) { console.error(`State listener error [${key}]:`, e); }
        });
    }
}

export function subscribe(key, fn) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(fn);
    // Return unsubscribe function
    return () => listeners.get(key)?.delete(fn);
}

export function updateState(key, updater) {
    const current = state[key];
    setState(key, updater(current));
}
