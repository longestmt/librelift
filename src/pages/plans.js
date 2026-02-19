/**
 * plans.js — Workout Plan Builder page
 */

import { getAll, put, softDelete, getById } from '../data/db.js';
import { DEFAULT_PLANS } from '../data/plans-seed.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

export async function renderPlansPage(container) {
  const plans = await getAll('plans');
  const exercises = await getAll('exercises');

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Programs</h1>
      <p class="page-subtitle">Build and manage your workout plans</p>
    </div>

    ${(() => {
      const existingNames = plans.map(p => p.name);
      const available = DEFAULT_PLANS.map((p, i) => ({ ...p, idx: i })).filter(p => !existingNames.includes(p.name));
      if (available.length === 0) return '';
      return `
      <div class="card" style="margin-bottom:var(--sp-4); background:var(--bg-elevated); border-color:var(--accent);">
        <div class="card-header">
          <div class="card-title" style="color:var(--accent)">${plans.length === 0 ? 'Get Started' : 'Add a Program'}</div>
        </div>
        <p class="text-sm text-secondary" style="margin-bottom:var(--sp-3)">
          ${plans.length === 0 ? 'Choose a popular program template to begin, or create your own from scratch.' : 'Add another program template:'}
        </p>
        <div class="flex flex-col gap-2" id="template-buttons">
          ${available.map(p => `
            <button class="btn btn-secondary btn-full" data-template="${p.idx}" style="justify-content:flex-start; text-align:left;">
              <span>
                <strong>${p.name}</strong>
                <span class="text-xs text-muted" style="display:block">${p.schedule}</span>
              </span>
            </button>
          `).join('')}
        </div>
      </div>`;
    })()}

    <div id="plans-list" class="flex flex-col gap-3">
      ${plans.map(plan => renderPlanCard(plan)).join('')}
    </div>

    <div class="flex gap-2" style="margin-top:var(--sp-4)">
      <button class="btn btn-secondary text-sm" id="import-plan-json" style="flex:1"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Import JSON</button>
      <button class="btn btn-ghost text-sm" id="export-plan-template" style="flex:1"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Export Template</button>
    </div>
  `;

  // Template buttons
  const templateBtns = container.querySelector('#template-buttons');
  if (templateBtns) {
    templateBtns.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-template]');
      if (!btn) return;
      const idx = parseInt(btn.dataset.template);
      const template = DEFAULT_PLANS[idx];

      // Resolve exercise names to IDs
      const days = template.days.map(day => ({
        name: day.name,
        exercises: day.exercises.map(ex => {
          const found = exercises.find(e => e.name === ex.exerciseName);
          return {
            ...ex,
            exerciseId: found?.id || null,
          };
        }),
      }));

      await put('plans', {
        name: template.name,
        description: template.description,
        schedule: template.schedule,
        days,
        currentDayIndex: 0,
      });

      showToast(`${template.name} added!`, 'success');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  }

  // Plan card clicks
  const plansList = container.querySelector('#plans-list');
  plansList.addEventListener('click', async (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const planId = card.dataset.planId;
    if (!planId) return;

    const deleteBtn = e.target.closest('.delete-plan-btn');
    if (deleteBtn) {
      if (confirm('Delete this plan?')) {
        await softDelete('plans', planId);
        showToast('Plan deleted', 'info');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
      return;
    }

    const plan = await getById('plans', planId);
    if (plan) showPlanDetail(plan, exercises);
  });

  // FAB for new plan
  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  fab.addEventListener('click', () => showCreatePlanModal(exercises));
  container.appendChild(fab);

  // Export template JSON
  container.querySelector('#export-plan-template').addEventListener('click', () => {
    const template = {
      _instructions: "Fill in this template and import it into LibreLift. You can give this to an AI (ChatGPT, Claude, etc.) and ask it to create a workout plan for you. Exercise names must match exactly — see the 'availableExercises' list below.",
      name: "My Plan Name",
      description: "Optional description",
      schedule: "e.g. 3 days/week",
      days: [
        {
          name: "Day 1 - Example",
          exercises: [
            { exerciseName: "Barbell Bench Press", sets: 3, reps: 5, increment: 5 },
            { exerciseName: "Barbell Row", sets: 3, reps: 5, increment: 5 },
          ]
        },
      ],
      availableExercises: exercises.map(e => ({ name: e.name, muscleGroup: e.muscleGroup, equipment: e.equipment })),
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'librelift-plan-template.json';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    showToast('Template downloaded — give it to an AI!', 'success');
  });

  // Import plan JSON
  container.querySelector('#import-plan-json').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.name || !data.days || !Array.isArray(data.days)) {
          showToast('Invalid plan: needs "name" and "days" array', 'danger');
          return;
        }
        // Resolve exercise names to IDs
        const days = data.days.map(day => ({
          name: day.name || 'Unnamed Day',
          exercises: (day.exercises || []).map(ex => {
            const found = exercises.find(e => e.name.toLowerCase() === (ex.exerciseName || '').toLowerCase());
            return {
              exerciseId: found?.id || null,
              exerciseName: ex.exerciseName,
              sets: ex.sets || 3,
              reps: ex.reps || 5,
              increment: ex.increment || 5,
              incrementUnit: ex.incrementUnit || 'lb',
              deloadPercent: ex.deloadPercent || 10,
              deloadAfter: ex.deloadAfter || 3,
            };
          }),
        }));
        await put('plans', {
          name: data.name,
          description: data.description || '',
          schedule: data.schedule || '',
          days,
          currentDayIndex: 0,
        });
        showToast(`"${data.name}" imported!`, 'success');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (err) {
        showToast('Error reading file: ' + err.message, 'danger');
      }
    });
    input.click();
  });
}

function renderPlanCard(plan) {
  const dayCount = plan.days?.length || 0;
  const exerciseCount = plan.days?.reduce((sum, d) => sum + (d.exercises?.length || 0), 0) || 0;

  return `
    <div class="card card-clickable" data-plan-id="${plan.id}">
      <div class="card-header">
        <div>
          <div class="card-title">${plan.name}</div>
          <div class="flex gap-2" style="margin-top:var(--sp-1)">
            <span class="badge badge-accent">${dayCount} days</span>
            <span class="badge badge-muted">${exerciseCount} exercises</span>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-icon btn-ghost delete-plan-btn" title="Delete">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
      ${plan.description ? `<p class="text-sm text-secondary">${plan.description}</p>` : ''}
      ${plan.schedule ? `<p class="text-xs text-muted" style="margin-top:var(--sp-2)">${plan.schedule}</p>` : ''}
    </div>
  `;
}

function showPlanDetail(plan, allExercises) {
  const body = openModal('', { title: plan.name });

  body.innerHTML = `
    ${plan.description ? `<p class="text-sm text-secondary" style="margin-bottom:var(--sp-4)">${plan.description}</p>` : ''}
    ${plan.schedule ? `<p class="text-xs text-muted" style="margin-bottom:var(--sp-4)">${plan.schedule}</p>` : ''}

    <div class="flex flex-col gap-4">
      ${(plan.days || []).map((day, di) => `
        <div>
          <div class="font-semibold" style="margin-bottom:var(--sp-2); color:var(--accent)">${day.name}</div>
          <div class="flex flex-col gap-1">
            ${(day.exercises || []).map(ex => {
    const exercise = allExercises.find(e => e.id === ex.exerciseId);
    const name = exercise?.name || ex.exerciseName || 'Unknown';
    return `
                <div class="list-item" style="cursor:default">
                  <div style="flex:1">
                    <div class="text-sm font-medium">${name}</div>
                    <div class="text-xs text-muted">${ex.sets}×${ex.reps} ${ex.increment ? `• +${ex.increment}${ex.incrementUnit || 'lb'}/session` : ''}</div>
                  </div>
                </div>
              `;
  }).join('')}
          </div>
        </div>
      `).join('<div class="divider"></div>')}
    </div>

    <div style="margin-top:var(--sp-6)">
      <button class="btn btn-primary btn-full" id="start-plan-workout">
        Start Next Workout
      </button>
    </div>
  `;

  body.querySelector('#start-plan-workout').addEventListener('click', () => {
    closeModal();
    // Navigate to workout with this plan
    window.location.hash = `/workout?planId=${plan.id}`;
  });
}

function showCreatePlanModal(exercises) {
  const body = openModal('', { title: 'Create Plan' });

  body.innerHTML = `
    <div class="flex flex-col gap-4">
      <div class="input-group">
        <label class="input-label">Plan Name</label>
        <input class="input" id="plan-name" placeholder="e.g. My Custom Plan" />
      </div>
      <div class="input-group">
        <label class="input-label">Description (optional)</label>
        <textarea class="input" id="plan-desc" rows="2" placeholder="What's this plan about?"></textarea>
      </div>
      <div class="input-group">
        <label class="input-label">Schedule (optional)</label>
        <input class="input" id="plan-schedule" placeholder="e.g. 3 days/week" />
      </div>

      <div class="divider"></div>

      <div class="flex items-center justify-between">
        <div class="font-semibold">Days</div>
        <button class="btn btn-ghost btn-sm" id="add-day-btn">+ Add Day</button>
      </div>

      <div id="days-container" class="flex flex-col gap-3"></div>

      <button class="btn btn-primary btn-full" id="save-plan-btn" style="margin-top:var(--sp-4)">Save Plan</button>
    </div>
  `;

  const daysContainer = body.querySelector('#days-container');
  const planDays = [];

  function addDay() {
    const dayIndex = planDays.length;
    planDays.push({ name: `Day ${dayIndex + 1}`, exercises: [] });
    renderDays();
  }

  function renderDays() {
    daysContainer.innerHTML = planDays.map((day, di) => `
      <div class="card" style="padding:var(--sp-3)">
        <input class="input" value="${day.name}" data-day="${di}" style="margin-bottom:var(--sp-2); font-weight:600" />
        <div class="flex flex-col gap-1" id="day-${di}-exercises">
          ${day.exercises.map((ex, ei) => {
      const exercise = exercises.find(e => e.id === ex.exerciseId);
      return `
              <div class="flex items-center gap-2 text-sm">
                <span style="flex:1">${exercise?.name || 'Select...'}</span>
                <input class="input-inline" value="${ex.sets}" data-day="${di}" data-ex="${ei}" data-field="sets" style="width:40px" />
                <span class="text-muted">×</span>
                <input class="input-inline" value="${ex.reps}" data-day="${di}" data-ex="${ei}" data-field="reps" style="width:40px" />
                <button class="btn btn-ghost btn-icon" data-remove-ex="${di}-${ei}" style="width:28px;height:28px">×</button>
              </div>
            `;
    }).join('')}
        </div>
        <button class="btn btn-ghost text-sm" data-add-exercise="${di}" style="margin-top:var(--sp-2)">+ Exercise</button>
      </div>
    `).join('');
  }

  // Add day
  body.querySelector('#add-day-btn').addEventListener('click', addDay);

  // Add exercise to day / handle inputs
  daysContainer.addEventListener('click', async (e) => {
    const addExBtn = e.target.closest('[data-add-exercise]');
    if (addExBtn) {
      const di = parseInt(addExBtn.dataset.addExercise);
      // Show exercise picker
      const exerciseId = await showExercisePicker(exercises);
      if (exerciseId) {
        planDays[di].exercises.push({
          exerciseId,
          sets: 3,
          reps: 5,
          increment: 5,
          incrementUnit: 'lb',
          deloadPercent: 10,
          deloadAfter: 3,
        });
        renderDays();
      }
    }

    const removeBtn = e.target.closest('[data-remove-ex]');
    if (removeBtn) {
      const [di, ei] = removeBtn.dataset.removeEx.split('-').map(Number);
      planDays[di].exercises.splice(ei, 1);
      renderDays();
    }
  });

  // Save
  body.querySelector('#save-plan-btn').addEventListener('click', async () => {
    const name = body.querySelector('#plan-name').value.trim();
    if (!name) {
      showToast('Plan name is required', 'danger');
      return;
    }

    // Update day names from inputs
    daysContainer.querySelectorAll('input[data-day]').forEach(input => {
      if (input.dataset.field) return;
      const di = parseInt(input.dataset.day);
      if (!input.dataset.ex) planDays[di].name = input.value;
    });

    await put('plans', {
      name,
      description: body.querySelector('#plan-desc').value,
      schedule: body.querySelector('#plan-schedule').value,
      days: planDays,
      currentDayIndex: 0,
    });

    showToast('Plan created!', 'success');
    closeModal();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  // Start with one day
  addDay();
}

function showExercisePicker(exercises) {
  return new Promise((resolve) => {
    const body = openModal('', { title: 'Select Exercise' });
    body.innerHTML = `
      <div class="search-bar" style="margin-bottom:var(--sp-3)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input class="input" id="picker-search" placeholder="Search..." />
      </div>
      <div id="picker-list" style="max-height:300px; overflow-y:auto;" class="flex flex-col gap-1">
        ${exercises.map(ex => `
          <button class="list-item" data-id="${ex.id}" style="width:100%; border:none; background:none; text-align:left; font-family:var(--font-sans); color:var(--text-primary)">
            <span style="flex:1">
              <div class="text-sm font-medium">${ex.name}</div>
              <div class="text-xs text-muted">${ex.muscleGroup} • ${ex.equipment}</div>
            </span>
          </button>
        `).join('')}
      </div>
    `;

    const list = body.querySelector('#picker-list');
    const search = body.querySelector('#picker-search');

    search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      list.querySelectorAll('.list-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(q) ? '' : 'none';
      });
    });

    list.addEventListener('click', (e) => {
      const item = e.target.closest('[data-id]');
      if (item) {
        closeModal();
        resolve(item.dataset.id);
      }
    });
  });
}
