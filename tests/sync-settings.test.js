import test from 'node:test';
import assert from 'node:assert/strict';

import { renderSyncSettings } from '../src/components/sync-settings.js';

class FakeElement {
    constructor(textContent = '') {
        this.textContent = textContent;
        this.disabled = false;
        this.isConnected = true;
        this.style = {};
        this.listeners = new Map();
    }

    addEventListener(type, listener) {
        this.listeners.set(type, listener);
    }

    async click() {
        return this.listeners.get('click')?.({ currentTarget: this, target: this });
    }
}

class FakeContainer {
    constructor() {
        this.html = '';
        this.elements = new Map();
    }

    set innerHTML(value) {
        this.html = value;
        this.elements.clear();
    }

    get innerHTML() {
        return this.html;
    }

    querySelector(selector) {
        if (!this.elements.has(selector)) {
            const labels = {
                '#sync-clear-device': 'Clear This Device',
                '#sync-create-vault': 'Create Vault',
                '#sync-show-join': 'Join Vault',
                '#sync-join-vault': 'Join This Vault',
            };
            this.elements.set(selector, new FakeElement(labels[selector] || ''));
        }
        return this.elements.get(selector);
    }
}

test('renders and executes the true local wipe when sync is disconnected or never configured', async () => {
    for (const status of [
        { connected: false, consent: false, serverUrl: '', deviceLabel: 'New device' },
        {
            connected: false,
            consent: true,
            serverUrl: 'https://sync.example',
            deviceLabel: 'Disconnected device',
        },
    ]) {
        const container = new FakeContainer();
        const wipeCalls = [];
        await renderSyncSettings(container, {
            getStatus: async () => status,
            clearLocalDevice: async options => wipeCalls.push(options),
        });

        assert.match(container.innerHTML, /Clear This Device/);
        assert.match(container.innerHTML, /all local records, settings, Gist and WebDAV credentials/);
        assert.match(container.innerHTML, /safety checkpoints, sync state, and the active workout draft/);
        assert.match(container.innerHTML, /remote LibreSync vault.*remain untouched/);

        const button = container.querySelector('#sync-clear-device');
        await button.click();
        assert.equal(button.textContent, 'Tap again: erase all local LibreLift data');
        assert.deepEqual(wipeCalls, []);

        await button.click();
        assert.deepEqual(wipeCalls, [{ disconnectFirst: false }]);
    }
});
