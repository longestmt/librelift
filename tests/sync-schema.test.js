import test from 'node:test';
import assert from 'node:assert/strict';

import {
    validateMaterializedEntity,
    validateSynchronizedPayload,
} from '../src/data/sync-schema.js';

test('validates every LibreLift synchronized entity family', () => {
    const values = [
        ['exercises', 'exercise-a', { id: 'exercise-a', name: 'Press' }],
        ['plans', 'plan-a', {
            id: 'plan-a', name: 'Plan A', currentDayIndex: 0,
            days: [{
                dayId: 'day-a', name: 'Day A',
                exercises: [{ planExerciseId: 'row-a', exerciseId: 'exercise-a' }],
            }],
        }],
        ['workouts', 'workout-a', { id: 'workout-a', date: '2026-09-01' }],
        ['sets', 'set-a', {
            id: 'set-a', workoutId: 'workout-a', exerciseId: 'exercise-a',
            setNumber: 1, weight: 100, reps: 5, completed: true,
        }],
        ['bodyWeight', 'weight-a', { id: 'weight-a', date: '2026-09-01', value: 180 }],
        ['settings', 'theme', { key: 'theme', value: 'dark' }],
    ];
    for (const [type, id, payload] of values) {
        assert.deepEqual(validateSynchronizedPayload(type, id, payload), payload);
    }
});

test('rejects local-only settings, mismatched IDs, and malformed nested records', () => {
    assert.throws(
        () => validateSynchronizedPayload('settings', 'webdavPassword', {
            key: 'webdavPassword', value: 'secret',
        }),
        /device-local/
    );
    assert.throws(
        () => validateSynchronizedPayload('bodyWeight', 'weight-a', {
            id: 'weight-b', date: '2026-09-01', value: 180,
        }),
        /does not match/
    );
    assert.throws(
        () => validateSynchronizedPayload('plans', 'plan-a', {
            id: 'plan-a', name: 'Plan A', days: [{ exercises: [] }],
        }),
        /Plan day ID/
    );
    assert.throws(
        () => validateSynchronizedPayload('plans', 'plan-a', {
            id: 'plan-a', name: 'Plan A',
            days: [{
                dayId: 'day-a', name: 'Day A',
                exercises: [{ planExerciseId: 'row-a' }],
            }],
        }),
        /Plan exercise ID/
    );
    assert.throws(
        () => validateSynchronizedPayload('workouts', 'workout-a', { id: 'workout-a' }),
        /Workout date/
    );
    assert.throws(
        () => validateSynchronizedPayload('workouts', 'workout-a', {
            id: 'workout-a', date: '2026-99-99',
        }),
        /real calendar date/
    );
    assert.throws(
        () => validateSynchronizedPayload('plans', 'plan-a', {
            id: 'plan-a', name: 'Plan A', currentDayIndex: 0,
            days: [
                { dayId: 'same-day', name: 'A', exercises: [] },
                { dayId: 'same-day', name: 'B', exercises: [] },
            ],
        }),
        /Duplicate plan day ID/
    );
    assert.throws(
        () => validateSynchronizedPayload('plans', 'plan-a', {
            id: 'plan-a', name: 'Plan A', currentDayIndex: 0,
            days: [
                { dayId: 'day-a', name: 'A', exercises: [{
                    planExerciseId: 'same-row', exerciseId: 'exercise-a',
                }] },
                { dayId: 'day-b', name: 'B', exercises: [{
                    planExerciseId: 'same-row', exerciseId: 'exercise-b',
                }] },
            ],
        }),
        /Duplicate plan exercise row ID/
    );
    for (const [field, value, message] of [
        ['setNumber', 0, /Set number/],
        ['weight', '100', /Set weight/],
        ['reps', 5.5, /Set reps/],
        ['completed', 'yes', /Set completed/],
    ]) {
        const invalid = {
            id: 'set-a', workoutId: 'workout-a', exerciseId: 'exercise-a',
            setNumber: 1, weight: 100, reps: 5, completed: true,
            [field]: value,
        };
        assert.throws(
            () => validateSynchronizedPayload('sets', 'set-a', invalid),
            message
        );
    }
    assert.throws(
        () => validateSynchronizedPayload('settings', 'unit', {
            key: 'unit', value: 'stones',
        }),
        /unsupported/
    );
    assert.throws(
        () => validateMaterializedEntity({
            entityType: 'activeWorkout', entityId: 'draft-a', kind: 'put', payload: {},
        }),
        /Unsupported/
    );
});
