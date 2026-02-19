/**
 * data.js — Combined Data page (History + Analytics)
 */

import { renderHistoryPage } from './history.js';
import { renderAnalyticsPage } from './analytics.js';

export async function renderDataPage(container) {
    container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Data</h1>
      <p class="page-subtitle">Your workout history and analytics</p>
    </div>
    <div class="flex gap-2" style="margin-bottom:var(--sp-4)" id="data-tabs">
      <button class="btn btn-sm btn-primary data-tab active" data-dtab="history" style="flex:1">History</button>
      <button class="btn btn-sm btn-secondary data-tab" data-dtab="analytics" style="flex:1">Analytics <span class="badge badge-accent" style="font-size:9px;vertical-align:1px;margin-left:2px">Beta</span></button>
    </div>
    <div id="data-tab-content"></div>
  `;

    const tabContent = container.querySelector('#data-tab-content');
    const tabs = container.querySelectorAll('.data-tab');

    async function activateTab(tab) {
        tabs.forEach(t => {
            t.classList.toggle('active', t === tab);
            t.classList.toggle('btn-primary', t === tab);
            t.classList.toggle('btn-secondary', t !== tab);
        });
        tabContent.innerHTML = '';
        const inner = document.createElement('div');
        tabContent.appendChild(inner);
        if (tab.dataset.dtab === 'history') {
            await renderHistoryContent(inner);
        } else {
            await renderAnalyticsPage(inner);
        }
    }

    tabs.forEach(t => t.addEventListener('click', () => activateTab(t)));

    // Check hash params for initial tab
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const initialTab = params.get('tab') === 'analytics' ? tabs[1] : tabs[0];
    await activateTab(initialTab);
}

// Inline render of history content without the page header (since Data page has its own)
async function renderHistoryContent(container) {
    await renderHistoryPage(container);
    const header = container.querySelector('.page-header');
    if (header) header.remove();
}
