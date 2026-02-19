/**
 * timer.js — Rest timer as a compact bar above bottom nav
 */

import { getSetting } from '../data/db.js';

let timerState = {
    running: false,
    remaining: 0,
    total: 0,
    interval: null,
    onComplete: null,
    element: null,
};

export function createTimerElement() {
    const el = document.createElement('div');
    el.className = 'rest-timer-bar';
    el.style.display = 'none';
    el.innerHTML = `
    <div class="rest-timer-progress"></div>
    <div class="rest-timer-content">
      <span class="rest-timer-time font-mono">0:00</span>
      <span class="rest-timer-label text-xs">Rest</span>
      <div class="rest-timer-actions">
        <button class="rest-timer-btn" data-timer-action="skip" title="Skip">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
        </button>
      </div>
    </div>`;

    el.addEventListener('click', (e) => {
        const action = e.target.closest('[data-timer-action]');
        if (action?.dataset.timerAction === 'skip') {
            stopTimer();
        }
    });

    timerState.element = el;
    return el;
}

export async function startTimer(durationSec, onComplete) {
    if (!durationSec) {
        durationSec = await getSetting('restTimer', 90);
    }

    stopTimer();

    timerState.total = durationSec;
    timerState.remaining = durationSec;
    timerState.running = true;
    timerState.onComplete = onComplete;

    if (timerState.element) {
        timerState.element.style.display = '';
    }

    updateTimerDisplay();

    timerState.interval = setInterval(() => {
        timerState.remaining--;
        updateTimerDisplay();

        if (timerState.remaining <= 0) {
            const cb = timerState.onComplete;
            stopTimer();
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            playTimerSound();
            if (cb) cb();
        }
    }, 1000);
}

export function stopTimer() {
    if (timerState.interval) {
        clearInterval(timerState.interval);
        timerState.interval = null;
    }
    timerState.running = false;
    timerState.remaining = 0;

    if (timerState.element) {
        timerState.element.style.display = 'none';
        const progress = timerState.element.querySelector('.rest-timer-progress');
        const timeDisplay = timerState.element.querySelector('.rest-timer-time');
        const label = timerState.element.querySelector('.rest-timer-label');
        if (progress) progress.style.width = '0%';
        if (timeDisplay) timeDisplay.textContent = '0:00';
        if (label) label.textContent = 'Rest';
    }
}

function updateTimerDisplay() {
    if (!timerState.element) return;

    const { remaining, total } = timerState;
    const progress = timerState.element.querySelector('.rest-timer-progress');
    const timeDisplay = timerState.element.querySelector('.rest-timer-time');
    const label = timerState.element.querySelector('.rest-timer-label');

    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    if (timeDisplay) timeDisplay.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
    if (label) label.textContent = 'Rest';

    if (progress) {
        const pct = ((total - remaining) / total) * 100;
        progress.style.width = `${pct}%`;
    }
}

function playTimerSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        osc.type = 'sine';
        gain.gain.value = 0.3;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
        // Audio not available
    }
}

export function isTimerRunning() {
    return timerState.running;
}

export function getTimerState() {
    return { ...timerState };
}

export function destroyTimer() {
    stopTimer();
    if (timerState.element) {
        timerState.element.remove();
        timerState.element = null;
    }
}
