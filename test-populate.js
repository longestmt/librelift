import { put, getSetting, openDB, exportAllData } from './src/data/db.js';
import { pushBackup, disconnectGist } from './src/data/gist-backup.js';

async function run() {
  await openDB();
  
  const tx = (await openDB()).transaction(['workouts', 'sets'], 'readwrite');
  
  // Add a malicious workout
  const workout = {
      id: 'malicious-workout',
      date: '2023-10-27',
      dayName: 'Hacked Day <img src="x" onerror="document.body.style.backgroundColor=\'red\'">',
      planName: 'Hacked Plan <img src="x" onerror="document.body.style.backgroundColor=\'blue\'">',
      notes: 'Hacked Notes <script>alert(1)</script>',
      durationSec: 100
  };
  tx.objectStore('workouts').put(workout);

  // Add a malicious set
  const set = {
      id: 'malicious-set',
      workoutId: 'malicious-workout',
      exerciseId: 'ex1',
      exerciseName: 'Hacked Exercise <img src="x" onerror="document.body.style.backgroundColor=\'green\'">',
      setNumber: 1,
      weight: 100,
      reps: 10,
      completed: true
  };
  tx.objectStore('sets').put(set);

  tx.oncomplete = () => {
    console.log("DB setup complete");
    process.exit(0);
  };
}

run();
