/**
 * workout.js — Active Workout page (hero page)
 */

import { getAll, getById, getByIndex, put, saveCompletedWorkout, getSetting, setSetting, uuid } from '../data/db.js';
import {
  suggestNextWeight,
  suggestNextCardio,
  getExerciseHistory,
  deriveSetType,
  checkPersonalRecord,
  checkCardioPersonalRecord,
} from '../engine/progression.js';
import { createTimerElement, startTimer, stopTimer } from '../components/timer.js';
import { createPlateCalculator } from '../components/plate-calc.js';
import { createRMCalculator } from '../components/rm-calculator.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast, showPRToast } from '../components/toast.js';
import { saveSession, loadSessionRecord, clearSession } from '../data/session.js';
import { hapticLight, hapticMedium, hapticHeavy, hapticSuccess } from '../utils/haptics.js';
import { escapeHTML } from '../utils/sanitize.js';
import { formatDuration } from '../utils/format.js';
import { distanceUnitForWeightUnit } from '../engine/progress-metrics.js';
import {
  findFirstInvalidCompletedSet,
  getWorkoutProgress,
  hasMeaningfulWorkoutProgress,
  parseSetInput,
  validateSetForCompletion,
} from '../engine/workout-validation.js';

function isCardioExercise(exercise) {
  return exercise?.mode === 'cardio'
    || exercise?.category === 'Cardio'
    || exercise?.sets?.some(set => set.mode === 'cardio');
}

function createCardioSet(setNumber, suggestion = {}, distanceUnit = 'mi') {
  return {
    id: uuid(),
    setNumber,
    mode: 'cardio',
    durationSec: suggestion.durationSec ?? null,
    distance: suggestion.distance ?? null,
    distanceUnit,
    calories: null,
    completed: false,
    failed: false,
  };
}

function formatCardioTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function formatCardioPerformance(set, fallbackDistanceUnit) {
  if (!set) return 'First time';
  const time = formatCardioTime(set.durationSec);
  const distance = Number.isFinite(set.distance) && set.distance > 0
    ? ` / ${set.distance} ${set.distanceUnit || fallbackDistanceUnit}`
    : '';
  return `Last: ${time}${distance}`;
}

let activeWorkout = null;
let workoutInterval = null;
let inactivityTimeout = null;
let isFinishing = false;

function saveWorkoutProgress() {
  if (!activeWorkout) return;
  saveSession(activeWorkout);
}

// Draft persistence is the primary recovery mechanism. The native browser
// warning adds protection for accidental refreshes and tab/app closure.
window.addEventListener('pagehide', saveWorkoutProgress);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveWorkoutProgress();
});
window.addEventListener('beforeunload', (event) => {
  if (!activeWorkout || isFinishing || !hasMeaningfulWorkoutProgress(activeWorkout)) return;
  saveWorkoutProgress();
  event.preventDefault();
  event.returnValue = '';
});

function clearInactivityTimer() {
  if (inactivityTimeout) {
    clearTimeout(inactivityTimeout);
    inactivityTimeout = null;
  }
}

function pauseWorkoutForInactivity(startedAt, timeoutMs) {
  if (!activeWorkout || activeWorkout.pausedAt || activeWorkout.inactivityStartedAt !== startedAt) return;

  const pauseAt = startedAt + timeoutMs;
  activeWorkout.pausedAt = pauseAt;
  delete activeWorkout.inactivityStartedAt;
  saveSession(activeWorkout);

  if (workoutInterval) { clearInterval(workoutInterval); workoutInterval = null; }

  const clock = document.querySelector('#workout-clock');
  if (clock) {
    updateWorkoutClock(clock, pauseAt);
    clock.style.opacity = '0.5';
    clock.setAttribute('aria-pressed', 'true');
    clock.setAttribute('aria-label', 'Resume workout timer');
  }
  showToast('Workout auto-paused due to inactivity', 'info');
}

function scheduleInactivityTimer(autoPauseMin) {
  clearInactivityTimer();
  if (!activeWorkout || activeWorkout.pausedAt || !activeWorkout.inactivityStartedAt) return;
  if (autoPauseMin <= 0) {
    delete activeWorkout.inactivityStartedAt;
    saveSession(activeWorkout);
    return;
  }

  const startedAt = activeWorkout.inactivityStartedAt;
  const timeoutMs = autoPauseMin * 60 * 1000;
  const remainingMs = (startedAt + timeoutMs) - Date.now();

  if (remainingMs <= 0) {
    pauseWorkoutForInactivity(startedAt, timeoutMs);
    return;
  }

  inactivityTimeout = setTimeout(() => {
    inactivityTimeout = null;
    if (!activeWorkout || activeWorkout.inactivityStartedAt !== startedAt) return;

    // A suspended mobile app may deliver the callback late. The persisted
    // deadline still determines the exact point at which the workout paused.
    if (Date.now() < startedAt + timeoutMs) {
      scheduleInactivityTimer(autoPauseMin);
      return;
    }
    pauseWorkoutForInactivity(startedAt, timeoutMs);
  }, remainingMs);
}

function restartInactivityTimer(autoPauseMin) {
  if (!activeWorkout) return;

  if (autoPauseMin <= 0) {
    delete activeWorkout.inactivityStartedAt;
    saveSession(activeWorkout);
    clearInactivityTimer();
    return;
  }

  const now = Date.now();
  activeWorkout.inactivityStartedAt = now;
  activeWorkout.lastActivityAt = now;
  saveSession(activeWorkout);
  scheduleInactivityTimer(autoPauseMin);
}

function resumeWorkout(autoPauseMin) {
  if (!activeWorkout?.pausedAt) return;

  const pausedElapsed = activeWorkout.pausedAt - activeWorkout.startTime;
  activeWorkout.startTime = Date.now() - pausedElapsed;
  delete activeWorkout.pausedAt;

  const clock = document.querySelector('#workout-clock');
  if (clock) {
    updateWorkoutClock(clock);
    clock.style.opacity = '1';
    clock.setAttribute('aria-pressed', 'false');
    clock.setAttribute('aria-label', 'Pause workout timer');
  }

  if (workoutInterval) clearInterval(workoutInterval);
  workoutInterval = setInterval(() => updateWorkoutClock(clock), 1000);
  restartInactivityTimer(autoPauseMin);
}

export async function renderWorkoutPage(container) {
  const unit = await getSetting('unit', 'lb');
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const planId = params.get('planId');

  // A recovered session requires an explicit choice. In-memory navigation
  // during the current app session resumes immediately and never loses edits.
  if (!activeWorkout) {
    const saved = loadSessionRecord();
    if (saved?.workout) {
      if (hasMeaningfulWorkoutProgress(saved.workout)) {
        renderWorkoutRecovery(container, unit, saved);
        return;
      }
      clearSession();
    }
  }

  if (activeWorkout) {
    renderActiveWorkout(container, unit);
    return;
  }

  const plans = await getAll('plans');
  const lastUsedId = await getSetting('lastUsedPlanId', null);

  // Sort: last-used plan first, then others
  const activePlan = plans.find(p => p.id === lastUsedId) || plans[0] || null;
  const otherPlans = plans.filter(p => p !== activePlan);

  const renderPlanButton = (plan, prominent) => {
    const nextDay = plan.days?.[plan.currentDayIndex || 0];
    if (prominent) {
      return `<button type="button" class="card card-clickable" data-start-plan="${escapeHTML(plan.id)}" style="text-align:left;border:1px solid var(--accent);font-family:var(--font-sans);width:100%;cursor:pointer">
          <div class="card-header"><div><div class="card-title" style="font-size:var(--text-lg)">${escapeHTML(plan.name)}</div>
          ${nextDay ? `<div class="text-sm text-accent" style="margin-top:4px">Next: ${escapeHTML(nextDay.name)}</div>` : ''}
          </div><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg></div></button>`;
    }
    return `<button type="button" class="card card-clickable" data-start-plan="${escapeHTML(plan.id)}" style="text-align:left;border:none;font-family:var(--font-sans);width:100%;cursor:pointer;padding:var(--sp-2) var(--sp-3);opacity:0.85">
          <div class="card-header"><div><div class="card-title text-sm">${escapeHTML(plan.name)}</div>
          ${nextDay ? `<div class="text-xs text-muted">Next: ${escapeHTML(nextDay.name)}</div>` : ''}
          </div><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg></div></button>`;
  };

  container.innerHTML = `
    <div class="page-header" style="text-align:center; padding-top:var(--sp-8)">
      <h1 class="page-title">Ready to Lift?</h1>
      <p class="page-subtitle">${activePlan ? 'Start your next workout' : 'Choose a program or go freestyle'}</p>
    </div>
    <div class="flex flex-col gap-3" style="max-width:400px; margin:var(--sp-6) auto 0">
      ${activePlan ? renderPlanButton(activePlan, true) : ''}
      ${otherPlans.length > 0 ? `
        <button class="btn btn-ghost text-xs" id="toggle-other-plans" style="align-self:center;padding:var(--sp-1) var(--sp-3)">
          <span id="toggle-other-label">Switch Program ▾</span>
        </button>
        <div id="other-plans" class="flex flex-col gap-2" style="display:none">
          ${otherPlans.map(p => renderPlanButton(p, false)).join('')}
        </div>
      ` : ''}
      ${plans.length === 0 ? `<button class="btn btn-primary btn-full btn-lg" id="pick-a-plan"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>Choose a Program</button>` : ''}
      <div class="divider"></div>
      <button class="btn btn-secondary btn-full btn-lg" id="start-empty-workout">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Start a Custom Workout
      </button>
    </div>`;

  // Toggle other plans
  container.querySelector('#toggle-other-plans')?.addEventListener('click', () => {
    const el = container.querySelector('#other-plans');
    const label = container.querySelector('#toggle-other-label');
    if (el.style.display === 'none') { el.style.display = ''; label.textContent = 'Switch Program ▴'; }
    else { el.style.display = 'none'; label.textContent = 'Switch Program ▾'; }
  });

  container.addEventListener('click', async (e) => {
    const planBtn = e.target.closest('[data-start-plan]');
    if (planBtn) {
      const plan = await getById('plans', planBtn.dataset.startPlan);
      if (plan) {
        await setSetting('lastUsedPlanId', plan.id);
        await startWorkoutFromPlan(plan, unit);
        renderActiveWorkout(container, unit);
      }
    }
  });

  container.querySelector('#start-empty-workout')?.addEventListener('click', async () => {
    startEmptyWorkout();
    renderActiveWorkout(container, unit);
  });

  container.querySelector('#pick-a-plan')?.addEventListener('click', () => {
    window.location.hash = '/plans';
  });

  if (planId) {
    const plan = await getById('plans', planId);
    if (plan) {
      const dayIndexParam = params.get('dayIndex');
      const overrideDayIndex = dayIndexParam !== null ? parseInt(dayIndexParam) : null;
      await setSetting('lastUsedPlanId', plan.id);
      await startWorkoutFromPlan(plan, unit, overrideDayIndex);
      renderActiveWorkout(container, unit);
    }
  }
}

function renderWorkoutRecovery(container, unit, savedSession) {
  const workout = savedSession.workout;
  const progress = getWorkoutProgress(workout);
  const savedDate = savedSession.savedAt ? new Date(savedSession.savedAt) : null;
  const savedLabel = savedDate && !Number.isNaN(savedDate.getTime())
    ? `Saved ${savedDate.toLocaleString()}`
    : 'Saved during your previous session';
  const progressLabel = progress.total > 0
    ? `${progress.completed} of ${progress.total} sets completed`
    : 'No sets completed yet';

  container.innerHTML = `
    <div class="page-header" style="text-align:center;padding-top:var(--sp-8)">
      <h1 class="page-title">Resume Workout?</h1>
      <p class="page-subtitle">Your local draft is safe.</p>
    </div>
    <div class="card" style="max-width:440px;margin:var(--sp-6) auto 0">
      <div class="card-title">${escapeHTML(workout.dayName || 'Workout')}</div>
      ${workout.planName ? `<div class="text-sm text-secondary" style="margin-top:var(--sp-1)">${escapeHTML(workout.planName)}</div>` : ''}
      <div class="text-sm text-muted" style="margin-top:var(--sp-3)">${progressLabel}</div>
      <div class="text-xs text-muted" style="margin-top:var(--sp-1)">${escapeHTML(savedLabel)}</div>
      <div class="flex flex-col gap-2" style="margin-top:var(--sp-4)">
        <button class="btn btn-primary btn-full" id="resume-workout-btn">Resume Workout</button>
        <button class="btn btn-ghost btn-full text-danger" id="discard-workout-btn">Discard Draft</button>
      </div>
    </div>`;

  container.querySelector('#resume-workout-btn').addEventListener('click', async () => {
    activeWorkout = workout;
    saveSession(activeWorkout); // Upgrade legacy session records on resume.
    await renderActiveWorkout(container, unit);
  });

  container.querySelector('#discard-workout-btn').addEventListener('click', async () => {
    await revertPlanDayForDraft(workout);
    clearSession();
    activeWorkout = null;
    if (window.location.hash !== '#/workout') {
      window.location.hash = '/workout';
    } else {
      await renderWorkoutPage(container);
    }
    showToast('Workout draft discarded', 'info');
  });
}

async function revertPlanDayForDraft(workout) {
  if (!workout?.planId) return;
  const plan = await getById('plans', workout.planId);
  if (!plan) return;
  plan.currentDayIndex = workout.dayIndex;
  await put('plans', plan);
}

function getLastWorkoutSets(allSets) {
  if (!allSets.length) return null;
  const map = new Map();
  for (const s of allSets) { if (!map.has(s.workoutId)) map.set(s.workoutId, []); map.get(s.workoutId).push(s); }
  const sorted = [...map.entries()].sort((a, b) => (b[1][0].createdAt || '').localeCompare(a[1][0].createdAt || ''));
  return sorted[0]?.[1] || null;
}

async function startWorkoutFromPlan(plan, unit, overrideDayIndex = null) {
  hapticMedium();
  const dayIndex = overrideDayIndex !== null ? overrideDayIndex : (plan.currentDayIndex || 0);
  const day = plan.days[dayIndex];
  const exercises = await getAll('exercises');
  const workoutExercises = [];

  for (const ex of day.exercises) {
    const exercise = exercises.find(e => e.id === ex.exerciseId);
    const isCardio = exercise?.category === 'Cardio';
    const suggestion = ex.exerciseId
      ? (isCardio
        ? await suggestNextCardio(ex.exerciseId, ex, unit)
        : await suggestNextWeight(ex.exerciseId, ex, unit))
      : { weight: 0, reason: 'first-time' };
    const prevSets = ex.exerciseId ? await getByIndex('sets', 'exerciseId', ex.exerciseId) : [];
    const lastSets = getLastWorkoutSets(prevSets);
    const sets = [];
    for (let i = 0; i < ex.sets; i++) {
      sets.push(isCardio
        ? createCardioSet(i + 1, suggestion, distanceUnitForWeightUnit(unit))
        : { id: uuid(), setNumber: i + 1, targetReps: ex.reps, targetRepsMax: ex.repsMax || null, weight: suggestion.weight, reps: ex.repsMax || ex.reps, completed: false, failed: false, rpe: null }
      );
    }
    workoutExercises.push({
      exerciseId: ex.exerciseId,
      exerciseName: exercise?.name || ex.exerciseName || 'Unknown',
      category: exercise?.category || null,
      mode: isCardio ? 'cardio' : 'strength',
      config: ex,
      sets,
      suggestedWeight: suggestion.weight,
      suggestionReason: suggestion.reason,
      previousPerformance: lastSets,
      notes: '',
      collapsed: false,
    });
  }

  const startTime = Date.now();
  activeWorkout = { id: uuid(), planId: plan.id, planName: plan.name, dayName: day.name, dayIndex, startTime, inactivityStartedAt: startTime, exercises: workoutExercises, notes: '' };
  saveSession(activeWorkout);
  plan.currentDayIndex = (dayIndex + 1) % plan.days.length;
  await put('plans', plan);
}

function startEmptyWorkout() {
  const startTime = Date.now();
  activeWorkout = { id: uuid(), planId: null, planName: null, dayName: 'Freestyle', dayIndex: 0, startTime, inactivityStartedAt: startTime, exercises: [], notes: '' };
  saveSession(activeWorkout);
}

async function renderActiveWorkout(container, unit) {
  const autoPauseMin = await getSetting('autoPauseMin', 15);

  container.innerHTML = `
    <div class="flex items-center justify-between workout-header gap-2" style="margin-bottom:var(--sp-4)">
      <div><h1 class="page-title" style="font-size:var(--text-xl)">${escapeHTML(activeWorkout.dayName || 'Workout')}</h1>
      ${activeWorkout.planName ? `<div class="text-xs text-muted">${escapeHTML(activeWorkout.planName)}</div>` : ''}</div>
      <div class="flex items-center gap-2 workout-header-actions">
        <button type="button" id="workout-clock" class="btn btn-ghost font-mono text-sm text-accent" aria-label="Pause workout timer" aria-pressed="false" style="min-width:50px;padding:var(--sp-2) var(--sp-3)">0:00</button>
        <button type="button" class="btn btn-ghost text-sm" id="cancel-workout-btn" style="padding:var(--sp-2) var(--sp-3);color:var(--text-muted)">Cancel</button>
        <button type="button" class="btn btn-danger" id="finish-workout-btn" style="padding:var(--sp-2) var(--sp-4)">Finish</button>
      </div>
    </div>
    <div id="workout-exercises" class="flex flex-col gap-4"></div>
    <div style="margin-top:var(--sp-4)"><div class="input-group"><label class="input-label" for="workout-notes">Gym Notes</label>
      <textarea class="input" id="workout-notes" rows="2" placeholder="How's the session going?">${escapeHTML(activeWorkout.notes)}</textarea></div></div>
    <div style="margin-top:var(--sp-4)"><button class="btn btn-secondary btn-full" id="add-exercise-btn">+ Add Exercise</button></div>`;

  const exContainer = container.querySelector('#workout-exercises');

  // Timer bar appended to body so it's not trapped in a hidden container
  const timerEl = createTimerElement();
  document.body.appendChild(timerEl);

  // Workout clock with pause (pausedAt is persisted on activeWorkout so it survives app restart)
  const clockEl = container.querySelector('#workout-clock');

  if (workoutInterval) { clearInterval(workoutInterval); workoutInterval = null; }

  if (activeWorkout.pausedAt) {
    // Restore paused state from saved session
    clockEl.style.opacity = '0.5';
    const pausedElapsed = Math.floor((activeWorkout.pausedAt - activeWorkout.startTime) / 1000);
    clockEl.textContent = `${Math.floor(pausedElapsed / 60)}:${(pausedElapsed % 60).toString().padStart(2, '0')}`;
    clockEl.setAttribute('aria-pressed', 'true');
    clockEl.setAttribute('aria-label', 'Resume workout timer');
  } else {
    updateWorkoutClock(clockEl);
    workoutInterval = setInterval(() => updateWorkoutClock(clockEl), 1000);
  }

  clockEl.addEventListener('click', () => {
    if (activeWorkout.pausedAt) {
      resumeWorkout(autoPauseMin);
    } else {
      // Pause: record when we paused
      activeWorkout.pausedAt = Date.now();
      delete activeWorkout.inactivityStartedAt;
      saveSession(activeWorkout);
      clearInactivityTimer();
      clockEl.style.opacity = '0.5';
      clockEl.setAttribute('aria-pressed', 'true');
      clockEl.setAttribute('aria-label', 'Resume workout timer');
      if (workoutInterval) { clearInterval(workoutInterval); workoutInterval = null; }
    }
  });

  container.querySelector('#workout-notes').addEventListener('input', (e) => { activeWorkout.notes = e.target.value; saveWorkoutProgress(); });

  // Starting a workout starts the invisible inactivity timer. Returning to an
  // already-running workout preserves its saved deadline rather than resetting it.
  if (!activeWorkout.pausedAt && !activeWorkout.inactivityStartedAt) {
    restartInactivityTimer(autoPauseMin);
  } else {
    scheduleInactivityTimer(autoPauseMin);
  }

  renderWorkoutExercises(exContainer, unit);

  // Event listeners set up ONCE here (not in renderWorkoutExercises which re-runs)
  setupWorkoutEvents(exContainer, unit, autoPauseMin);

  container.querySelector('#add-exercise-btn').addEventListener('click', async () => {
    const exercises = await getAll('exercises');
    showExercisePicker(exercises, exContainer, unit);
  });

  container.querySelector('#finish-workout-btn').addEventListener('click', () => finishWorkout(container, unit));
  container.querySelector('#cancel-workout-btn').addEventListener('click', () => cancelWorkout(container, unit));
}

function renderExerciseCard(ex, ei, unit) {
  const isCardio = isCardioExercise(ex);
  const distanceUnit = distanceUnitForWeightUnit(unit);
  const prevText = isCardio
    ? formatCardioPerformance(ex.previousPerformance?.[0], distanceUnit)
    : (ex.previousPerformance ? `Last: ${ex.previousPerformance[0]?.weight || 0}${unit} × ${ex.previousPerformance[0]?.reps || 0}` : 'First time');
  const reasonBadge = ex.suggestionReason === 'increment' ? '<span class="badge badge-success">↑ Up</span>' : ex.suggestionReason === 'deload' ? '<span class="badge badge-danger">↓ Deload</span>' : '';

  return `<div class="card" data-ei="${ei}" style="${ex.supersetGroup ? 'border:none;box-shadow:none;background:transparent;padding:0' : ''}">
      <div class="card-header exercise-card-header gap-2">
        <button type="button" data-toggle="${ei}" aria-expanded="${!ex.collapsed}" style="border:0;background:none;color:inherit;text-align:left;font:inherit;padding:0;cursor:pointer;flex:1;min-width:0">
          <div class="card-title">${escapeHTML(ex.exerciseName)}</div><div class="flex gap-2" style="margin-top:2px">${reasonBadge}<span class="prev-hint">${escapeHTML(prevText)}</span></div>
        </button>
        <div class="flex items-center gap-1 exercise-card-actions">
          <button type="button" class="btn btn-ghost btn-icon" data-show-history="${ei}" aria-label="History for ${escapeHTML(ex.exerciseName)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></button>
          <button type="button" class="btn btn-ghost btn-icon" data-swap-ex="${ei}" aria-label="Swap ${escapeHTML(ex.exerciseName)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/></svg></button>
          ${isCardio ? '' : `<button type="button" class="btn btn-ghost btn-icon" data-show-rm="${ei}" aria-label="1RM calculator for ${escapeHTML(ex.exerciseName)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button type="button" class="btn btn-ghost btn-icon" data-show-plates="${ei}" aria-label="Plate calculator for ${escapeHTML(ex.exerciseName)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="6" width="4" height="12" rx="1"/><rect x="18" y="6" width="4" height="12" rx="1"/><line x1="6" y1="12" x2="18" y2="12"/></svg></button>`}
        </div>
      </div>
      <div class="exercise-body" style="${ex.collapsed ? 'display:none' : ''}">
        <div class="set-grid-header ${isCardio ? 'cardio-set-grid' : ''}" aria-hidden="true"><span style="text-align:center">SET</span><span style="text-align:center">${isCardio ? 'TIME' : unit.toUpperCase()}</span><span style="text-align:center">${isCardio ? `DIST (${distanceUnit})` : `REPS${ex.config?.repsMax && ex.config.repsMax !== ex.config.reps ? ` (${ex.config.reps}–${ex.config.repsMax})` : ''}`}</span><span style="text-align:center">${isCardio ? 'CAL' : 'RPE'}</span><span style="text-align:center">✓</span></div>
        ${ex.sets.map((set, si) => isCardio ? renderCardioSetRow(set, si, ei) : renderSetRow(set, si, ei)).join('')}
        <div class="flex gap-2" style="margin-top:var(--sp-2)"><button class="btn btn-ghost text-sm" data-add-set="${ei}" style="flex:1">+ Set</button>${ex.sets.length > 1 ? `<button class="btn btn-ghost text-sm text-danger" data-remove-set="${ei}">− Set</button>` : ''}<button class="btn btn-ghost text-sm" data-ex-note="${ei}" title="Note"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button></div>
        ${ex.notes ? `<div class="text-xs text-muted" style="margin-top:var(--sp-1);padding:var(--sp-1) var(--sp-2);background:var(--bg-elevated);border-radius:var(--radius-sm);font-style:italic">${escapeHTML(ex.notes)}</div>` : ''}
      </div></div>`;
}

function renderCardioSetRow(set, si, ei) {
  const cls = set.completed ? 'completed' : '';
  const icon = set.completed ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '';
  const locked = set.completed ? 'readonly' : '';
  const lockedCls = set.completed ? 'locked' : '';
  const minutes = Number.isFinite(set.durationSec) ? Math.floor(set.durationSec / 60) : '';
  const seconds = Number.isFinite(set.durationSec) ? set.durationSec % 60 : '';
  const distance = Number.isFinite(set.distance) ? set.distance : '';
  const calories = Number.isFinite(set.calories) ? set.calories : '';
  return `<div class="set-row cardio-set-grid">
    <span class="set-number" aria-hidden="true">${set.setNumber}</span>
    <div class="cardio-time-input">
      <input class="input-inline ${lockedCls}" type="number" min="0" step="1" aria-label="Minutes for set ${set.setNumber}" value="${minutes}" data-ei="${ei}" data-si="${si}" data-field="durationMin" inputmode="numeric" placeholder="m" ${locked}/>
      <span aria-hidden="true">:</span>
      <input class="input-inline ${lockedCls}" type="number" min="0" max="59" step="1" aria-label="Seconds for set ${set.setNumber}" value="${seconds}" data-ei="${ei}" data-si="${si}" data-field="durationSeconds" inputmode="numeric" placeholder="s" ${locked}/>
    </div>
    <input class="input-inline ${lockedCls}" type="number" min="0" step="any" aria-label="Distance for set ${set.setNumber}" value="${distance}" data-ei="${ei}" data-si="${si}" data-field="distance" inputmode="decimal" placeholder="—" ${locked}/>
    <input class="input-inline ${lockedCls}" type="number" min="0" step="1" aria-label="Calories for set ${set.setNumber}" value="${calories}" data-ei="${ei}" data-si="${si}" data-field="calories" inputmode="numeric" placeholder="—" ${locked}/>
    <button type="button" class="set-check ${cls}" aria-label="Mark set ${set.setNumber} ${set.completed ? 'incomplete' : 'complete'}" aria-pressed="${set.completed}" data-ei="${ei}" data-si="${si}">${icon}</button>
  </div>`;
}

function renderLinkButton(ei) {
  return `<div class="superset-link-zone" style="display:flex;justify-content:center;padding:var(--sp-1) 0">
    <button class="btn btn-ghost text-xs" data-link-superset="${ei}" style="padding:2px var(--sp-2);color:var(--text-muted);opacity:0.6" title="Link as superset">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      Link
    </button>
  </div>`;
}

function renderWorkoutExercises(container, unit) {
  const exercises = activeWorkout.exercises;
  let html = '';
  let i = 0;

  while (i < exercises.length) {
    const ex = exercises[i];

    if (ex.supersetGroup) {
      // Collect all consecutive exercises in this superset group
      const groupId = ex.supersetGroup;
      const groupStart = i;
      const groupExercises = [];
      while (i < exercises.length && exercises[i].supersetGroup === groupId) {
        groupExercises.push({ ex: exercises[i], ei: i });
        i++;
      }
      const names = groupExercises.map(g => g.ex.exerciseName).join(' + ');
      const label = groupExercises.length > 2 ? 'Circuit' : 'Superset';
      html += `<div class="superset-wrapper">
        <div class="superset-header">
          <span class="badge badge-accent">${label}</span>
          <span class="text-xs text-muted">${names}</span>
          <button class="btn btn-ghost text-xs" data-unlink-superset="${groupStart}" style="margin-left:auto;padding:2px var(--sp-2);color:var(--text-muted)">Unlink</button>
        </div>
        ${groupExercises.map(g => renderExerciseCard(g.ex, g.ei, unit)).join('')}
      </div>`;
    } else {
      html += renderExerciseCard(ex, i, unit);
      i++;
    }

    // Add link button between exercises/groups (not after the last one)
    if (i < exercises.length) {
      html += renderLinkButton(i - 1);
    }
  }

  container.innerHTML = html;
}

function renderSetRow(set, si, ei) {
  const cls = set.completed ? 'completed' : '';
  const icon = set.completed ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '';
  const locked = set.completed ? 'readonly' : '';
  const lockedCls = set.completed ? 'locked' : '';
  const isPressed = set.completed ? 'true' : 'false';
  const weightValue = Number.isFinite(set.weight) ? set.weight : '';
  const repsValue = Number.isFinite(set.reps) ? set.reps : '';
  const rpeValue = Number.isFinite(set.rpe) ? set.rpe : '';
  return `<div class="set-row">
    <span class="set-number" aria-hidden="true">${set.setNumber}</span>
    <input class="input-inline ${lockedCls}" type="number" min="0" step="any" aria-label="Weight for set ${set.setNumber}" value="${weightValue}" data-ei="${ei}" data-si="${si}" data-field="weight" inputmode="decimal" ${locked}/>
    <input class="input-inline ${lockedCls}" type="number" min="1" step="1" aria-label="Reps for set ${set.setNumber}" value="${repsValue}" data-ei="${ei}" data-si="${si}" data-field="reps" inputmode="numeric" ${locked}/>
    <input class="input-inline ${lockedCls}" type="number" min="1" max="10" step="0.5" aria-label="RPE for set ${set.setNumber}" value="${rpeValue}" data-ei="${ei}" data-si="${si}" data-field="rpe" inputmode="decimal" placeholder="—" ${locked}/>
    <button type="button" class="set-check ${cls}" aria-label="Mark set ${set.setNumber} ${set.completed ? 'incomplete' : 'complete'}" aria-pressed="${isPressed}" data-ei="${ei}" data-si="${si}">${icon}</button>
  </div>`;
}

function isSupersetRoundComplete(groupId, exercises) {
  const grouped = exercises.filter(e => e.supersetGroup === groupId);
  if (grouped.length === 0) return true;
  // The current round number is the minimum completed sets across the group
  const completedCounts = grouped.map(e => e.sets.filter(s => s.completed).length);
  const minCompleted = Math.min(...completedCounts);
  const maxCompleted = Math.max(...completedCounts);
  // Round is complete when all exercises have the same number of completed sets
  return minCompleted === maxCompleted && minCompleted > 0;
}

function setupWorkoutEvents(container, unit, autoPauseMin) {
  container.addEventListener('click', async (e) => {
    // Check buttons FIRST (they are inside card-header, must not bubble to toggle)
    const historyBtn = e.target.closest('[data-show-history]');
    if (historyBtn) {
      e.stopPropagation();
      const ei = parseInt(historyBtn.dataset.showHistory);
      showExerciseHistoryModal(ei, unit);
      return;
    }

    const rmBtn = e.target.closest('[data-show-rm]');
    if (rmBtn) {
      e.stopPropagation();
      const ei = parseInt(rmBtn.dataset.showRm);
      const ex = activeWorkout.exercises[ei];
      const lastCompleted = [...ex.sets].reverse().find(s => s.completed);
      const w = lastCompleted?.weight || ex.sets[0]?.weight || 0;
      const r = lastCompleted?.reps || ex.sets[0]?.reps || 0;
      const el = await createRMCalculator(w, r);
      const body = openModal('', { title: `1RM — ${ex.exerciseName}` });
      body.innerHTML = '';
      body.appendChild(el);
      return;
    }

    const platesBtn = e.target.closest('[data-show-plates]');
    if (platesBtn) { e.stopPropagation(); const ei = parseInt(platesBtn.dataset.showPlates); const w = activeWorkout.exercises[ei].sets[0]?.weight || 0; const el = await createPlateCalculator(w); const body = openModal('', { title: `Plates for ${w}${unit}` }); body.innerHTML = ''; body.appendChild(el); return; }

    const swapBtn = e.target.closest('[data-swap-ex]');
    if (swapBtn) { e.stopPropagation(); const ei = parseInt(swapBtn.dataset.swapEx); showSwapPicker(ei, container, unit); return; }

    const linkBtn = e.target.closest('[data-link-superset]');
    if (linkBtn) {
      e.stopPropagation();
      const ei = parseInt(linkBtn.dataset.linkSuperset);
      const exA = activeWorkout.exercises[ei];
      const exB = activeWorkout.exercises[ei + 1];
      if (!exB) return;
      // Merge into one group — absorb B's group into A's if both exist
      const groupId = exA.supersetGroup || exB.supersetGroup || uuid();
      const oldGroupB = exB.supersetGroup;
      if (oldGroupB && oldGroupB !== groupId) {
        for (const ex of activeWorkout.exercises) {
          if (ex.supersetGroup === oldGroupB) ex.supersetGroup = groupId;
        }
      }
      exA.supersetGroup = groupId;
      exB.supersetGroup = groupId;
      saveSession(activeWorkout);
      renderWorkoutExercises(container, unit);
      const count = activeWorkout.exercises.filter(e => e.supersetGroup === groupId).length;
      showToast(count > 2 ? 'Circuit updated' : 'Superset created', 'success');
      return;
    }

    const unlinkBtn = e.target.closest('[data-unlink-superset]');
    if (unlinkBtn) {
      e.stopPropagation();
      const ei = parseInt(unlinkBtn.dataset.unlinkSuperset);
      const groupId = activeWorkout.exercises[ei].supersetGroup;
      if (groupId) {
        for (const ex of activeWorkout.exercises) {
          if (ex.supersetGroup === groupId) delete ex.supersetGroup;
        }
      }
      saveSession(activeWorkout);
      renderWorkoutExercises(container, unit);
      showToast('Superset removed', 'info');
      return;
    }

    const toggle = e.target.closest('[data-toggle]');
    if (toggle) { const ei = parseInt(toggle.dataset.toggle); activeWorkout.exercises[ei].collapsed = !activeWorkout.exercises[ei].collapsed; saveWorkoutProgress(); renderWorkoutExercises(container, unit); return; }

    const check = e.target.closest('.set-check');
    if (check) {
      const ei = parseInt(check.dataset.ei), si = parseInt(check.dataset.si);
      const ex = activeWorkout.exercises[ei];
      const set = ex.sets[si];
      // Simple toggle: tap = done, tap again = undo
      if (!set.completed) {
        const validation = validateSetForCompletion(set);
        if (!validation.valid) {
          const invalidInput = container.querySelector(
            `.input-inline[data-ei="${ei}"][data-si="${si}"][data-field="${validation.field}"]`
          );
          if (invalidInput) {
            invalidInput.setAttribute('aria-invalid', 'true');
            invalidInput.focus();
          }
          showToast(validation.message, 'danger');
          return;
        }

        set.completed = true;

        // Reuse the just-completed values for later interval/working sets.
        for (let i = si + 1; i < ex.sets.length; i++) {
          if (!ex.sets[i].completed) {
            if (isCardioExercise(ex)) {
              ex.sets[i].durationSec = set.durationSec;
              ex.sets[i].distance = set.distance;
              ex.sets[i].calories = set.calories;
            } else {
              ex.sets[i].weight = set.weight;
              ex.sets[i].reps = set.reps;
            }
          }
        }

        // Haptics & Animation
        hapticHeavy();

        if (activeWorkout.pausedAt) resumeWorkout(autoPauseMin);
        else restartInactivityTimer(autoPauseMin);
        renderWorkoutExercises(container, unit);

        // Trigger animation on the newly rendered check button
        const newCheck = container.querySelector(`.set-check[data-ei="${ei}"][data-si="${si}"]`);
        if (newCheck) {
          newCheck.classList.add('set-completed');
          setTimeout(() => newCheck.classList.remove('set-completed'), 500);
        }

        // Check for personal record
        if (ex.exerciseId && isCardioExercise(ex)) {
          checkCardioPersonalRecord(ex.exerciseId, set).then(pr => {
            if (pr) showToast(`🏆 ${ex.exerciseName}: ${pr.label}`, 'success', 4000);
          });
        } else if (ex.exerciseId && set.weight > 0 && set.reps > 0) {
          checkPersonalRecord(ex.exerciseId, set.weight, set.reps).then(pr => {
            if (pr) showPRToast(ex.exerciseName, pr, unit);
          });
        }

        // Rest timer: skip if mid-superset, start after the round is complete
        const shouldRest = !ex.supersetGroup || isSupersetRoundComplete(ex.supersetGroup, activeWorkout.exercises);
        if (shouldRest) {
          const rest = await getSetting('restTimer', 90);
          startTimer(rest);
        }
      } else {
        set.completed = false;

        hapticLight();
        saveWorkoutProgress();
        renderWorkoutExercises(container, unit);
      }
      return;
    }

    const removeSet = e.target.closest('[data-remove-set]');
    if (removeSet) { const ei = parseInt(removeSet.dataset.removeSet); const ex = activeWorkout.exercises[ei]; if (ex.sets.length > 1) { ex.sets.pop(); ex.sets.forEach((s, i) => s.setNumber = i + 1); saveWorkoutProgress(); renderWorkoutExercises(container, unit); } return; }

    const addSet = e.target.closest('[data-add-set]');
    if (addSet) {
      const ei = parseInt(addSet.dataset.addSet);
      const ex = activeWorkout.exercises[ei];
      const last = ex.sets[ex.sets.length - 1];
      ex.sets.push(isCardioExercise(ex)
        ? createCardioSet(ex.sets.length + 1, last, distanceUnitForWeightUnit(unit))
        : { id: uuid(), setNumber: ex.sets.length + 1, targetReps: last?.targetReps || 5, weight: last?.weight || 0, reps: last?.reps || 5, completed: false, failed: false, rpe: null }
      );
      saveWorkoutProgress();
      renderWorkoutExercises(container, unit);
      return;
    }

    const noteBtn = e.target.closest('[data-ex-note]');
    if (noteBtn) {
      const ei = parseInt(noteBtn.dataset.exNote);
      const ex = activeWorkout.exercises[ei];
      const body = openModal('', { title: `Note — ${ex.exerciseName}` });
      body.innerHTML = `<label class="input-label" for="ex-note-input">Exercise note</label><textarea class="input" id="ex-note-input" rows="3" autofocus placeholder="How does this feel? Any cues?">${escapeHTML(ex.notes) || ''}</textarea>
              <button class="btn btn-primary btn-full" id="save-note-btn" style="margin-top:var(--sp-3)">Save</button>`;
      body.querySelector('#save-note-btn').addEventListener('click', () => {
        ex.notes = body.querySelector('#ex-note-input').value;
        saveWorkoutProgress();
        closeModal();
        renderWorkoutExercises(container, unit);
      });
      return;
    }
  });

  container.addEventListener('input', (e) => {
    const input = e.target.closest('.input-inline');
    if (!input) return;
    const ei = parseInt(input.dataset.ei), si = parseInt(input.dataset.si), field = input.dataset.field;
    const set = activeWorkout.exercises[ei].sets[si];
    if (field === 'durationMin' || field === 'durationSeconds') {
      const row = input.closest('.set-row');
      const minutes = Number.parseInt(row.querySelector('[data-field="durationMin"]').value || '0', 10);
      const seconds = Number.parseInt(row.querySelector('[data-field="durationSeconds"]').value || '0', 10);
      set.durationSec = Math.max(0, minutes || 0) * 60 + Math.max(0, Math.min(59, seconds || 0));
    } else {
      set[field] = parseSetInput(field, input.value);
    }
    input.removeAttribute('aria-invalid');
    saveWorkoutProgress();
  });
}

function updateWorkoutClock(el, now = Date.now()) {
  if (!el || !activeWorkout) return;
  const s = Math.floor((now - activeWorkout.startTime) / 1000);
  el.textContent = `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

async function finishWorkout(container, unit, incompleteConfirmed = false) {
  if (!activeWorkout) return;

  const invalidCompletedSet = findFirstInvalidCompletedSet(activeWorkout);
  if (invalidCompletedSet) {
    const { exerciseIndex, setIndex, field, message } = invalidCompletedSet;
    activeWorkout.exercises[exerciseIndex].sets[setIndex].completed = false;
    activeWorkout.exercises[exerciseIndex].collapsed = false;
    saveWorkoutProgress();

    const exerciseContainer = container.querySelector('#workout-exercises');
    renderWorkoutExercises(exerciseContainer, unit);
    const invalidInput = exerciseContainer.querySelector(
      `.input-inline[data-ei="${exerciseIndex}"][data-si="${setIndex}"][data-field="${field}"]`
    );
    if (invalidInput) {
      invalidInput.setAttribute('aria-invalid', 'true');
      invalidInput.focus();
    }
    showToast(message, 'danger');
    return;
  }

  const progress = getWorkoutProgress(activeWorkout);
  if ((progress.total === 0 || progress.incomplete > 0) && !incompleteConfirmed) {
    const body = openModal('', { title: 'Finish Workout?' });
    const completedText = progress.total > 0
      ? `${progress.completed} of ${progress.total} sets are complete.`
      : 'This workout has no sets.';
    const warningText = progress.total > 0
      ? `${completedText} Incomplete sets will remain visible in your history.`
      : `${completedText} You can review it or save the empty workout.`;
    const saveLabel = progress.total > 0
      ? `Save with ${progress.incomplete} incomplete`
      : 'Save Empty Workout';

    body.innerHTML = `
      <p class="text-secondary" style="margin-bottom:var(--sp-4)">${warningText}</p>
      <div class="flex flex-col gap-2">
        <button class="btn btn-secondary btn-full" id="finish-review">Review Workout</button>
        <button class="btn btn-danger btn-full" id="finish-incomplete">${saveLabel}</button>
      </div>`;
    body.querySelector('#finish-review').addEventListener('click', () => closeModal());
    body.querySelector('#finish-incomplete').addEventListener('click', () => {
      closeModal();
      finishWorkout(container, unit, true);
    });
    return;
  }

  const endTime = activeWorkout.pausedAt || Date.now();
  const dur = Math.floor((endTime - activeWorkout.startTime) / 1000);
  const maxWorkoutMin = await getSetting('maxWorkoutMin', 120);

  // Duration sanity check
  if (maxWorkoutMin > 0 && dur > maxWorkoutMin * 60) {
    const h = Math.floor(dur / 3600);
    const m = Math.floor((dur % 3600) / 60);
    const displayDur = h > 0 ? `${h}h ${m}m` : `${m}m`;

    const body = openModal('', { title: 'Duration Check' });
    const hasActivity = !!activeWorkout.lastActivityAt;
    const activityDur = hasActivity ? Math.floor((activeWorkout.lastActivityAt - activeWorkout.startTime) / 1000) : dur;
    const activityMin = Math.floor(activityDur / 60);

    body.innerHTML = `
      <p class="text-secondary" style="margin-bottom:var(--sp-4)">This workout is showing as <strong>${displayDur}</strong>. Does that look right?</p>
      <div class="flex flex-col gap-2">
        <button class="btn btn-secondary btn-full" id="dur-keep">Yes, save as-is</button>
        ${hasActivity ? `<button class="btn btn-full" id="dur-activity" style="background:var(--bg-elevated);color:var(--text)">Use last activity time (${activityMin}m)</button>` : ''}
        <div class="flex items-center gap-2" style="margin-top:var(--sp-2)">
          <input class="input" type="number" min="1" step="1" id="dur-manual-input" aria-label="Workout duration in minutes" placeholder="Minutes" inputmode="numeric" style="flex:1" />
          <button class="btn btn-primary" id="dur-manual-save">Save</button>
        </div>
      </div>`;

    body.querySelector('#dur-keep').addEventListener('click', () => { closeModal(); commitFinish(container, unit, dur); });
    if (hasActivity) {
      body.querySelector('#dur-activity').addEventListener('click', () => { closeModal(); commitFinish(container, unit, activityDur); });
    }
    body.querySelector('#dur-manual-save').addEventListener('click', () => {
      const val = parseInt(body.querySelector('#dur-manual-input').value);
      if (!val || val <= 0) { showToast('Enter a valid duration in minutes', 'danger'); return; }
      closeModal();
      commitFinish(container, unit, val * 60);
    });
    return;
  }

  commitFinish(container, unit, dur);
}

async function commitFinish(container, unit, dur) {
  if (!activeWorkout || isFinishing) return;

  const finishingWorkout = activeWorkout;
  const finishButton = container.querySelector('#finish-workout-btn');
  isFinishing = true;
  if (finishButton) {
    finishButton.disabled = true;
    finishButton.textContent = 'Saving…';
  }

  try {
    const allSets = [];
    for (const ex of finishingWorkout.exercises) {
      const isCardio = isCardioExercise(ex);
      const setType = isCardio ? null : deriveSetType(ex.config);
      for (const s of ex.sets) {
        allSets.push({
          id: s.id,
          workoutId: finishingWorkout.id,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          setNumber: s.setNumber,
          weight: isCardio ? null : s.weight,
          reps: isCardio ? null : s.reps,
          rpe: isCardio ? null : s.rpe,
          durationSec: isCardio ? s.durationSec : null,
          distance: isCardio ? s.distance : null,
          distanceUnit: isCardio ? (s.distanceUnit || distanceUnitForWeightUnit(unit)) : null,
          calories: isCardio ? s.calories : null,
          mode: isCardio ? 'cardio' : 'strength',
          completed: s.completed,
          failed: s.failed,
          notes: ex.notes,
          setType,
          unit,
        });
      }
    }

    // Get last bodyweight for pre-fill
    const bwEntries = await getAll('bodyWeight');
    const lastBW = bwEntries.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];

    const { workout: savedWorkout, sets: savedSets } = await saveCompletedWorkout({
      id: finishingWorkout.id,
      date: new Date().toISOString().split('T')[0],
      planId: finishingWorkout.planId,
      planName: finishingWorkout.planName,
      dayName: finishingWorkout.dayName,
      notes: finishingWorkout.notes,
      durationSec: dur,
      exerciseCount: finishingWorkout.exercises.length,
      unit,
    }, allSets);

    clearSession();
    clearInactivityTimer();
    if (workoutInterval) { clearInterval(workoutInterval); workoutInterval = null; }
    const timerBar = document.querySelector('.rest-timer-bar');
    if (timerBar) timerBar.remove();
    stopTimer();
    hapticSuccess();

    const vol = savedSets.reduce((sum, record) =>
      sum + (record.completed && record.mode !== 'cardio' ? record.weight * record.reps : 0), 0);
    const done = savedSets.filter(record => record.completed).length;
    const durStr = formatDuration(savedWorkout.durationSec);
    activeWorkout = null;
    isFinishing = false;

    container.innerHTML = `<div style="text-align:center;padding-top:var(--sp-8);animation:scaleIn 300ms var(--ease-spring)"><div style="width:80px;height:80px;border-radius:50%;background:var(--success);display:flex;align-items:center;justify-content:center;margin:0 auto var(--sp-4)"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--success-text)" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><h1 class="page-title" style="margin-bottom:var(--sp-2)">Workout Complete!</h1><p class="text-secondary">${escapeHTML(finishingWorkout.dayName || 'Workout')}</p></div>
        <div class="card" style="margin-top:var(--sp-6)"><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--sp-4);text-align:center"><div><div class="font-bold text-accent" style="font-size:var(--text-xl)">${durStr}</div><div class="text-xs text-muted">Duration</div></div><div><div class="font-bold text-accent" style="font-size:var(--text-xl)">${vol.toLocaleString()}</div><div class="text-xs text-muted">Volume</div></div><div><div class="font-bold text-success" style="font-size:var(--text-xl)">${done}/${allSets.length}</div><div class="text-xs text-muted">Sets</div></div></div></div>
        <div class="card" style="margin-top:var(--sp-3);padding:var(--sp-3)">
          <div class="flex items-center gap-3">
            <span style="font-size:20px">⚖️</span>
            <div style="flex:1">
              <div class="text-xs text-muted" style="margin-bottom:2px">Bodyweight (optional)</div>
              <div class="flex items-center gap-2">
                <input class="input" type="number" min="0" step="0.1" id="bw-input" aria-label="Bodyweight in ${escapeHTML(unit)}" placeholder="${lastBW ? lastBW.value : 'e.g. 185'}" value="${lastBW ? lastBW.value : ''}" style="width:100px" />
                <span class="text-sm text-muted">${unit}</span>
              </div>
            </div>
          </div>
        </div>
        <button class="btn btn-primary btn-full btn-lg" style="margin-top:var(--sp-4)" id="done-btn">Done</button>`;

    container.querySelector('#done-btn').addEventListener('click', async () => {
      const bwVal = parseFloat(container.querySelector('#bw-input').value);
      if (bwVal && bwVal > 0) {
        await put('bodyWeight', { date: new Date().toISOString().split('T')[0], value: bwVal, unit });
      }
      window.location.hash = '/data';
    });
    showToast('Workout saved! 💪', 'success');
  } catch (err) {
    activeWorkout = finishingWorkout;
    saveSession(activeWorkout);
    isFinishing = false;
    if (finishButton) {
      finishButton.disabled = false;
      finishButton.textContent = 'Finish';
    }
    console.error('Error finishing workout:', err);
    showToast('Could not save workout. Your draft is still safe. ' + err.message, 'danger');
  }
}

async function cancelWorkout(container, unit) {
  const body = openModal('', { title: 'Stop Workout?' });
  const hasPlan = !!activeWorkout?.planId;
  body.innerHTML = `<p class="text-secondary" style="margin-bottom:var(--sp-4)">Discarding removes this local draft and any sets logged in it.</p>
      <div class="flex flex-col gap-2">
        <button class="btn btn-secondary btn-full" id="cancel-keep">Keep Going</button>
        <button class="btn btn-danger btn-full" id="cancel-cancel">${hasPlan ? 'Discard Draft — Repeat This Day' : 'Discard Draft'}</button>
        ${hasPlan ? '<button class="btn btn-ghost btn-full" id="cancel-skip">Discard and Skip This Day</button>' : ''}
      </div>`;
  body.querySelector('#cancel-keep').addEventListener('click', () => closeModal());

  // Cancel: revert day index so user gets the same workout again
  body.querySelector('#cancel-cancel').addEventListener('click', async () => {
    closeModal();
    await revertPlanDayForDraft(activeWorkout);
    cleanupWorkout();
    showToast(hasPlan ? 'Draft discarded — this day will repeat' : 'Workout draft discarded', 'info');
  });

  // Skip: keep day index advanced (already done at start)
  if (hasPlan) {
    body.querySelector('#cancel-skip').addEventListener('click', () => {
      closeModal();
      cleanupWorkout();
      showToast('Draft discarded — moving to the next day', 'info');
    });
  }
}

function cleanupWorkout() {
  if (workoutInterval) { clearInterval(workoutInterval); workoutInterval = null; }
  clearInactivityTimer();
  const timerBar = document.querySelector('.rest-timer-bar');
  if (timerBar) timerBar.remove();
  stopTimer();
  clearSession();
  activeWorkout = null;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

async function showExercisePicker(exercises, exContainer, unit) {
  const body = openModal('', { title: 'Add Exercise' });
  body.innerHTML = `<div class="search-bar" style="margin-bottom:var(--sp-3)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input class="input" type="search" id="add-ex-search" aria-label="Search exercises" autofocus placeholder="Search..."/></div><div id="add-ex-list" style="max-height:300px;overflow-y:auto" class="flex flex-col gap-1">${exercises.map(ex => `<button type="button" class="list-item" data-id="${escapeHTML(ex.id)}" data-name="${escapeHTML(ex.name)}" data-category="${escapeHTML(ex.category || '')}" style="width:100%;border:none;background:none;text-align:left;font-family:var(--font-sans);color:var(--text-primary)"><span style="flex:1"><div class="text-sm font-medium">${escapeHTML(ex.name)}</div><div class="text-xs text-muted">${escapeHTML(ex.category || '')} • ${escapeHTML(ex.muscleGroup)} • ${escapeHTML(ex.equipment)}</div></span></button>`).join('')}</div>`;

  body.querySelector('#add-ex-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    body.querySelectorAll('.list-item').forEach(i => { i.style.display = i.textContent.toLowerCase().includes(q) ? '' : 'none'; });
  });

  body.querySelector('#add-ex-list').addEventListener('click', async (e) => {
    const item = e.target.closest('[data-id]'); if (!item) return;
    const id = item.dataset.id, name = item.dataset.name;
    const isCardio = item.dataset.category === 'Cardio';
    const config = isCardio
      ? { sets: 1, targetDurationSec: 1200, targetDistance: null }
      : { sets: 3, reps: 5, increment: 5 };
    const sug = isCardio
      ? await suggestNextCardio(id, config, unit)
      : await suggestNextWeight(id, config, unit);
    const prev = await getByIndex('sets', 'exerciseId', id);
    const sets = [];
    for (let i = 0; i < config.sets; i++) {
      sets.push(isCardio
        ? createCardioSet(i + 1, sug, distanceUnitForWeightUnit(unit))
        : { id: uuid(), setNumber: i + 1, targetReps: 5, weight: sug.weight, reps: 5, completed: false, failed: false, rpe: null }
      );
    }
    activeWorkout.exercises.push({
      exerciseId: id,
      exerciseName: name,
      category: item.dataset.category,
      mode: isCardio ? 'cardio' : 'strength',
      config,
      sets,
      suggestedWeight: sug.weight,
      suggestionReason: sug.reason,
      previousPerformance: getLastWorkoutSets(prev),
      notes: '',
      collapsed: false,
    });
    saveSession(activeWorkout);
    closeModal(); renderWorkoutExercises(exContainer, unit); showToast(`${name} added`, 'success');
  });
}

async function showSwapPicker(ei, exContainer, unit) {
  const currentEx = activeWorkout.exercises[ei];
  const allExercises = await getAll('exercises');
  const currentExData = allExercises.find(e => e.id === currentEx.exerciseId);
  const muscleGroup = currentExData?.muscleGroup || '';

  // Filter to same muscle group, exclude current exercise
  const alternatives = allExercises.filter(e => e.muscleGroup === muscleGroup && e.id !== currentEx.exerciseId);

  const body = openModal('', { title: `Swap ${currentEx.exerciseName}` });
  body.innerHTML = `
    <div class="text-xs text-muted" style="margin-bottom:var(--sp-3)">${escapeHTML(muscleGroup)} exercises • ${alternatives.length} alternatives</div>
    <div class="search-bar" style="margin-bottom:var(--sp-3)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input class="input" type="search" id="swap-search" aria-label="Search alternative exercises" autofocus placeholder="Search..."/></div>
    <div id="swap-list" style="max-height:300px;overflow-y:auto" class="flex flex-col gap-1">
      ${alternatives.map(ex => `
        <div class="list-item" style="flex-direction:column;align-items:stretch;gap:var(--sp-2);padding:var(--sp-3)">
          <div><div class="text-sm font-medium">${escapeHTML(ex.name)}</div><div class="text-xs text-muted">${escapeHTML(ex.equipment)}</div></div>
          <div class="flex gap-2">
            <button type="button" class="btn btn-secondary text-xs" data-swap-id="${escapeHTML(ex.id)}" data-swap-name="${escapeHTML(ex.name)}" data-swap-category="${escapeHTML(ex.category || '')}" data-swap-mode="temp" style="flex:1;padding:var(--sp-1) var(--sp-2)">This workout</button>
            ${activeWorkout.planId ? `<button type="button" class="btn btn-primary text-xs" data-swap-id="${escapeHTML(ex.id)}" data-swap-name="${escapeHTML(ex.name)}" data-swap-category="${escapeHTML(ex.category || '')}" data-swap-mode="permanent" style="flex:1;padding:var(--sp-1) var(--sp-2)">All future</button>` : ''}
          </div>
        </div>
      `).join('')}
      ${alternatives.length === 0 ? '<div class="text-sm text-muted" style="padding:var(--sp-4);text-align:center">No alternatives found</div>' : ''}
    </div>`;

  body.querySelector('#swap-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    body.querySelectorAll('.list-item').forEach(i => { i.style.display = i.textContent.toLowerCase().includes(q) ? '' : 'none'; });
  });

  body.querySelector('#swap-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-swap-id]');
    if (!btn) return;
    const newId = btn.dataset.swapId;
    const newName = btn.dataset.swapName;
    const newCategory = btn.dataset.swapCategory;
    const mode = btn.dataset.swapMode;

    // Swap in current workout
    const oldId = currentEx.exerciseId;
    const oldName = currentEx.exerciseName;
    currentEx.exerciseId = newId;
    currentEx.exerciseName = newName;
    currentEx.category = newCategory;
    currentEx.mode = newCategory === 'Cardio' ? 'cardio' : 'strength';

    const isCardio = newCategory === 'Cardio';
    const nextConfig = isCardio
      ? { sets: currentEx.sets.length || 1, targetDurationSec: 1200, targetDistance: null }
      : { sets: currentEx.sets.length || 3, reps: 5, increment: 5 };
    currentEx.config = nextConfig;
    const sug = isCardio
      ? await suggestNextCardio(newId, nextConfig, unit)
      : await suggestNextWeight(newId, nextConfig, unit);
    const prev = await getByIndex('sets', 'exerciseId', newId);
    currentEx.suggestedWeight = sug.weight;
    currentEx.suggestionReason = sug.reason;
    currentEx.previousPerformance = getLastWorkoutSets(prev);
    currentEx.sets = currentEx.sets.map((set, index) =>
      isCardio
        ? createCardioSet(index + 1, sug, distanceUnitForWeightUnit(unit))
        : { id: set.id || uuid(), setNumber: index + 1, targetReps: 5, weight: sug.weight, reps: 5, completed: false, failed: false, rpe: null }
    );

    // If permanent, also update the plan
    if (mode === 'permanent' && activeWorkout.planId) {
      const plan = await getById('plans', activeWorkout.planId);
      if (plan) {
        const day = plan.days[activeWorkout.dayIndex];
        if (day) {
          const planEx = day.exercises.find(e => e.exerciseId === oldId || e.exerciseName === oldName);
          if (planEx) {
            planEx.exerciseId = newId;
            planEx.exerciseName = newName;
            await put('plans', plan);
          }
        }
      }
    }

    saveSession(activeWorkout);
    closeModal();
    renderWorkoutExercises(exContainer, unit);
    showToast(`Swapped to ${newName}`, 'success');
  });
}

async function showExerciseHistoryModal(ei, unit) {
  const ex = activeWorkout.exercises[ei];
  if (!ex || !ex.exerciseId) return;

  const history = await getExerciseHistory(ex.exerciseId);
  const body = openModal('', { title: `${ex.exerciseName} History` });

  if (!history.length) {
    body.innerHTML = '<div class="text-sm text-muted" style="text-align:center;padding:var(--sp-4)">No recorded history yet.</div>';
    return;
  }

  const fmtDate = (iso) => {
    if (!iso) return 'Unknown';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--sp-2);max-height:60vh;overflow-y:auto;padding-right:var(--sp-2)">
      ${history.slice().reverse().map(h => `
        <div class="card" style="padding:var(--sp-3);display:flex;flex-direction:column;gap:var(--sp-2)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div class="font-bold">${h.mode === 'cardio'
                ? `${formatCardioTime(h.durationSec)}${h.distance ? ` / ${h.distance} ${escapeHTML(h.distanceUnit || distanceUnitForWeightUnit(unit))}` : ''}`
                : `${h.weight} ${escapeHTML(h.unit || unit)} × ${h.reps}`}</div>
              <div class="text-xs text-muted" style="margin-top:2px">${fmtDate(h.date)}</div>
            </div>
            <div style="text-align:right">
              <div class="text-xs text-muted">${h.mode === 'cardio' ? (h.pace ? 'Pace' : 'Calories') : 'Volume'}</div>
              <div class="font-medium" style="color:var(--accent)">${h.mode === 'cardio'
                ? (h.pace
                  ? `${formatCardioTime(h.pace)} / ${escapeHTML(h.distanceUnit || distanceUnitForWeightUnit(unit))}`
                  : `${h.calories || 0} cal`)
                : `${h.volume >= 1000 ? `${(h.volume / 1000).toFixed(1)}k` : h.volume} ${escapeHTML(h.unit || unit)}`}</div>
            </div>
          </div>
          ${h.notes ? `<div class="text-sm text-muted" style="padding:var(--sp-2);background:var(--bg-elevated);border-radius:var(--radius-sm);font-style:italic;margin-top:4px">${escapeHTML(h.notes)}</div>` : ''}
        </div>
      `).join('')}
    </div>`;
}

export function openWorkoutPage(container) {
  activeWorkout = null;
  if (workoutInterval) { clearInterval(workoutInterval); workoutInterval = null; }

  container.innerHTML = `
    <div class="flex items-center justify-between" style="margin-bottom:var(--sp-4)">
      <h1 class="page-title" style="font-size:var(--text-xl)">Start Workout</h1>
    </div>
    <div class="flex flex-col gap-3">
      <button class="btn btn-primary btn-full shadow-sm" id="start-empty-btn" style="height:48px;font-size:var(--text-base)">+ Start Empty Workout</button>
    </div>
    <div style="margin-top:var(--sp-5);margin-bottom:var(--sp-3)">
      <h2 class="font-bold text-sm">Active Plans</h2>
    </div>
    <div id="workout-plan-list" class="flex flex-col gap-3"></div>
  `;

  const planList = container.querySelector('#workout-plan-list');
  getAll('plans').then(plans => {
    if (!plans.length) {
      planList.innerHTML = '<div class="card"><div class="text-sm text-muted" style="text-align:center">No active plans. Add a plan from the Plans tab.</div></div>';
      return;
    }

    planList.innerHTML = plans.map(p => {
      const dayIndex = p.currentDayIndex || 0;
      const day = p.days[dayIndex];
      return `<div class="card" style="cursor:pointer" data-plan-id="${p.id}">
        <div class="card-header">
          <div><div class="card-title">${p.name}</div><div class="text-xs text-muted" style="margin-top:2px">Up next: ${day ? day.name : 'Workout'}</div></div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>`;
    }).join('');
  });

  container.querySelector('#start-empty-btn').addEventListener('click', () => {
    startEmptyWorkout();
    renderActiveWorkout(container, 'lb'); // Default to lb, UI will adapt on save
  });

  planList.addEventListener('click', async (e) => {
    const card = e.target.closest('[data-plan-id]');
    if (!card) return;
    const plan = await getById('plans', card.dataset.planId);
    if (plan) {
      const unit = await getSetting('distanceUnit', 'lb');
      await startWorkoutFromPlan(plan, unit);
      renderActiveWorkout(container, unit);
    }
  });

  // Handle back button / unload to confirm leaving active workout
  const cleanup = () => { if (workoutInterval) clearInterval(workoutInterval); };
  return cleanup;
}
