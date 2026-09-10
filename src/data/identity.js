import { CARDIO_EXERCISES, DEFAULT_EXERCISES } from './exercises-seed.js';

const BUILTIN_EXERCISES = [...DEFAULT_EXERCISES, ...CARDIO_EXERCISES];
export const BUILTIN_SEED_TIMESTAMP = '2025-01-01T00:00:00.000Z';

export function normalizedSlug(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'unnamed';
}

export function builtinExerciseId(name) {
    return `builtin-exercise-v1-${normalizedSlug(name)}`;
}

export const BUILTIN_ID_BY_NAME = new Map(
    BUILTIN_EXERCISES.map(exercise => [exercise.name, builtinExerciseId(exercise.name)])
);

export const BUILTIN_EXERCISE_BY_NAME = new Map(
    BUILTIN_EXERCISES.map(exercise => [exercise.name, Object.freeze({ ...exercise })])
);

const LEGACY_BUILTIN_ID_MAP = new Map([
    ...DEFAULT_EXERCISES.map((exercise, index) => [
        `seed-${index}`,
        builtinExerciseId(exercise.name),
    ]),
    ...CARDIO_EXERCISES.map(exercise => [
        `seed-cardio-${exercise.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        builtinExerciseId(exercise.name),
    ]),
]);

export function isCanonicalBuiltinExerciseId(id) {
    return typeof id === 'string' && id.startsWith('builtin-exercise-v1-');
}

export function canonicalBuiltinRecord(exercise) {
    const id = canonicalBuiltinId(exercise);
    const definition = BUILTIN_EXERCISE_BY_NAME.get(exercise?.name);
    if (!id || !definition) return null;
    return {
        ...definition,
        id,
        createdAt: BUILTIN_SEED_TIMESTAMP,
        updatedAt: BUILTIN_SEED_TIMESTAMP,
        deleted: false,
    };
}

/**
 * This mapping intentionally recognizes only IDs LibreLift itself previously
 * assigned to seed records. A custom exercise with the same display name keeps
 * its UUID and remains a distinct synchronized entity.
 */
export function canonicalBuiltinId(exercise) {
    if (!exercise || typeof exercise.id !== 'string') return null;
    if (isCanonicalBuiltinExerciseId(exercise.id)) return exercise.id;
    const encodedIdentity = LEGACY_BUILTIN_ID_MAP.get(exercise.id);
    if (encodedIdentity) return encodedIdentity;
    if (exercise.id.startsWith('seed-') && BUILTIN_ID_BY_NAME.has(exercise.name)) {
        return BUILTIN_ID_BY_NAME.get(exercise.name);
    }
    return null;
}

// FNV-1a 64-bit provides compact deterministic IDs without requiring async
// WebCrypto inside an IndexedDB versionchange transaction.
export function stableHash(value) {
    let hash = 0xcbf29ce484222325n;
    const bytes = new TextEncoder().encode(String(value));
    for (const byte of bytes) {
        hash ^= BigInt(byte);
        hash = BigInt.asUintN(64, hash * 0x100000001b3n);
    }
    return hash.toString(36).padStart(13, '0');
}

function stableValue(value) {
    if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(key =>
            `${JSON.stringify(key)}:${stableValue(value[key])}`
        ).join(',')}}`;
    }
    return JSON.stringify(value);
}

export function deterministicDayId(planId, day, index) {
    return `plan-day-v1-${stableHash(stableValue({
        planId,
        index,
        name: day?.name || '',
    }))}`;
}

export function deterministicPlanExerciseId(planId, dayId, exercise, index) {
    return `plan-exercise-v1-${stableHash(stableValue({
        planId,
        dayId,
        index,
        exerciseId: exercise?.exerciseId || null,
        exerciseName: exercise?.exerciseName || null,
    }))}`;
}

export function withStablePlanIds(plan) {
    const planId = plan.id;
    return {
        ...plan,
        days: (plan.days || []).map((day, dayIndex) => {
            const dayId = day.dayId || deterministicDayId(planId, day, dayIndex);
            return {
                ...day,
                dayId,
                exercises: (day.exercises || []).map((exercise, exerciseIndex) => ({
                    ...exercise,
                    planExerciseId: exercise.planExerciseId || deterministicPlanExerciseId(
                        planId,
                        dayId,
                        exercise,
                        exerciseIndex
                    ),
                })),
            };
        }),
    };
}

export function remapPlanExerciseReferences(plan, exerciseIdMap) {
    return withStablePlanIds({
        ...plan,
        days: (plan.days || []).map(day => ({
            ...day,
            exercises: (day.exercises || []).map(exercise => ({
                ...exercise,
                exerciseId: exerciseIdMap.get(exercise.exerciseId) || exercise.exerciseId,
            })),
        })),
    });
}

/**
 * Normalize an older portable backup after validation but before restore.
 * The database migration marker is device-local and may already be set, so a
 * restore must not be able to reintroduce legacy seed IDs behind that marker.
 */
export function normalizePortableIdentity(stores) {
    const copy = structuredClone(stores);
    const exerciseIdMap = new Map();
    const exercisesById = new Map();

    for (const exercise of copy.exercises || []) {
        const canonicalId = canonicalBuiltinId(exercise);
        if (canonicalId && canonicalId !== exercise.id) {
            exerciseIdMap.set(exercise.id, canonicalId);
        }
        const normalized = canonicalId
            ? { ...exercise, id: canonicalId }
            : exercise;
        exercisesById.set(normalized.id, normalized);
    }

    return {
        ...copy,
        exercises: [...exercisesById.values()],
        sets: (copy.sets || []).map(set => ({
            ...set,
            exerciseId: exerciseIdMap.get(set.exerciseId) || set.exerciseId,
        })),
        plans: (copy.plans || []).map(plan =>
            remapPlanExerciseReferences(plan, exerciseIdMap)
        ),
    };
}
