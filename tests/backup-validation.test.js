import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CURRENT_BACKUP_VERSION,
    validateBackupData,
} from '../src/data/backup-validation.js';
import { importAllData } from '../src/data/db.js';

function validBackup(version = CURRENT_BACKUP_VERSION) {
    return {
        version,
        exportedAt: '2026-07-27T00:00:00.000Z',
        stores: {
            exercises: [{ id: 'exercise-1', name: 'Squat' }],
            plans: [{ id: 'plan-1', name: 'Simple' }],
            workouts: [{ id: 'workout-1', date: '2026-07-27' }],
            sets: [{ id: 'set-1', workoutId: 'workout-1' }],
            bodyWeight: [{ id: 'weight-1', weight: 180 }],
            settings: [{ key: 'unit', value: 'lb' }],
        },
    };
}

test('accepts a complete current backup and reports record counts', () => {
    const result = validateBackupData(validBackup());

    assert.equal(result.version, CURRENT_BACKUP_VERSION);
    assert.equal(result.counts.workouts, 1);
    assert.equal(result.counts.sets, 1);
});

test('accepts version 1 backups without the later body-weight store', () => {
    const backup = validBackup(1);
    delete backup.stores.bodyWeight;

    assert.doesNotThrow(() => validateBackupData(backup));
});

test('rejects backups created by a newer data format', () => {
    const backup = validBackup(CURRENT_BACKUP_VERSION + 1);

    assert.throws(
        () => validateBackupData(backup),
        /Update LibreLift before restoring/
    );
});

test('rejects missing stores, malformed records, and duplicate keys', () => {
    const missingStore = validBackup();
    delete missingStore.stores.sets;
    assert.throws(() => validateBackupData(missingStore), /missing "sets" data/);

    const malformedRecord = validBackup();
    malformedRecord.stores.workouts = [{ date: '2026-07-27' }];
    assert.throws(() => validateBackupData(malformedRecord), /has no id/);

    const duplicateKey = validBackup();
    duplicateKey.stores.settings.push({ key: 'unit', value: 'kg' });
    assert.throws(() => validateBackupData(duplicateKey), /duplicate key "unit"/);
});

test('invalid data is rejected before IndexedDB can be opened for writing', async () => {
    const invalid = validBackup();
    delete invalid.stores.workouts;

    await assert.rejects(
        importAllData(invalid, false),
        /missing "workouts" data/
    );
});
