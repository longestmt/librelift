/**
 * workout.js — Active Workout page (hero page)
 */

import { getAll, getById, getByIndex, put, putMany, getSetting } from '../data/db.js';
import { suggestNextWeight } from '../engine/progression.js';
import { createTimerElement, startTimer, stopTimer } from '../components/timer.js';
import { createPlateCalculator } from '../components/plate-calc.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { uuid } from '../data/db.js';

let activeWorkout = null;
let workoutInterval = null;

export async function renderWorkoutPage(container) {
    const unit = await getSetting('unit', 'lb');
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const planId = params.get('planId');

    if (activeWorkout) {
        renderActiveWorkout(container, unit);
        return;
    }

    const plans = await getAll('plans');

    container.innerHTML = `
    <div class="page-header" style="text-align:center; padding-top:var(--sp-8)">
      <h1 class="page-title">Ready to Lift?</h1>
      <p class="page-subtitle">Start a workout from a plan or go freestyle</p>
    </div>
    <div class="flex flex-col gap-3" style="max-width:400px; margin:var(--sp-6) auto 0">
      ${plans.map(plan => {
        const nextDay = plan.days?.[plan.currentDayIndex || 0];
        return `<button class="card card-clickable" data-start-plan="${plan.id}" style="text-align:left;border:none;font-family:var(--font-sans);width:100%;cursor:pointer">
          <div class="card-header"><div><div class="card-title">${plan.name}</div>
          ${nextDay ? `<div class="text-xs text-accent" style="margin-top:2px">Next: ${nextDay.name}</div>` : ''}
          </div><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg></div></button>`;
    }).join('')}
      ${plans.length === 0 ? `<button class="btn btn-primary btn-full btn-lg" id="pick-a-plan"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>Choose a Program</button>` : ''}
      <div class="divider"></div>
      <button class="btn btn-secondary btn-full btn-lg" id="start-empty-workout">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Start a Custom Workout
      </button>
    </div>`;

    container.addEventListener('click', async (e) => {
        const planBtn = e.target.closest('[data-start-plan]');
        if (planBtn) {
            const plan = await getById('plans', planBtn.dataset.startPlan);
            if (plan) { await startWorkoutFromPlan(plan, unit); renderActiveWorkout(container, unit); }
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
        if (plan) { await startWorkoutFromPlan(plan, unit); renderActiveWorkout(container, unit); }
    }
}

function getLastWorkoutSets(allSets) {
    if (!allSets.length) return null;
    const map = new Map();
    for (const s of allSets) { if (!map.has(s.workoutId)) map.set(s.workoutId, []); map.get(s.workoutId).push(s); }
    const sorted = [...map.entries()].sort((a, b) => (b[1][0].createdAt || '').localeCompare(a[1][0].createdAt || ''));
    return sorted[0]?.[1] || null;
}

async function startWorkoutFromPlan(plan, unit) {
    const dayIndex = plan.currentDayIndex || 0;
    const day = plan.days[dayIndex];
    const exercises = await getAll('exercises');
    const workoutExercises = [];

    for (const ex of day.exercises) {
        const exercise = exercises.find(e => e.id === ex.exerciseId);
        const suggestion = ex.exerciseId ? await suggestNextWeight(ex.exerciseId, ex, unit) : { weight: 0, reason: 'first-time' };
        const prevSets = ex.exerciseId ? await getByIndex('sets', 'exerciseId', ex.exerciseId) : [];
        const lastSets = getLastWorkoutSets(prevSets);
        const sets = [];
        for (let i = 0; i < ex.sets; i++) {
            sets.push({ id: uuid(), setNumber: i + 1, targetReps: ex.reps, weight: suggestion.weight, reps: ex.reps, completed: false, failed: false, rpe: null });
        }
        workoutExercises.push({ exerciseId: ex.exerciseId, exerciseName: exercise?.name || ex.exerciseName || 'Unknown', config: ex, sets, suggestedWeight: suggestion.weight, suggestionReason: suggestion.reason, previousPerformance: lastSets, notes: '', collapsed: false });
    }

    activeWorkout = { id: uuid(), planId: plan.id, planName: plan.name, dayName: day.name, dayIndex, startTime: Date.now(), exercises: workoutExercises, notes: '' };
    plan.currentDayIndex = (dayIndex + 1) % plan.days.length;
    await put('plans', plan);
}

function startEmptyWorkout() {
    activeWorkout = { id: uuid(), planId: null, planName: null, dayName: 'Freestyle', dayIndex: 0, startTime: Date.now(), exercises: [], notes: '' };
}

function renderActiveWorkout(container, unit) {
    container.innerHTML = `
    <div class="flex items-center justify-between" style="margin-bottom:var(--sp-4)">
      <div><h1 class="page-title" style="font-size:var(--text-xl)">${activeWorkout.dayName || 'Workout'}</h1>
      ${activeWorkout.planName ? `<div class="text-xs text-muted">${activeWorkout.planName}</div>` : ''}</div>
      <div class="flex items-center gap-2">
        <button id="workout-clock" class="btn btn-ghost font-mono text-sm text-accent" style="min-width:50px;padding:var(--sp-2) var(--sp-3)" title="Tap to pause/resume">0:00</button>
        <button class="btn btn-ghost text-sm" id="cancel-workout-btn" style="padding:var(--sp-2) var(--sp-3);color:var(--text-muted)">Cancel</button>
        <button class="btn btn-danger" id="finish-workout-btn" style="padding:var(--sp-2) var(--sp-4)">Finish</button>
      </div>
    </div>
    <div id="workout-exercises" class="flex flex-col gap-4"></div>
    <div style="margin-top:var(--sp-4)"><div class="input-group"><label class="input-label">Gym Notes</label>
      <textarea class="input" id="workout-notes" rows="2" placeholder="How's the session going?">${activeWorkout.notes}</textarea></div></div>
    <div style="margin-top:var(--sp-4)"><button class="btn btn-secondary btn-full" id="add-exercise-btn">+ Add Exercise</button></div>`;

    const exContainer = container.querySelector('#workout-exercises');

    // Timer bar appended to body so it's not trapped in a hidden container
    const timerEl = createTimerElement();
    document.body.appendChild(timerEl);

    // Workout clock with pause
    let clockPaused = false;
    let pausedElapsed = 0;
    const clockEl = container.querySelector('#workout-clock');
    updateWorkoutClock(clockEl);
    workoutInterval = setInterval(() => updateWorkoutClock(clockEl), 1000);

    clockEl.addEventListener('click', () => {
        if (clockPaused) {
            // Resume: adjust startTime to account for paused duration
            activeWorkout.startTime = Date.now() - (pausedElapsed * 1000);
            clockPaused = false;
            clockEl.style.opacity = '1';
            workoutInterval = setInterval(() => updateWorkoutClock(clockEl), 1000);
        } else {
            // Pause: save elapsed and stop interval
            pausedElapsed = Math.floor((Date.now() - activeWorkout.startTime) / 1000);
            clockPaused = true;
            clockEl.style.opacity = '0.5';
            if (workoutInterval) { clearInterval(workoutInterval); workoutInterval = null; }
        }
    });

    container.querySelector('#workout-notes').addEventListener('input', (e) => { activeWorkout.notes = e.target.value; });

    renderWorkoutExercises(exContainer, unit);

    // Event listeners set up ONCE here (not in renderWorkoutExercises which re-runs)
    setupWorkoutEvents(exContainer, unit);

    container.querySelector('#add-exercise-btn').addEventListener('click', async () => {
        const exercises = await getAll('exercises');
        showExercisePicker(exercises, exContainer, unit);
    });

    container.querySelector('#finish-workout-btn').addEventListener('click', () => finishWorkout(container, unit));
    container.querySelector('#cancel-workout-btn').addEventListener('click', () => cancelWorkout(container, unit));
}

function renderWorkoutExercises(container, unit) {
    container.innerHTML = activeWorkout.exercises.map((ex, ei) => {
        const prevText = ex.previousPerformance ? `Last: ${ex.previousPerformance[0]?.weight || 0}${unit} × ${ex.previousPerformance[0]?.reps || 0}` : 'First time';
        const reasonBadge = ex.suggestionReason === 'increment' ? '<span class="badge badge-success">↑ Up</span>' : ex.suggestionReason === 'deload' ? '<span class="badge badge-danger">↓ Deload</span>' : '';

        return `<div class="card" data-ei="${ei}">
      <div class="card-header" style="cursor:pointer" data-toggle="${ei}">
        <div><div class="card-title">${ex.exerciseName}</div><div class="flex gap-2" style="margin-top:2px">${reasonBadge}<span class="prev-hint">${prevText}</span></div></div>
        <div class="flex items-center gap-1">
          <button class="btn btn-ghost btn-icon" data-swap-ex="${ei}" title="Swap exercise" style="width:32px;height:32px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/></svg></button>
          <button class="btn btn-ghost btn-icon" data-show-plates="${ei}" title="Plates" style="width:32px;height:32px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="4" height="12" rx="1"/><rect x="18" y="6" width="4" height="12" rx="1"/><line x1="6" y1="12" x2="18" y2="12"/></svg></button>
        </div>
      </div>
      <div class="exercise-body" style="${ex.collapsed ? 'display:none' : ''}">
        <div style="display:grid;grid-template-columns:36px 1fr 1fr 56px 36px;gap:var(--sp-2);align-items:center;padding:var(--sp-1) 0;color:var(--text-muted);font-size:var(--text-xs);font-weight:500"><span style="text-align:center">SET</span><span style="text-align:center">${unit.toUpperCase()}</span><span style="text-align:center">REPS</span><span style="text-align:center">RPE</span><span style="text-align:center">✓</span></div>
        ${ex.sets.map((set, si) => renderSetRow(set, si, ei)).join('')}
        <div class="flex gap-2" style="margin-top:var(--sp-2)"><button class="btn btn-ghost text-sm" data-add-set="${ei}" style="flex:1">+ Set</button>${ex.sets.length > 1 ? `<button class="btn btn-ghost text-sm text-danger" data-remove-set="${ei}">− Set</button>` : ''}<button class="btn btn-ghost text-sm" data-ex-note="${ei}" title="Note"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button></div>
        ${ex.notes ? `<div class="text-xs text-muted" style="margin-top:var(--sp-1);padding:var(--sp-1) var(--sp-2);background:var(--bg-elevated);border-radius:var(--radius-sm);font-style:italic">${ex.notes}</div>` : ''}
      </div></div>`;
    }).join('');
}

function renderSetRow(set, si, ei) {
    const cls = set.completed ? 'completed' : '';
    const icon = set.completed ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '';
    return `<div class="set-row"><span class="set-number">${set.setNumber}</span><input class="input-inline" type="number" value="${set.weight}" data-ei="${ei}" data-si="${si}" data-field="weight" inputmode="decimal"/><input class="input-inline" type="number" value="${set.reps}" data-ei="${ei}" data-si="${si}" data-field="reps" inputmode="numeric"/><input class="input-inline" type="number" value="${set.rpe || ''}" data-ei="${ei}" data-si="${si}" data-field="rpe" inputmode="decimal" placeholder="—"/><button class="set-check ${cls}" data-ei="${ei}" data-si="${si}">${icon}</button></div>`;
}

function setupWorkoutEvents(container, unit) {
    container.addEventListener('click', async (e) => {
        // Check plates button FIRST (it's inside card-header, must not bubble to toggle)
        const platesBtn = e.target.closest('[data-show-plates]');
        if (platesBtn) { e.stopPropagation(); const ei = parseInt(platesBtn.dataset.showPlates); const w = activeWorkout.exercises[ei].sets[0]?.weight || 0; const el = await createPlateCalculator(w); const body = openModal('', { title: `Plates for ${w}${unit}` }); body.innerHTML = ''; body.appendChild(el); return; }

        const swapBtn = e.target.closest('[data-swap-ex]');
        if (swapBtn) { e.stopPropagation(); const ei = parseInt(swapBtn.dataset.swapEx); showSwapPicker(ei, container, unit); return; }

        const toggle = e.target.closest('[data-toggle]');
        if (toggle) { const ei = parseInt(toggle.dataset.toggle); activeWorkout.exercises[ei].collapsed = !activeWorkout.exercises[ei].collapsed; renderWorkoutExercises(container, unit); return; }

        const check = e.target.closest('.set-check');
        if (check) {
            const ei = parseInt(check.dataset.ei), si = parseInt(check.dataset.si);
            const set = activeWorkout.exercises[ei].sets[si];
            // Simple toggle: tap = done, tap again = undo
            if (!set.completed) {
                set.completed = true;
                check.classList.add('completed');
                check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
                const rest = await getSetting('restTimer', 90);
                startTimer(rest);
            } else {
                set.completed = false;
                check.classList.remove('completed');
                check.innerHTML = '';
            }
            return;
        }

        const removeSet = e.target.closest('[data-remove-set]');
        if (removeSet) { const ei = parseInt(removeSet.dataset.removeSet); const ex = activeWorkout.exercises[ei]; if (ex.sets.length > 1) { ex.sets.pop(); ex.sets.forEach((s, i) => s.setNumber = i + 1); renderWorkoutExercises(container, unit); } return; }

        const addSet = e.target.closest('[data-add-set]');
        if (addSet) { const ei = parseInt(addSet.dataset.addSet); const ex = activeWorkout.exercises[ei]; const last = ex.sets[ex.sets.length - 1]; ex.sets.push({ id: uuid(), setNumber: ex.sets.length + 1, targetReps: last?.targetReps || 5, weight: last?.weight || 0, reps: last?.reps || 5, completed: false, failed: false, rpe: null }); renderWorkoutExercises(container, unit); return; }

        const noteBtn = e.target.closest('[data-ex-note]');
        if (noteBtn) {
            const ei = parseInt(noteBtn.dataset.exNote);
            const ex = activeWorkout.exercises[ei];
            const body = openModal('', { title: `Note — ${ex.exerciseName}` });
            body.innerHTML = `<textarea class="input" id="ex-note-input" rows="3" placeholder="How does this feel? Any cues?">${ex.notes || ''}</textarea>
              <button class="btn btn-primary btn-full" id="save-note-btn" style="margin-top:var(--sp-3)">Save</button>`;
            body.querySelector('#save-note-btn').addEventListener('click', () => {
                ex.notes = body.querySelector('#ex-note-input').value;
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
        const val = parseFloat(input.value) || 0;
        activeWorkout.exercises[ei].sets[si][field] = val;
    });
}

function updateWorkoutClock(el) {
    if (!el || !activeWorkout) return;
    const s = Math.floor((Date.now() - activeWorkout.startTime) / 1000);
    el.textContent = `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

async function finishWorkout(container, unit) {
    if (!activeWorkout) return;

    try {
        const dur = Math.floor((Date.now() - activeWorkout.startTime) / 1000);
        if (workoutInterval) { clearInterval(workoutInterval); workoutInterval = null; }

        // Clean up timer bar from body
        const timerBar = document.querySelector('.rest-timer-bar');
        if (timerBar) timerBar.remove();
        stopTimer();

        const w = await put('workouts', { id: activeWorkout.id, date: new Date().toISOString().split('T')[0], planId: activeWorkout.planId, planName: activeWorkout.planName, dayName: activeWorkout.dayName, notes: activeWorkout.notes, durationSec: dur, exerciseCount: activeWorkout.exercises.length });

        const allSets = [];
        for (const ex of activeWorkout.exercises) for (const s of ex.sets) allSets.push({ id: s.id, workoutId: w.id, exerciseId: ex.exerciseId, exerciseName: ex.exerciseName, setNumber: s.setNumber, weight: s.weight, reps: s.reps, rpe: s.rpe, completed: s.completed, failed: s.failed });
        if (allSets.length > 0) await putMany('sets', allSets);

        const vol = allSets.reduce((s, r) => s + (r.completed ? r.weight * r.reps : 0), 0);
        const done = allSets.filter(s => s.completed).length;
        const min = Math.floor(dur / 60);

        container.innerHTML = `<div style="text-align:center;padding-top:var(--sp-8);animation:scaleIn 300ms var(--ease-spring)"><div style="width:80px;height:80px;border-radius:50%;background:var(--success);display:flex;align-items:center;justify-content:center;margin:0 auto var(--sp-4)"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--success-text)" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><h1 class="page-title" style="margin-bottom:var(--sp-2)">Workout Complete!</h1><p class="text-secondary">${activeWorkout.dayName}</p></div>
        <div class="card" style="margin-top:var(--sp-6)"><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--sp-4);text-align:center"><div><div class="font-bold text-accent" style="font-size:var(--text-xl)">${min}m</div><div class="text-xs text-muted">Duration</div></div><div><div class="font-bold text-accent" style="font-size:var(--text-xl)">${vol.toLocaleString()}</div><div class="text-xs text-muted">Volume</div></div><div><div class="font-bold text-success" style="font-size:var(--text-xl)">${done}/${allSets.length}</div><div class="text-xs text-muted">Sets</div></div></div></div>
        <button class="btn btn-primary btn-full btn-lg" style="margin-top:var(--sp-6)" id="done-btn">Done</button>`;

        container.querySelector('#done-btn').addEventListener('click', () => { activeWorkout = null; window.location.hash = '/history'; });
        showToast('Workout saved! 💪', 'success');
    } catch (err) {
        console.error('Error finishing workout:', err);
        showToast('Error saving workout: ' + err.message, 'danger');
    }
}

function cancelWorkout(container, unit) {
    const body = openModal('', { title: 'Cancel Workout?' });
    body.innerHTML = `<p class="text-secondary" style="margin-bottom:var(--sp-4)">This will discard the current workout. Any logged sets will not be saved.</p>
      <div class="flex gap-3"><button class="btn btn-secondary" id="cancel-no" style="flex:1">Keep Going</button><button class="btn btn-danger" id="cancel-yes" style="flex:1">Discard</button></div>`;
    body.querySelector('#cancel-no').addEventListener('click', () => closeModal());
    body.querySelector('#cancel-yes').addEventListener('click', () => {
        closeModal();
        if (workoutInterval) { clearInterval(workoutInterval); workoutInterval = null; }
        const timerBar = document.querySelector('.rest-timer-bar');
        if (timerBar) timerBar.remove();
        stopTimer();
        activeWorkout = null;
        // Re-render through router
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        showToast('Workout discarded', 'info');
    });
}

async function showExercisePicker(exercises, exContainer, unit) {
    const body = openModal('', { title: 'Add Exercise' });
    body.innerHTML = `<div class="search-bar" style="margin-bottom:var(--sp-3)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input class="input" id="add-ex-search" placeholder="Search..."/></div><div id="add-ex-list" style="max-height:300px;overflow-y:auto" class="flex flex-col gap-1">${exercises.map(ex => `<button class="list-item" data-id="${ex.id}" data-name="${ex.name}" style="width:100%;border:none;background:none;text-align:left;font-family:var(--font-sans);color:var(--text-primary)"><span style="flex:1"><div class="text-sm font-medium">${ex.name}</div><div class="text-xs text-muted">${ex.muscleGroup} • ${ex.equipment}</div></span></button>`).join('')}</div>`;

    body.querySelector('#add-ex-search').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        body.querySelectorAll('.list-item').forEach(i => { i.style.display = i.textContent.toLowerCase().includes(q) ? '' : 'none'; });
    });

    body.querySelector('#add-ex-list').addEventListener('click', async (e) => {
        const item = e.target.closest('[data-id]'); if (!item) return;
        const id = item.dataset.id, name = item.dataset.name;
        const sug = await suggestNextWeight(id, { sets: 3, reps: 5, increment: 5 }, unit);
        const prev = await getByIndex('sets', 'exerciseId', id);
        const sets = []; for (let i = 0; i < 3; i++) sets.push({ id: uuid(), setNumber: i + 1, targetReps: 5, weight: sug.weight, reps: 5, completed: false, failed: false, rpe: null });
        activeWorkout.exercises.push({ exerciseId: id, exerciseName: name, config: { sets: 3, reps: 5, increment: 5 }, sets, suggestedWeight: sug.weight, suggestionReason: sug.reason, previousPerformance: getLastWorkoutSets(prev), notes: '', collapsed: false });
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
    <div class="text-xs text-muted" style="margin-bottom:var(--sp-3)">${muscleGroup} exercises • ${alternatives.length} alternatives</div>
    <div class="search-bar" style="margin-bottom:var(--sp-3)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input class="input" id="swap-search" placeholder="Search..."/></div>
    <div id="swap-list" style="max-height:300px;overflow-y:auto" class="flex flex-col gap-1">
      ${alternatives.map(ex => `
        <div class="list-item" style="flex-direction:column;align-items:stretch;gap:var(--sp-2);padding:var(--sp-3)">
          <div><div class="text-sm font-medium">${ex.name}</div><div class="text-xs text-muted">${ex.equipment}</div></div>
          <div class="flex gap-2">
            <button class="btn btn-secondary text-xs" data-swap-id="${ex.id}" data-swap-name="${ex.name}" data-swap-mode="temp" style="flex:1;padding:var(--sp-1) var(--sp-2)">This workout</button>
            ${activeWorkout.planId ? `<button class="btn btn-primary text-xs" data-swap-id="${ex.id}" data-swap-name="${ex.name}" data-swap-mode="permanent" style="flex:1;padding:var(--sp-1) var(--sp-2)">All future</button>` : ''}
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
        const mode = btn.dataset.swapMode;

        // Swap in current workout
        const oldId = currentEx.exerciseId;
        const oldName = currentEx.exerciseName;
        currentEx.exerciseId = newId;
        currentEx.exerciseName = newName;

        // Recalculate weight suggestion for new exercise
        const sug = await suggestNextWeight(newId, currentEx.config || { sets: 3, reps: 5, increment: 5 }, unit);
        const prev = await getByIndex('sets', 'exerciseId', newId);
        currentEx.suggestedWeight = sug.weight;
        currentEx.suggestionReason = sug.reason;
        currentEx.previousPerformance = getLastWorkoutSets(prev);
        // Update set weights to the new suggestion
        for (const s of currentEx.sets) { if (!s.completed) s.weight = sug.weight; }

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
                    }
                    await put('plans', plan);
                }
            }
        }

        closeModal();
        renderWorkoutExercises(exContainer, unit);
        showToast(`Swapped to ${newName}${mode === 'permanent' ? ' (updated plan)' : ''}`, 'success');
    });
}
