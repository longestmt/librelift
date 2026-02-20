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

  // Inject beautiful historical data so the history page and charts look populated
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
          const setsStore = tx.objectStore('sets');
          let setId = 1;

          function addSet(workoutId, exerciseId, setNum, type, weight, reps, completed, historicalDaysAgo = 0) {
            setsStore.put({
              id: 'set_' + setId++,
              workoutId: workoutId,
              exerciseId,
              setNumber: setNum,
              type,
              weight,
              reps,
              completed,
              createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * historicalDaysAgo).toISOString(),
              updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * historicalDaysAgo).toISOString(),
              deleted: false
            });
          }

          // Create 15 past historical workouts
          for (let i = 1; i <= 15; i++) {
            let daysAgo = i * 2;
            let historicalDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * daysAgo).toISOString().split('T')[0];

            let wid = 'hist_workout_' + i;
            workouts.put({
              id: wid,
              date: historicalDate,
              startTime: Date.now() - 1000 * 60 * 60 * 24 * daysAgo - 1000 * 60 * 60,
              endTime: Date.now() - 1000 * 60 * 60 * 24 * daysAgo,
              notes: 'Solid session.',
              createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * daysAgo).toISOString(),
              updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * daysAgo).toISOString(),
              deleted: false
            });

            let sqWeight = 225 - (i * 5);
            let bnWeight = 165 - (i * 2.5);
            let dlWeight = 315 - (i * 10);

            addSet(wid, 'squat', 1, 'normal', sqWeight, 5, true, daysAgo);
            addSet(wid, 'squat', 2, 'normal', sqWeight, 5, true, daysAgo);
            addSet(wid, 'squat', 3, 'normal', sqWeight, 5, true, daysAgo);

            addSet(wid, 'bench-press', 1, 'normal', bnWeight, 5, true, daysAgo);
            addSet(wid, 'bench-press', 2, 'normal', bnWeight, 5, true, daysAgo);
            addSet(wid, 'bench-press', 3, 'normal', bnWeight, 5, true, daysAgo);

            addSet(wid, 'deadlift', 1, 'normal', dlWeight, 5, true, daysAgo);
          }

          tx.oncomplete = () => resolve();
          tx.onerror = (err) => reject(err);
        } catch (err) {
          reject(err);
        }
      };
      req.onerror = (e) => reject(e.target.error);
    });
  });

  // Reload to ensure historical data is loaded
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  // Now we simulate a real user starting a workout using the UI!
  await page.click('#start-empty-workout');
  await new Promise(r => setTimeout(r, 500));

  // Add Squat
  await page.click('#add-exercise-btn');
  await new Promise(r => setTimeout(r, 500));
  await page.type('#add-ex-search', 'squat');
  await new Promise(r => setTimeout(r, 200));
  let items = await page.$$('#add-ex-list .list-item');
  for (let item of items) {
    let isVisible = await item.evaluate(el => el.style.display !== 'none');
    if (isVisible) { await item.click(); break; }
  }
  await new Promise(r => setTimeout(r, 500));

  // Add Bench Press
  await page.click('#add-exercise-btn');
  await new Promise(r => setTimeout(r, 500));
  await page.type('#add-ex-search', 'bench press');
  await new Promise(r => setTimeout(r, 200));
  items = await page.$$('#add-ex-list .list-item');
  for (let item of items) {
    let isVisible = await item.evaluate(el => el.style.display !== 'none');
    if (isVisible) { await item.click(); break; }
  }
  await new Promise(r => setTimeout(r, 500));

  // Wait to clear out the toast messages
  await new Promise(r => setTimeout(r, 4000));

  // Set real weights for Squat
  await page.evaluate(() => {
    // Fill squat data
    const inputs = document.querySelectorAll('input[data-field="weight"]');
    if (inputs.length >= 6) {
      inputs[0].value = 225;
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[1].value = 225;
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[2].value = 225;
      inputs[2].dispatchEvent(new Event('input', { bubbles: true }));

      inputs[3].value = 175;
      inputs[3].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[4].value = 175;
      inputs[4].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[5].value = 175;
      inputs[5].dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  // Interact with the sets to check them off
  await page.evaluate(() => {
    // Check off all squat sets
    const checks = document.querySelectorAll('.set-check');
    if (checks.length >= 3) {
      checks[0].click();
      checks[1].click();
      checks[2].click();
    }
  });

  await new Promise(r => setTimeout(r, 500));

  // Write a note
  await page.type('#workout-notes', "Feeling great today, crushed the squats! 💪");

  await new Promise(r => setTimeout(r, 500));

  // Scroll to middle/top
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });

  await new Promise(r => setTimeout(r, 500));

  // Take screenshot 1: Workout View (Dark)
  await page.screenshot({ path: 'assets/screenshots/active-workout-v2.png' });

  // Switch to History tab natively via the nav route
  await page.click('#nav-data');
  await new Promise(r => setTimeout(r, 1000));

  await page.evaluate(async () => {
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

  // Reload to apply light theme and ensure history loads
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  // Click on the Nav Data tab again just to be 100% sure we are on the data page after reload
  await page.click('#nav-data');
  await new Promise(r => setTimeout(r, 1500));

  // Scroll down slightly to make the chart visible and the heatmap prominent
  await page.evaluate(() => {
    window.scrollBy(0, 150);
  });
  await new Promise(r => setTimeout(r, 500));

  // Take screenshot 2: History View (Light) (saving directly to the new file name)
  await page.screenshot({ path: 'assets/screenshots/history-heatmap-v2.png' });

  await browser.close();
})();
