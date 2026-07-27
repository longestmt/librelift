import test from 'node:test';
import assert from 'node:assert/strict';

import { saveCompletedWorkout } from '../src/data/db.js';

test('rejects duplicate set IDs before opening a database transaction', async () => {
    await assert.rejects(
        saveCompletedWorkout(
            { id: 'workout-1', date: '2026-07-27' },
            [
                { id: 'set-1', reps: 5 },
                { id: 'set-1', reps: 5 },
            ]
        ),
        /duplicate set id "set-1"/
    );
});
