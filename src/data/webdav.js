/**
 * webdav.js — WebDAV Sync for LibreLift
 * Saves/restores full app data to a private WebDAV folder (e.g. Nextcloud)
 */

import { exportAllData, importAllData } from './db.js';
import { getSetting, setSetting } from './db.js';
import { Capacitor } from '@capacitor/core';

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
    // Ensure URL has a valid protocol
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error('WebDAV URL must start with http:// or https://');
    }

    // Ensure URL ends with a slash
    if (url && !url.endsWith('/')) {
        url += '/';
    }

    // Test the connection before saving
    let res;
    try {
        const options = {
            url,
            method: 'PROPFIND',
            headers: {
                'Authorization': getAuthHeader(username, password),
                'Depth': '0'
            }
        };

        if (Capacitor.isNativePlatform() && Capacitor.Plugins.CapacitorHttp) {
            res = await Capacitor.Plugins.CapacitorHttp.request(options);
            // CapacitorHttp normalizes to status instead of ok
            res.ok = res.status >= 200 && res.status < 300;
        } else {
            res = await fetch(options.url, options);
        }
    } catch (e) {
        if (e.message && e.message.includes('Failed to fetch')) {
            throw new Error('Network Error (CORS, Mixed Content, or invalid SSL). Check browser console.');
        }
        throw new Error(`Failed to connect to server: ${e.message}`);
    }

    if (!res.ok) {
        if (res.status === 401) throw new Error('Invalid username or app password (401 Unauthorized)');
        if (res.status === 404) throw new Error('WebDAV endpoint not found (404). Check the URL path.');
        throw new Error(`WebDAV Server Error: ${res.status} ${res.statusText || res.status}`);
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

    let res;
    try {
        const options = {
            url: targetUrl,
            method: 'PUT',
            headers: {
                'Authorization': getAuthHeader(config.username, config.password),
                'Content-Type': 'application/json'
            },
            data: jsonStr
        };

        if (Capacitor.isNativePlatform() && Capacitor.Plugins.CapacitorHttp) {
            res = await Capacitor.Plugins.CapacitorHttp.request(options);
            res.ok = res.status >= 200 && res.status < 300;
        } else {
            res = await fetch(options.url, { ...options, body: options.data });
        }
    } catch (e) {
        if (e.message && e.message.includes('Failed to fetch')) {
            throw new Error('Network Error (CORS, Mixed Content, or invalid SSL). Check browser console.');
        }
        throw e;
    }

    if (!res.ok) {
        throw new Error(`WebDAV HTTP Error: ${res.status} ${res.statusText || res.status}`);
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

    let res;
    try {
        const options = {
            url: targetUrl,
            method: 'GET',
            headers: {
                'Authorization': getAuthHeader(config.username, config.password),
                'Accept': 'application/json',
                'Cache-Control': 'no-store'
            }
        };

        if (Capacitor.isNativePlatform() && Capacitor.Plugins.CapacitorHttp) {
            res = await Capacitor.Plugins.CapacitorHttp.request(options);
            res.ok = res.status >= 200 && res.status < 300;
        } else {
            res = await fetch(options.url, { ...options, cache: 'no-store' });
        }
    } catch (e) {
        if (e.message && e.message.includes('Failed to fetch')) {
            throw new Error('Network Error (CORS, Mixed Content, or invalid SSL). Check browser console.');
        }
        throw e;
    }

    if (res.status === 404) {
        throw new Error('Backup file not found on the server. Try pushing first.');
    }

    if (!res.ok) {
        throw new Error(`WebDAV HTTP Error: ${res.status} ${res.statusText || res.status}`);
    }

    try {
        // CapacitorHttp parses JSON natively, fetch does not
        const jsonData = (Capacitor.isNativePlatform() && Capacitor.Plugins.CapacitorHttp) ? res.data : await res.json();

        // Sometimes CapacitorHttp returns a string if it couldn't parse it
        const parsedData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

        await importAllData(parsedData);
        return true;
    } catch (e) {
        throw new Error('Failed to parse the WebDAV backup file. It may be corrupted.');
    }
}
