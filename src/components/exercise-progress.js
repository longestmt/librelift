import { createLineChart } from './charts.js';
import {
    buildExerciseTrendSeries,
    latestTrendUnit,
} from '../engine/progress-metrics.js';
import { escapeHTML } from '../utils/sanitize.js';

function formatMetricSummary(series, metric, fractionDigits = 0) {
    return [...series.entries()].map(([unit, points]) => {
        const values = points.map(point => point[metric]).filter(Number.isFinite);
        const best = values.length ? Math.max(...values) : 0;
        return `${best.toFixed(fractionDigits)} ${unit}`;
    }).join(' • ');
}

function buildEntries(exercises, sets, workouts, fallbackUnit) {
    const exerciseNames = new Map(exercises.map(exercise => [exercise.id, exercise.name]));
    const workoutById = new Map(workouts.map(workout => [workout.id, workout]));
    const grouped = new Map();

    for (const set of sets) {
        if (!set?.completed) continue;
        const key = set.exerciseId || set.exerciseName;
        if (!key) continue;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(set);
    }

    return [...grouped.entries()].map(([key, exerciseSets]) => {
        const series = buildExerciseTrendSeries(exerciseSets, workoutById, fallbackUnit);
        return {
            key,
            name: exerciseNames.get(key) || exerciseSets[0]?.exerciseName || 'Unknown exercise',
            series,
            defaultUnit: latestTrendUnit(series, fallbackUnit),
            sessions: [...series.values()].reduce((sum, points) => sum + points.length, 0),
        };
    }).filter(entry => entry.sessions > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
}

function renderChart(card, entry) {
    const chartArea = card.querySelector('.exercise-progress-chart');
    const activeMetric = card.querySelector('[data-progress-metric].active')?.dataset.progressMetric
        || 'bestWeight';
    const activeUnit = card.querySelector('[data-progress-unit].active')?.dataset.progressUnit
        || entry.defaultUnit;
    const points = entry.series.get(activeUnit) || [];
    const values = points.map(point => point[activeMetric]);

    chartArea.innerHTML = '';
    if (values.length === 0 || values.every(value => value === 0)) {
        chartArea.innerHTML = `
          <div class="text-sm text-muted" style="text-align:center;padding:var(--sp-4)">
            ${activeMetric === 'estimated1RM'
                ? 'Estimated 1RM needs a completed set with external load.'
                : 'No external load recorded for this exercise yet.'}
          </div>`;
        return;
    }

    const chartData = points.map(point => ({
        label: point.label,
        value: activeMetric === 'estimated1RM'
            ? Math.round(point.estimated1RM)
            : point.bestWeight,
    }));
    const label = activeMetric === 'estimated1RM'
        ? `Estimated 1RM (${activeUnit})`
        : `Best working weight (${activeUnit})`;
    const width = Math.min(chartArea.clientWidth || 360, 560);
    chartArea.appendChild(createLineChart(chartData, { width, height: 170, label }));
}

export function renderExerciseProgressList(
    container,
    { exercises, sets, workouts, fallbackUnit = 'lb' }
) {
    const entries = buildEntries(exercises, sets, workouts, fallbackUnit);

    if (entries.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-title">No exercise progress yet</div>
            <div class="empty-state-text">Complete a set to start a best-weight and estimated-1RM trend.</div>
          </div>`;
        return;
    }

    container.innerHTML = `<div class="flex flex-col gap-3">${entries.map((entry, index) => {
        const units = [...entry.series.keys()];
        const bestWeight = formatMetricSummary(entry.series, 'bestWeight');
        const bestE1RM = formatMetricSummary(entry.series, 'estimated1RM');

        return `
          <div class="card exercise-progress-card" data-progress-index="${index}">
            <button type="button" class="card-header exercise-progress-toggle" aria-expanded="false" style="width:100%;border:0;background:none;color:inherit;text-align:left;font:inherit;padding:0;cursor:pointer">
              <div>
                <div class="card-title" style="font-size:var(--text-sm)">${escapeHTML(entry.name)}</div>
                <div class="text-xs text-muted">${entry.sessions} session${entry.sessions !== 1 ? 's' : ''} • Best ${bestWeight}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" class="chevron-icon" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="exercise-progress-detail" hidden>
              <div class="text-xs text-muted" style="margin-top:var(--sp-2)">Best estimated 1RM: ${bestE1RM}</div>
              <div class="flex gap-1" role="group" aria-label="Progress metric" style="margin-top:var(--sp-3);flex-wrap:wrap">
                <button type="button" class="btn btn-ghost text-xs active" data-progress-metric="bestWeight" aria-pressed="true">Best Weight</button>
                <button type="button" class="btn btn-ghost text-xs" data-progress-metric="estimated1RM" aria-pressed="false">Est. 1RM</button>
              </div>
              ${units.length > 1 ? `
                <div class="flex gap-1" role="group" aria-label="Weight unit" style="margin-top:var(--sp-2)">
                  ${units.map(unit => `<button type="button" class="btn btn-ghost text-xs ${unit === entry.defaultUnit ? 'active' : ''}" data-progress-unit="${escapeHTML(unit)}" aria-pressed="${unit === entry.defaultUnit}">${escapeHTML(unit)}</button>`).join('')}
                </div>` : ''}
              <div class="exercise-progress-chart" style="margin-top:var(--sp-2)"></div>
            </div>
          </div>`;
    }).join('')}</div>`;

    container.onclick = event => {
        const card = event.target.closest('[data-progress-index]');
        if (!card) return;
        const entry = entries[Number(card.dataset.progressIndex)];

        const toggle = event.target.closest('.exercise-progress-toggle');
        if (toggle) {
            const detail = card.querySelector('.exercise-progress-detail');
            const willOpen = detail.hidden;
            detail.hidden = !willOpen;
            toggle.setAttribute('aria-expanded', String(willOpen));
            toggle.querySelector('.chevron-icon').style.transform = willOpen ? 'rotate(180deg)' : '';
            if (willOpen) renderChart(card, entry);
            return;
        }

        const metricButton = event.target.closest('[data-progress-metric]');
        if (metricButton) {
            card.querySelectorAll('[data-progress-metric]').forEach(button => {
                const active = button === metricButton;
                button.classList.toggle('active', active);
                button.setAttribute('aria-pressed', String(active));
            });
            renderChart(card, entry);
            return;
        }

        const unitButton = event.target.closest('[data-progress-unit]');
        if (unitButton) {
            card.querySelectorAll('[data-progress-unit]').forEach(button => {
                const active = button === unitButton;
                button.classList.toggle('active', active);
                button.setAttribute('aria-pressed', String(active));
            });
            renderChart(card, entry);
        }
    };
}
