import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeBackupData } from '../src/data/backup-security.js';

test('removes every private connection setting from a backup', () => {
    const source = {
        version: 6,
        stores: {
            workouts: [{ id: 'workout-1' }],
            settings: [
                { key: 'unit', value: 'lb' },
                { key: 'githubPAT', value: 'github-secret' },
                { key: 'githubGistId', value: 'gist-id' },
                { key: 'webdavUrl', value: 'https://example.test/dav/' },
                { key: 'webdavUsername', value: 'lifter' },
                { key: 'webdavPassword', value: 'webdav-secret' },
                { key: 'theme', value: 'dark' },
            ],
        },
    };

    const sanitized = sanitizeBackupData(source);

    assert.deepEqual(
        sanitized.stores.settings.map(setting => setting.key),
        ['unit', 'theme']
    );
    assert.deepEqual(sanitized.stores.workouts, source.stores.workouts);
});

test('does not mutate the exported database object', () => {
    const source = {
        stores: {
            settings: [
                { key: 'githubPAT', value: 'secret' },
                { key: 'unit', value: 'kg' },
            ],
        },
    };

    const sanitized = sanitizeBackupData(source);

    assert.notStrictEqual(sanitized, source);
    assert.notStrictEqual(sanitized.stores, source.stores);
    assert.equal(source.stores.settings.length, 2);
    assert.equal(sanitized.stores.settings.length, 1);
});

test('leaves backup data without a settings store unchanged', () => {
    const source = { version: 6, stores: { workouts: [] } };

    assert.strictEqual(sanitizeBackupData(source), source);
    assert.equal(sanitizeBackupData(null), null);
});
