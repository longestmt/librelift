import { put, getSetting, openDB, exportAllData } from './src/data/db.js';
import { pushBackup, disconnectGist } from './src/data/gist-backup.js';

async function run() {
  await openDB();
  
  // Set fake tokens
  const tx = (await openDB()).transaction('settings', 'readwrite');
  const store = tx.objectStore('settings');
  store.put({ key: 'githubPAT', value: 'ghp_fake_token_123', updatedAt: new Date().toISOString() });
  store.put({ key: 'githubGistId', value: 'fake_gist_id_456', updatedAt: new Date().toISOString() });
  
  tx.oncomplete = async () => {
    try {
        const exported = await exportAllData();
        console.log("Raw export info:", JSON.stringify(exported.stores.settings, null, 2));
    } catch (e) {
        console.error("Export fail", e);
    }
  };
}

run();
