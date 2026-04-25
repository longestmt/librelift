/**
 * rm-calculator.js — 1RM estimator / rep max table component
 */

import { getSetting } from '../data/db.js';

const FORMULAS = {
    epley:    { name: 'Epley',    calc: (w, r) => r === 1 ? w : w * (1 + r / 30) },
    brzycki:  { name: 'Brzycki',  calc: (w, r) => r === 1 ? w : w * (36 / (37 - r)) },
    lombardi: { name: 'Lombardi', calc: (w, r) => r === 1 ? w : w * Math.pow(r, 0.10) },
    oconner:  { name: "O'Conner", calc: (w, r) => r === 1 ? w : w * (1 + r * 0.025) },
};

const REP_TARGETS = [1, 2, 3, 5, 8, 10, 12, 15, 20];

function percentOf1RM(reps) {
    if (reps === 1) return 1;
    return 1 / (1 + reps / 30);
}

export async function createRMCalculator(initialWeight = 0, initialReps = 0) {
    const unit = await getSetting('unit', 'lb');

    const el = document.createElement('div');
    el.className = 'rm-calc';

    let weight = initialWeight;
    let reps = initialReps;
    let formula = 'epley';

    // Static inputs section (never re-rendered)
    const inputsDiv = document.createElement('div');
    inputsDiv.className = 'flex gap-3';
    inputsDiv.style.marginBottom = 'var(--sp-4)';
    inputsDiv.innerHTML = `
        <div class="input-group" style="flex:1">
            <label class="input-label" for="rm-weight">Weight (${unit})</label>
            <input class="input" type="number" id="rm-weight" value="${weight || ''}" placeholder="e.g. 225" inputmode="decimal" />
        </div>
        <div class="input-group" style="flex:1">
            <label class="input-label" for="rm-reps">Reps</label>
            <input class="input" type="number" id="rm-reps" value="${reps || ''}" placeholder="e.g. 5" inputmode="numeric" />
        </div>`;

    // Results section (re-rendered on changes)
    const resultsDiv = document.createElement('div');

    el.appendChild(inputsDiv);
    el.appendChild(resultsDiv);

    function updateResults() {
        const estimated1RM = weight > 0 && reps > 0 ? FORMULAS[formula].calc(weight, reps) : 0;
        const rounded1RM = Math.round(estimated1RM);

        const comparisons = Object.entries(FORMULAS).map(([key, f]) => {
            const est = weight > 0 && reps > 0 ? Math.round(f.calc(weight, reps)) : 0;
            const isActive = key === formula;
            return `<button class="rm-formula-btn ${isActive ? 'active' : ''}" data-formula="${key}">
                <span class="text-xs">${f.name}</span>
                <span class="font-bold${isActive ? ' text-accent' : ''}">${est || '\u2014'}</span>
            </button>`;
        }).join('');

        const repTable = estimated1RM > 0 ? REP_TARGETS.map(r => {
            const pct = percentOf1RM(r);
            const estWeight = Math.round(estimated1RM * pct);
            const isInput = r === reps && estWeight === Math.round(weight);
            return `<div class="rm-table-row${isInput ? ' rm-table-current' : ''}">
                <span class="rm-table-reps">${r}</span>
                <span class="rm-table-weight font-bold">${estWeight} ${unit}</span>
                <span class="rm-table-pct text-muted">${Math.round(pct * 100)}%</span>
            </div>`;
        }).join('') : '';

        if (estimated1RM > 0) {
            resultsDiv.innerHTML = `
                <div style="text-align:center;margin-bottom:var(--sp-4)">
                    <div class="text-xs text-muted">Estimated 1RM</div>
                    <div class="font-bold text-accent" style="font-size:var(--text-2xl)">${rounded1RM} ${unit}</div>
                </div>
                <div class="text-xs text-muted" style="margin-bottom:var(--sp-2)">Compare formulas</div>
                <div class="rm-formula-grid">${comparisons}</div>
                <div class="text-xs text-muted" style="margin:var(--sp-4) 0 var(--sp-2)">Rep max table</div>
                <div class="rm-table">${repTable}</div>`;
        } else {
            resultsDiv.innerHTML = `
                <div class="text-center text-muted text-sm" style="padding:var(--sp-4) 0">
                    Enter a weight and rep count to estimate your max
                </div>`;
        }

        // Formula buttons
        resultsDiv.querySelectorAll('.rm-formula-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                formula = btn.dataset.formula;
                updateResults();
            });
        });
    }

    // Input listeners (set once, never destroyed)
    inputsDiv.querySelector('#rm-weight').addEventListener('input', (e) => {
        weight = parseFloat(e.target.value) || 0;
        updateResults();
    });
    inputsDiv.querySelector('#rm-reps').addEventListener('input', (e) => {
        reps = parseInt(e.target.value) || 0;
        updateResults();
    });

    updateResults();
    return el;
}
