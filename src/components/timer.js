/**
 * timer.js — Rest timer with circular SVG countdown
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
    el.className = 'timer-ring';
    el.style.margin = '0 auto';
    el.style.cursor = 'pointer';

    const r = 70;
    const circumference = 2 * Math.PI * r;

    el.innerHTML = `
    <svg width="160" height="160" viewBox="0 0 160 160">
      <circle class="timer-ring-bg" cx="80" cy="80" r="${r}" />
      <circle class="timer-ring-progress" cx="80" cy="80" r="${r}"
        stroke-dasharray="${circumference}"
        stroke-dashoffset="0" />
    </svg>
    <div class="timer-display">
      <span class="timer-time">0:00</span>
      <span class="timer-label">Rest</span>
    </div>
  `;

    el.addEventListener('click', () => {
        if (timerState.running) {
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

    updateTimerDisplay();

    timerState.interval = setInterval(() => {
        timerState.remaining--;
        updateTimerDisplay();

        if (timerState.remaining <= 0) {
            stopTimer();
            // Vibrate if available
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            // Play sound
            playTimerSound();
            if (timerState.onComplete) timerState.onComplete();
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
        const progress = timerState.element.querySelector('.timer-ring-progress');
        const timeDisplay = timerState.element.querySelector('.timer-time');
        const label = timerState.element.querySelector('.timer-label');
        if (progress) progress.style.strokeDashoffset = '0';
        if (timeDisplay) timeDisplay.textContent = '0:00';
        if (label) label.textContent = 'Rest';
    }
}

function updateTimerDisplay() {
    if (!timerState.element) return;

    const { remaining, total } = timerState;
    const progress = timerState.element.querySelector('.timer-ring-progress');
    const timeDisplay = timerState.element.querySelector('.timer-time');
    const label = timerState.element.querySelector('.timer-label');

    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    if (timeDisplay) timeDisplay.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
    if (label) label.textContent = remaining > 0 ? 'Tap to skip' : 'Rest';

    if (progress) {
        const r = 70;
        const circumference = 2 * Math.PI * r;
        const offset = circumference * (1 - remaining / total);
        progress.style.strokeDashoffset = offset;
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
