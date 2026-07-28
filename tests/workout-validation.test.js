import test from 'node:test';
import assert from 'node:assert/strict';

import {
    findFirstInvalidCompletedSet,
    getWorkoutProgress,
    hasMeaningfulWorkoutProgress,
    parseSetInput,
    validateSetForCompletion,
} from '../src/engine/workout-validation.js';

test('parses blank values separately from a real zero', () => {
    assert.equal(parseSetInput('weight', ''), null);
    assert.equal(parseSetInput('weight', '0'), 0);
    assert.equal(parseSetInput('reps', '5'), 5);
});

test('allows bodyweight sets and an optional RPE', () => {
    assert.deepEqual(
        validateSetForCompletion({ weight: 0, reps: 10, rpe: null }),
        { valid: true, field: null, message: '' }
    );
});

test('requires positive whole-number reps', () => {
    assert.equal(validateSetForCompletion({ weight: 10, reps: 0, rpe: null }).field, 'reps');
    assert.equal(validateSetForCompletion({ weight: 10, reps: 2.5, rpe: null }).field, 'reps');
});

test('limits optional RPE values to 1 through 10', () => {
    assert.equal(validateSetForCompletion({ weight: 10, reps: 5, rpe: 0 }).field, 'rpe');
    assert.equal(validateSetForCompletion({ weight: 10, reps: 5, rpe: 10.5 }).field, 'rpe');
    assert.equal(validateSetForCompletion({ weight: 10, reps: 5, rpe: 8.5 }).valid, true);
});

test('validates cardio duration while allowing optional distance and calories', () => {
    assert.equal(validateSetForCompletion({
        mode: 'cardio',
        durationSec: 600,
        distance: null,
        calories: null,
    }).valid, true);
    assert.equal(validateSetForCompletion({
        mode: 'cardio',
        durationSec: 0,
    }).field, 'durationMin');
    assert.equal(validateSetForCompletion({
        mode: 'cardio',
        durationSec: 600,
        distance: -1,
    }).field, 'distance');
});

test('summarizes progress and locates invalid completed sets', () => {
    const workout = {
        exercises: [{
            sets: [
                { weight: 100, reps: 5, rpe: 8, completed: true },
                { weight: 100, reps: null, rpe: null, completed: true },
                { weight: 100, reps: 5, rpe: null, completed: false },
            ],
        }],
    };

    assert.deepEqual(getWorkoutProgress(workout), {
        total: 3,
        completed: 2,
        incomplete: 1,
    });
    assert.deepEqual(findFirstInvalidCompletedSet(workout), {
        exerciseIndex: 0,
        setIndex: 1,
        valid: false,
        field: 'reps',
        message: 'Reps must be a positive whole number.',
    });
});

test('treats empty freestyle sessions as disposable but planned sets as meaningful', () => {
    assert.equal(hasMeaningfulWorkoutProgress({ exercises: [], notes: '' }), false);
    assert.equal(
        hasMeaningfulWorkoutProgress({ exercises: [{ sets: [{ completed: false }] }], notes: '' }),
        true
    );
});
