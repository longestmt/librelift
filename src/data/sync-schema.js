import {
    isSynchronizedSetting,
    SYNCED_ENTITY_STORES,
} from './sync-config.js';
import {
    BUILTIN_SEED_TIMESTAMP,
    isCanonicalBuiltinExerciseId,
    withStablePlanIds,
} from './identity.js';

function plainObject(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${label} must be an object.`);
    }
    return value;
}

function nonEmptyString(value, label) {
    if (typeof value !== 'string' || value.trim() === '' || value.length > 500) {
        throw new Error(`${label} must be a non-empty string.`);
    }
}

function isoDate(value, label) {
    nonEmptyString(value, label);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(`${label} must use YYYY-MM-DD.`);
    }
    const [year, month, day] = value.split('-').map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
        throw new Error(`${label} is not a real calendar date.`);
    }
}

function own(record, key, label) {
    if (!Object.hasOwn(record, key)) throw new Error(`${label} is required.`);
}

function nonNegativeFinite(value, label, { nullable = false } = {}) {
    if (nullable && value === null) return;
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${label} must be a non-negative number${nullable ? ' or null' : ''}.`);
    }
}

function validateSetting(key, value) {
    if (!isSynchronizedSetting(key)) {
        throw new Error(`Setting "${key}" is device-local and cannot be synchronized.`);
    }
    if (key === 'unit') {
        if (!['lb', 'kg'].includes(value)) throw new Error('unit is unsupported.');
    } else if (key === 'distanceUnit') {
        if (!['mi', 'km'].includes(value)) throw new Error('distanceUnit is unsupported.');
    } else if (key === 'theme') {
        if (!['dark', 'amoled', 'light'].includes(value)) throw new Error('theme is unsupported.');
    } else if (['barWeight', 'restTimer', 'autoPauseMin', 'maxWorkoutMin'].includes(key)) {
        if (!Number.isFinite(value) || value < 0) throw new Error(`${key} must be non-negative.`);
    } else if (key === 'plateInventory') {
        plainObject(value, 'plateInventory');
        for (const count of Object.values(value)) {
            if (!Number.isSafeInteger(count) || count < 0) {
                throw new Error('Every plateInventory count must be a non-negative integer.');
            }
        }
    }
}

export function validateSynchronizedPayload(entityType, entityId, payload) {
    const record = structuredClone(plainObject(payload, `${entityType} payload`));
    if (entityType === 'settings') {
        nonEmptyString(entityId, 'Setting key');
        if (record.key !== entityId) throw new Error('Setting payload key does not match its entity ID.');
        validateSetting(entityId, record.value);
        return record;
    }
    if (!SYNCED_ENTITY_STORES.includes(entityType)) {
        throw new Error(`Unsupported LibreLift synchronized entity type: ${entityType}`);
    }
    nonEmptyString(entityId, `${entityType} entity ID`);
    if (record.id !== entityId) throw new Error(`${entityType} payload ID does not match its entity ID.`);
    if (record.deleted === true) throw new Error('A put payload cannot be marked deleted.');

    if (entityType === 'exercises') nonEmptyString(record.name, 'Exercise name');
    if (entityType === 'plans') {
        nonEmptyString(record.name, 'Plan name');
        if (!Array.isArray(record.days)) throw new Error('Plan days must be a list.');
        if (record.currentDayIndex !== undefined && (
            !Number.isSafeInteger(record.currentDayIndex)
            || record.currentDayIndex < 0
            || (record.days.length > 0 && record.currentDayIndex >= record.days.length)
        )) throw new Error('Plan currentDayIndex is invalid.');
        const dayIds = new Set();
        const planExerciseIds = new Set();
        for (const day of record.days) {
            nonEmptyString(day?.dayId, 'Plan day ID');
            if (dayIds.has(day.dayId)) throw new Error(`Duplicate plan day ID "${day.dayId}".`);
            dayIds.add(day.dayId);
            nonEmptyString(day?.name, 'Plan day name');
            if (!Array.isArray(day.exercises)) throw new Error('Plan day exercises must be a list.');
            for (const exercise of day.exercises) {
                nonEmptyString(exercise?.planExerciseId, 'Plan exercise row ID');
                if (planExerciseIds.has(exercise.planExerciseId)) {
                    throw new Error(
                        `Duplicate plan exercise row ID "${exercise.planExerciseId}".`
                    );
                }
                planExerciseIds.add(exercise.planExerciseId);
                nonEmptyString(exercise?.exerciseId, 'Plan exercise ID');
            }
        }
        return withStablePlanIds(record);
    }
    if (entityType === 'workouts') {
        isoDate(record.date, 'Workout date');
        if (record.durationSec !== undefined) {
            nonNegativeFinite(record.durationSec, 'Workout duration');
        }
        if (record.exerciseCount !== undefined && (
            !Number.isSafeInteger(record.exerciseCount) || record.exerciseCount < 0
        )) throw new Error('Workout exerciseCount must be a non-negative integer.');
    }
    if (entityType === 'sets') {
        nonEmptyString(record.workoutId, 'Set workout ID');
        nonEmptyString(record.exerciseId, 'Set exercise ID');
        own(record, 'setNumber', 'Set number');
        if (!Number.isSafeInteger(record.setNumber) || record.setNumber < 1) {
            throw new Error('Set number must be a positive integer.');
        }
        own(record, 'weight', 'Set weight');
        nonNegativeFinite(record.weight, 'Set weight', { nullable: true });
        own(record, 'reps', 'Set reps');
        if (record.reps !== null && (!Number.isSafeInteger(record.reps) || record.reps < 0)) {
            throw new Error('Set reps must be a non-negative integer or null.');
        }
        own(record, 'completed', 'Set completed');
        if (typeof record.completed !== 'boolean') {
            throw new Error('Set completed must be a boolean.');
        }
    }
    if (entityType === 'bodyWeight') {
        isoDate(record.date, 'Body-weight date');
        if (!Number.isFinite(record.value) || record.value <= 0) {
            throw new Error('Body-weight value must be positive.');
        }
        if (record.unit !== undefined && !['lb', 'kg'].includes(record.unit)) {
            throw new Error('Body-weight unit is unsupported.');
        }
    }
    return record;
}

export function validateMaterializedEntity(entity) {
    plainObject(entity, 'Materialized entity');
    nonEmptyString(entity.entityType, 'Entity type');
    nonEmptyString(entity.entityId, 'Entity ID');
    if (entity.kind !== 'put' && entity.kind !== 'delete') {
        throw new Error('Materialized entity kind is unsupported.');
    }
    if (entity.entityType === 'settings') {
        if (!isSynchronizedSetting(entity.entityId)) {
            throw new Error(`Setting "${entity.entityId}" is device-local and cannot be synchronized.`);
        }
    } else if (!SYNCED_ENTITY_STORES.includes(entity.entityType)) {
        throw new Error(`Unsupported LibreLift synchronized entity type: ${entity.entityType}`);
    }
    return entity.kind === 'put'
        ? { ...entity, payload: validateSynchronizedPayload(entity.entityType, entity.entityId, entity.payload) }
        : structuredClone(entity);
}

/**
 * Called only by the LibreSync client inside the same remote-apply transaction.
 * It deliberately writes stores directly, so remote operations never echo into
 * the local outbox.
 */
export function applyMaterializedEntities({ transaction, entities }) {
    const validated = entities.map(validateMaterializedEntity);
    for (const entity of validated) {
        const store = transaction.objectStore(entity.entityType);
        const authoredAt = entity.alternatives?.[0]?.authoredAt || new Date(0).toISOString();
        if (entity.entityType === 'settings') {
            if (entity.kind === 'delete') store.delete(entity.entityId);
            else store.put({ ...entity.payload, updatedAt: authoredAt });
            continue;
        }
        if (entity.kind === 'put') {
            const createdAt = entity.entityType === 'exercises'
                && isCanonicalBuiltinExerciseId(entity.entityId)
                && !entity.payload.createdAt
                ? { createdAt: BUILTIN_SEED_TIMESTAMP }
                : {};
            store.put({ ...entity.payload, ...createdAt, updatedAt: authoredAt, deleted: false });
        } else {
            store.put({ id: entity.entityId, deleted: true, updatedAt: authoredAt });
        }
    }
}
