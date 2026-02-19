/**
 * settings.js — Settings page
 */

import { getSetting, setSetting } from '../data/db.js';
import { exportData, importData } from '../data/io.js';
import { showToast } from '../components/toast.js';
import { STANDARD_PLATES_LB, STANDARD_PLATES_KG } from '../engine/progression.js';

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
          <button class="tab ${theme === 'dark' ? 'active' : ''}" data-theme="dark">Compline (Dark)</button>
          <button class="tab ${theme === 'light' ? 'active' : ''}" data-theme="light">Lauds (Light)</button>
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

      <!-- About -->
      <div class="card">
        <div class="card-title" style="margin-bottom:var(--sp-2)">About</div>
        <div class="text-sm text-secondary">
          <strong>LibreLift</strong> v0.1.0<br>
          A free/libre, open-source lifting app.<br>
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
        if (newTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');
        else document.documentElement.removeAttribute('data-theme');
        container.querySelector('#theme-tabs').querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.theme === newTheme));
        showToast(`Theme: ${newTheme === 'dark' ? 'Compline' : 'Lauds'}`, 'success');
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
}
