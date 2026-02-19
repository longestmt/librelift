/**
 * app.js — LibreLift app shell, router, and navigation
 */

import { getAll, putMany, getSetting, setSetting } from './data/db.js';
import { DEFAULT_EXERCISES } from './data/exercises-seed.js';
import { renderWorkoutPage } from './pages/workout.js';
import { destroyTimer } from './components/timer.js';
import { renderHistoryPage } from './pages/history.js';
import { renderExercisesPage } from './pages/exercises.js';
import { renderPlansPage } from './pages/plans.js';
import { renderSettingsPage } from './pages/settings.js';

const ROUTES = {
  '/workout': { render: renderWorkoutPage, label: 'Workout', icon: 'dumbbell' },
  '/history': { render: renderHistoryPage, label: 'History', icon: 'calendar' },
  '/exercises': { render: renderExercisesPage, label: 'Exercises', icon: 'list' },
  '/plans': { render: renderPlansPage, label: 'Plans', icon: 'clipboard' },
  '/settings': { render: renderSettingsPage, label: 'Settings', icon: 'settings' },
};

const ICONS = {
  dumbbell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6.5 6.5h-2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1z"/><path d="M17.5 6.5h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/><path d="M7.5 12h9"/><path d="M2 9.5v5"/><path d="M22 9.5v5"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
};

const app = document.getElementById('app');

async function init() {
  // Seed exercises on first run
  const seeded = await getSetting('exercisesSeeded', false);
  if (!seeded) {
    const exercises = DEFAULT_EXERCISES.map((ex, i) => ({
      ...ex,
      id: `seed-${i}`,
    }));
    await putMany('exercises', exercises);
    await setSetting('exercisesSeeded', true);
  }

  // Default settings
  if (await getSetting('unit') === null) await setSetting('unit', 'lb');
  if (await getSetting('barWeight') === null) await setSetting('barWeight', 45);
  if (await getSetting('restTimer') === null) await setSetting('restTimer', 90);
  if (await getSetting('theme') === null) await setSetting('theme', 'dark');

  // Apply theme
  const theme = await getSetting('theme', 'dark');
  if (theme && theme !== 'dark') document.documentElement.setAttribute('data-theme', theme);

  renderShell();
  handleRoute();
  window.addEventListener('hashchange', handleRoute);
}

function renderShell() {
  // Create nav
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.id = 'main-nav';

  nav.innerHTML = `
    <div class="nav-brand">
      <svg width="28" height="28" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="20" fill="var(--accent)" opacity="0.15"/>
        <g transform="translate(50,50)">
          <rect x="-40" y="-3" width="80" height="6" rx="3" fill="var(--accent)"/>
          <rect x="-38" y="-18" width="10" height="36" rx="3" fill="var(--success)"/>
          <rect x="28" y="-18" width="10" height="36" rx="3" fill="var(--success)"/>
          <rect x="-28" y="-12" width="6" height="24" rx="2" fill="var(--info)"/>
          <rect x="22" y="-12" width="6" height="24" rx="2" fill="var(--info)"/>
        </g>
      </svg>
      LibreLift
    </div>
    ${Object.entries(ROUTES).map(([path, route]) => `
      <button class="nav-item" data-route="${path}" id="nav-${route.label.toLowerCase()}">
        ${ICONS[route.icon]}
        <span>${route.label}</span>
      </button>
    `).join('')}
  `;

  nav.addEventListener('click', (e) => {
    const item = e.target.closest('.nav-item');
    if (item) {
      const route = item.dataset.route;
      window.location.hash = route;
    }
  });

  // Page container
  const pageContainer = document.createElement('main');
  pageContainer.id = 'page-container';

  app.innerHTML = '';
  app.appendChild(nav);
  app.appendChild(pageContainer);
}

async function handleRoute() {
  const hash = window.location.hash.slice(1) || '/workout';
  const route = ROUTES[hash] || ROUTES['/workout'];

  // Clean up rest timer when leaving workout
  destroyTimer();

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.route === hash);
  });

  // Render page
  const container = document.getElementById('page-container');
  container.innerHTML = '';

  const page = document.createElement('div');
  page.className = 'page';

  try {
    await route.render(page);
  } catch (err) {
    console.error('Page render error:', err);
    page.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">Something went wrong</div>
        <div class="empty-state-text">${err.message}</div>
      </div>
    `;
  }

  container.appendChild(page);
}

// Kick things off
init();
