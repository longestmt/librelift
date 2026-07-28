// End-to-end stdio MCP transport test.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function emptyBackup() {
  return {
    version: 2,
    exportedAt: '2026-07-01T00:00:00.000Z',
    stores: {
      exercises: [
        { id: 'bench', name: 'Barbell Bench Press', muscleGroup: 'Chest', equipment: 'Barbell' },
      ],
      plans: [],
      workouts: [],
      sets: [],
      bodyWeight: [],
      settings: [{ key: 'unit', value: 'lb' }],
    },
  };
}

test('serves tools over stdio and persists a tool write', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'librelift-mcp-'));
  const dataFile = join(directory, 'backup.json');
  await writeFile(dataFile, JSON.stringify(emptyBackup()), 'utf8');

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['./scripts/server.mjs'],
    cwd: pluginRoot,
    env: { LIBRELIFT_DATA_FILE: dataFile },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'librelift-test', version: '1.0.0' });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map(tool => tool.name),
      [
        'list_exercises',
        'get_recent_workouts',
        'get_exercise_progress',
        'get_body_weight_history',
        'log_strength_workout',
        'log_body_weight',
      ]
    );

    const result = await client.callTool({
      name: 'log_strength_workout',
      arguments: {
        request_id: 'mcp-test-1',
        date: '2026-07-28',
        name: 'MCP Test',
        exercises: [{
          name: 'Barbell Bench Press',
          sets: [{ weight: 185, reps: 5, rpe: 8 }],
        }],
      },
    });
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent.created, true);

    const saved = JSON.parse(await readFile(dataFile, 'utf8'));
    assert.equal(saved.stores.workouts.length, 1);
    assert.equal(saved.stores.sets.length, 1);
  } finally {
    await client.close();
  }
});
