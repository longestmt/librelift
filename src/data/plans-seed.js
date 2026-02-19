/**
 * plans-seed.js — Default workout plan templates
 * StrongLifts 5×5, Ivysaur 4-4-8, Reddit PPL
 */

export const DEFAULT_PLANS = [
    {
        name: 'StrongLifts 5×5',
        description: 'Classic 3-day A/B alternating program for beginners. Focus on compound lifts with linear progression.',
        days: [
            {
                name: 'Workout A',
                exercises: [
                    { exerciseName: 'Barbell Back Squat', sets: 5, reps: 5, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Barbell Bench Press', sets: 5, reps: 5, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Barbell Row', sets: 5, reps: 5, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                ],
            },
            {
                name: 'Workout B',
                exercises: [
                    { exerciseName: 'Barbell Back Squat', sets: 5, reps: 5, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Overhead Press', sets: 5, reps: 5, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Barbell Deadlift', sets: 1, reps: 5, increment: 10, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                ],
            },
        ],
        schedule: '3 days/week, alternating A/B (e.g. Mon A, Wed B, Fri A)',
    },
    {
        name: 'Ivysaur 4-4-8',
        description: 'Upper/lower 3×/week with variable rep ranges for balanced strength and hypertrophy.',
        days: [
            {
                name: 'Workout A',
                exercises: [
                    { exerciseName: 'Barbell Bench Press', sets: 4, reps: 4, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Barbell Back Squat', sets: 4, reps: 8, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Overhead Press', sets: 4, reps: 8, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Chin-Up', sets: 4, reps: 8, increment: 0, incrementUnit: 'lb', deloadPercent: 0, deloadAfter: 0 },
                ],
            },
            {
                name: 'Workout B',
                exercises: [
                    { exerciseName: 'Overhead Press', sets: 4, reps: 4, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Barbell Deadlift', sets: 4, reps: 4, increment: 10, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Barbell Bench Press', sets: 4, reps: 8, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Barbell Row', sets: 4, reps: 8, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                ],
            },
            {
                name: 'Workout C',
                exercises: [
                    { exerciseName: 'Barbell Bench Press', sets: 4, reps: 4, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Barbell Back Squat', sets: 4, reps: 4, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Overhead Press', sets: 4, reps: 8, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Barbell Row', sets: 4, reps: 4, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                ],
            },
        ],
        schedule: '3 days/week, rotating A/B/C',
    },
    {
        name: 'Reddit PPL',
        description: 'Linear progression PPL 6-day split from r/Fitness. Alternates main lifts (Deadlift/Row on Pull, Bench/OHP on Push).',
        days: [
            {
                name: 'Pull A (Deadlift)',
                exercises: [
                    { exerciseName: 'Barbell Deadlift', sets: 1, reps: 5, increment: 10, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Lat Pulldown', sets: 3, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Seated Cable Row', sets: 3, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Face Pull', sets: 5, reps: 20, increment: 0, incrementUnit: 'lb', deloadPercent: 0, deloadAfter: 0 },
                    { exerciseName: 'Hammer Curl', sets: 4, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Dumbbell Curl', sets: 4, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                ],
            },
            {
                name: 'Push A (Bench)',
                exercises: [
                    { exerciseName: 'Barbell Bench Press', sets: 5, reps: 5, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Overhead Press', sets: 3, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Incline Dumbbell Bench Press', sets: 3, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Tricep Pushdown', sets: 3, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Lateral Raise', sets: 3, reps: 20, increment: 0, incrementUnit: 'lb', deloadPercent: 0, deloadAfter: 0 },
                    { exerciseName: 'Overhead Tricep Extension', sets: 3, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Lateral Raise', sets: 3, reps: 20, increment: 0, incrementUnit: 'lb', deloadPercent: 0, deloadAfter: 0 },
                ],
            },
            {
                name: 'Legs',
                exercises: [
                    { exerciseName: 'Barbell Back Squat', sets: 3, reps: 5, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Romanian Deadlift', sets: 3, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Leg Press', sets: 3, reps: 12, increment: 10, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Leg Curl', sets: 3, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Standing Calf Raise', sets: 5, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                ],
            },
            {
                name: 'Pull B (Row)',
                exercises: [
                    { exerciseName: 'Barbell Row', sets: 5, reps: 5, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Pull-Up', sets: 3, reps: 12, increment: 0, incrementUnit: 'lb', deloadPercent: 0, deloadAfter: 0 },
                    { exerciseName: 'Seated Cable Row', sets: 3, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Face Pull', sets: 5, reps: 20, increment: 0, incrementUnit: 'lb', deloadPercent: 0, deloadAfter: 0 },
                    { exerciseName: 'Hammer Curl', sets: 4, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Dumbbell Curl', sets: 4, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                ],
            },
            {
                name: 'Push B (OHP)',
                exercises: [
                    { exerciseName: 'Overhead Press', sets: 5, reps: 5, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Barbell Bench Press', sets: 3, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Incline Dumbbell Bench Press', sets: 3, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Tricep Pushdown', sets: 3, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Lateral Raise', sets: 3, reps: 20, increment: 0, incrementUnit: 'lb', deloadPercent: 0, deloadAfter: 0 },
                    { exerciseName: 'Overhead Tricep Extension', sets: 3, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Lateral Raise', sets: 3, reps: 20, increment: 0, incrementUnit: 'lb', deloadPercent: 0, deloadAfter: 0 },
                ],
            },
            {
                name: 'Legs',
                exercises: [
                    { exerciseName: 'Barbell Back Squat', sets: 3, reps: 5, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Romanian Deadlift', sets: 3, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Leg Press', sets: 3, reps: 12, increment: 10, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Leg Curl', sets: 3, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                    { exerciseName: 'Standing Calf Raise', sets: 5, reps: 12, increment: 5, incrementUnit: 'lb', deloadPercent: 10, deloadAfter: 3 },
                ],
            },
        ],
        schedule: '6 days/week: Pull A, Push A, Legs, Pull B, Push B, Legs, Rest',
    },
];
