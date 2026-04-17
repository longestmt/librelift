/**
 * plate-calc.js — Visual plate calculator component
 */

import { calculatePlates, STANDARD_PLATES_LB, STANDARD_PLATES_KG } from '../engine/progression.js';
import { getSetting } from '../data/db.js';

// Plate colors (rough standard)
const PLATE_COLORS = {
    45: '#cdacac',  // red tint
    35: '#b4bcc4',  // blue tint
    25: '#b8c4b8',  // green tint
    20: '#b4bcc4',  // blue (kg)
    15: '#d4ccb4',  // yellow (kg)
    10: '#b8c4b8',  // green
    5: '#8b919a',  // gray
    2.5: '#515761', // dark gray
    1.25: '#515761',
};

const PLATE_HEIGHTS = {
    45: 70, 35: 60, 25: 52, 20: 70, 15: 60,
    10: 44, 5: 36, 2.5: 28, 1.25: 24,
};

export async function createPlateCalculator(targetWeight) {
    const unit = await getSetting('unit', 'lb');
    let barWeight = await getSetting('barWeight', unit === 'kg' ? 20 : 45);
    const savedPlates = await getSetting('plateInventory', null);
    const defaultPlates = unit === 'kg' ? { ...STANDARD_PLATES_KG } : { ...STANDARD_PLATES_LB };

    // Default: 4 of each (8 total, 4 per side)
    const plateInventory = savedPlates || Object.fromEntries(
        Object.keys(defaultPlates).map(k => [k, 8])
    );

    const el = document.createElement('div');
    el.style.padding = 'var(--sp-3) 0';

    // Bar weight input (stable, never re-rendered)
    const barDiv = document.createElement('div');
    barDiv.className = 'flex items-center gap-2';
    barDiv.style.marginBottom = 'var(--sp-3)';
    barDiv.innerHTML = `
      <label class="text-xs text-muted" for="plate-bar-weight" style="white-space:nowrap">Bar weight</label>
      <input class="input" type="number" id="plate-bar-weight" value="${barWeight}" inputmode="decimal" style="width:80px;padding:var(--sp-1) var(--sp-2);font-size:var(--text-sm)" />
      <span class="text-xs text-muted">${unit}</span>`;
    el.appendChild(barDiv);

    // Results container (re-rendered when bar weight changes)
    const resultsDiv = document.createElement('div');
    el.appendChild(resultsDiv);

    function updatePlates() {
        const result = calculatePlates(targetWeight, barWeight, plateInventory);

        if (targetWeight <= barWeight) {
            resultsDiv.innerHTML = `<div class="text-center text-muted text-sm">Bar only (${barWeight} ${unit})</div>`;
            return;
        }

        const plateHTML = buildPlateVisual(result.perSide, unit);
        resultsDiv.innerHTML = `
        <div class="plate-bar">
          <div style="display:flex; align-items:center; flex-direction:row-reverse; gap:2px;">
            ${plateHTML}
          </div>
          <div class="plate-bar-center"></div>
          <div style="display:flex; align-items:center; gap:2px;">
            ${plateHTML}
          </div>
        </div>
        <div class="text-center text-sm text-secondary" style="margin-top:var(--sp-2)">
          ${result.perSide.map(p => `${p.count}×${p.weight}${unit}`).join(' + ') || 'No plates'} per side
          ${result.remainder > 0 ? `<br><span class="text-danger">⚠ ${result.remainder}${unit} unachievable with available plates</span>` : ''}
        </div>`;
    }

    barDiv.querySelector('#plate-bar-weight').addEventListener('input', (e) => {
        barWeight = parseFloat(e.target.value) || 0;
        updatePlates();
    });

    updatePlates();
    return el;
}

function buildPlateVisual(perSide, unit) {
    let html = '';
    for (const plate of perSide) {
        for (let i = 0; i < plate.count; i++) {
            const color = PLATE_COLORS[plate.weight] || '#8b919a';
            const height = PLATE_HEIGHTS[plate.weight] || 32;
            html += `
        <div class="plate-segment" style="
          width: 16px;
          height: ${height}px;
          background: ${color};
        ">${plate.weight}</div>
      `;
        }
    }
    return html;
}
