/**
 * history.js — Workout History page
 */

import { getAll, getById, getByIndex, softDelete } from '../data/db.js';
import { createLineChart } from '../components/charts.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

export async function renderHistoryPage(container) {
  const workouts = await getAll('workouts');
  workouts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const allSets = await getAll('sets');
  const exercises = await getAll('exercises');

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">History</h1>
      <p class="page-subtitle">${workouts.length} workout${workouts.length !== 1 ? 's' : ''} logged</p>
    </div>
    <div id="heatmap-area" style="margin-bottom:var(--sp-6)"></div>
    <div class="tabs" style="margin-bottom:var(--sp-4)">
      <button class="tab active" data-tab="workouts">Workouts</button>
      <button class="tab" data-tab="exercises">By Exercise</button>
    </div>
    <div id="history-content"></div>`;

  // Heatmap
  renderHeatmap(container.querySelector('#heatmap-area'), workouts);

  // Tabs
  const tabContainer = container.querySelector('.tabs');
  const content = container.querySelector('#history-content');

  function showTab(tab) {
    tabContainer.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    if (tab === 'workouts') renderWorkoutsList(content, workouts, allSets);
    else renderExerciseProgress(content, exercises, allSets);
  }

  tabContainer.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (tab) showTab(tab.dataset.tab);
  });

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

  let html = '<div style="display:flex;gap:3px;flex-wrap:wrap;">';
  const d = new Date(startDate);
  while (d <= today) {
    const key = d.toISOString().split('T')[0];
    const count = dateMap.get(key) || 0;
    const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count >= 3 ? 4 : 3;
    const title = `${key}: ${count} workout${count !== 1 ? 's' : ''}`;
    html += `<div class="heatmap-cell level-${level}" title="${title}"></div>`;
    d.setDate(d.getDate() + 1);
  }
  html += '</div>';
  container.innerHTML = html;
}

function renderWorkoutsList(container, workouts, allSets) {
  if (workouts.length === 0) {
    container.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><div class="empty-state-title">No workouts yet</div><div class="empty-state-text">Complete a workout to see it here</div></div>`;
    return;
  }

  container.innerHTML = `<div class="flex flex-col gap-3">${workouts.map(w => {
    const wSets = allSets.filter(s => s.workoutId === w.id);
    const vol = wSets.reduce((s, r) => s + (r.completed ? r.weight * r.reps : 0), 0);
    const dur = w.durationSec ? `${Math.floor(w.durationSec / 60)}m` : '';
    const completed = wSets.filter(s => s.completed).length;

    return `<div class="card card-clickable" data-workout-id="${w.id}">
      <div class="card-header">
        <div>
          <div class="card-title">${w.dayName || 'Workout'}</div>
          <div class="flex gap-2" style="margin-top:2px">
            <span class="text-xs text-muted">${w.date || ''}</span>
            ${w.planName ? `<span class="badge badge-muted">${w.planName}</span>` : ''}
          </div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div class="flex gap-4 text-xs text-secondary" style="margin-top:var(--sp-2)">
        ${dur ? `<span>⏱ ${dur}</span>` : ''}
        <span>📊 ${vol.toLocaleString()} vol</span>
        <span>✅ ${completed}/${wSets.length} sets</span>
        ${w.exerciseCount ? `<span>💪 ${w.exerciseCount} exercises</span>` : ''}
      </div>
    </div>`;
  }).join('')}</div>`;

  container.addEventListener('click', async (e) => {
    const card = e.target.closest('[data-workout-id]');
    if (!card) return;
    const wId = card.dataset.workoutId;
    const w = workouts.find(x => x.id === wId);
    const wSets = allSets.filter(s => s.workoutId === wId);
    showWorkoutDetail(w, wSets, () => {
      // Re-render the page after deletion
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  });
}

function showWorkoutDetail(workout, sets, onDelete) {
  const exerciseMap = new Map();
  for (const s of sets) {
    const key = s.exerciseName || s.exerciseId;
    if (!exerciseMap.has(key)) exerciseMap.set(key, []);
    exerciseMap.get(key).push(s);
  }

  const body = openModal('', { title: workout.dayName || 'Workout' });
  body.innerHTML = `
    <div class="text-xs text-muted" style="margin-bottom:var(--sp-3)">${workout.date}${workout.planName ? ` • ${workout.planName}` : ''}${workout.durationSec ? ` • ${Math.floor(workout.durationSec / 60)}m` : ''}</div>
    ${workout.notes ? `<div class="card" style="margin-bottom:var(--sp-3);padding:var(--sp-3)"><div class="text-xs text-muted">Notes</div><div class="text-sm">${workout.notes}</div></div>` : ''}
    <div class="flex flex-col gap-4">
      ${[...exerciseMap.entries()].map(([name, exSets]) => `
        <div>
          <div class="font-semibold text-sm" style="margin-bottom:var(--sp-1);color:var(--accent)">${name}</div>
          <div class="flex flex-col gap-1">
            ${exSets.sort((a, b) => a.setNumber - b.setNumber).map(s => `
              <div class="flex items-center gap-3 text-sm">
                <span class="text-muted" style="width:24px">S${s.setNumber}</span>
                <span class="font-mono">${s.weight} × ${s.reps}</span>
                ${s.rpe ? `<span class="text-xs text-muted">@${s.rpe}</span>` : ''}
                <span>${s.completed ? '<span class="text-success">✓</span>' : s.failed ? '<span class="text-danger">✗</span>' : '<span class="text-muted">—</span>'}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('<div class="divider" style="margin:var(--sp-2) 0"></div>')}
    </div>
    <button class="btn btn-ghost text-sm text-danger btn-full" id="delete-workout-btn" style="margin-top:var(--sp-4)">Delete Workout</button>`;

  body.querySelector('#delete-workout-btn').addEventListener('click', async () => {
    if (!confirm('Delete this workout? This cannot be undone.')) return;
    await softDelete('workouts', workout.id);
    // Also delete associated sets
    for (const s of sets) await softDelete('sets', s.id);
    closeModal();
    showToast('Workout deleted', 'success');
    if (onDelete) onDelete();
  });
}

function renderExerciseProgress(container, exercises, allSets) {
  const exercisesWithSets = exercises.filter(ex => allSets.some(s => s.exerciseId === ex.id));

  if (exercisesWithSets.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-title">No exercise data</div><div class="empty-state-text">Complete workouts to see progression</div></div>`;
    return;
  }

  container.innerHTML = `<div class="flex flex-col gap-4">${exercisesWithSets.map(ex => {
    const exSets = allSets.filter(s => s.exerciseId === ex.id && s.completed);
    const workoutMap = new Map();
    for (const s of exSets) { if (!workoutMap.has(s.workoutId)) workoutMap.set(s.workoutId, []); workoutMap.get(s.workoutId).push(s); }
    const dataPoints = [...workoutMap.values()].map(sets => {
      const best = sets.reduce((a, b) => a.weight > b.weight ? a : b);
      return { value: best.weight, label: '' };
    });

    return `<div class="card"><div class="card-title" style="margin-bottom:var(--sp-2)">${ex.name}</div><div class="text-xs text-muted" style="margin-bottom:var(--sp-2)">${workoutMap.size} sessions • Best: ${Math.max(...exSets.map(s => s.weight))} ${''}</div><div id="chart-${ex.id}"></div></div>`;
  }).join('')}</div>`;

  // Render charts
  exercisesWithSets.forEach(ex => {
    const el = container.querySelector(`#chart-${ex.id}`);
    if (!el) return;
    const exSets = allSets.filter(s => s.exerciseId === ex.id && s.completed);
    const workoutMap = new Map();
    for (const s of exSets) { if (!workoutMap.has(s.workoutId)) workoutMap.set(s.workoutId, []); workoutMap.get(s.workoutId).push(s); }
    const data = [...workoutMap.values()].map(sets => {
      const best = sets.reduce((a, b) => a.weight > b.weight ? a : b);
      return { value: best.weight, label: '' };
    });
    const chart = createLineChart(data, { width: Math.min(320, window.innerWidth - 80), height: 120 });
    el.appendChild(chart);
  });
}
