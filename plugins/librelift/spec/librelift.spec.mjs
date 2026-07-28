// Domain-level contract tests for the LibreLift plugin.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getBodyWeightHistory,
  getExerciseProgress,
  getRecentWorkouts,
  listExercises,
  logBodyWeight,
  logStrengthWorkout,
} from '../scripts/librelift.mjs';

function backup() {
  return {
    version: 2,
    exportedAt: '2026-07-01T00:00:00.000Z',
    stores: {
      exercises: [
        { id: 'bench', name: 'Barbell Bench Press', muscleGroup: 'Chest', equipment: 'Barbell' },
        { id: 'row', name: 'Barbell Row', muscleGroup: 'Back', equipment: 'Barbell' },
      ],
      plans: [],
      workouts: [],
      sets: [],
      bodyWeight: [],
      settings: [{ key: 'unit', value: 'lb' }],
    },
  };
}

test('lists exercises using a forgiving text query', () => {
  const data = backup();
  assert.deepEqual(
    listExercises(data, { query: 'chest' }).map(exercise => exercise.name),
    ['Barbell Bench Press']
  );
});

test('logs a workout in the portable LibreLift format and reads it back', () => {
  const data = backup();
  const result = logStrengthWorkout(data, {
    request_id: 'message-1',
    date: '2026-07-28',
    name: 'Upper A',
    duration_minutes: 45,
    exercises: [{
      name: 'bench press',
      sets: [
        { weight: 185, reps: 5, rpe: 8 },
        { weight: 185, reps: 5 },
      ],
    }],
  }, '2026-07-28T14:00:00.000Z');

  assert.equal(result.created, true);
  assert.equal(data.stores.workouts.length, 1);
  assert.equal(data.stores.sets.length, 2);
  assert.equal(data.stores.sets[0].exerciseId, 'bench');

  const recent = getRecentWorkouts(data);
  assert.equal(recent[0].name, 'Upper A');
  assert.equal(recent[0].volume, 1850);
  assert.equal(recent[0].completed_sets, 2);

  const progress = getExerciseProgress(data, { exercise_name: 'Barbell Bench Press' });
  assert.equal(progress.sessions[0].top_set.weight, 185);
  assert.equal(progress.sessions[0].top_set.estimated_1rm, 215.8);
});

test('uses request IDs to make workout writes idempotent', () => {
  const data = backup();
  const input = {
    request_id: 'same-request',
    exercises: [{ name: 'Barbell Row', sets: [{ weight: 135, reps: 8 }] }],
  };
  const first = logStrengthWorkout(data, input, '2026-07-28T14:00:00.000Z');
  const second = logStrengthWorkout(data, input, '2026-07-28T14:01:00.000Z');

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(data.stores.workouts.length, 1);
  assert.equal(data.stores.sets.length, 1);
});

test('logs body weight with the configured unit', () => {
  const data = backup();
  const result = logBodyWeight(
    data,
    { value: 182.4, request_id: 'weight-1' },
    '2026-07-28T14:00:00.000Z'
  );
  assert.equal(result.entry.unit, 'lb');
  assert.equal(data.stores.bodyWeight[0].value, 182.4);
  assert.equal(getBodyWeightHistory(data)[0].value, 182.4);
  assert.equal(logBodyWeight(
    data,
    { value: 182.4, request_id: 'weight-1' },
    '2026-07-28T14:01:00.000Z'
  ).created, false);
});

test('rejects ambiguous exercise names rather than logging against the wrong lift', () => {
  const data = backup();
  assert.throws(
    () => logStrengthWorkout(data, {
      exercises: [{ name: 'barbell', sets: [{ weight: 100, reps: 5 }] }],
    }),
    /ambiguous/
  );
  assert.equal(data.stores.workouts.length, 0);
});
