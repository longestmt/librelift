/**
 * data.js — Combined Data page (History + Analytics)
 */

import { renderHistoryPage } from './history.js';
import { renderAnalyticsPage } from './analytics.js';
import { escapeHTML } from '../utils/sanitize.js';
import { enableRovingKeyboard } from '../utils/accessibility.js';

export async function renderDataPage(container) {
    container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Data</h1>
      <p class="page-subtitle">Your workout history and progress</p>
    </div>
    <div class="flex gap-2" role="tablist" aria-label="Workout data" style="margin-bottom:var(--sp-4)" id="data-tabs">
      <button type="button" class="btn btn-sm btn-primary data-tab active" id="data-history-tab" role="tab" aria-controls="data-tab-content" aria-selected="true" tabindex="0" data-dtab="history" style="flex:1">History</button>
      <button type="button" class="btn btn-sm btn-secondary data-tab" id="data-progress-tab" role="tab" aria-controls="data-tab-content" aria-selected="false" tabindex="-1" data-dtab="progress" style="flex:1">Progress</button>
    </div>
    <div id="data-tab-content" role="tabpanel" aria-labelledby="data-history-tab"></div>
  `;

    const tabContent = container.querySelector('#data-tab-content');
    const tabs = container.querySelectorAll('.data-tab');
    let renderSequence = 0;

    async function activateTab(tab) {
        const sequence = ++renderSequence;
        tabs.forEach(t => {
            const active = t === tab;
            t.classList.toggle('active', active);
            t.classList.toggle('btn-primary', active);
            t.classList.toggle('btn-secondary', !active);
            t.setAttribute('aria-selected', String(active));
            t.tabIndex = active ? 0 : -1;
        });
        tabContent.setAttribute('aria-labelledby', tab.id);
        tabContent.innerHTML = '<div class="text-sm text-muted" role="status" style="padding:var(--sp-6);text-align:center">Loading…</div>';
        const inner = document.createElement('div');
        try {
            if (tab.dataset.dtab === 'history') {
                await renderHistoryContent(inner);
            } else {
                await renderAnalyticsPage(inner);
            }
            if (sequence !== renderSequence) return;
            tabContent.replaceChildren(inner);
        } catch (error) {
            if (sequence !== renderSequence) return;
            tabContent.innerHTML = `
              <div class="empty-state" role="alert">
                <div class="empty-state-title">Couldn’t load your data</div>
                <div class="empty-state-text">${escapeHTML(error?.message || 'Please try again.')}</div>
                <button type="button" class="btn btn-secondary" id="retry-data-tab">Try Again</button>
              </div>`;
            tabContent.querySelector('#retry-data-tab')
                ?.addEventListener('click', () => activateTab(tab));
        }
    }

    tabs.forEach(t => t.addEventListener('click', () => {
        const targetHash = t.dataset.dtab === 'progress' ? '#/data?tab=progress' : '#/data';
        window.history.replaceState(null, '', targetHash);
        activateTab(t);
    }));
    enableRovingKeyboard(container.querySelector('#data-tabs'), { selector: '[role="tab"]' });

    // Check hash params for initial tab
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const initialTab = ['analytics', 'progress'].includes(params.get('tab')) ? tabs[1] : tabs[0];
    await activateTab(initialTab);
}

// Inline render of history content without the page header (since Data page has its own)
async function renderHistoryContent(container) {
    await renderHistoryPage(container);
    const header = container.querySelector('.page-header');
    if (header) header.remove();
}
