import test from 'node:test';
import assert from 'node:assert/strict';

import {
    builtinExerciseId,
    canonicalBuiltinId,
    deterministicDayId,
    normalizePortableIdentity,
    normalizedSlug,
    remapPlanExerciseReferences,
    withStablePlanIds,
} from '../src/data/identity.js';

test('built-in exercise IDs are semantic and independent of seed order', () => {
    assert.equal(normalizedSlug("Farmer's Walk"), 'farmers-walk');
    assert.equal(
        builtinExerciseId('Barbell Bench Press'),
        'builtin-exercise-v1-barbell-bench-press'
    );
    assert.equal(
        canonicalBuiltinId({ id: 'seed-0', name: 'Barbell Bench Press' }),
        'builtin-exercise-v1-barbell-bench-press'
    );
    assert.equal(
        canonicalBuiltinId({ id: 'seed-0', name: 'My edited bench label' }),
        'builtin-exercise-v1-barbell-bench-press'
    );
    assert.equal(
        canonicalBuiltinId({ id: 'seed-cardio-treadmill-run', name: 'Indoor run' }),
        'builtin-exercise-v1-treadmill-run'
    );
    assert.equal(canonicalBuiltinId({ id: 'custom-id', name: 'Barbell Bench Press' }), null);
});

test('plan nested IDs backfill deterministically and survive later edits', () => {
    const original = {
        id: 'plan-a',
        days: [{
            name: 'Day A',
            exercises: [{ exerciseId: 'seed-0', exerciseName: 'Bench', sets: 3 }],
        }],
    };
    const first = withStablePlanIds(original);
    const second = withStablePlanIds(original);
    assert.deepEqual(first, second);
    assert.equal(first.days[0].dayId, deterministicDayId('plan-a', original.days[0], 0));
    assert.match(first.days[0].exercises[0].planExerciseId, /^plan-exercise-v1-/);

    const edited = withStablePlanIds({
        ...first,
        days: [{ ...first.days[0], name: 'Renamed' }],
    });
    assert.equal(edited.days[0].dayId, first.days[0].dayId);
    assert.equal(
        edited.days[0].exercises[0].planExerciseId,
        first.days[0].exercises[0].planExerciseId
    );
});

test('reference migration remaps exercises before assigning nested IDs', () => {
    const plan = remapPlanExerciseReferences({
        id: 'plan-a',
        days: [{ name: 'A', exercises: [{ exerciseId: 'seed-0' }] }],
    }, new Map([['seed-0', 'builtin-exercise-v1-bench']]));

    assert.equal(plan.days[0].exercises[0].exerciseId, 'builtin-exercise-v1-bench');
    assert.ok(plan.days[0].dayId);
    assert.ok(plan.days[0].exercises[0].planExerciseId);
});

test('portable restore normalization cannot reintroduce legacy seed IDs', () => {
    const normalized = normalizePortableIdentity({
        exercises: [{
            id: 'seed-0',
            name: 'My edited bench label',
            instructions: 'Preserve these user notes',
        }],
        sets: [{ id: 'set-a', exerciseId: 'seed-0' }],
        plans: [{
            id: 'plan-a',
            days: [{ name: 'A', exercises: [{ exerciseId: 'seed-0' }] }],
        }],
        workouts: [],
        bodyWeight: [],
        settings: [],
    });

    const canonicalId = builtinExerciseId('Barbell Bench Press');
    assert.equal(normalized.exercises[0].id, canonicalId);
    assert.equal(normalized.exercises[0].name, 'My edited bench label');
    assert.equal(normalized.exercises[0].instructions, 'Preserve these user notes');
    assert.equal(normalized.sets[0].exerciseId, canonicalId);
    assert.equal(normalized.plans[0].days[0].exercises[0].exerciseId, canonicalId);
    assert.ok(normalized.plans[0].days[0].dayId);
    assert.ok(normalized.plans[0].days[0].exercises[0].planExerciseId);
});
