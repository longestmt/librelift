/**
 * app.js — LibreLift app shell, router, and navigation
 */

import { getAll, putMany, getSetting, setSetting, runIdentityMigrations } from './data/db.js';
import { CARDIO_EXERCISES, DEFAULT_EXERCISES } from './data/exercises-seed.js';
import { builtinExerciseId, BUILTIN_SEED_TIMESTAMP } from './data/identity.js';
import { renderWorkoutPage } from './pages/workout.js';
import { destroyTimer } from './components/timer.js';
import { renderDataPage } from './pages/data.js';
import { renderExercisesPage } from './pages/exercises.js';
import { renderPlansPage } from './pages/plans.js';
import { renderSettingsPage } from './pages/settings.js';
import { hapticLight } from './utils/haptics.js';
import { escapeHTML } from './utils/sanitize.js';
import { initializeSync } from './data/sync.js';
import { registerSyncBackend } from './data/sync.js';
import { createLibreLiftSyncBackend } from './data/sync-backend.js';
import { ensureInitialDefaultSettings } from './data/app-initialization.js';

const ROUTES = {
  '/workout': { render: renderWorkoutPage, label: 'Workout', icon: 'dumbbell' },
  '/data': { render: renderDataPage, label: 'Data', icon: 'barchart' },
  '/exercises': { render: renderExercisesPage, label: 'Exercises', icon: 'list' },
  '/plans': { render: renderPlansPage, label: 'Programs', icon: 'clipboard' },
  '/settings': { render: renderSettingsPage, label: 'Settings', icon: 'settings' },
};

const ICONS = {
  dumbbell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6.5 6.5h-2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1z"/><path d="M17.5 6.5h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/><path d="M7.5 12h9"/><path d="M2 9.5v5"/><path d="M22 9.5v5"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  barchart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
};

const app = document.getElementById('app');
let routeSequence = 0;

async function init() {
  // Identity migration must finish before seeding, routing, or synchronization.
  await runIdentityMigrations();

  // Install the transaction recorder before any startup writes. We delay
  // automatic network activity until migrations and one-time seeds finish.
  let startupSyncStatus = { connected: false };
  try {
    const syncBackend = await createLibreLiftSyncBackend();
    registerSyncBackend(syncBackend);
    startupSyncStatus = await syncBackend.getStatus();
  } catch (error) {
    // A damaged sync profile must not make local lifting data inaccessible.
    console.error('LibreSync initialization failed:', error);
  }

  // Seed exercises on first run
  const seeded = await getSetting('exercisesSeeded', false);
  if (!seeded) {
    const exercises = DEFAULT_EXERCISES.map(ex => ({
      ...ex,
      id: builtinExerciseId(ex.name),
      createdAt: BUILTIN_SEED_TIMESTAMP,
      updatedAt: BUILTIN_SEED_TIMESTAMP,
    }));
    await putMany('exercises', exercises);
    await setSetting('exercisesSeeded', true);
  }

  // Existing installs were already marked as seeded before cardio exercises
  // shipped. Add only missing built-ins, preserving custom exercises and data.
  const cardioSeedVersion = await getSetting('cardioSeedVersion', 0);
  if (cardioSeedVersion < 1) {
    const existingNames = new Set(
      (await getAll('exercises')).map(exercise => exercise.name.toLowerCase())
    );
    const additions = CARDIO_EXERCISES
      .filter(exercise => !existingNames.has(exercise.name.toLowerCase()))
      .map(exercise => ({
        ...exercise,
        id: builtinExerciseId(exercise.name),
        createdAt: BUILTIN_SEED_TIMESTAMP,
        updatedAt: BUILTIN_SEED_TIMESTAMP,
      }));
    if (additions.length > 0) await putMany('exercises', additions);
    await setSetting('cardioSeedVersion', 1);
  }

  await ensureInitialDefaultSettings({
    hasRegisteredSyncDevice: startupSyncStatus.connected,
  });

  // Apply theme
  const theme = await getSetting('theme', 'dark');
  if (theme && theme !== 'dark') document.documentElement.setAttribute('data-theme', theme);

  // Start launch/reconnect/foreground sync only after deterministic IDs and
  // one-time seeds are complete.
  try {
    await initializeSync();
  } catch (error) {
    // A damaged sync profile or unavailable relay must never make local lifting
    // data inaccessible. Settings exposes the actionable status/error.
    console.error('LibreSync initialization failed:', error);
  }

  renderShell();
  handleRoute();
  window.addEventListener('hashchange', handleRoute);
}

function renderShell() {
  // Create nav
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.id = 'main-nav';
  nav.setAttribute('aria-label', 'Primary');

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
      <button type="button" class="nav-item" data-route="${path}" id="nav-${route.label.toLowerCase()}">
        <span aria-hidden="true">${ICONS[route.icon]}</span>
        <span>${route.label}</span>
      </button>
    `).join('')}
  `;

  nav.addEventListener('click', (e) => {
    const item = e.target.closest('.nav-item');
    if (item) {
      hapticLight();
      const route = item.dataset.route;
      window.location.hash = route;
    }
  });

  // Page container
  const pageContainer = document.createElement('main');
  pageContainer.id = 'page-container';
  pageContainer.tabIndex = -1;

  app.innerHTML = '';
  app.appendChild(nav);
  app.appendChild(pageContainer);
}

async function handleRoute() {
  const sequence = ++routeSequence;
  const hash = window.location.hash.slice(1) || '/workout';
  const requestedPath = hash.split('?')[0];
  const path = ROUTES[requestedPath] ? requestedPath : '/workout';
  const route = ROUTES[path];

  // Clean up rest timer when leaving workout
  destroyTimer();

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    const active = item.dataset.route === path;
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  document.title = `${route.label} — LibreLift`;

  // Render page
  const container = document.getElementById('page-container');

  const page = document.createElement('div');
  page.className = 'page';
  page.setAttribute('aria-busy', 'true');
  container.replaceChildren(page);

  try {
    await route.render(page);
    if (sequence !== routeSequence) return;
  } catch (err) {
    if (sequence !== routeSequence) return;
    console.error('Page render error:', err);
    page.innerHTML = `
      <div class="empty-state" role="alert">
        <div class="empty-state-title">Something went wrong</div>
        <div class="empty-state-text">${escapeHTML(err?.message || 'Please try again.')}</div>
      </div>
    `;
  }
  page.removeAttribute('aria-busy');
  container.focus({ preventScroll: true });
}

// Kick things off
init();
