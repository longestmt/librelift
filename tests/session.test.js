import test from 'node:test';
import assert from 'node:assert/strict';

import {
    clearSession,
    loadSession,
    parseSession,
    saveSession,
    serializeSession,
} from '../src/data/session.js';

test('round-trips the versioned active-workout session', () => {
    const workout = {
        id: 'workout-1',
        startTime: 1000,
        exercises: [],
        notes: 'Strong day',
    };
    const savedAt = '2026-07-27T12:00:00.000Z';

    assert.deepEqual(parseSession(serializeSession(workout, savedAt)), {
        workout,
        savedAt,
        legacy: false,
    });
});

test('loads legacy sessions that stored the workout directly', () => {
    const workout = { id: 'legacy-workout', startTime: 1000, exercises: [] };

    assert.deepEqual(parseSession(JSON.stringify(workout)), {
        workout,
        savedAt: null,
        legacy: true,
    });
});

test('rejects corrupted or unrelated session data', () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
        assert.equal(parseSession('{broken'), null);
        assert.equal(parseSession(JSON.stringify({ version: 1 })), null);
    } finally {
        console.warn = originalWarn;
    }
});

test('device-clear session step removes the active local workout draft', () => {
    const values = new Map();
    const originalStorage = globalThis.localStorage;
    globalThis.localStorage = {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key),
    };
    try {
        const workout = { id: 'local-draft', startTime: 1000, exercises: [] };
        assert.equal(saveSession(workout), true);
        assert.equal(loadSession().id, workout.id);
        clearSession();
        assert.equal(loadSession(), null);
    } finally {
        globalThis.localStorage = originalStorage;
    }
});
