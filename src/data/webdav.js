/**
 * webdav.js — WebDAV Sync for LibreLift
 * Saves/restores full app data to a private WebDAV folder (e.g. Nextcloud)
 */

import { exportAllData, importAllData } from './db.js';
import { getSetting, setSetting } from './db.js';

/** Get WebDAV Credentials */
export async function getWebDavConfig() {
    return {
        url: await getSetting('webdavUrl', null),
        username: await getSetting('webdavUsername', null),
        password: await getSetting('webdavPassword', null)
    };
}

/** Set WebDAV Credentials */
export async function setWebDavConfig(url, username, password) {
    // Basic validation to enforce HTTPS (unless localhost or IP address for local network testing)
    const isIpAddress = /^https?:\/\/(?:[0-9]{1,3}\.){3}[0-9]{1,3}/.test(url);
    if (url && !url.startsWith('https://') && !url.includes('localhost') && !isIpAddress) {
        throw new Error('WebDAV URL must use HTTPS for remote servers.');
    }

    // Ensure URL ends with a slash
    if (url && !url.endsWith('/')) {
        url += '/';
    }

    await setSetting('webdavUrl', url);
    await setSetting('webdavUsername', username);
    await setSetting('webdavPassword', password);
}

/** Disconnect WebDAV */
export async function disconnectWebDav() {
    await setSetting('webdavUrl', null);
    await setSetting('webdavUsername', null);
    await setSetting('webdavPassword', null);
}

/** Generates Basic Auth Header */
function getAuthHeader(username, password) {
    return 'Basic ' + btoa(`${username}:${password}`);
}

/** Push backup to WebDAV Server */
export async function pushToWebDav() {
    const config = await getWebDavConfig();
    if (!config.url || !config.username || !config.password) {
        throw new Error('WebDAV is not fully configured.');
    }

    const data = await exportAllData();
    // Exclude the credentials themselves from the backup file
    if (data.settings) {
        data.settings = data.settings.filter(s =>
            !['webdavUrl', 'webdavUsername', 'webdavPassword', 'githubPAT', 'githubGistId'].includes(s.key)
        );
    }

    const jsonStr = JSON.stringify(data, null, 2);
    const targetUrl = `${config.url}librelift_backup.json`;

    const res = await fetch(targetUrl, {
        method: 'PUT',
        headers: {
            'Authorization': getAuthHeader(config.username, config.password),
            'Content-Type': 'application/json'
        },
        body: jsonStr
    });

    if (!res.ok) {
        throw new Error(`WebDAV HTTP Error: ${res.status} ${res.statusText}`);
    }

    return true;
}

/** Pull backup from WebDAV Server */
export async function pullFromWebDav() {
    const config = await getWebDavConfig();
    if (!config.url || !config.username || !config.password) {
        throw new Error('WebDAV is not fully configured.');
    }

    const targetUrl = `${config.url}librelift_backup.json`;

    const res = await fetch(targetUrl, {
        method: 'GET',
        headers: {
            'Authorization': getAuthHeader(config.username, config.password),
            'Accept': 'application/json'
        },
        // Prevent aggressive browser caching of the backup file
        cache: 'no-store'
    });

    if (res.status === 404) {
        throw new Error('Backup file not found on the server. Try pushing first.');
    }

    if (!res.ok) {
        throw new Error(`WebDAV HTTP Error: ${res.status} ${res.statusText}`);
    }

    try {
        const jsonData = await res.json();
        await importAllData(jsonData);
        return true;
    } catch (e) {
        throw new Error('Failed to parse the WebDAV backup file. It may be corrupted.');
    }
}
