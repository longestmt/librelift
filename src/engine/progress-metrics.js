export function estimateOneRepMax(weight, reps) {
    if (!Number.isFinite(weight) || weight <= 0) return 0;
    if (!Number.isFinite(reps) || reps <= 0) return 0;
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
}

export function resolveSetUnit(set, workout, fallbackUnit = 'lb') {
    return set?.unit || workout?.unit || fallbackUnit;
}

export function calculateVolumeByUnit(sets, workoutById = new Map(), fallbackUnit = 'lb') {
    const volumes = new Map();

    for (const set of sets || []) {
        if (!set?.completed) continue;
        if (!Number.isFinite(set.weight) || !Number.isFinite(set.reps)) continue;

        const unit = resolveSetUnit(set, workoutById.get(set.workoutId), fallbackUnit);
        const volume = Math.max(0, set.weight) * Math.max(0, set.reps);
        volumes.set(unit, (volumes.get(unit) || 0) + volume);
    }

    return volumes;
}

export function summarizeWorkout(workout, sets, fallbackUnit = 'lb') {
    const workoutSets = Array.isArray(sets) ? sets : [];
    const completed = workoutSets.filter(set => set.completed).length;
    const workoutMap = new Map([[workout?.id, workout]]);
    const exerciseKeys = new Set(
        workoutSets.map(set => set.exerciseId || set.exerciseName).filter(Boolean)
    );

    return {
        completed,
        total: workoutSets.length,
        incomplete: workoutSets.length - completed,
        exerciseCount: workout?.exerciseCount || exerciseKeys.size,
        volumeByUnit: calculateVolumeByUnit(workoutSets, workoutMap, fallbackUnit),
    };
}

function pointDate(workout, sets) {
    if (workout?.date) return workout.date;
    const createdAt = sets.find(set => set.createdAt)?.createdAt;
    return createdAt ? createdAt.slice(0, 10) : '';
}

function shortDateLabel(date) {
    if (!date || date.length < 10) return 'Unknown';
    return `${date.slice(5, 7)}/${date.slice(8, 10)}`;
}

/**
 * Build one best-weight and estimated-1RM point per workout, separated by unit.
 * Workouts on the same date remain separate observations.
 */
export function buildExerciseTrendSeries(
    exerciseSets,
    workoutById = new Map(),
    fallbackUnit = 'lb'
) {
    const byWorkout = new Map();
    let workoutOrder = 0;
    for (const set of exerciseSets || []) {
        if (!set?.completed) continue;
        if (!Number.isFinite(set.weight) || set.weight < 0) continue;
        if (!Number.isFinite(set.reps) || set.reps <= 0) continue;
        if (!byWorkout.has(set.workoutId)) {
            byWorkout.set(set.workoutId, { sets: [], order: workoutOrder++ });
        }
        byWorkout.get(set.workoutId).sets.push(set);
    }

    const byUnit = new Map();
    for (const [workoutId, workoutGroup] of byWorkout) {
        const { sets, order } = workoutGroup;
        const workout = workoutById.get(workoutId);
        const unitGroups = new Map();

        for (const set of sets) {
            const unit = resolveSetUnit(set, workout, fallbackUnit);
            if (!unitGroups.has(unit)) unitGroups.set(unit, []);
            unitGroups.get(unit).push(set);
        }

        for (const [unit, unitSets] of unitGroups) {
            const date = pointDate(workout, unitSets);
            const bestWeight = Math.max(...unitSets.map(set => set.weight));
            const estimated1RM = Math.max(
                ...unitSets.map(set => estimateOneRepMax(set.weight, set.reps))
            );
            if (!byUnit.has(unit)) byUnit.set(unit, []);
            byUnit.get(unit).push({
                workoutId,
                date,
                label: shortDateLabel(date),
                bestWeight,
                estimated1RM,
                sortKey: `${date}:${workout?.createdAt || ''}`,
                order,
            });
        }
    }

    for (const points of byUnit.values()) {
        points.sort((a, b) =>
            a.sortKey.localeCompare(b.sortKey) || a.order - b.order
        );
    }

    return byUnit;
}

export function latestTrendUnit(series, fallbackUnit = 'lb') {
    let latest = null;
    for (const [unit, points] of series) {
        const point = points[points.length - 1];
        if (!point) continue;
        const key = `${point.sortKey}:${String(point.order).padStart(10, '0')}`;
        if (!latest || key > latest.key) latest = { unit, key };
    }
    return latest?.unit || series.keys().next().value || fallbackUnit;
}
