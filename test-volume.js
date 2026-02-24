import { openDB } from 'idb';

async function testVolume() {
  const db = await openDB('LibreLiftDB', 1);
  const sets = await db.getAll('sets');
  const workouts = await db.getAll('workouts');
  const exercises = await db.getAll('exercises');

  // get specific workout sets
  if (workouts.length === 0) {
     console.log('No workouts');
     return;
  }
  const w = workouts[workouts.length - 1];
  const wSets = sets.filter(s => s.workoutId === w.id);
  const vol = wSets.reduce((s, r) => s + (r.completed ? r.weight * r.reps : 0), 0);
  console.log('Workout', w.id, 'volume:', vol);
}

// Just checking if we can see the DB
testVolume().catch(console.error);
