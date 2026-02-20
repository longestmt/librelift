/**
 * gist-backup.js — GitHub Gist backup for LibreLift
 * Saves/restores full app data to a private GitHub Gist.
 * Cleanly separated so it can be removed if needed.
 */

import { exportAllData, importAllData } from './db.js';
import { getSetting, setSetting } from './db.js';

const GIST_API = 'https://api.github.com/gists';
const GIST_FILE = 'librelift-backup.json';

/** Get stored GitHub PAT */
export async function getGistToken() {
    return getSetting('githubPAT', null);
}

/** Save GitHub PAT */
export async function setGistToken(token) {
    return setSetting('githubPAT', token);
}

/** Get stored Gist ID (for updating existing gist) */
export async function getGistId() {
    return getSetting('githubGistId', null);
}

/** Validate a PAT by fetching user info */
export async function validateToken(token) {
    const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
    });
    if (!res.ok) throw new Error('Invalid token');
    const user = await res.json();
    return user.login;
}

/** Find existing LibreLift gist in user's account */
export async function discoverGist(token) {
    const res = await fetch(GIST_API, {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
    });
    if (!res.ok) throw new Error('Could not fetch gists');
    const gists = await res.json();
    // Look for gist containing librelift-backup.json
    const found = gists.find(g => g.files && g.files[GIST_FILE]);
    if (found) {
        await setSetting('githubGistId', found.id);
        return found.id;
    }
    return null;
}

/** Push backup to GitHub Gist */
export async function pushBackup() {
    const token = await getGistToken();
    if (!token) throw new Error('No GitHub token configured');

    const data = await exportAllData();
    data.backedUpAt = new Date().toISOString();

    // Remove sensitive information from the backup data before pushing to Gist
    if (data.stores && data.stores.settings) {
        data.stores.settings = data.stores.settings.filter(
            s => s.key !== 'githubPAT' && s.key !== 'githubGistId'
        );
    }

    let content = JSON.stringify(data, null, 2);
    // Bulletproof: ensure literal string of the token doesn't exist anywhere in the payload
    content = content.split(token).join('HIDDEN_TOKEN');

    let gistId = await getGistId();
    if (!gistId) {
        gistId = await discoverGist(token);
    }

    if (gistId) {
        // Update existing gist
        const res = await fetch(`${GIST_API}/${gistId}`, {
            method: 'PATCH',
            headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
            body: JSON.stringify({ files: { [GIST_FILE]: { content } } }),
        });
        if (res.status === 404) {
            // Gist was deleted, create a new one
            await setSetting('githubGistId', null);
            return pushBackup();
        }
        if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
        const gist = await res.json();
        return { id: gist.id, url: gist.html_url, updated: true };
    } else {
        // Create new private gist
        const res = await fetch(GIST_API, {
            method: 'POST',
            headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
            body: JSON.stringify({
                description: 'LibreLift Backup — auto-synced workout data',
                public: false,
                files: { [GIST_FILE]: { content } },
            }),
        });
        if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
        const gist = await res.json();
        await setSetting('githubGistId', gist.id);
        return { id: gist.id, url: gist.html_url, updated: false };
    }
}

/** Pull backup from GitHub Gist */
export async function pullBackup() {
    const token = await getGistToken();
    if (!token) throw new Error('No GitHub token configured');

    let gistId = await getGistId();
    if (!gistId) {
        gistId = await discoverGist(token);
    }
    if (!gistId) throw new Error('No backup found — push a backup first');

    const res = await fetch(`${GIST_API}/${gistId}`, {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

    const gist = await res.json();
    const file = gist.files[GIST_FILE];
    if (!file) throw new Error('Backup file not found in gist');

    // If truncated, fetch raw content
    let content = file.content;
    if (file.truncated) {
        const rawRes = await fetch(file.raw_url);
        content = await rawRes.text();
    }

    const data = JSON.parse(content);
    if (!data.stores) throw new Error('Invalid backup data');

    return data;
}

/** Restore from gist backup (replaces local data) */
export async function restoreFromGist() {
    // Preserve current credentials so restoring doesn't disconnect us
    const token = await getGistToken();
    const gistId = await getGistId();

    const data = await pullBackup();
    await importAllData(data, false);

    // Restore them back to settings
    if (token) await setGistToken(token);
    if (gistId) await setSetting('githubGistId', gistId);

    return data;
}

/** Get backup info without restoring */
export async function getBackupInfo() {
    const token = await getGistToken();
    const gistId = await getGistId();
    if (!token || !gistId) return null;

    try {
        const res = await fetch(`${GIST_API}/${gistId}`, {
            headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
        });
        if (!res.ok) return null;
        const gist = await res.json();
        return {
            id: gist.id,
            url: gist.html_url,
            updatedAt: gist.updated_at,
            description: gist.description,
        };
    } catch {
        return null;
    }
}

/** Disconnect — remove token and gist ID from settings */
export async function disconnectGist() {
    await setSetting('githubPAT', null);
    await setSetting('githubGistId', null);
}
