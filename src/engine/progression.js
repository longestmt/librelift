/**
 * progression.js — Progressive overload engine
 * Pure functions for suggesting weights and calculating plates
 */

import { getByIndex } from '../data/db.js';

/**
 * Suggest the next weight for an exercise based on plan config and history.
 * @param {string} exerciseId
 * @param {object} config - { increment, deloadPercent, deloadAfter, sets, reps }
 * @param {string} unit - 'lb' or 'kg'
 * @returns {Promise<{weight: number, reason: string}>}
 */
export async function suggestNextWeight(exerciseId, config, unit = 'lb') {
    const sets = await getByIndex('sets', 'exerciseId', exerciseId);
    if (!sets.length) {
        return { weight: 0, reason: 'first-time' };
    }

    // Group sets by workout, get last N workouts
    const workoutMap = new Map();
    for (const s of sets) {
        if (!workoutMap.has(s.workoutId)) workoutMap.set(s.workoutId, []);
        workoutMap.get(s.workoutId).push(s);
    }

    // Sort workouts by date (newest first)
    const workouts = [...workoutMap.entries()].sort((a, b) => {
        const aDate = a[1][0].createdAt || '';
        const bDate = b[1][0].createdAt || '';
        return bDate.localeCompare(aDate);
    });

    if (workouts.length === 0) {
        return { weight: 0, reason: 'first-time' };
    }

    const lastWorkoutSets = workouts[0][1];
    const lastWeight = Math.max(...lastWorkoutSets.map(s => s.weight || 0));

    // Check if all sets in last workout were completed successfully
    const targetSets = config.sets || lastWorkoutSets.length;
    const targetReps = config.reps || 5;

    const completedSets = lastWorkoutSets.filter(s => s.completed && s.reps >= targetReps);
    const allCompleted = completedSets.length >= targetSets;

    if (allCompleted) {
        // Success: increase weight
        const increment = config.increment || 5;
        return {
            weight: lastWeight + increment,
            reason: 'increment',
        };
    }

    // Check consecutive failures
    const deloadAfter = config.deloadAfter || 3;
    let consecutiveFailures = 0;

    for (const [, wSets] of workouts) {
        const wCompleted = wSets.filter(s => s.completed && s.reps >= targetReps);
        if (wCompleted.length < targetSets) {
            consecutiveFailures++;
        } else {
            break;
        }
    }

    if (consecutiveFailures >= deloadAfter) {
        // Deload
        const deloadPercent = config.deloadPercent || 10;
        const deloadedWeight = roundToNearest(lastWeight * (1 - deloadPercent / 100), unit === 'kg' ? 2.5 : 5);
        return {
            weight: deloadedWeight,
            reason: 'deload',
        };
    }

    // Keep same weight
    return {
        weight: lastWeight,
        reason: 'retry',
    };
}

/**
 * Get sorted exercise history (for charts).
 */
export async function getExerciseHistory(exerciseId) {
    const sets = await getByIndex('sets', 'exerciseId', exerciseId);
    if (!sets.length) return [];

    // Group by workout and get best set per workout
    const workoutMap = new Map();
    for (const s of sets) {
        if (!workoutMap.has(s.workoutId)) workoutMap.set(s.workoutId, []);
        workoutMap.get(s.workoutId).push(s);
    }

    const history = [];
    for (const [workoutId, wSets] of workoutMap) {
        const best = wSets.reduce((a, b) => (a.weight || 0) > (b.weight || 0) ? a : b);
        const notes = wSets.find(s => s.notes)?.notes || '';
        history.push({
            workoutId,
            date: best.createdAt,
            weight: best.weight || 0,
            reps: best.reps || 0,
            volume: wSets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0),
            notes
        });
    }

    return history.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

/**
 * Calculate plates needed per side.
 * @param {number} targetWeight - Total target weight
 * @param {number} barWeight - Weight of the bar
 * @param {object} plateInventory - { "45": 4, "25": 2, "10": 4, ... } (count of each)
 * @returns {{ perSide: Array<{weight: number, count: number}>, remainder: number }}
 */
export function calculatePlates(targetWeight, barWeight, plateInventory) {
    const weightPerSide = (targetWeight - barWeight) / 2;
    if (weightPerSide <= 0) {
        return { perSide: [], remainder: 0 };
    }

    // Sort plate sizes descending
    const plateSizes = Object.keys(plateInventory)
        .map(Number)
        .filter(p => plateInventory[p] > 0)
        .sort((a, b) => b - a);

    const perSide = [];
    let remaining = weightPerSide;
    const usedCounts = {};

    for (const size of plateSizes) {
        if (remaining <= 0) break;
        // Each plate in inventory is a pair (2 plates), so per side = inventory / 2
        const availablePerSide = Math.floor(plateInventory[size] / 2);
        const needed = Math.floor(remaining / size);
        const use = Math.min(needed, availablePerSide);
        if (use > 0) {
            perSide.push({ weight: size, count: use });
            remaining -= use * size;
            usedCounts[size] = use;
        }
    }

    return {
        perSide,
        remainder: Math.round(remaining * 100) / 100,
    };
}

function roundToNearest(value, nearest) {
    return Math.round(value / nearest) * nearest;
}

/**
 * Standard plate sizes.
 */
export const STANDARD_PLATES_LB = {
    45: 0, 35: 0, 25: 0, 10: 0, 5: 0, 2.5: 0,
};

export const STANDARD_PLATES_KG = {
    20: 0, 15: 0, 10: 0, 5: 0, 2.5: 0, 1.25: 0,
};
