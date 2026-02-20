import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Mobile viewport
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });
  
  // Go to app
  await page.goto('http://localhost:4173/');
  
  // Wait for initial DB setup by the app to finish
  await new Promise(r => setTimeout(r, 1000));
  
  // Inject beautiful data directly into IndexedDB without needing the module
  await page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const isoNow = new Date().toISOString();
      const today = isoNow.split('T')[0];
      
      const req = indexedDB.open('librelift');
      req.onsuccess = (e) => {
        const db = e.target.result;
        try {
          const tx = db.transaction(['settings', 'workouts', 'sets'], 'readwrite');
          const settings = tx.objectStore('settings');
          settings.put({ key: 'theme', value: 'dark', updatedAt: isoNow });
          settings.put({ key: 'unit', value: 'lb', updatedAt: isoNow });
          
          const workouts = tx.objectStore('workouts');
          workouts.put({
            id: 'mock_active_workout',
            date: today,
            startTime: Date.now() - 1000 * 60 * 45, // started 45 mins ago
            endTime: null,
            notes: 'Feeling strong today! 💪',
            createdAt: isoNow,
            updatedAt: isoNow,
            deleted: false
          });
          
          const setsStore = tx.objectStore('sets');
          
          let setId = 1;
          function addSet(exerciseId, setNum, type, weight, reps, completed) {
              setsStore.put({
                  id: 'set_' + setId++,
                  workoutId: 'mock_active_workout',
                  exerciseId,
                  setNumber: setNum,
                  type, // 'warmup', 'normal'
                  weight,
                  reps,
                  completed,
                  createdAt: new Date(Date.now() - 1000 * 60 * (45 - setId * 2)).toISOString(),
                  updatedAt: isoNow,
                  deleted: false
              });
          }
          
          // Squat (ID 1)
          addSet('1', 1, 'normal', 225, 5, true);
          addSet('1', 2, 'normal', 275, 5, true);
          addSet('1', 3, 'normal', 315, 5, true);
          
          // Bench (ID 2)
          addSet('2', 1, 'normal', 185, 8, true);
          addSet('2', 2, 'normal', 225, 5, true);
          addSet('2', 3, 'normal', 225, 5, false); // Active set
          
          tx.oncomplete = () => resolve();
          tx.onerror = (err) => reject(err);
        } catch (err) {
          reject(err);
        }
      };
      req.onerror = (e) => reject(e.target.error);
    });
  });
  
  // Reload to show the active workout and theme
  await page.reload({ waitUntil: 'networkidle0' });
  
  // Click on active workout resume if needed
  await page.evaluate(() => {
    const resumeBtn = [...document.querySelectorAll('button')].find(b => b.textContent && b.textContent.includes('Resume'));
    if (resumeBtn) resumeBtn.click();
  });
  
  // Wait a bit for animations
  await new Promise(r => setTimeout(r, 1000));
  
  // Take screenshot 1: Workout View (Dark)
  await page.screenshot({ path: 'assets/screenshots/workout-dark.png' });
  
  // Switch to History tab
  await page.evaluate(async () => {
      window.location.hash = '#history';
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('librelift');
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction(['settings'], 'readwrite');
          tx.objectStore('settings').put({ key: 'theme', value: 'light', updatedAt: new Date().toISOString() });
          tx.oncomplete = () => resolve();
        };
      });
  });
  
  // Reload to apply light theme
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  
  // Take screenshot 2: History View (Light)
  await page.screenshot({ path: 'assets/screenshots/history-light.png' });
  
  await browser.close();
})();
