import { exportAllData, openDB } from './src/data/db.js';

async function run() {
  const db = await openDB();
  const tx = db.transaction('settings', 'readwrite');
  const store = tx.objectStore('settings');
  store.put({ key: 'githubPAT', value: 'ghp_testtesttest', updatedAt: new Date().toISOString() });
  
  tx.oncomplete = async () => {
      const data = await exportAllData();
      
      if (data.stores && data.stores.settings) {
          data.stores.settings = data.stores.settings.filter(
              s => s.key !== 'githubPAT' && s.key !== 'githubGistId'
          );
      }
      console.log(JSON.stringify(data, null, 2));
  };
}
run();
