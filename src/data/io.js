/**
 * io.js — Import/export for LibreLift
 */

import { exportAllData, importAllData } from './db.js';

export function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

export async function exportData() {
    const data = await exportAllData();
    const date = new Date().toISOString().split('T')[0];
    downloadJSON(data, `librelift-backup-${date}.json`);
}

export function readFileAsJSON(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try { resolve(JSON.parse(reader.result)); }
            catch (e) { reject(new Error('Invalid JSON file')); }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

export async function importData(file, merge = false) {
    const data = await readFileAsJSON(file);
    if (!data.stores) throw new Error('Invalid LibreLift backup file');
    await importAllData(data, merge);
}

export function exportWorkoutsCSV(workouts, sets) {
    const headers = ['Date', 'Exercise', 'Set', 'Weight', 'Reps', 'RPE', 'Completed'];
    const rows = [headers.join(',')];
    for (const w of workouts) {
        const wSets = sets.filter(s => s.workoutId === w.id);
        for (const s of wSets) {
            rows.push([
                w.date,
                s.exerciseName || s.exerciseId,
                s.setNumber,
                s.weight,
                s.reps,
                s.rpe || '',
                s.completed ? 'Yes' : 'No',
            ].join(','));
        }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'librelift-workouts.csv';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}
