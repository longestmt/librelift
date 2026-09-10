/**
 * io.js — Import/export for LibreLift
 */

import {
    exportAllData,
    importAllData,
    persistSafetySnapshot,
} from './db.js';
import { sanitizeBackupData } from './backup-security.js';
import { validateBackupData } from './backup-validation.js';

export function downloadJSON(data, filename) {
    downloadSerializedJSON(JSON.stringify(data, null, 2), filename);
}

export function downloadSerializedJSON(serialized, filename) {
    const blob = new Blob([serialized], { type: 'application/json' });
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
    const data = sanitizeBackupData(await exportAllData());
    const date = new Date().toISOString().split('T')[0];
    downloadJSON(data, `librelift-backup-${date}.json`);
}

async function readFileText(file) {
    if (typeof file?.text === 'function') return file.text();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

/**
 * Write a user-observable portable file and read it back exactly. Browsers with
 * the File System Access API can verify the selected native file directly.
 * Other browsers download first and require the user to select that saved JSON
 * file before a destructive restore or vault join may continue.
 */
export async function writePortableSafetySnapshot({ serialized, filename, download }) {
    if (typeof globalThis.showSaveFilePicker === 'function') {
        try {
            const handle = await globalThis.showSaveFilePicker({
                suggestedName: filename,
                types: [{
                    description: 'LibreLift JSON backup',
                    accept: { 'application/json': ['.json'] },
                }],
            });
            const writable = await handle.createWritable();
            await writable.write(serialized);
            await writable.close();
            return readFileText(await handle.getFile());
        } catch (error) {
            // Remote restore validation and IndexedDB reads can consume the
            // browser's transient activation. Fall back to download+reselect
            // when the picker cannot start, but never hide user cancellation.
            if (error?.name === 'AbortError') throw error;
            if (!['SecurityError', 'NotAllowedError'].includes(error?.name)) throw error;
        }
    }

    if (typeof document === 'undefined') {
        throw new Error('A portable safety-backup file could not be selected for verification.');
    }
    download(serialized, filename);
    globalThis.alert?.(
        'LibreLift downloaded a safety backup. Select that exact JSON file now to verify it before continuing.'
    );
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.style.display = 'none';
        const cleanup = () => input.remove();
        input.addEventListener('change', async () => {
            const [file] = input.files || [];
            if (!file) {
                cleanup();
                reject(new Error('Safety-backup verification was cancelled; existing data was kept.'));
                return;
            }
            try {
                resolve(await readFileText(file));
            } catch (error) {
                reject(error);
            } finally {
                cleanup();
            }
        }, { once: true });
        input.addEventListener('cancel', () => {
            cleanup();
            reject(new Error('Safety-backup verification was cancelled; existing data was kept.'));
        }, { once: true });
        document.body.appendChild(input);
        input.click();
    });
}

export async function exportSafetySnapshot({
    persistSnapshot = persistSafetySnapshot,
    download = downloadSerializedJSON,
    writePortableSnapshot = writePortableSafetySnapshot,
} = {}) {
    const data = sanitizeBackupData(await exportAllData());
    validateBackupData(data);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `librelift-before-restore-${timestamp}.json`;
    const serialized = JSON.stringify(data, null, 2);

    // Keep an extra bounded same-origin recovery checkpoint, but do not call it
    // portable or let it satisfy the join/restore gate by itself.
    const persisted = await persistSnapshot({ filename, serialized });
    if (persisted?.filename !== filename || persisted?.serialized !== serialized) {
        throw new Error('The safety snapshot failed exact persisted read-back verification.');
    }
    let readBack;
    try {
        readBack = JSON.parse(persisted.serialized);
    } catch {
        throw new Error('The persisted safety snapshot is not valid JSON.');
    }
    validateBackupData(readBack);
    if (JSON.stringify(sanitizeBackupData(readBack), null, 2) !== serialized) {
        throw new Error('The persisted safety snapshot contains non-portable settings.');
    }

    const portableReadBack = await writePortableSnapshot({ serialized, filename, download });
    if (portableReadBack !== serialized) {
        throw new Error('The portable safety-backup file failed exact read-back verification.');
    }
    // Parsing again makes a successful exact comparison an explicit portable
    // backup validation step, not merely a string equality assertion.
    validateBackupData(JSON.parse(portableReadBack));
    return { filename, verified: true, portable: true };
}

export async function replaceAllDataWithSafetySnapshot(data, {
    createSafetySnapshot = exportSafetySnapshot,
    importer = importAllData,
} = {}) {
    const safeData = sanitizeBackupData(data);
    validateBackupData(safeData);
    const snapshot = await createSafetySnapshot();
    if (snapshot?.verified !== true) {
        throw new Error('The safety snapshot could not be verified; existing data was kept.');
    }
    await importer(safeData, false);
    return safeData;
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

export async function importData(file, merge = false, {
    readJson = readFileAsJSON,
    createSafetySnapshot = exportSafetySnapshot,
    importer = importAllData,
} = {}) {
    const data = sanitizeBackupData(await readJson(file));
    validateBackupData(data);
    if (merge) {
        await importer(data, true);
    } else {
        await replaceAllDataWithSafetySnapshot(data, { createSafetySnapshot, importer });
    }
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
