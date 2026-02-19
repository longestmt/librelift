/**
 * exercises-seed.js — Built-in exercise database
 * Free video links from public resources
 */

export const MUSCLE_GROUPS = [
    'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
    'Quadriceps', 'Hamstrings', 'Glutes', 'Calves',
    'Core', 'Forearms', 'Full Body',
];

export const EQUIPMENT = [
    'Barbell', 'Dumbbell', 'Cable', 'Machine',
    'Bodyweight', 'Kettlebell', 'Band', 'Other',
];

export const CATEGORIES = [
    'Compound', 'Isolation', 'Cardio', 'Stretch',
];

export const DEFAULT_EXERCISES = [
    // ---- CHEST ----
    {
        name: 'Barbell Bench Press', category: 'Compound', muscleGroup: 'Chest', equipment: 'Barbell',
        mediaUrl: 'https://www.youtube.com/watch?v=rT7DgCr-3pg',
        instructions: 'Lie flat on bench. Grip bar slightly wider than shoulders. Lower to chest, press up to lockout.'
    },
    {
        name: 'Incline Barbell Bench Press', category: 'Compound', muscleGroup: 'Chest', equipment: 'Barbell',
        mediaUrl: 'https://www.youtube.com/watch?v=SrqOu55lrYU',
        instructions: 'Set bench to 30-45°. Grip bar slightly wider than shoulders. Lower to upper chest, press up.'
    },
    {
        name: 'Dumbbell Bench Press', category: 'Compound', muscleGroup: 'Chest', equipment: 'Dumbbell',
        mediaUrl: 'https://www.youtube.com/watch?v=VmB1G1K7v94',
        instructions: 'Lie flat with dumbbells. Lower to chest level, press up bringing dumbbells together.'
    },
    {
        name: 'Incline Dumbbell Bench Press', category: 'Compound', muscleGroup: 'Chest', equipment: 'Dumbbell',
        mediaUrl: 'https://www.youtube.com/watch?v=8iPEnn-ltC8',
        instructions: 'Set bench to 30-45°. Press dumbbells up from shoulder level, lower controlled.'
    },
    {
        name: 'Dumbbell Fly', category: 'Isolation', muscleGroup: 'Chest', equipment: 'Dumbbell',
        mediaUrl: 'https://www.youtube.com/watch?v=eozdVDA78K0',
        instructions: 'Lie flat with arms extended. Lower dumbbells in arc to sides, squeeze back up.'
    },
    {
        name: 'Cable Crossover', category: 'Isolation', muscleGroup: 'Chest', equipment: 'Cable',
        mediaUrl: 'https://www.youtube.com/watch?v=taI4XduLpTk',
        instructions: 'Stand between cables set high. Bring handles together in front in arc motion.'
    },
    {
        name: 'Push-Up', category: 'Compound', muscleGroup: 'Chest', equipment: 'Bodyweight',
        mediaUrl: 'https://www.youtube.com/watch?v=IODxDxX7oi4',
        instructions: 'Hands shoulder-width. Lower chest to floor, push back up. Keep body straight.'
    },
    {
        name: 'Dip (Chest)', category: 'Compound', muscleGroup: 'Chest', equipment: 'Bodyweight',
        mediaUrl: 'https://www.youtube.com/watch?v=2z8JmcrW-As',
        instructions: 'Lean forward on dip bars. Lower body until shoulders below elbows, press up.'
    },

    // ---- BACK ----
    {
        name: 'Barbell Deadlift', category: 'Compound', muscleGroup: 'Back', equipment: 'Barbell',
        mediaUrl: 'https://www.youtube.com/watch?v=op9kVnSso6Q',
        instructions: 'Stand with feet hip-width. Hinge at hips, grip bar. Drive through heels to stand up.'
    },
    {
        name: 'Barbell Row', category: 'Compound', muscleGroup: 'Back', equipment: 'Barbell',
        mediaUrl: 'https://www.youtube.com/watch?v=FWJR5Ve8bnQ',
        instructions: 'Bend at hips ~45°. Pull bar to lower chest, squeeze shoulder blades, lower controlled.'
    },
    {
        name: 'Pull-Up', category: 'Compound', muscleGroup: 'Back', equipment: 'Bodyweight',
        mediaUrl: 'https://www.youtube.com/watch?v=eGo4IYlbE5g',
        instructions: 'Grip bar overhand, shoulder-width. Pull chin above bar, lower controlled.'
    },
    {
        name: 'Chin-Up', category: 'Compound', muscleGroup: 'Back', equipment: 'Bodyweight',
        mediaUrl: 'https://www.youtube.com/watch?v=brhRXlOhWAM',
        instructions: 'Grip bar underhand, shoulder-width. Pull chin above bar, lower controlled.'
    },
    {
        name: 'Lat Pulldown', category: 'Compound', muscleGroup: 'Back', equipment: 'Cable',
        mediaUrl: 'https://www.youtube.com/watch?v=CAwf7n6Luuc',
        instructions: 'Grip wide bar overhand. Pull to upper chest, squeeze lats, return controlled.'
    },
    {
        name: 'Seated Cable Row', category: 'Compound', muscleGroup: 'Back', equipment: 'Cable',
        mediaUrl: 'https://www.youtube.com/watch?v=GZbfZ033f74',
        instructions: 'Sit upright, feet braced. Pull handle to torso, squeeze back, return controlled.'
    },
    {
        name: 'Dumbbell Row', category: 'Compound', muscleGroup: 'Back', equipment: 'Dumbbell',
        mediaUrl: 'https://www.youtube.com/watch?v=roCP6wCXPqo',
        instructions: 'One hand/knee on bench. Row dumbbell to hip, squeeze back, lower controlled.'
    },
    {
        name: 'T-Bar Row', category: 'Compound', muscleGroup: 'Back', equipment: 'Barbell',
        mediaUrl: 'https://www.youtube.com/watch?v=j3Igk5nyZE4',
        instructions: 'Straddle bar, bent over. Pull to chest, squeeze shoulder blades together.'
    },
    {
        name: 'Face Pull', category: 'Isolation', muscleGroup: 'Back', equipment: 'Cable',
        mediaUrl: 'https://www.youtube.com/watch?v=rep-qVOkqgk',
        instructions: 'Cable at face height. Pull rope to face with elbows high, externally rotate.'
    },

    // ---- SHOULDERS ----
    {
        name: 'Overhead Press', category: 'Compound', muscleGroup: 'Shoulders', equipment: 'Barbell',
        mediaUrl: 'https://www.youtube.com/watch?v=2yjwXTZQDDI',
        instructions: 'Bar at shoulders. Press overhead to lockout, lower controlled.'
    },
    {
        name: 'Dumbbell Shoulder Press', category: 'Compound', muscleGroup: 'Shoulders', equipment: 'Dumbbell',
        mediaUrl: 'https://www.youtube.com/watch?v=qEwKCR5JCog',
        instructions: 'Dumbbells at shoulder height. Press overhead, lower controlled.'
    },
    {
        name: 'Lateral Raise', category: 'Isolation', muscleGroup: 'Shoulders', equipment: 'Dumbbell',
        mediaUrl: 'https://www.youtube.com/watch?v=3VcKaXpzqRo',
        instructions: 'Arms at sides. Raise dumbbells to shoulder height, slight bend in elbows.'
    },
    {
        name: 'Front Raise', category: 'Isolation', muscleGroup: 'Shoulders', equipment: 'Dumbbell',
        mediaUrl: 'https://www.youtube.com/watch?v=-t7fuZ0KhDA',
        instructions: 'Arms at sides. Raise dumbbells in front to shoulder height, lower controlled.'
    },
    {
        name: 'Reverse Fly', category: 'Isolation', muscleGroup: 'Shoulders', equipment: 'Dumbbell',
        mediaUrl: 'https://www.youtube.com/watch?v=tTV3UA-dpLc',
        instructions: 'Bent at hips. Raise dumbbells to sides squeezing rear delts.'
    },
    {
        name: 'Arnold Press', category: 'Compound', muscleGroup: 'Shoulders', equipment: 'Dumbbell',
        mediaUrl: 'https://www.youtube.com/watch?v=6Z15_WdXmVw',
        instructions: 'Start with dumbbells facing you. Rotate and press overhead.'
    },

    // ---- BICEPS ----
    {
        name: 'Barbell Curl', category: 'Isolation', muscleGroup: 'Biceps', equipment: 'Barbell',
        mediaUrl: 'https://www.youtube.com/watch?v=kwG2ipFRgfo',
        instructions: 'Stand, grip bar underhand shoulder-width. Curl to shoulders, lower controlled.'
    },
    {
        name: 'Dumbbell Curl', category: 'Isolation', muscleGroup: 'Biceps', equipment: 'Dumbbell',
        mediaUrl: 'https://www.youtube.com/watch?v=ykJmrZ5v0Oo',
        instructions: 'Arms at sides. Curl dumbbells to shoulders, lower controlled.'
    },
    {
        name: 'Hammer Curl', category: 'Isolation', muscleGroup: 'Biceps', equipment: 'Dumbbell',
        mediaUrl: 'https://www.youtube.com/watch?v=zC3nLlEvin4',
        instructions: 'Neutral grip (palms facing). Curl to shoulders, lower controlled.'
    },
    {
        name: 'Incline Dumbbell Curl', category: 'Isolation', muscleGroup: 'Biceps', equipment: 'Dumbbell',
        mediaUrl: 'https://www.youtube.com/watch?v=soxrZlIl35U',
        instructions: 'Seated on incline bench, arms hanging. Curl dumbbells up, lower controlled.'
    },
    {
        name: 'Cable Curl', category: 'Isolation', muscleGroup: 'Biceps', equipment: 'Cable',
        mediaUrl: 'https://www.youtube.com/watch?v=NFzTWp2qpiE',
        instructions: 'Cable at bottom. Curl bar/handle to shoulders, lower controlled.'
    },

    // ---- TRICEPS ----
    {
        name: 'Close-Grip Bench Press', category: 'Compound', muscleGroup: 'Triceps', equipment: 'Barbell',
        mediaUrl: 'https://www.youtube.com/watch?v=nEF0bv2FW94',
        instructions: 'Hands shoulder-width on bar. Lower to chest, press up focusing triceps.'
    },
    {
        name: 'Tricep Pushdown', category: 'Isolation', muscleGroup: 'Triceps', equipment: 'Cable',
        mediaUrl: 'https://www.youtube.com/watch?v=2-LAMcpzODU',
        instructions: 'Cable at top. Push bar/rope down to full extension, return controlled.'
    },
    {
        name: 'Overhead Tricep Extension', category: 'Isolation', muscleGroup: 'Triceps', equipment: 'Dumbbell',
        mediaUrl: 'https://www.youtube.com/watch?v=YbX7Wd8jQ-Q',
        instructions: 'Hold dumbbell overhead with both hands. Lower behind head, extend up.'
    },
    {
        name: 'Skull Crusher', category: 'Isolation', muscleGroup: 'Triceps', equipment: 'Barbell',
        mediaUrl: 'https://www.youtube.com/watch?v=d_KZxkY_0cM',
        instructions: 'Lie flat, arms extended over face. Lower bar to forehead, extend up.'
    },
    {
        name: 'Dip (Tricep)', category: 'Compound', muscleGroup: 'Triceps', equipment: 'Bodyweight',
        mediaUrl: 'https://www.youtube.com/watch?v=2z8JmcrW-As',
        instructions: 'Upright on dip bars. Lower body keeping elbows close, press up.'
    },

    // ---- QUADRICEPS ----
    {
        name: 'Barbell Back Squat', category: 'Compound', muscleGroup: 'Quadriceps', equipment: 'Barbell',
        mediaUrl: 'https://www.youtube.com/watch?v=bEv6CCg2BC8',
        instructions: 'Bar on upper back. Squat down until thighs parallel, drive up through heels.'
    },
    {
        name: 'Barbell Front Squat', category: 'Compound', muscleGroup: 'Quadriceps', equipment: 'Barbell',
        mediaUrl: 'https://www.youtube.com/watch?v=m4ytaCJZpl0',
        instructions: 'Bar on front delts. Squat down keeping torso upright, drive up.'
    },
    {
        name: 'Leg Press', category: 'Compound', muscleGroup: 'Quadriceps', equipment: 'Machine',
        mediaUrl: 'https://www.youtube.com/watch?v=IZxyjW7MPJQ',
        instructions: 'Feet shoulder-width on platform. Lower sled, press up without locking knees.'
    },
    {
        name: 'Leg Extension', category: 'Isolation', muscleGroup: 'Quadriceps', equipment: 'Machine',
        mediaUrl: 'https://www.youtube.com/watch?v=YyvSfVjQeL0',
        instructions: 'Seated in machine. Extend legs to full lockout, lower controlled.'
    },
    {
        name: 'Bulgarian Split Squat', category: 'Compound', muscleGroup: 'Quadriceps', equipment: 'Dumbbell',
        mediaUrl: 'https://www.youtube.com/watch?v=2C-uNgKwPLE',
        instructions: 'Rear foot elevated on bench. Squat down on front leg, drive up.'
    },
    {
        name: 'Goblet Squat', category: 'Compound', muscleGroup: 'Quadriceps', equipment: 'Dumbbell',
        mediaUrl: 'https://www.youtube.com/watch?v=MeIiIdhvXT4',
        instructions: 'Hold dumbbell at chest. Squat down, keep torso upright, drive up.'
    },

    // ---- HAMSTRINGS ----
    {
        name: 'Romanian Deadlift', category: 'Compound', muscleGroup: 'Hamstrings', equipment: 'Barbell',
        mediaUrl: 'https://www.youtube.com/watch?v=7AaaYhMqSbY',
        instructions: 'Bar at hips. Hinge at hips pushing butt back, lower bar along legs, return.'
    },
    {
        name: 'Leg Curl', category: 'Isolation', muscleGroup: 'Hamstrings', equipment: 'Machine',
        mediaUrl: 'https://www.youtube.com/watch?v=1Tq3QdYUuHs',
        instructions: 'Lying or seated in machine. Curl weight toward glutes, return controlled.'
    },
    {
        name: 'Stiff-Leg Deadlift', category: 'Compound', muscleGroup: 'Hamstrings', equipment: 'Barbell',
        mediaUrl: 'https://www.youtube.com/watch?v=CN_7cz3P-I',
        instructions: 'Minimal knee bend. Hinge at hips to lower bar, feel hamstring stretch, return.'
    },
    {
        name: 'Good Morning', category: 'Compound', muscleGroup: 'Hamstrings', equipment: 'Barbell',
        mediaUrl: 'https://www.youtube.com/watch?v=YA-h3n9L4YU',
        instructions: 'Bar on upper back. Hinge at hips keeping back straight, return to upright.'
    },

    // ---- GLUTES ----
    {
        name: 'Hip Thrust', category: 'Compound', muscleGroup: 'Glutes', equipment: 'Barbell',
        mediaUrl: 'https://www.youtube.com/watch?v=SEdqd1n0cvg',
        instructions: 'Upper back on bench, bar on hips. Drive hips up squeezing glutes, lower.'
    },
    {
        name: 'Glute Bridge', category: 'Isolation', muscleGroup: 'Glutes', equipment: 'Bodyweight',
        mediaUrl: 'https://www.youtube.com/watch?v=OUgsJ8-Vi0E',
        instructions: 'Lie on back, feet flat. Drive hips up squeezing glutes, lower controlled.'
    },
    {
        name: 'Cable Kickback', category: 'Isolation', muscleGroup: 'Glutes', equipment: 'Cable',
        mediaUrl: 'https://www.youtube.com/watch?v=mJFpXhYg-OA',
        instructions: 'Ankle strap on low cable. Kick leg back squeezing glute, return controlled.'
    },

    // ---- CALVES ----
    {
        name: 'Standing Calf Raise', category: 'Isolation', muscleGroup: 'Calves', equipment: 'Machine',
        mediaUrl: 'https://www.youtube.com/watch?v=gwLzBJYoWlI',
        instructions: 'Balls of feet on platform. Rise up on toes, lower below platform for stretch.'
    },
    {
        name: 'Seated Calf Raise', category: 'Isolation', muscleGroup: 'Calves', equipment: 'Machine',
        mediaUrl: 'https://www.youtube.com/watch?v=JbyjNymZOt0',
        instructions: 'Seated with pad on knees. Rise up on toes, lower for stretch.'
    },

    // ---- CORE ----
    {
        name: 'Plank', category: 'Isolation', muscleGroup: 'Core', equipment: 'Bodyweight',
        mediaUrl: 'https://www.youtube.com/watch?v=ASdvN_XEl_c',
        instructions: 'Forearms on floor, body straight. Hold position engaging core.'
    },
    {
        name: 'Hanging Leg Raise', category: 'Isolation', muscleGroup: 'Core', equipment: 'Bodyweight',
        mediaUrl: 'https://www.youtube.com/watch?v=hdng3Nm1x_E',
        instructions: 'Hang from bar. Raise legs to parallel or above, lower controlled.'
    },
    {
        name: 'Cable Crunch', category: 'Isolation', muscleGroup: 'Core', equipment: 'Cable',
        mediaUrl: 'https://www.youtube.com/watch?v=2fbujeH3F0E',
        instructions: 'Kneel facing cable. Crunch down curling torso, return controlled.'
    },
    {
        name: 'Ab Wheel Rollout', category: 'Compound', muscleGroup: 'Core', equipment: 'Other',
        mediaUrl: 'https://www.youtube.com/watch?v=uYBOBBv9GzY',
        instructions: 'Kneel with ab wheel. Roll forward extending body, roll back to start.'
    },
    {
        name: 'Russian Twist', category: 'Isolation', muscleGroup: 'Core', equipment: 'Bodyweight',
        mediaUrl: 'https://www.youtube.com/watch?v=wkD8rjkodUI',
        instructions: 'Seated, lean back slightly. Rotate torso side to side with or without weight.'
    },

    // ---- FOREARMS ----
    {
        name: 'Wrist Curl', category: 'Isolation', muscleGroup: 'Forearms', equipment: 'Barbell',
        mediaUrl: 'https://www.youtube.com/watch?v=FW5kzNxEbkI',
        instructions: 'Forearms on bench, palms up. Curl wrists up, lower controlled.'
    },
    {
        name: 'Reverse Wrist Curl', category: 'Isolation', muscleGroup: 'Forearms', equipment: 'Barbell',
        mediaUrl: 'https://www.youtube.com/watch?v=FW5kzNxEbkI',
        instructions: 'Forearms on bench, palms down. Curl wrists up, lower controlled.'
    },
    {
        name: 'Farmer Walk', category: 'Compound', muscleGroup: 'Forearms', equipment: 'Dumbbell',
        mediaUrl: 'https://www.youtube.com/watch?v=Fkzk_RqlYig',
        instructions: 'Heavy dumbbells at sides. Walk for prescribed distance or time.'
    },

    // ---- FULL BODY ----
    {
        name: 'Clean and Press', category: 'Compound', muscleGroup: 'Full Body', equipment: 'Barbell',
        mediaUrl: 'https://www.youtube.com/watch?v=uf6kS2Z-240',
        instructions: 'Deadlift bar, clean to shoulders, press overhead in one fluid motion.'
    },
    {
        name: 'Thruster', category: 'Compound', muscleGroup: 'Full Body', equipment: 'Barbell',
        mediaUrl: 'https://www.youtube.com/watch?v=M02_jy8AT4s',
        instructions: 'Front squat with bar. Drive up and press overhead in one motion.'
    },
    {
        name: 'Burpee', category: 'Compound', muscleGroup: 'Full Body', equipment: 'Bodyweight',
        mediaUrl: 'https://www.youtube.com/watch?v=JZQA08SlJnM',
        instructions: 'Drop to push-up, jump feet in, explosive jump up. Repeat.'
    },
    {
        name: 'Kettlebell Swing', category: 'Compound', muscleGroup: 'Full Body', equipment: 'Kettlebell',
        mediaUrl: 'https://www.youtube.com/watch?v=YSxHifyI6s8',
        instructions: 'Hinge at hips, swing kettlebell between legs, drive hips to swing up to shoulder height.'
    },
];
