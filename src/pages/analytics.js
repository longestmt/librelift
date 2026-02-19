/**
 * analytics.js — Analytics (Beta) page
 * Lifetime metrics, weekly report, muscle engagement, exercise analytics
 */

import { getAll, getSetting } from '../data/db.js';
import { createLineChart } from '../components/charts.js';

export async function renderAnalyticsPage(container) {
  const workouts = await getAll('workouts');
  const sets = await getAll('sets');
  const exercises = await getAll('exercises');
  const unit = await getSetting('unit', 'lb');

  // Compute metrics
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const totalWorkouts = workouts.length;
  const totalDuration = workouts.reduce((s, w) => s + (w.durationSec || 0), 0);
  const totalVolume = sets.filter(s => s.completed).reduce((s, r) => s + (r.weight || 0) * (r.reps || 0), 0);
  const totalSets = sets.filter(s => s.completed).length;

  // Weekly
  const weekWorkouts = workouts.filter(w => new Date(w.date) >= weekStart);
  const weekWorkoutIds = new Set(weekWorkouts.map(w => w.id));
  const weekSets = sets.filter(s => weekWorkoutIds.has(s.workoutId) && s.completed);
  const weekDuration = weekWorkouts.reduce((s, w) => s + (w.durationSec || 0), 0);
  const weekVolume = weekSets.reduce((s, r) => s + (r.weight || 0) * (r.reps || 0), 0);

  // First workout date
  const firstDate = workouts.length > 0 ? workouts.reduce((min, w) => w.date < min ? w.date : min, workouts[0].date) : null;
  const daysSinceStart = firstDate ? Math.max(1, Math.floor((now - new Date(firstDate)) / 86400000)) : 0;

  const fmtDur = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };
  const fmtVol = (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString();

  container.innerHTML = `
    <!-- Lifetime Metrics -->
    <div class="card" style="margin-bottom:var(--sp-4)">
      <div class="card-header"><div class="card-title" style="font-size:var(--text-sm)">Lifetime Metrics</div>${firstDate ? `<span class="text-xs text-muted">Since ${firstDate}</span>` : ''}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-top:var(--sp-3)">
        <div class="text-center">
          <div class="font-bold text-accent" style="font-size:var(--text-xl)">${totalWorkouts}</div>
          <div class="text-xs text-muted">Workouts</div>
        </div>
        <div class="text-center">
          <div class="font-bold text-accent" style="font-size:var(--text-xl)">${fmtDur(totalDuration)}</div>
          <div class="text-xs text-muted">Time Training</div>
        </div>
        <div class="text-center">
          <div class="font-bold text-accent" style="font-size:var(--text-xl)">${fmtVol(totalVolume)}</div>
          <div class="text-xs text-muted">${unit} Lifted</div>
        </div>
        <div class="text-center">
          <div class="font-bold text-accent" style="font-size:var(--text-xl)">${totalSets}</div>
          <div class="text-xs text-muted">Sets Completed</div>
        </div>
      </div>
    </div>

    <!-- Weekly Report -->
    <div class="card" style="margin-bottom:var(--sp-4)">
      <div class="card-header"><div class="card-title" style="font-size:var(--text-sm)">This Week</div><span class="text-xs text-muted">${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — Now</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--sp-3);margin-top:var(--sp-3)">
        <div class="text-center">
          <div class="font-bold text-accent" style="font-size:var(--text-lg)">${weekWorkouts.length}</div>
          <div class="text-xs text-muted">Workouts</div>
        </div>
        <div class="text-center">
          <div class="font-bold text-accent" style="font-size:var(--text-lg)">${fmtDur(weekDuration)}</div>
          <div class="text-xs text-muted">Duration</div>
        </div>
        <div class="text-center">
          <div class="font-bold text-accent" style="font-size:var(--text-lg)">${fmtVol(weekVolume)}</div>
          <div class="text-xs text-muted">${unit} Volume</div>
        </div>
      </div>
    </div>

    <!-- Tab Bar -->
    <div class="flex gap-2" style="margin-bottom:var(--sp-4)">
      <button class="btn btn-sm analytics-tab active" data-tab="muscle" style="flex:1">Muscle Engagement</button>
      <button class="btn btn-sm analytics-tab" data-tab="exercise" style="flex:1">Exercise Analytics</button>
    </div>

    <div id="analytics-tab-content"></div>
  `;

  const tabContent = container.querySelector('#analytics-tab-content');
  const tabs = container.querySelectorAll('.analytics-tab');

  function activateTab(tab) {
    tabs.forEach(t => { t.classList.toggle('active', t === tab); t.classList.toggle('btn-primary', t === tab); t.classList.toggle('btn-secondary', t !== tab); });
    if (tab.dataset.tab === 'muscle') renderMuscleTab(tabContent, sets, exercises, unit);
    else renderExerciseTab(tabContent, sets, exercises, workouts, unit);
  }

  tabs.forEach(t => t.addEventListener('click', () => activateTab(t)));
  activateTab(tabs[0]);
}

function renderMuscleTab(container, sets, exercises, unit) {
  // Group completed sets by muscle group
  const exMap = new Map();
  for (const ex of exercises) exMap.set(ex.id, ex);

  const muscleData = {};
  for (const s of sets) {
    if (!s.completed) continue;
    const ex = exMap.get(s.exerciseId);
    if (!ex) continue;
    const mg = ex.muscleGroup || 'Other';
    if (!muscleData[mg]) muscleData[mg] = { sets: 0, volume: 0, exercises: new Set() };
    muscleData[mg].sets++;
    muscleData[mg].volume += (s.weight || 0) * (s.reps || 0);
    muscleData[mg].exercises.add(ex.name);
  }

  const sorted = Object.entries(muscleData).sort((a, b) => b[1].sets - a[1].sets);
  const maxSets = sorted.length > 0 ? sorted[0][1].sets : 1;

  const fmtVol = (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString();

  container.innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title" style="font-size:var(--text-sm)">Sets by Muscle Group</div></div>
      ${sorted.length === 0 ? '<div class="text-sm text-muted" style="padding:var(--sp-4);text-align:center">No workout data yet</div>' : ''}
      <div class="flex flex-col gap-3" style="margin-top:var(--sp-3)">
        ${sorted.map(([name, data]) => {
    const pct = Math.round((data.sets / maxSets) * 100);
    return `
          <div>
            <div class="flex items-center justify-between" style="margin-bottom:var(--sp-1)">
              <span class="text-sm font-medium">${name}</span>
              <span class="text-xs text-muted">${data.sets} sets • ${fmtVol(data.volume)} ${unit}</span>
            </div>
            <div style="height:8px;background:var(--bg-elevated);border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:4px;transition:width 500ms ease"></div>
            </div>
            <div class="text-xs text-muted" style="margin-top:2px">${data.exercises.size} exercise${data.exercises.size !== 1 ? 's' : ''}</div>
          </div>`;
  }).join('')}
      </div>
    </div>
  `;
}

function renderExerciseTab(container, sets, exercises, workouts, unit) {
  // Group sets by exercise
  const exMap = new Map();
  for (const ex of exercises) exMap.set(ex.id, ex);

  const exerciseData = {};
  for (const s of sets) {
    if (!s.completed) continue;
    const id = s.exerciseId;
    if (!exerciseData[id]) exerciseData[id] = { name: s.exerciseName || exMap.get(id)?.name || 'Unknown', sets: [] };
    exerciseData[id].sets.push(s);
  }

  // Sort by most recent/most used
  const sorted = Object.entries(exerciseData).sort((a, b) => b[1].sets.length - a[1].sets.length);

  // Workout date lookup
  const workoutDates = new Map();
  for (const w of workouts) workoutDates.set(w.id, w.date);

  container.innerHTML = `
    <div class="flex flex-col gap-3">
      ${sorted.length === 0 ? '<div class="card"><div class="text-sm text-muted" style="padding:var(--sp-4);text-align:center">No workout data yet</div></div>' : ''}
      ${sorted.map(([exId, data]) => {
    // Compute PRs
    const maxWeight = Math.max(...data.sets.map(s => s.weight || 0));
    const maxSetVol = Math.max(...data.sets.map(s => (s.weight || 0) * (s.reps || 0)));
    const best1RM = Math.max(...data.sets.map(s => estimate1RM(s.weight, s.reps)));
    const maxReps = Math.max(...data.sets.map(s => s.reps || 0));

    return `
      <div class="card" data-exercise-card="${exId}">
        <div class="card-header" style="cursor:pointer" data-toggle-ex="${exId}">
          <div>
            <div class="card-title" style="font-size:var(--text-sm)">${data.name}</div>
            <div class="text-xs text-muted">${data.sets.length} sets logged</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" class="chevron-icon"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="exercise-detail" id="detail-${exId}" style="display:none">
          <!-- PRs -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-2);margin-top:var(--sp-3)">
            <div class="card" style="padding:var(--sp-2);background:var(--bg-elevated)">
              <div class="text-xs text-muted">Max Weight</div>
              <div class="font-bold text-accent">${maxWeight} ${unit}</div>
            </div>
            <div class="card" style="padding:var(--sp-2);background:var(--bg-elevated)">
              <div class="text-xs text-muted">Best Est. 1RM</div>
              <div class="font-bold text-accent">${Math.round(best1RM)} ${unit}</div>
            </div>
            <div class="card" style="padding:var(--sp-2);background:var(--bg-elevated)">
              <div class="text-xs text-muted">Max Set Volume</div>
              <div class="font-bold text-accent">${maxSetVol.toLocaleString()} ${unit}</div>
            </div>
            <div class="card" style="padding:var(--sp-2);background:var(--bg-elevated)">
              <div class="text-xs text-muted">Max Reps</div>
              <div class="font-bold text-accent">${maxReps}</div>
            </div>
          </div>

          <!-- Chart selector -->
          <div class="flex gap-1" style="margin-top:var(--sp-3);flex-wrap:wrap">
            <button class="btn btn-ghost text-xs chart-metric active" data-metric="e1rm" data-ex="${exId}" style="padding:var(--sp-1) var(--sp-2)">Est. 1RM</button>
            <button class="btn btn-ghost text-xs chart-metric" data-metric="best" data-ex="${exId}" style="padding:var(--sp-1) var(--sp-2)">Best Set</button>
            <button class="btn btn-ghost text-xs chart-metric" data-metric="volume" data-ex="${exId}" style="padding:var(--sp-1) var(--sp-2)">Volume</button>
            <button class="btn btn-ghost text-xs chart-metric" data-metric="reps" data-ex="${exId}" style="padding:var(--sp-1) var(--sp-2)">Max Reps</button>
          </div>
          <div class="chart-container" id="chart-${exId}" style="margin-top:var(--sp-2)"></div>
        </div>
      </div>`;
  }).join('')}
    </div>
  `;

  // Toggle expand
  container.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-toggle-ex]');
    if (toggle) {
      const exId = toggle.dataset.toggleEx;
      const detail = container.querySelector(`#detail-${exId}`);
      const chevron = toggle.querySelector('.chevron-icon');
      if (detail.style.display === 'none') {
        detail.style.display = '';
        chevron.style.transform = 'rotate(180deg)';
        // Render default chart
        renderExerciseChart(exId, 'e1rm', detail.querySelector(`#chart-${exId}`), exerciseData[exId].sets, workoutDates, unit);
      } else {
        detail.style.display = 'none';
        chevron.style.transform = '';
      }
      return;
    }

    const metricBtn = e.target.closest('.chart-metric');
    if (metricBtn) {
      const exId = metricBtn.dataset.ex;
      const metric = metricBtn.dataset.metric;
      // Update active
      metricBtn.closest('.flex').querySelectorAll('.chart-metric').forEach(b => b.classList.toggle('active', b === metricBtn));
      renderExerciseChart(exId, metric, container.querySelector(`#chart-${exId}`), exerciseData[exId].sets, workoutDates, unit);
    }
  });
}

function renderExerciseChart(exId, metric, chartContainer, allSets, workoutDates, unit) {
  // Group sets by workout date and pick the best per workout
  const byWorkout = new Map();
  for (const s of allSets) {
    const date = workoutDates.get(s.workoutId) || 'Unknown';
    if (!byWorkout.has(date)) byWorkout.set(date, []);
    byWorkout.get(date).push(s);
  }

  const sortedDates = [...byWorkout.keys()].sort();

  const chartData = sortedDates.map(date => {
    const wSets = byWorkout.get(date);
    let value;
    switch (metric) {
      case 'e1rm':
        value = Math.max(...wSets.map(s => estimate1RM(s.weight, s.reps)));
        break;
      case 'best':
        value = Math.max(...wSets.map(s => (s.weight || 0) * (s.reps || 0)));
        break;
      case 'volume':
        value = wSets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
        break;
      case 'reps':
        value = Math.max(...wSets.map(s => s.reps || 0));
        break;
      default:
        value = 0;
    }
    return { label: date.slice(5), value }; // MM-DD label
  });

  const labels = { e1rm: `Est. 1RM (${unit})`, best: `Best Set Vol (${unit})`, volume: `Total Volume (${unit})`, reps: 'Max Reps' };

  chartContainer.innerHTML = '';
  const width = Math.min(chartContainer.offsetWidth || 300, 400);
  const chart = createLineChart(chartData, { width, height: 160, label: labels[metric] || metric });
  chartContainer.appendChild(chart);
}

function estimate1RM(weight, reps) {
  if (!weight || !reps || reps <= 0) return 0;
  if (reps === 1) return weight;
  // Epley formula
  return weight * (1 + reps / 30);
}
