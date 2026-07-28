import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  getBodyWeightHistory,
  getExerciseProgress,
  getRecentWorkouts,
  listExercises,
  logBodyWeight,
  logStrengthWorkout,
} from './librelift.mjs';

const sourceSchema = z.string();
const unitSchema = z.enum(['lb', 'kg']);
const nullableUnitSchema = unitSchema.nullable();

const exerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  muscle_group: z.string().nullable(),
  equipment: z.string().nullable(),
  category: z.string().nullable(),
});

const workoutSetSchema = z.object({
  set: z.number().nullable(),
  weight: z.number().nullable(),
  reps: z.number().nullable(),
  rpe: z.number().nullable(),
  completed: z.boolean(),
  unit: nullableUnitSchema,
});

const workoutSchema = z.object({
  id: z.string(),
  date: z.string(),
  name: z.string(),
  duration_minutes: z.number().nullable(),
  completed_sets: z.number(),
  total_sets: z.number(),
  volume: z.number(),
  unit: unitSchema,
  notes: z.string().nullable(),
  exercises: z.array(z.object({
    name: z.string(),
    sets: z.array(workoutSetSchema),
  })),
});

const bodyWeightSchema = z.object({
  id: z.string(),
  date: z.string(),
  value: z.number(),
  unit: unitSchema,
});

function success(data, message = null) {
  return {
    content: [{ type: 'text', text: message || JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function failure(error) {
  return {
    isError: true,
    content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
  };
}

export function createLibreLiftMcpServer(store) {
  const server = new McpServer(
    { name: 'librelift', version: '0.1.0' },
    {
      instructions:
        'Resolve uncertain exercise names with list_exercises before writing. '
        + 'Confirm missing set details with the user. Pass a stable request_id to write tools so retries are idempotent.',
    }
  );

  async function read(handler) {
    try {
      const backup = await store.load();
      return success(handler(backup));
    } catch (error) {
      return failure(error);
    }
  }

  async function write(handler) {
    try {
      const backup = await store.load();
      const result = handler(backup);
      if (result.created) await store.save(backup);
      return success(result);
    } catch (error) {
      return failure(error);
    }
  }

  server.registerTool(
    'list_exercises',
    {
      title: 'List LibreLift exercises',
      description: 'Find canonical exercise names in the connected LibreLift library before logging a workout.',
      inputSchema: {
        query: z.string().optional().describe('Optional name, muscle group, equipment, or category search.'),
        limit: z.number().int().min(1).max(100).default(20),
      },
      outputSchema: {
        exercises: z.array(exerciseSchema),
        source: sourceSchema,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    input => read(backup => ({ exercises: listExercises(backup, input), source: store.describe() }))
  );

  server.registerTool(
    'get_recent_workouts',
    {
      title: 'Get recent LibreLift workouts',
      description: 'Read recent workouts, exercise sets, duration, and volume from LibreLift.',
      inputSchema: {
        limit: z.number().int().min(1).max(50).default(10),
      },
      outputSchema: {
        workouts: z.array(workoutSchema),
        source: sourceSchema,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    input => read(backup => ({ workouts: getRecentWorkouts(backup, input), source: store.describe() }))
  );

  server.registerTool(
    'get_exercise_progress',
    {
      title: 'Get exercise progress',
      description: 'Review recent top sets, estimated one-rep max, and volume for one LibreLift exercise.',
      inputSchema: {
        exercise_name: z.string().min(1).describe('A canonical or uniquely matching LibreLift exercise name.'),
        limit: z.number().int().min(1).max(100).default(20),
      },
      outputSchema: {
        exercise: z.string(),
        sessions: z.array(z.object({
          date: z.string(),
          top_set: z.object({
            weight: z.number(),
            reps: z.number(),
            rpe: z.number().nullable(),
            estimated_1rm: z.number(),
          }),
          volume: z.number(),
          unit: unitSchema,
        })),
        source: sourceSchema,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    input => read(backup => ({ ...getExerciseProgress(backup, input), source: store.describe() }))
  );

  server.registerTool(
    'get_body_weight_history',
    {
      title: 'Get body-weight history',
      description: 'Read recent body-weight measurements from LibreLift.',
      inputSchema: {
        limit: z.number().int().min(1).max(365).default(30),
      },
      outputSchema: {
        entries: z.array(bodyWeightSchema),
        source: sourceSchema,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    input => read(backup => ({ entries: getBodyWeightHistory(backup, input), source: store.describe() }))
  );

  server.registerTool(
    'log_strength_workout',
    {
      title: 'Log a strength workout',
      description: 'Save a completed strength workout to LibreLift. Confirm uncertain exercise names or set details with the user first.',
      inputSchema: {
        request_id: z.string().min(1).optional().describe('Stable unique ID for safe retries of the same log operation.'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Workout date in YYYY-MM-DD; defaults to today.'),
        name: z.string().min(1).max(120).optional(),
        duration_minutes: z.number().positive().max(1440).optional(),
        notes: z.string().max(4000).optional(),
        unit: unitSchema.optional().describe('Defaults to the user’s LibreLift setting.'),
        exercises: z.array(z.object({
          name: z.string().min(1),
          notes: z.string().max(2000).optional(),
          sets: z.array(z.object({
            weight: z.number().nonnegative(),
            reps: z.number().int().positive(),
            rpe: z.number().min(1).max(10).optional(),
            completed: z.boolean().optional(),
            failed: z.boolean().optional(),
            set_type: z.enum(['warmup', 'working', 'backoff', 'failure']).optional(),
          })).min(1),
        })).min(1),
      },
      outputSchema: {
        created: z.boolean(),
        workout: workoutSchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    input => write(backup => logStrengthWorkout(backup, input))
  );

  server.registerTool(
    'log_body_weight',
    {
      title: 'Log body weight',
      description: 'Save a body-weight measurement to LibreLift.',
      inputSchema: {
        request_id: z.string().min(1).optional().describe('Stable unique ID for safe retries of the same log operation.'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Measurement date in YYYY-MM-DD; defaults to today.'),
        value: z.number().positive(),
        unit: unitSchema.optional().describe('Defaults to the user’s LibreLift setting.'),
      },
      outputSchema: {
        created: z.boolean(),
        entry: bodyWeightSchema.extend({
          source: z.string(),
          sourceRequestId: z.string().nullable(),
          createdAt: z.string(),
          updatedAt: z.string(),
          deleted: z.boolean(),
        }),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    input => write(backup => logBodyWeight(backup, input))
  );

  return server;
}
