import { randomUUID } from 'node:crypto';

function active(records) {
  return records.filter(record => !record.deleted);
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function timestamp() {
  return new Date().toISOString();
}

function setting(backup, key, fallback = null) {
  return active(backup.stores.settings).find(record => record.key === key)?.value ?? fallback;
}

function assertDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Date must use YYYY-MM-DD.');
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid calendar date: ${date}.`);
  }
}

function findExercise(backup, requestedName) {
  const query = normalize(requestedName);
  if (!query) throw new Error('Exercise name is required.');

  const exercises = active(backup.stores.exercises);
  const exact = exercises.filter(exercise => normalize(exercise.name) === query);
  if (exact.length === 1) return exact[0];

  const partial = exercises.filter(exercise => normalize(exercise.name).includes(query));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    throw new Error(
      `Exercise "${requestedName}" is ambiguous. Try one of: ${partial.slice(0, 8).map(exercise => exercise.name).join(', ')}.`
    );
  }
  throw new Error(`Exercise "${requestedName}" was not found in LibreLift.`);
}

function setsForWorkout(backup, workoutId) {
  return active(backup.stores.sets)
    .filter(setRecord => setRecord.workoutId === workoutId)
    .sort((a, b) => (a.setNumber || 0) - (b.setNumber || 0));
}

function summarizeWorkout(backup, workout) {
  const sets = setsForWorkout(backup, workout.id);
  const completed = sets.filter(setRecord => setRecord.completed);
  const volume = completed.reduce((sum, setRecord) => {
    if (setRecord.mode === 'cardio') return sum;
    return sum + (Number(setRecord.weight) || 0) * (Number(setRecord.reps) || 0);
  }, 0);

  const grouped = new Map();
  for (const setRecord of sets) {
    const name = setRecord.exerciseName || setRecord.exerciseId || 'Unknown exercise';
    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name).push({
      set: setRecord.setNumber ?? null,
      weight: setRecord.weight ?? null,
      reps: setRecord.reps ?? null,
      rpe: setRecord.rpe ?? null,
      completed: !!setRecord.completed,
      unit: setRecord.unit || workout.unit || null,
    });
  }

  return {
    id: workout.id,
    date: workout.date,
    name: workout.dayName || workout.planName || 'Workout',
    duration_minutes: workout.durationSec ? Math.round(workout.durationSec / 60) : null,
    completed_sets: completed.length,
    total_sets: sets.length,
    volume,
    unit: workout.unit || setting(backup, 'unit', 'lb'),
    notes: workout.notes || null,
    exercises: [...grouped.entries()].map(([name, exerciseSets]) => ({
      name,
      sets: exerciseSets,
    })),
  };
}

export function listExercises(backup, { query = '', limit = 20 } = {}) {
  const normalizedQuery = normalize(query);
  return active(backup.stores.exercises)
    .filter(exercise => !normalizedQuery || [
      exercise.name,
      exercise.muscleGroup,
      exercise.equipment,
      exercise.category,
    ].some(value => normalize(value).includes(normalizedQuery)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, Math.max(1, Math.min(limit, 100)))
    .map(exercise => ({
      id: exercise.id,
      name: exercise.name,
      muscle_group: exercise.muscleGroup || null,
      equipment: exercise.equipment || null,
      category: exercise.category || null,
    }));
}

export function getRecentWorkouts(backup, { limit = 10 } = {}) {
  return active(backup.stores.workouts)
    .sort((a, b) =>
      String(b.date || '').localeCompare(String(a.date || ''))
      || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    )
    .slice(0, Math.max(1, Math.min(limit, 50)))
    .map(workout => summarizeWorkout(backup, workout));
}

export function getBodyWeightHistory(backup, { limit = 30 } = {}) {
  return active(backup.stores.bodyWeight)
    .sort((a, b) =>
      String(b.date || '').localeCompare(String(a.date || ''))
      || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    )
    .slice(0, Math.max(1, Math.min(limit, 365)))
    .map(entry => ({
      id: entry.id,
      date: entry.date,
      value: entry.value,
      unit: entry.unit || setting(backup, 'unit', 'lb'),
    }));
}

export function getExerciseProgress(backup, { exercise_name: exerciseName, limit = 20 }) {
  const exercise = findExercise(backup, exerciseName);
  const workoutsById = new Map(
    active(backup.stores.workouts).map(workout => [workout.id, workout])
  );
  const entriesByWorkout = new Map();

  for (const setRecord of active(backup.stores.sets)) {
    if (
      setRecord.exerciseId !== exercise.id
      || !setRecord.completed
      || setRecord.mode === 'cardio'
    ) continue;
    const workout = workoutsById.get(setRecord.workoutId);
    if (!workout) continue;
    if (!entriesByWorkout.has(workout.id)) {
      entriesByWorkout.set(workout.id, { workout, sets: [] });
    }
    entriesByWorkout.get(workout.id).sets.push(setRecord);
  }

  const sessions = [...entriesByWorkout.values()]
    .map(({ workout, sets }) => {
      const topSet = [...sets].sort((a, b) => {
        const aOneRepMax = Number(a.weight || 0) * (1 + Number(a.reps || 0) / 30);
        const bOneRepMax = Number(b.weight || 0) * (1 + Number(b.reps || 0) / 30);
        return bOneRepMax - aOneRepMax;
      })[0];
      return {
        date: workout.date,
        top_set: {
          weight: Number(topSet.weight) || 0,
          reps: Number(topSet.reps) || 0,
          rpe: topSet.rpe ?? null,
          estimated_1rm: Math.round((Number(topSet.weight) || 0) * (1 + (Number(topSet.reps) || 0) / 30) * 10) / 10,
        },
        volume: sets.reduce(
          (sum, setRecord) => sum + (Number(setRecord.weight) || 0) * (Number(setRecord.reps) || 0),
          0
        ),
        unit: topSet.unit || workout.unit || setting(backup, 'unit', 'lb'),
      };
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, Math.max(1, Math.min(limit, 100)));

  return { exercise: exercise.name, sessions };
}

export function logStrengthWorkout(backup, input, now = timestamp()) {
  const date = input.date || now.slice(0, 10);
  assertDate(date);
  if (!Array.isArray(input.exercises) || input.exercises.length === 0) {
    throw new Error('At least one exercise is required.');
  }

  if (input.request_id) {
    const existing = active(backup.stores.workouts)
      .find(workout => workout.sourceRequestId === input.request_id);
    if (existing) {
      return { created: false, workout: summarizeWorkout(backup, existing) };
    }
  }

  const unit = input.unit || setting(backup, 'unit', 'lb');
  if (!['lb', 'kg'].includes(unit)) throw new Error('Unit must be "lb" or "kg".');

  const resolvedExercises = input.exercises.map(exerciseInput => {
    const exercise = findExercise(backup, exerciseInput.name);
    if (!Array.isArray(exerciseInput.sets) || exerciseInput.sets.length === 0) {
      throw new Error(`${exercise.name} needs at least one set.`);
    }
    return { exercise, input: exerciseInput };
  });

  const workoutId = randomUUID();
  const workout = {
    id: workoutId,
    date,
    planId: null,
    planName: null,
    dayName: input.name || 'ChatGPT Workout',
    notes: input.notes || '',
    durationSec: input.duration_minutes ? Math.round(input.duration_minutes * 60) : null,
    exerciseCount: resolvedExercises.length,
    unit,
    source: 'chatgpt',
    sourceRequestId: input.request_id || null,
    createdAt: now,
    updatedAt: now,
    deleted: false,
  };

  const setRecords = [];
  for (const { exercise, input: exerciseInput } of resolvedExercises) {
    exerciseInput.sets.forEach((setInput, index) => {
      const weight = Number(setInput.weight);
      const reps = Number(setInput.reps);
      if (!Number.isFinite(weight) || weight < 0) {
        throw new Error(`${exercise.name} set ${index + 1} has an invalid weight.`);
      }
      if (!Number.isInteger(reps) || reps < 1) {
        throw new Error(`${exercise.name} set ${index + 1} has invalid reps.`);
      }
      if (
        setInput.rpe != null
        && (!Number.isFinite(Number(setInput.rpe)) || Number(setInput.rpe) < 1 || Number(setInput.rpe) > 10)
      ) {
        throw new Error(`${exercise.name} set ${index + 1} has an invalid RPE.`);
      }
      setRecords.push({
        id: randomUUID(),
        workoutId,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        setNumber: index + 1,
        weight,
        reps,
        rpe: setInput.rpe == null ? null : Number(setInput.rpe),
        durationSec: null,
        distance: null,
        distanceUnit: null,
        calories: null,
        mode: 'strength',
        completed: setInput.completed ?? true,
        failed: setInput.failed ?? false,
        notes: exerciseInput.notes || '',
        setType: setInput.set_type || null,
        unit,
        createdAt: now,
        updatedAt: now,
        deleted: false,
      });
    });
  }

  backup.stores.workouts.push(workout);
  backup.stores.sets.push(...setRecords);
  backup.exportedAt = now;
  backup.backedUpAt = now;

  return { created: true, workout: summarizeWorkout(backup, workout) };
}

export function logBodyWeight(backup, input, now = timestamp()) {
  const date = input.date || now.slice(0, 10);
  assertDate(date);
  const value = Number(input.value);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Body weight must be greater than zero.');
  }
  const unit = input.unit || setting(backup, 'unit', 'lb');
  if (!['lb', 'kg'].includes(unit)) throw new Error('Unit must be "lb" or "kg".');

  if (input.request_id) {
    const existing = active(backup.stores.bodyWeight)
      .find(entry => entry.sourceRequestId === input.request_id);
    if (existing) return { created: false, entry: existing };
  }

  const entry = {
    id: randomUUID(),
    date,
    value,
    unit,
    source: 'chatgpt',
    sourceRequestId: input.request_id || null,
    createdAt: now,
    updatedAt: now,
    deleted: false,
  };
  backup.stores.bodyWeight.push(entry);
  backup.exportedAt = now;
  backup.backedUpAt = now;
  return { created: true, entry };
}
