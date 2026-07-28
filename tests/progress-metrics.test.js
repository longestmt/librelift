import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildCardioTrendSeries,
    buildExerciseTrendSeries,
    calculateCardioTotals,
    calculateVolumeByUnit,
    estimateOneRepMax,
    latestTrendUnit,
    summarizeWorkout,
} from '../src/engine/progress-metrics.js';

test('calculates Epley estimated 1RM and rejects unusable inputs', () => {
    assert.equal(estimateOneRepMax(100, 1), 100);
    assert.equal(Math.round(estimateOneRepMax(100, 5)), 117);
    assert.equal(estimateOneRepMax(0, 10), 0);
    assert.equal(estimateOneRepMax(100, 0), 0);
});

test('counts incomplete sets without including them in volume', () => {
    const workout = { id: 'workout-1', unit: 'lb' };
    const sets = [
        { workoutId: 'workout-1', exerciseId: 'squat', weight: 100, reps: 5, completed: true },
        { workoutId: 'workout-1', exerciseId: 'squat', weight: 100, reps: 5, completed: false },
    ];

    const summary = summarizeWorkout(workout, sets);
    assert.equal(summary.completed, 1);
    assert.equal(summary.incomplete, 1);
    assert.equal(summary.volumeByUnit.get('lb'), 500);
});

test('keeps mixed-unit volume separate', () => {
    const workoutById = new Map([
        ['lb-workout', { id: 'lb-workout', unit: 'lb' }],
        ['kg-workout', { id: 'kg-workout', unit: 'kg' }],
    ]);
    const volumes = calculateVolumeByUnit([
        { workoutId: 'lb-workout', weight: 100, reps: 5, completed: true },
        { workoutId: 'kg-workout', weight: 50, reps: 5, completed: true },
    ], workoutById);

    assert.equal(volumes.get('lb'), 500);
    assert.equal(volumes.get('kg'), 250);
});

test('keeps cardio out of strength volume and summarizes cardio by distance unit', () => {
    const sets = [
        {
            workoutId: 'mixed',
            mode: 'strength',
            weight: 100,
            reps: 5,
            completed: true,
        },
        {
            workoutId: 'mixed',
            mode: 'cardio',
            durationSec: 1200,
            distance: 2.5,
            distanceUnit: 'mi',
            calories: 150,
            completed: true,
        },
    ];

    assert.equal(calculateVolumeByUnit(sets).get('lb'), 500);
    const cardio = calculateCardioTotals(sets);
    assert.equal(cardio.durationSec, 1200);
    assert.equal(cardio.distanceByUnit.get('mi'), 2.5);
    assert.equal(cardio.calories, 150);
    assert.equal(cardio.sessions, 1);
});

test('builds cardio trends with total duration, distance, and pace per workout', () => {
    const workouts = new Map([
        ['run', { id: 'run', date: '2026-07-28' }],
    ]);
    const series = buildCardioTrendSeries([
        {
            workoutId: 'run',
            mode: 'cardio',
            durationSec: 300,
            distance: 0.5,
            distanceUnit: 'mi',
            completed: true,
        },
        {
            workoutId: 'run',
            mode: 'cardio',
            durationSec: 300,
            distance: 0.5,
            distanceUnit: 'mi',
            completed: true,
        },
    ], workouts);

    assert.equal(series.get('mi')[0].durationSec, 600);
    assert.equal(series.get('mi')[0].distance, 1);
    assert.equal(series.get('mi')[0].pace, 600);
});

test('keeps same-day workouts as separate trend points and excludes incomplete sets', () => {
    const workouts = new Map([
        ['morning', { id: 'morning', date: '2026-07-27', unit: 'lb' }],
        ['evening', { id: 'evening', date: '2026-07-27', unit: 'lb' }],
    ]);
    const series = buildExerciseTrendSeries([
        { workoutId: 'morning', weight: 100, reps: 5, completed: true },
        { workoutId: 'morning', weight: 200, reps: 5, completed: false },
        { workoutId: 'evening', weight: 110, reps: 5, completed: true },
    ], workouts);

    assert.deepEqual(series.get('lb').map(point => point.bestWeight), [100, 110]);
});

test('separates exercise trends by unit and selects the most recent unit', () => {
    const workouts = new Map([
        ['old', { id: 'old', date: '2026-07-01', unit: 'lb' }],
        ['new', { id: 'new', date: '2026-07-27', unit: 'kg' }],
    ]);
    const series = buildExerciseTrendSeries([
        { workoutId: 'old', weight: 100, reps: 5, completed: true },
        { workoutId: 'new', weight: 50, reps: 5, completed: true },
    ], workouts);

    assert.equal(series.get('lb')[0].bestWeight, 100);
    assert.equal(series.get('kg')[0].bestWeight, 50);
    assert.equal(latestTrendUnit(series), 'kg');
});
