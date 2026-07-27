/**
 * analytics.js — Focused progress review
 * Answers: how consistently am I training, and are my lifts moving?
 */

import { getAll, getSetting } from '../data/db.js';
import { createLineChart } from '../components/charts.js';
import { renderExerciseProgressList } from '../components/exercise-progress.js';
import {
  calculateVolumeByUnit,
  resolveSetUnit,
} from '../engine/progress-metrics.js';
import { formatDuration } from '../utils/format.js';
import { escapeHTML } from '../utils/sanitize.js';
import { enableRovingKeyboard } from '../utils/accessibility.js';

function parseLocalDate(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatShortDate(value) {
  const date = parseLocalDate(value);
  if (!date) return value || 'Unknown';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatVolume(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return Math.round(value).toLocaleString();
}

function formatVolumes(volumes, fallbackUnit) {
  const entries = [...volumes.entries()].filter(([, value]) => value > 0);
  if (entries.length === 0) return `0 ${escapeHTML(fallbackUnit)}`;
  return entries
    .map(([unit, value]) => `${formatVolume(value)} ${escapeHTML(unit)}`)
    .join(' + ');
}

export async function renderAnalyticsPage(container) {
  const [workouts, sets, exercises, bodyWeight, fallbackUnit] = await Promise.all([
    getAll('workouts'),
    getAll('sets'),
    getAll('exercises'),
    getAll('bodyWeight'),
    getSetting('unit', 'lb'),
  ]);
  const workoutById = new Map(workouts.map(workout => [workout.id, workout]));

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const completedSets = sets.filter(set => set.completed);
  const weekWorkouts = workouts.filter(workout => {
    const date = parseLocalDate(workout.date);
    return date && date >= weekStart && date <= now;
  });
  const weekWorkoutIds = new Set(weekWorkouts.map(workout => workout.id));
  const weekSets = completedSets.filter(set => weekWorkoutIds.has(set.workoutId));

  const totalDuration = workouts.reduce((sum, workout) => sum + (workout.durationSec || 0), 0);
  const weekDuration = weekWorkouts.reduce((sum, workout) => sum + (workout.durationSec || 0), 0);
  const totalVolumes = calculateVolumeByUnit(completedSets, workoutById, fallbackUnit);
  const weekVolumes = calculateVolumeByUnit(weekSets, workoutById, fallbackUnit);
  const firstDate = workouts.reduce(
    (earliest, workout) => !earliest || workout.date < earliest ? workout.date : earliest,
    null
  );
  const hasLegacyUnits = sets.some(set => !set.unit)
    && workouts.some(workout => !workout.unit);

  container.innerHTML = `
    ${workouts.length === 0 ? `
      <div class="empty-state" style="margin-bottom:var(--sp-4)">
        <div class="empty-state-title">Your progress starts with a completed workout</div>
        <div class="empty-state-text">Once you log one, this page will summarize your consistency and lift trends.</div>
      </div>` : ''}

    ${hasLegacyUnits ? `
      <div class="text-xs text-muted" style="margin-bottom:var(--sp-3)">
        Older records without a saved unit use your current ${escapeHTML(fallbackUnit)} setting.
      </div>` : ''}

    <div class="card" style="margin-bottom:var(--sp-4)">
      <div class="card-header">
        <div class="card-title" style="font-size:var(--text-sm)">All Time</div>
        ${firstDate ? `<span class="text-xs text-muted">Since ${escapeHTML(formatShortDate(firstDate))}</span>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-top:var(--sp-3)">
        ${metric(workouts.length, 'Workouts')}
        ${metric(formatDuration(totalDuration), 'Time Training')}
        ${metric(formatVolumes(totalVolumes, fallbackUnit), 'Volume')}
        ${metric(completedSets.length, 'Sets Completed')}
      </div>
    </div>

    <div class="card" style="margin-bottom:var(--sp-4)">
      <div class="card-header">
        <div class="card-title" style="font-size:var(--text-sm)">This Week</div>
        <span class="text-xs text-muted">${escapeHTML(formatShortDate(toDateKey(weekStart)))} — Now</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--sp-3);margin-top:var(--sp-3)">
        ${metric(weekWorkouts.length, 'Workouts', 'var(--text-lg)')}
        ${metric(formatDuration(weekDuration), 'Duration', 'var(--text-lg)')}
        ${metric(formatVolumes(weekVolumes, fallbackUnit), 'Volume', 'var(--text-lg)')}
      </div>
    </div>

    <div class="card" style="margin-bottom:var(--sp-4)">
      <div class="card-header">
        <div class="card-title" style="font-size:var(--text-sm)">Bodyweight</div>
      </div>
      <div id="bw-chart-area" style="margin-top:var(--sp-2)"></div>
    </div>

    <div class="flex gap-2" role="tablist" aria-label="Progress detail" style="margin-bottom:var(--sp-4)">
      <button type="button" class="btn btn-sm analytics-tab active" id="progress-exercises-tab" role="tab" aria-controls="analytics-tab-content" aria-selected="true" tabindex="0" data-tab="exercise" style="flex:1">Exercises</button>
      <button type="button" class="btn btn-sm analytics-tab" id="progress-muscles-tab" role="tab" aria-controls="analytics-tab-content" aria-selected="false" tabindex="-1" data-tab="muscle" style="flex:1">Muscle Groups</button>
    </div>

    <div id="analytics-tab-content" role="tabpanel" aria-labelledby="progress-exercises-tab"></div>
  `;

  renderBodyweight(container.querySelector('#bw-chart-area'), bodyWeight, fallbackUnit);

  const tabContent = container.querySelector('#analytics-tab-content');
  const tabs = [...container.querySelectorAll('.analytics-tab')];

  function activateTab(tab) {
    tabs.forEach(button => {
      const active = button === tab;
      button.classList.toggle('active', active);
      button.classList.toggle('btn-primary', active);
      button.classList.toggle('btn-secondary', !active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    tabContent.setAttribute('aria-labelledby', tab.id);

    if (tab.dataset.tab === 'exercise') {
      renderExerciseProgressList(tabContent, {
        exercises,
        sets,
        workouts,
        fallbackUnit,
      });
    } else {
      renderMuscleTab(tabContent, sets, exercises, workoutById, fallbackUnit);
    }
  }

  tabs.forEach(tab => tab.addEventListener('click', () => activateTab(tab)));
  enableRovingKeyboard(
    container.querySelector('[role="tablist"][aria-label="Progress detail"]'),
    { selector: '[role="tab"]' }
  );
  activateTab(tabs[0]);
}

function metric(value, label, size = 'var(--text-xl)') {
  return `
    <div class="text-center" style="min-width:0">
      <div class="font-bold text-accent" style="font-size:${size};overflow-wrap:anywhere">${escapeHTML(String(value))}</div>
      <div class="text-xs text-muted">${label}</div>
    </div>`;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function renderBodyweight(container, entries, fallbackUnit) {
  if (entries.length === 0) {
    container.innerHTML = `
      <div class="text-sm text-muted" style="text-align:center;padding:var(--sp-3)">
        No bodyweight data yet — you can log it after finishing a workout.
      </div>`;
    return;
  }

  const byUnit = new Map();
  for (const entry of entries) {
    if (!Number.isFinite(entry.value)) continue;
    const unit = entry.unit || fallbackUnit;
    if (!byUnit.has(unit)) byUnit.set(unit, []);
    byUnit.get(unit).push(entry);
  }

  if (byUnit.size === 0) {
    container.innerHTML = '<div class="text-sm text-muted" style="text-align:center;padding:var(--sp-3)">No valid bodyweight entries yet.</div>';
    return;
  }

  container.innerHTML = '';
  for (const [unit, unitEntries] of byUnit) {
    unitEntries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const latest = unitEntries[unitEntries.length - 1];
    const section = document.createElement('div');
    section.style.marginTop = 'var(--sp-2)';
    section.innerHTML = `
      <div class="flex items-center justify-between" style="margin-bottom:var(--sp-2)">
        <span class="font-bold text-accent" style="font-size:var(--text-lg)">${escapeHTML(String(latest.value))} ${escapeHTML(unit)}</span>
        <span class="text-xs text-muted">${unitEntries.length} ${unitEntries.length === 1 ? 'entry' : 'entries'}</span>
      </div>`;
    section.appendChild(createLineChart(
      unitEntries.map(entry => ({
        label: formatShortDate(entry.date),
        value: entry.value,
      })),
      {
        width: Math.min(container.clientWidth || 360, 560),
        height: 140,
        label: `Bodyweight (${unit})`,
      }
    ));
    container.appendChild(section);
  }
}

function renderMuscleTab(container, sets, exercises, workoutById, fallbackUnit) {
  const exerciseById = new Map(exercises.map(exercise => [exercise.id, exercise]));
  const muscleData = new Map();

  for (const set of sets) {
    if (!set.completed) continue;
    const exercise = exerciseById.get(set.exerciseId);
    if (!exercise) continue;

    const muscle = exercise.muscleGroup || 'Other';
    if (!muscleData.has(muscle)) {
      muscleData.set(muscle, { sets: 0, volumes: new Map(), exercises: new Set() });
    }

    const data = muscleData.get(muscle);
    data.sets++;
    data.exercises.add(exercise.name);
    if (Number.isFinite(set.weight) && Number.isFinite(set.reps)) {
      const unit = resolveSetUnit(set, workoutById.get(set.workoutId), fallbackUnit);
      data.volumes.set(
        unit,
        (data.volumes.get(unit) || 0) + Math.max(0, set.weight) * Math.max(0, set.reps)
      );
    }
  }

  const sorted = [...muscleData.entries()].sort((a, b) => b[1].sets - a[1].sets);
  const maxSets = sorted[0]?.[1].sets || 1;

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title" style="font-size:var(--text-sm)">Completed Sets by Muscle Group</div>
      </div>
      ${sorted.length === 0
        ? '<div class="text-sm text-muted" style="padding:var(--sp-4);text-align:center">Complete a set to see muscle-group totals.</div>'
        : `
          <div class="flex flex-col gap-3" style="margin-top:var(--sp-3)">
            ${sorted.map(([name, data]) => {
              const percentage = Math.round((data.sets / maxSets) * 100);
              return `
                <div>
                  <div class="flex items-center justify-between gap-2" style="margin-bottom:var(--sp-1);flex-wrap:wrap">
                    <span class="text-sm font-medium">${escapeHTML(name)}</span>
                    <span class="text-xs text-muted">${data.sets} ${data.sets === 1 ? 'set' : 'sets'} • ${formatVolumes(data.volumes, fallbackUnit)}</span>
                  </div>
                  <div role="img" aria-label="${escapeHTML(name)}: ${data.sets} completed ${data.sets === 1 ? 'set' : 'sets'}" style="height:8px;background:var(--bg-elevated);border-radius:4px;overflow:hidden">
                    <div style="height:100%;width:${percentage}%;background:var(--accent);border-radius:4px"></div>
                  </div>
                  <div class="text-xs text-muted" style="margin-top:2px">${data.exercises.size} exercise${data.exercises.size !== 1 ? 's' : ''}</div>
                </div>`;
            }).join('')}
          </div>`}
    </div>`;
}
