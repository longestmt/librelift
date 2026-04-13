/**
 * toast.js — Toast notification system
 */

import { escapeHTML } from '../utils/sanitize.js';

let container = null;

function ensureContainer() {
    if (container) return container;
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

export function showToast(message, type = 'info', duration = 3000) {
    const c = ensureContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
    <span>${escapeHTML(String(message))}</span>
  `;
    c.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-8px)';
        toast.style.transition = 'all 200ms ease-out';
        setTimeout(() => toast.remove(), 200);
    }, duration);
}

export function showPRToast(exerciseName, pr, unit) {
    const c = ensureContainer();
    const toast = document.createElement('div');
    toast.className = 'toast toast-pr';

    const safeExerciseName = escapeHTML(String(exerciseName));
    const safeLabel = escapeHTML(String(pr.label));
    const safeUnit = escapeHTML(String(unit));
    const safeDetail = pr.prev ? `Previous best: ${escapeHTML(String(pr.prev))} ${safeUnit}` : '';

    toast.innerHTML = `
    <span class="pr-icon">🏆</span>
    <span class="pr-text">
      <span class="pr-title">Personal Record!</span>
      <span class="pr-detail">${safeExerciseName} — ${safeLabel} ${safeUnit}${safeDetail ? ` (was ${escapeHTML(String(pr.prev))} ${safeUnit})` : ''}</span>
    </span>`;
    c.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-8px)';
        toast.style.transition = 'all 200ms ease-out';
        setTimeout(() => toast.remove(), 200);
    }, 4000);
}
