import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const GIST_API = 'https://api.github.com/gists';
const GIST_FILE = 'librelift-backup.json';
const STORE_NAMES = ['exercises', 'plans', 'workouts', 'sets', 'bodyWeight', 'settings'];

export function validateBackup(backup) {
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
    throw new Error('LibreLift data must be a JSON object.');
  }
  if (!Number.isInteger(backup.version) || backup.version < 1 || backup.version > 2) {
    throw new Error(`Unsupported LibreLift backup version: ${backup.version ?? 'missing'}.`);
  }
  if (!backup.stores || typeof backup.stores !== 'object' || Array.isArray(backup.stores)) {
    throw new Error('LibreLift data is missing its stores.');
  }

  for (const name of STORE_NAMES) {
    if (backup.version === 1 && name === 'bodyWeight' && !backup.stores[name]) {
      backup.stores[name] = [];
    }
    if (!Array.isArray(backup.stores[name])) {
      throw new Error(`LibreLift data is missing the "${name}" store.`);
    }
  }
  return backup;
}

export class FileBackupStore {
  constructor(filePath) {
    this.filePath = resolve(filePath);
  }

  async load() {
    let raw;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(
          `LibreLift data file not found at ${this.filePath}. Export a backup from LibreLift first.`
        );
      }
      throw error;
    }
    return validateBackup(JSON.parse(raw));
  }

  async save(backup) {
    validateBackup(backup);
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(backup, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, this.filePath);
  }

  describe() {
    return `file:${this.filePath}`;
  }
}

export class GistBackupStore {
  constructor({ token, gistId = null, fetchImpl = fetch }) {
    this.token = token;
    this.gistId = gistId;
    this.fetch = fetchImpl;
  }

  headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  async request(url, options = {}) {
    const response = await this.fetch(url, {
      ...options,
      headers: { ...this.headers(), ...options.headers },
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`GitHub Gist request failed (${response.status}): ${detail || response.statusText}`);
    }
    return response;
  }

  async discoverGist() {
    const response = await this.request(`${GIST_API}?per_page=100`);
    const gists = await response.json();
    const gist = gists.find(candidate => candidate.files?.[GIST_FILE]);
    if (!gist) {
      throw new Error('No LibreLift Gist backup found. Push a backup from LibreLift first.');
    }
    this.gistId = gist.id;
  }

  async load() {
    if (!this.gistId) await this.discoverGist();
    const response = await this.request(`${GIST_API}/${this.gistId}`);
    const gist = await response.json();
    const file = gist.files?.[GIST_FILE];
    if (!file) throw new Error(`Gist ${this.gistId} does not contain ${GIST_FILE}.`);

    let raw = file.content;
    if (file.truncated) {
      raw = await (await this.request(file.raw_url)).text();
    }
    return validateBackup(JSON.parse(raw));
  }

  async save(backup) {
    validateBackup(backup);
    if (!this.gistId) await this.discoverGist();
    await this.request(`${GIST_API}/${this.gistId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: {
          [GIST_FILE]: { content: JSON.stringify(backup, null, 2) },
        },
      }),
    });
  }

  describe() {
    return `gist:${this.gistId || 'auto-discover'}`;
  }
}

export function createBackupStore(env = process.env) {
  if (env.LIBRELIFT_DATA_FILE) {
    return new FileBackupStore(env.LIBRELIFT_DATA_FILE);
  }
  if (env.LIBRELIFT_GITHUB_TOKEN) {
    return new GistBackupStore({
      token: env.LIBRELIFT_GITHUB_TOKEN,
      gistId: env.LIBRELIFT_GIST_ID || null,
    });
  }
  throw new Error(
    'Configure LIBRELIFT_DATA_FILE, or LIBRELIFT_GITHUB_TOKEN with an optional LIBRELIFT_GIST_ID.'
  );
}
