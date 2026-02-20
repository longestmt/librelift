/**
 * settings.js — Settings page
 */

import { getSetting, setSetting } from '../data/db.js';
import { exportData, importData } from '../data/io.js';
import { showToast } from '../components/toast.js';
import { STANDARD_PLATES_LB, STANDARD_PLATES_KG } from '../engine/progression.js';
import { getGistToken, setGistToken, validateToken, pushBackup, pullBackup, restoreFromGist, getBackupInfo, disconnectGist } from '../data/gist-backup.js';

export async function renderSettingsPage(container) {
  const unit = await getSetting('unit', 'lb');
  const barWeight = await getSetting('barWeight', unit === 'kg' ? 20 : 45);
  const restTimer = await getSetting('restTimer', 90);
  const theme = await getSetting('theme', 'dark');
  const plates = await getSetting('plateInventory', null);
  const defaultPlates = unit === 'kg' ? { ...STANDARD_PLATES_KG } : { ...STANDARD_PLATES_LB };
  const plateInventory = plates || Object.fromEntries(Object.keys(defaultPlates).map(k => [k, 8]));

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Settings</h1>
    </div>
    <div class="flex flex-col gap-4">
      <!-- Units -->
      <div class="card">
        <div class="card-title" style="margin-bottom:var(--sp-3)">Units</div>
        <div class="tabs" id="unit-tabs">
          <button class="tab ${unit === 'lb' ? 'active' : ''}" data-unit="lb">Pounds (lb)</button>
          <button class="tab ${unit === 'kg' ? 'active' : ''}" data-unit="kg">Kilograms (kg)</button>
        </div>
      </div>

      <!-- Bar Weight -->
      <div class="card">
        <div class="flex items-center justify-between">
          <div><div class="card-title">Bar Weight</div><div class="text-xs text-muted">Used for plate calculator</div></div>
          <div class="flex items-center gap-2">
            <input class="input-inline" type="number" id="bar-weight" value="${barWeight}" style="width:72px" inputmode="decimal" />
            <span class="text-sm text-muted">${unit}</span>
          </div>
        </div>
      </div>

      <!-- Rest Timer -->
      <div class="card">
        <div class="flex items-center justify-between">
          <div><div class="card-title">Rest Timer</div><div class="text-xs text-muted">Default rest between sets</div></div>
          <div class="flex items-center gap-2">
            <input class="input-inline" type="number" id="rest-timer" value="${restTimer}" style="width:72px" inputmode="numeric" />
            <span class="text-sm text-muted">sec</span>
          </div>
        </div>
      </div>

      <!-- Theme -->
      <div class="card">
        <div class="card-title" style="margin-bottom:var(--sp-3)">Theme</div>
        <div class="tabs" id="theme-tabs">
          <button class="tab ${theme === 'dark' ? 'active' : ''}" data-theme="dark">Compline</button>
          <button class="tab ${theme === 'amoled' ? 'active' : ''}" data-theme="amoled">Vigil</button>
          <button class="tab ${theme === 'light' ? 'active' : ''}" data-theme="light">Lauds</button>
        </div>
      </div>

      <!-- Plate Inventory -->
      <div class="card">
        <div class="card-title" style="margin-bottom:var(--sp-2)">Plate Inventory</div>
        <div class="text-xs text-muted" style="margin-bottom:var(--sp-3)">Enter how many of each plate you have (total, both sides)</div>
        <div class="flex flex-col gap-2" id="plate-inputs">
          ${Object.keys(plateInventory).sort((a, b) => parseFloat(b) - parseFloat(a)).map(size => `
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">${size} ${unit}</span>
              <input class="input-inline" type="number" data-plate="${size}" value="${plateInventory[size]}" inputmode="numeric" style="width:64px"/>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Data -->
      <div class="card">
        <div class="card-title" style="margin-bottom:var(--sp-3)">Data</div>
        <div class="flex flex-col gap-2">
          <button class="btn btn-secondary btn-full" id="export-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export Backup (JSON)
          </button>
          <label class="btn btn-secondary btn-full" style="cursor:pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import Backup
            <input type="file" accept=".json" id="import-input" style="display:none" />
          </label>
        </div>
      </div>

      <!-- GitHub Backup -->
      <div class="card">
        <div class="card-title" style="margin-bottom:var(--sp-2)">Cloud Backup</div>
        <div class="text-xs text-muted" style="margin-bottom:var(--sp-3)">Sync your data to a private GitHub Gist</div>
        <div id="gist-section"></div>
      </div>

      <!-- About -->
      <div class="card">
        <div class="card-title" style="margin-bottom:var(--sp-2)">About</div>
        <div class="text-sm text-secondary">
          <strong>LibreLift</strong> v0.1.1<br>
          A free/libre, open-source lifting app.<br>
          <a href="https://github.com/tylerapf/librelift" target="_blank" style="color:var(--accent)">View Source Code on GitHub</a><br>
          Licensed under AGPL-3.0.<br><br>
          <span class="text-muted">Compline + Lauds themes inspired by
            <a href="https://github.com/joshuablais/compline" target="_blank" style="color:var(--accent)">joshuablais/compline</a>
          </span>
        </div>
      </div>
    </div>`;

  // Unit toggle
  container.querySelector('#unit-tabs').addEventListener('click', async (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    const newUnit = tab.dataset.unit;
    await setSetting('unit', newUnit);
    await setSetting('barWeight', newUnit === 'kg' ? 20 : 45);
    showToast(`Units set to ${newUnit}`, 'success');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  // Bar weight
  container.querySelector('#bar-weight').addEventListener('change', async (e) => {
    await setSetting('barWeight', parseFloat(e.target.value) || 45);
    showToast('Bar weight saved', 'success');
  });

  // Rest timer
  container.querySelector('#rest-timer').addEventListener('change', async (e) => {
    await setSetting('restTimer', parseInt(e.target.value) || 90);
    showToast('Rest timer saved', 'success');
  });

  // Theme toggle
  container.querySelector('#theme-tabs').addEventListener('click', async (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    const newTheme = tab.dataset.theme;
    await setSetting('theme', newTheme);
    if (newTheme === 'dark') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', newTheme);
    container.querySelector('#theme-tabs').querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.theme === newTheme));
    const names = { dark: 'Compline', amoled: 'Vigil', light: 'Lauds' };
    showToast(`Theme: ${names[newTheme]}`, 'success');
  });

  // Plate inventory
  container.querySelector('#plate-inputs').addEventListener('change', async (e) => {
    const input = e.target.closest('[data-plate]');
    if (!input) return;
    plateInventory[input.dataset.plate] = parseInt(input.value) || 0;
    await setSetting('plateInventory', { ...plateInventory });
    showToast('Plates updated', 'success');
  });

  // Export
  container.querySelector('#export-btn').addEventListener('click', async () => {
    try { await exportData(); showToast('Data exported!', 'success'); }
    catch (e) { showToast('Export failed: ' + e.message, 'danger'); }
  });

  // Import
  container.querySelector('#import-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { await importData(file, true); showToast('Data imported!', 'success'); window.dispatchEvent(new HashChangeEvent('hashchange')); }
    catch (e) { showToast('Import failed: ' + e.message, 'danger'); }
  });

  // GitHub Gist Backup
  const gistSection = container.querySelector('#gist-section');
  async function renderGistUI() {
    const token = await getGistToken();
    if (!token) {
      gistSection.innerHTML = `
        <div class="flex flex-col gap-2">
          <input class="input" type="password" id="gist-token" placeholder="Paste GitHub Personal Access Token" style="font-size:var(--text-sm)" />
          <div class="text-xs text-muted">Create a token at <a href="https://github.com/settings/tokens/new?scopes=gist&description=LibreLift+Backup" target="_blank" style="color:var(--accent)">github.com/settings/tokens</a> with <strong>gist</strong> scope only.</div>
          <button class="btn btn-primary btn-full btn-sm" id="gist-connect">Connect GitHub</button>
        </div>`;
      gistSection.querySelector('#gist-connect').addEventListener('click', async () => {
        const tokenVal = gistSection.querySelector('#gist-token').value.trim();
        if (!tokenVal) { showToast('Paste your token first', 'danger'); return; }
        try {
          const btn = gistSection.querySelector('#gist-connect');
          btn.textContent = 'Connecting…'; btn.disabled = true;
          const username = await validateToken(tokenVal);
          await setGistToken(tokenVal);
          showToast(`Connected as ${username}`, 'success');
          renderGistUI();
        } catch (e) {
          showToast('Invalid token: ' + e.message, 'danger');
          gistSection.querySelector('#gist-connect').textContent = 'Connect GitHub';
          gistSection.querySelector('#gist-connect').disabled = false;
        }
      });
    } else {
      const info = await getBackupInfo();
      const lastBackup = info ? new Date(info.updatedAt).toLocaleString() : 'Never';
      gistSection.innerHTML = `
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium text-success">● Connected</div>
              <div class="text-xs text-muted">Last backup: ${lastBackup}</div>
            </div>
            ${info ? `<a href="${info.url}" target="_blank" class="text-xs" style="color:var(--accent)">View Gist ↗</a>` : ''}
          </div>
          <div class="flex gap-2">
            <button class="btn btn-primary btn-sm" id="gist-push" style="flex:1">Push Backup</button>
            <button class="btn btn-secondary btn-sm" id="gist-pull" style="flex:1">Restore from Cloud</button>
          </div>
          <button class="btn btn-ghost btn-sm text-xs" id="gist-disconnect" style="color:var(--danger)">Disconnect GitHub</button>
        </div>`;
      gistSection.querySelector('#gist-push').addEventListener('click', async () => {
        try {
          const btn = gistSection.querySelector('#gist-push');
          btn.textContent = 'Pushing…'; btn.disabled = true;
          const result = await pushBackup();
          showToast(result.updated ? 'Backup updated!' : 'Backup created!', 'success');
          renderGistUI();
        } catch (e) { showToast('Backup failed: ' + e.message, 'danger'); renderGistUI(); }
      });
      gistSection.querySelector('#gist-pull').addEventListener('click', async () => {
        if (!confirm('This will replace all local data with the cloud backup. Continue?')) return;
        try {
          const btn = gistSection.querySelector('#gist-pull');
          btn.textContent = 'Restoring…'; btn.disabled = true;
          await restoreFromGist();
          showToast('Data restored from backup!', 'success');
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        } catch (e) { showToast('Restore failed: ' + e.message, 'danger'); renderGistUI(); }
      });
      gistSection.querySelector('#gist-disconnect').addEventListener('click', async () => {
        if (!confirm('Disconnect GitHub? Your backup gist will not be deleted.')) return;
        await disconnectGist();
        showToast('GitHub disconnected', 'info');
        renderGistUI();
      });
    }
  }
  renderGistUI();
}
