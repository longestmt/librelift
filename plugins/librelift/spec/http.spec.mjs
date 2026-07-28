// End-to-end streamable-HTTP MCP transport test.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function sampleBackup() {
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

function waitForEndpoint(child) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const timeout = setTimeout(() => reject(new Error(`HTTP server did not start. ${stderr}`)), 5000);
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.stdout.on('data', chunk => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:(\d+)\/mcp/);
      if (match) {
        clearTimeout(timeout);
        resolve(new URL(`http://127.0.0.1:${match[1]}/mcp`));
      }
    });
    child.on('exit', code => {
      clearTimeout(timeout);
      reject(new Error(`HTTP server exited with ${code}. ${stderr}`));
    });
  });
}

test('serves the ChatGPT development transport over streamable HTTP', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'librelift-http-'));
  const dataFile = join(directory, 'backup.json');
  await writeFile(dataFile, JSON.stringify(sampleBackup()), 'utf8');

  const child = spawn(process.execPath, ['./scripts/http-server.mjs'], {
    cwd: pluginRoot,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: '0',
      LIBRELIFT_DATA_FILE: dataFile,
      LIBRELIFT_ALLOW_UNAUTHENTICATED_HTTP: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let client;
  try {
    const endpoint = await waitForEndpoint(child);
    client = new Client({ name: 'librelift-http-test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(endpoint));

    const result = await client.callTool({
      name: 'list_exercises',
      arguments: { query: 'bench' },
    });
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent.exercises[0].name, 'Barbell Bench Press');
  } finally {
    if (client) await client.close();
    child.kill('SIGTERM');
  }
});
