/**
 * Parse an editable set field while preserving the difference between a blank
 * value and a real zero (zero weight is valid for bodyweight movements).
 */
export function parseSetInput(field, rawValue) {
    const text = String(rawValue ?? '').trim();
    if (text === '') return null;

    const value = Number(text);
    if (!Number.isFinite(value)) return null;

    if (!['weight', 'reps', 'rpe'].includes(field)) return null;
    return value;
}

export function validateSetForCompletion(set) {
    if (!Number.isFinite(set?.weight) || set.weight < 0) {
        return {
            valid: false,
            field: 'weight',
            message: 'Enter a weight of zero or more.',
        };
    }

    if (!Number.isInteger(set?.reps) || set.reps <= 0) {
        return {
            valid: false,
            field: 'reps',
            message: 'Reps must be a positive whole number.',
        };
    }

    if (
        set.rpe !== null
        && set.rpe !== undefined
        && (!Number.isFinite(set.rpe) || set.rpe < 1 || set.rpe > 10)
    ) {
        return {
            valid: false,
            field: 'rpe',
            message: 'RPE must be between 1 and 10, or left blank.',
        };
    }

    return { valid: true, field: null, message: '' };
}

export function getWorkoutProgress(workout) {
    const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];
    const sets = exercises.flatMap(exercise =>
        Array.isArray(exercise?.sets) ? exercise.sets : []
    );
    const completed = sets.filter(set => set.completed).length;

    return {
        total: sets.length,
        completed,
        incomplete: sets.length - completed,
    };
}

export function findFirstInvalidCompletedSet(workout) {
    const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];

    for (let exerciseIndex = 0; exerciseIndex < exercises.length; exerciseIndex++) {
        const sets = Array.isArray(exercises[exerciseIndex]?.sets)
            ? exercises[exerciseIndex].sets
            : [];

        for (let setIndex = 0; setIndex < sets.length; setIndex++) {
            if (!sets[setIndex].completed) continue;
            const validation = validateSetForCompletion(sets[setIndex]);
            if (!validation.valid) {
                return { exerciseIndex, setIndex, ...validation };
            }
        }
    }

    return null;
}

export function hasMeaningfulWorkoutProgress(workout) {
    if (!workout || typeof workout !== 'object') return false;
    if (String(workout.notes || '').trim()) return true;

    const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
    return exercises.some(exercise => {
        if (String(exercise?.notes || '').trim()) return true;
        return Array.isArray(exercise?.sets) && exercise.sets.length > 0;
    });
}
