/**
 * history.js — Workout History page
 */

import { getAll, softDelete, put, getSetting } from '../data/db.js';
import { renderExerciseProgressList } from '../components/exercise-progress.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { escapeHTML } from '../utils/sanitize.js';
import { formatDuration } from '../utils/format.js';
import {
  calculateCardioTotals,
  distanceUnitForWeightUnit,
  resolveSetUnit,
  summarizeWorkout,
} from '../engine/progress-metrics.js';
import { enableRovingKeyboard } from '../utils/accessibility.js';

export async function renderHistoryPage(container) {
  const [workouts, allSets, exercises, unit] = await Promise.all([
    getAll('workouts'),
    getAll('sets'),
    getAll('exercises'),
    getSetting('unit', 'lb'),
  ]);
  workouts.sort((a, b) =>
    `${b.date || ''}:${b.createdAt || ''}`.localeCompare(`${a.date || ''}:${a.createdAt || ''}`)
  );
  const hasLegacyUnits = allSets.some(set => !set.unit)
    && workouts.some(workout => !workout.unit);

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">History</h1>
      <p class="page-subtitle">${workouts.length} workout${workouts.length !== 1 ? 's' : ''} logged</p>
    </div>
    <div id="heatmap-area" style="margin-bottom:var(--sp-6)"></div>
    ${hasLegacyUnits ? `<div class="text-xs text-muted" style="margin-bottom:var(--sp-3)">Older records without a saved unit use your current ${escapeHTML(unit)} setting.</div>` : ''}
    <div class="tabs" role="tablist" aria-label="History view" style="margin-bottom:var(--sp-4)">
      <button class="tab active" id="history-workouts-tab" role="tab" aria-controls="history-content" aria-selected="true" tabindex="0" data-tab="workouts">Workouts</button>
      <button class="tab" id="history-exercises-tab" role="tab" aria-controls="history-content" aria-selected="false" tabindex="-1" data-tab="exercises">By Exercise</button>
    </div>
    <div id="history-content" role="tabpanel" aria-labelledby="history-workouts-tab"></div>`;

  // Heatmap
  renderHeatmap(container.querySelector('#heatmap-area'), workouts);

  // Tabs
  const tabContainer = container.querySelector('.tabs');
  const content = container.querySelector('#history-content');

  function showTab(tab) {
    tabContainer.querySelectorAll('.tab').forEach(button => {
      const active = button.dataset.tab === tab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    content.setAttribute(
      'aria-labelledby',
      tab === 'workouts' ? 'history-workouts-tab' : 'history-exercises-tab'
    );
    if (tab === 'workouts') renderWorkoutsList(content, workouts, allSets, unit);
    else renderExerciseProgressList(content, {
      exercises,
      sets: allSets,
      workouts,
      fallbackUnit: unit,
    });
  }

  tabContainer.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (tab) showTab(tab.dataset.tab);
  });
  enableRovingKeyboard(tabContainer, { selector: '[role="tab"]' });

  showTab('workouts');
}

function renderHeatmap(container, workouts) {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 90);

  const dateMap = new Map();
  for (const w of workouts) {
    if (w.date) dateMap.set(w.date, (dateMap.get(w.date) || 0) + 1);
  }

  let html = '<div style="display:flex;gap:3px;flex-wrap:wrap;" role="img" aria-label="Workouts completed over the last 90 days">';
  const d = new Date(startDate);
  while (d <= today) {
    const key = d.toISOString().split('T')[0];
    const count = dateMap.get(key) || 0;
    const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count >= 3 ? 4 : 3;
    const title = `${key}: ${count} workout${count !== 1 ? 's' : ''}`;
    html += `<div class="heatmap-cell level-${level}" title="${title}" ${count > 0 ? `aria-label="${title}"` : 'aria-hidden="true"'}></div>`;
    d.setDate(d.getDate() + 1);
  }
  html += '</div>';
  container.innerHTML = html;
}

function formatHistoryDate(date) {
  if (!date) return 'Unknown date';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatVolumes(volumeByUnit) {
  const entries = [...volumeByUnit.entries()];
  if (entries.length === 0) return '0 volume';
  return entries.map(([unit, volume]) =>
    `${volume.toLocaleString()} ${unit}`
  ).join(' + ');
}

function formatCardioTime(seconds) {
  const minutes = Math.floor((seconds || 0) / 60);
  const remainder = Math.floor((seconds || 0) % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function formatDistances(distanceByUnit) {
  return [...distanceByUnit.entries()]
    .map(([unit, distance]) => `${Number(distance.toFixed(2))} ${unit}`)
    .join(' + ');
}

function renderWorkoutsList(container, workouts, allSets, fallbackUnit) {
  if (workouts.length === 0) {
    container.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><div class="empty-state-title">No workouts yet</div><div class="empty-state-text">Complete a workout to see it here</div></div>`;
    return;
  }

  container.innerHTML = `<div class="flex flex-col gap-3">${workouts.map(w => {
    const wSets = allSets.filter(s => s.workoutId === w.id);
    const summary = summarizeWorkout(w, wSets, fallbackUnit);
    const cardio = calculateCardioTotals(wSets);
    const dur = w.durationSec ? formatDuration(w.durationSec) : '';
    const incompleteBadge = summary.incomplete > 0
      ? `<span class="badge badge-danger">${summary.incomplete} incomplete</span>`
      : '';

    return `<button type="button" class="card card-clickable" data-workout-id="${escapeHTML(w.id)}" style="width:100%;text-align:left;color:inherit;font:inherit">
      <div class="card-header">
        <div>
          <div class="card-title">${escapeHTML(w.dayName || 'Workout')}</div>
          <div class="flex gap-2" style="margin-top:2px">
            <span class="text-xs text-muted">${escapeHTML(formatHistoryDate(w.date))}</span>
            ${w.planName ? `<span class="badge badge-muted">${escapeHTML(w.planName)}</span>` : ''}
            ${incompleteBadge}
          </div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div class="flex gap-4 text-xs text-secondary" style="margin-top:var(--sp-2);flex-wrap:wrap">
        ${dur ? `<span>⏱ ${dur}</span>` : ''}
        ${summary.volumeByUnit.size > 0 ? `<span>📊 ${formatVolumes(summary.volumeByUnit)}</span>` : ''}
        ${cardio.durationSec > 0 ? `<span>🏃 ${formatDuration(cardio.durationSec)}${cardio.distanceByUnit.size ? ` • ${escapeHTML(formatDistances(cardio.distanceByUnit))}` : ''}</span>` : ''}
        <span>✅ ${summary.completed}/${summary.total} sets</span>
        ${summary.exerciseCount ? `<span>💪 ${summary.exerciseCount} exercise${summary.exerciseCount !== 1 ? 's' : ''}</span>` : ''}
      </div>
    </button>`;
  }).join('')}</div>`;

  container.addEventListener('click', async (e) => {
    const card = e.target.closest('[data-workout-id]');
    if (!card) return;
    const wId = card.dataset.workoutId;
    const w = workouts.find(x => x.id === wId);
    const wSets = allSets.filter(s => s.workoutId === wId);
    showWorkoutDetail(w, wSets, fallbackUnit, () => {
      // Re-render the page after deletion
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  });
}

function showWorkoutDetail(workout, sets, fallbackUnit, onDelete) {
  const exerciseMap = new Map();
  for (const s of sets) {
    const key = s.exerciseName || s.exerciseId;
    if (!exerciseMap.has(key)) exerciseMap.set(key, []);
    exerciseMap.get(key).push(s);
  }

  const body = openModal('', { title: workout.dayName || 'Workout' });
  const durMin = workout.durationSec ? Math.floor(workout.durationSec / 60) : null;
  const durDisplay = durMin != null ? formatDuration(workout.durationSec) : '';
  body.innerHTML = `
    <div class="text-xs text-muted" style="margin-bottom:var(--sp-3)">${escapeHTML(formatHistoryDate(workout.date))}${workout.planName ? ` • ${escapeHTML(workout.planName)}` : ''}${durDisplay ? ` • <button type="button" id="dur-display" class="btn btn-ghost text-xs" style="padding:0;min-height:0;text-decoration:underline dotted;text-underline-offset:2px" title="Edit duration">${durDisplay}</button>` : ''}</div>
    ${workout.notes ? `<div class="card" style="margin-bottom:var(--sp-3);padding:var(--sp-3)"><div class="text-xs text-muted">Notes</div><div class="text-sm">${escapeHTML(workout.notes)}</div></div>` : ''}
    <div class="flex flex-col gap-4">
      ${[...exerciseMap.entries()].map(([name, exSets]) => `
        <div>
          <div class="font-semibold text-sm" style="margin-bottom:var(--sp-1);color:var(--accent)">${escapeHTML(name)}</div>
          <div class="flex flex-col gap-1">
            ${exSets.sort((a, b) => a.setNumber - b.setNumber).map(s => {
              const isCardio = s.mode === 'cardio' || Number.isFinite(s.durationSec);
              const cardioUnit = s.distanceUnit || distanceUnitForWeightUnit(workout.unit || fallbackUnit);
              return `
              <div class="flex items-center gap-3 text-sm">
                <span class="text-muted" style="width:24px">S${s.setNumber}</span>
                <span class="font-mono">${isCardio
                  ? `${formatCardioTime(s.durationSec)}${Number.isFinite(s.distance) && s.distance > 0 ? ` / ${s.distance} ${escapeHTML(cardioUnit)}` : ''}`
                  : `${Number.isFinite(s.weight) ? s.weight : '—'} ${escapeHTML(resolveSetUnit(s, workout, fallbackUnit))} × ${Number.isFinite(s.reps) ? s.reps : '—'}`}</span>
                ${isCardio && Number.isFinite(s.calories) ? `<span class="text-xs text-muted">${s.calories} cal</span>` : (s.rpe ? `<span class="text-xs text-muted">@${s.rpe}</span>` : '')}
                <span>${s.completed ? '<span class="text-success" aria-label="Completed">✓</span>' : s.failed ? '<span class="text-danger" aria-label="Failed">✗</span>' : '<span class="text-muted">Incomplete</span>'}</span>
              </div>
            `;}).join('')}
          </div>
        </div>
      `).join('<div class="divider" style="margin:var(--sp-2) 0"></div>')}
    </div>
    <button class="btn btn-ghost text-sm text-danger btn-full" id="delete-workout-btn" style="margin-top:var(--sp-4)">Delete Workout</button>`;

  const deleteBtn = body.querySelector('#delete-workout-btn');
  let confirmPending = false;
  deleteBtn.addEventListener('click', async () => {
    if (!confirmPending) {
      confirmPending = true;
      deleteBtn.textContent = 'Tap again to confirm';
      deleteBtn.style.fontWeight = '600';
      setTimeout(() => { confirmPending = false; deleteBtn.textContent = 'Delete Workout'; deleteBtn.style.fontWeight = ''; }, 3000);
      return;
    }
    await softDelete('workouts', workout.id);
    for (const s of sets) await softDelete('sets', s.id);
    closeModal();
    showToast('Workout deleted', 'success');
    if (onDelete) onDelete();
  });

  // Editable duration
  const durEl = body.querySelector('#dur-display');
  if (durEl) {
    durEl.addEventListener('click', () => {
      const currentMin = Math.floor(workout.durationSec / 60);
      durEl.outerHTML = `<span id="dur-edit" class="flex items-center gap-1" style="display:inline-flex"><input class="input-inline" type="number" id="dur-edit-input" value="${currentMin}" style="width:56px;font-size:var(--text-xs)" inputmode="numeric" /><span>min</span><button class="btn btn-ghost text-xs" id="dur-edit-save" style="padding:0 var(--sp-1);min-height:0">Save</button></span>`;
      const editInput = body.querySelector('#dur-edit-input');
      editInput.focus();
      editInput.select();
      body.querySelector('#dur-edit-save').addEventListener('click', async () => {
        const val = parseInt(editInput.value);
        if (!val || val <= 0) { showToast('Enter a valid duration', 'danger'); return; }
        workout.durationSec = val * 60;
        await put('workouts', workout);
        body.querySelector('#dur-edit').outerHTML = `<span id="dur-display" style="cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px" title="Tap to edit">${formatDuration(workout.durationSec)}</span>`;
        showToast('Duration updated', 'success');
        if (onDelete) onDelete(); // re-render list to reflect change
      });
    });
  }
}
