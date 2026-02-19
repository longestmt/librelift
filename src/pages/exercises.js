/**
 * exercises.js — Exercise Library page
 */

import { getAll, put, getByIndex } from '../data/db.js';
import { MUSCLE_GROUPS, EQUIPMENT, CATEGORIES } from '../data/exercises-seed.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { createLineChart } from '../components/charts.js';
import { getExerciseHistory } from '../engine/progression.js';

export async function renderExercisesPage(container) {
    const exercises = await getAll('exercises');

    container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Exercises</h1>
      <p class="page-subtitle">${exercises.length} exercises in your library</p>
    </div>

    <div class="search-bar" style="margin-bottom:var(--sp-4)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input class="input" type="search" id="exercise-search" placeholder="Search exercises..." />
    </div>

    <div id="muscle-filter" style="display:flex; gap:var(--sp-2); flex-wrap:wrap; margin-bottom:var(--sp-4)">
      <button class="chip active" data-filter="All">All</button>
      ${MUSCLE_GROUPS.map(mg => `<button class="chip" data-filter="${mg}">${mg}</button>`).join('')}
    </div>

    <div id="exercise-grid" style="display:flex; flex-direction:column; gap:var(--sp-3)">
    </div>
  `;

    const grid = container.querySelector('#exercise-grid');
    const searchInput = container.querySelector('#exercise-search');
    const filterContainer = container.querySelector('#muscle-filter');

    let activeFilter = 'All';

    function renderExerciseCards(filter = '', muscleGroup = 'All') {
        const filtered = exercises.filter(ex => {
            const matchesSearch = !filter ||
                ex.name.toLowerCase().includes(filter.toLowerCase()) ||
                ex.muscleGroup?.toLowerCase().includes(filter.toLowerCase()) ||
                ex.equipment?.toLowerCase().includes(filter.toLowerCase());
            const matchesMuscle = muscleGroup === 'All' || ex.muscleGroup === muscleGroup;
            return matchesSearch && matchesMuscle;
        });

        if (filtered.length === 0) {
            grid.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <div class="empty-state-title">No exercises found</div>
          <div class="empty-state-text">Try a different search or filter</div>
        </div>
      `;
            return;
        }

        grid.innerHTML = filtered.map(ex => `
      <div class="card card-clickable" data-exercise-id="${ex.id}" style="animation: slideUp 200ms var(--ease-out) both; animation-delay: ${Math.random() * 100}ms">
        <div class="card-header">
          <div>
            <div class="card-title">${ex.name}</div>
            <div class="flex gap-2" style="margin-top:var(--sp-1)">
              <span class="badge badge-accent">${ex.muscleGroup || 'Other'}</span>
              <span class="badge badge-muted">${ex.equipment || ''}</span>
            </div>
          </div>
          <div style="color:var(--text-faint)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>
      </div>
    `).join('');
    }

    renderExerciseCards();

    // Search
    searchInput.addEventListener('input', (e) => {
        renderExerciseCards(e.target.value, activeFilter);
    });

    // Filter chips
    filterContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        filterContainer.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeFilter = chip.dataset.filter;
        renderExerciseCards(searchInput.value, activeFilter);
    });

    // Exercise detail
    grid.addEventListener('click', async (e) => {
        const card = e.target.closest('.card');
        if (!card) return;
        const id = card.dataset.exerciseId;
        const ex = exercises.find(e => e.id === id);
        if (!ex) return;

        const history = await getExerciseHistory(id);
        const chartData = history.map(h => ({
            value: h.weight,
            label: h.date ? new Date(h.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '',
        }));

        const body = openModal('', { title: ex.name });
        body.innerHTML = `
      <div class="flex gap-2" style="margin-bottom:var(--sp-4)">
        <span class="badge badge-accent">${ex.muscleGroup}</span>
        <span class="badge badge-muted">${ex.equipment}</span>
        <span class="badge badge-muted">${ex.category}</span>
      </div>

      <div style="margin-bottom:var(--sp-4)">
        <div class="text-sm text-secondary" style="margin-bottom:var(--sp-2)">Instructions</div>
        <p class="text-sm" style="line-height:1.6">${ex.instructions || 'No instructions available.'}</p>
      </div>

      ${ex.mediaUrl ? `
        <a href="${ex.mediaUrl}" target="_blank" rel="noopener" class="btn btn-secondary btn-full" style="margin-bottom:var(--sp-4)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Watch Video
        </a>
      ` : ''}

      <div class="divider"></div>

      <div class="text-sm text-secondary" style="margin-bottom:var(--sp-2)">Progression History</div>
      <div id="exercise-chart" style="display:flex; justify-content:center;"></div>
    `;

        const chartContainer = body.querySelector('#exercise-chart');
        const chart = createLineChart(chartData, { width: Math.min(340, window.innerWidth - 80), height: 140 });
        chartContainer.appendChild(chart);
    });

    // FAB for adding custom exercise
    const fab = document.createElement('button');
    fab.className = 'fab';
    fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    fab.addEventListener('click', () => showAddExerciseModal(exercises));
    container.appendChild(fab);
}

function showAddExerciseModal(exercises) {
    const body = openModal('', { title: 'Add Custom Exercise' });
    body.innerHTML = `
    <div class="flex flex-col gap-4">
      <div class="input-group">
        <label class="input-label">Name</label>
        <input class="input" id="new-ex-name" placeholder="e.g. Zercher Squat" />
      </div>
      <div class="input-group">
        <label class="input-label">Muscle Group</label>
        <select class="input" id="new-ex-muscle">
          ${MUSCLE_GROUPS.map(mg => `<option value="${mg}">${mg}</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Equipment</label>
        <select class="input" id="new-ex-equip">
          ${EQUIPMENT.map(eq => `<option value="${eq}">${eq}</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Category</label>
        <select class="input" id="new-ex-cat">
          ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Instructions (optional)</label>
        <textarea class="input" id="new-ex-instructions" rows="3" placeholder="How to perform this exercise..."></textarea>
      </div>
      <div class="input-group">
        <label class="input-label">Video URL (optional)</label>
        <input class="input" id="new-ex-url" placeholder="https://youtube.com/..." />
      </div>
      <button class="btn btn-primary btn-full" id="save-exercise-btn">Save Exercise</button>
    </div>
  `;

    body.querySelector('#save-exercise-btn').addEventListener('click', async () => {
        const name = body.querySelector('#new-ex-name').value.trim();
        if (!name) {
            showToast('Name is required', 'danger');
            return;
        }

        await put('exercises', {
            name,
            muscleGroup: body.querySelector('#new-ex-muscle').value,
            equipment: body.querySelector('#new-ex-equip').value,
            category: body.querySelector('#new-ex-cat').value,
            instructions: body.querySelector('#new-ex-instructions').value,
            mediaUrl: body.querySelector('#new-ex-url').value,
        });

        showToast('Exercise added!', 'success');
        closeModal();
        // Re-render page
        window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
}
