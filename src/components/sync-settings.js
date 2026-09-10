import {
    createInvitation,
    createVault,
    deleteVault,
    disconnect,
    getStatus,
    joinVault,
    listConflicts,
    listDevices,
    resolveConflict,
    revokeDevice,
    sync,
} from '../data/sync.js';
import {
    clearThisDeviceData,
    deleteSynchronizedDataEverywhere,
} from '../data/db.js';
import { clearSession } from '../data/session.js';
import { showToast } from './toast.js';
import { escapeHTML } from '../utils/sanitize.js';

function formatDate(value) {
    if (!value) return 'Never';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}

function validateServerUrl(raw) {
    let url;
    try { url = new URL(raw); } catch { throw new Error('Enter a valid server URL.'); }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
        throw new Error('Use HTTPS unless LibreSync is running on this device.');
    }
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
}

function pairingText(invitation) {
    if (typeof invitation === 'string') return invitation;
    return invitation.uri
        || invitation.json
        || (invitation.payload ? JSON.stringify(invitation.payload, null, 2) : null)
        || JSON.stringify(invitation, null, 2);
}

function displayEntityType(value) {
    return {
        bodyWeight: 'Body weight',
        exercises: 'Exercise',
        plans: 'Plan',
        workouts: 'Workout',
        sets: 'Set',
        settings: 'Setting',
    }[value] || value || 'Record';
}

function summarizePayload(payload) {
    if (payload === undefined) return 'Deleted';
    if (payload === null) return 'Empty value';
    if (typeof payload !== 'object') return String(payload);
    return payload.name || payload.dayName || payload.date || payload.key
        || JSON.stringify(payload);
}

async function copyText(value) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
    const area = document.createElement('textarea');
    area.value = value;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
}

export async function renderSyncSettings(container, options = {}) {
    const status = await (options.getStatus || getStatus)();
    if (!status.connected) renderDisconnected(container, status, options);
    else await renderConnected(container, status, options);
}

async function clearLocalDevice({ disconnectFirst = false } = {}) {
    if (disconnectFirst) await disconnect();
    await clearThisDeviceData();
    clearSession();
    showToast('All local LibreLift data was erased; any relay vault was kept', 'info');
    window.location.reload();
}

function renderDisconnected(container, status, options) {
    container.innerHTML = `
      <div class="text-xs text-muted" style="margin-bottom:var(--sp-3)">
        End-to-end encrypted synchronization is separate from backups. The relay stores encrypted operation envelopes; this browser profile stores the vault key and device credential.
      </div>
      <label class="flex gap-2 text-sm" style="align-items:flex-start;margin-bottom:var(--sp-3)">
        <input type="checkbox" id="sync-consent" ${status.consent ? 'checked' : ''} />
        <span>I understand encrypted application data will be stored on the LibreSync server I choose.</span>
      </label>
      <div class="input-group">
        <label class="input-label" for="sync-server-url">Server URL</label>
        <input class="input" type="url" id="sync-server-url" placeholder="https://sync.example.com" value="${escapeHTML(status.serverUrl || '')}" />
      </div>
      <div class="input-group" style="margin-top:var(--sp-3)">
        <label class="input-label" for="sync-device-label">Device label</label>
        <input class="input" id="sync-device-label" maxlength="100" placeholder="Tyler’s phone" value="${escapeHTML(status.deviceLabel || '')}" />
      </div>
      <div class="flex gap-2" style="margin-top:var(--sp-3)">
        <button class="btn btn-primary" id="sync-create-vault" style="flex:1">Create Vault</button>
        <button class="btn btn-secondary" id="sync-show-join" style="flex:1">Join Vault</button>
      </div>
      <div id="sync-join-area" style="display:none;margin-top:var(--sp-3)">
        <label class="input-label" for="sync-pairing-payload">Pairing URI or JSON</label>
        <textarea class="input" id="sync-pairing-payload" rows="5" autocomplete="off" spellcheck="false" placeholder="Paste the payload from an authorized LibreLift device"></textarea>
        <div class="text-xs text-muted" style="margin-top:var(--sp-2)">LibreLift and LibreLog use independent vault secrets. There is no recovery phrase; another authorized device is required to pair. If this profile has local records, LibreLift saves and asks you to reselect an exact safety backup before consuming the invitation.</div>
        <button class="btn btn-primary btn-full" id="sync-join-vault" style="margin-top:var(--sp-3)">Join This Vault</button>
      </div>
      <div class="divider" style="margin:var(--sp-4) 0"></div>
      <div class="text-xs text-muted" style="margin-bottom:var(--sp-2)">Clear This Device permanently erases all local records, settings, Gist and WebDAV credentials, safety checkpoints, sync state, and the active workout draft. Any remote LibreSync vault and its encrypted relay data remain untouched.</div>
      <button class="btn btn-ghost btn-full text-danger" id="sync-clear-device">Clear This Device</button>`;

    const formValues = ({ requireServer = true } = {}) => {
        if (!container.querySelector('#sync-consent').checked) {
            throw new Error('Consent is required before enabling remote synchronization.');
        }
        const deviceLabel = container.querySelector('#sync-device-label').value.trim();
        if (!deviceLabel) throw new Error('Enter a label for this device.');
        const values = {
            consent: true,
            deviceLabel,
        };
        if (requireServer) {
            values.serverUrl = validateServerUrl(
                container.querySelector('#sync-server-url').value.trim()
            );
        }
        return values;
    };

    container.querySelector('#sync-show-join').addEventListener('click', () => {
        const area = container.querySelector('#sync-join-area');
        area.style.display = area.style.display === 'none' ? '' : 'none';
    });
    container.querySelector('#sync-create-vault').addEventListener('click', async event => {
        const button = event.currentTarget;
        try {
            button.disabled = true;
            button.textContent = 'Creating…';
            await createVault(formValues());
            showToast('Encrypted LibreLift vault created', 'success');
            await renderSyncSettings(container, options);
        } catch (error) {
            showToast(error.message, 'danger');
        } finally {
            if (button.isConnected) {
                button.disabled = false;
                button.textContent = 'Create Vault';
            }
        }
    });
    container.querySelector('#sync-join-vault').addEventListener('click', async event => {
        const button = event.currentTarget;
        try {
            const payload = container.querySelector('#sync-pairing-payload').value.trim();
            if (!payload) throw new Error('Paste a pairing payload first.');
            button.disabled = true;
            button.textContent = 'Joining safely…';
            // The authenticated pairing payload carries the server URL. Asking
            // the user to type it a second time creates an avoidable mismatch.
            await joinVault(payload, formValues({ requireServer: false }));
            showToast('This device joined the LibreLift vault', 'success');
            await renderSyncSettings(container, options);
        } catch (error) {
            showToast(error.message, 'danger');
        } finally {
            if (button.isConnected) {
                button.disabled = false;
                button.textContent = 'Join This Vault';
            }
        }
    });
    installTwoStepAction(container.querySelector('#sync-clear-device'), {
        confirmation: 'Tap again: erase all local LibreLift data',
        action: () => (options.clearLocalDevice || clearLocalDevice)({ disconnectFirst: false }),
    });
}

async function renderConnected(container, status, options) {
    container.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <div>
          <div class="text-sm font-medium text-success">● Connected</div>
          <div class="text-xs text-muted">${escapeHTML(status.deviceLabel || status.deviceId || 'This device')}</div>
        </div>
        <button class="btn btn-primary btn-sm" id="sync-now">Sync Now</button>
      </div>
      <div class="text-xs text-muted" style="margin-top:var(--sp-3)">
        <div>Server: ${escapeHTML(status.serverUrl || '')}</div>
        <div>Automatic sync: ${escapeHTML(status.automaticSync || 'stopped')}</div>
        <div>Last successful sync: ${escapeHTML(formatDate(status.lastSuccessfulSync))}</div>
        ${status.lastError ? `<div class="text-danger">Last error: ${escapeHTML(status.lastError)}</div>` : ''}
      </div>
      <div class="flex gap-2" style="margin-top:var(--sp-3);flex-wrap:wrap">
        <span class="badge badge-muted">${Number(status.pendingCount) || 0} pending</span>
        <span class="badge ${(Number(status.quarantinedCount) || 0) ? 'badge-danger' : 'badge-muted'}">${Number(status.quarantinedCount) || 0} need update</span>
        <span class="badge ${(Number(status.conflictCount) || 0) ? 'badge-danger' : 'badge-muted'}">${Number(status.conflictCount) || 0} conflicts</span>
      </div>
      <div class="flex flex-col gap-2" style="margin-top:var(--sp-4)">
        <button class="btn btn-secondary btn-full" id="sync-review-conflicts">Review Conflicts</button>
        <button class="btn btn-secondary btn-full" id="sync-create-invitation">Pair Another Device</button>
        <button class="btn btn-secondary btn-full" id="sync-manage-devices">Manage Devices</button>
      </div>
      <div id="sync-detail-area" style="margin-top:var(--sp-3)"></div>
      <div class="divider" style="margin:var(--sp-4) 0"></div>
      <div class="text-xs text-muted" style="margin-bottom:var(--sp-2)">Disconnecting does not revoke this device; revoke it from another authorized device if it should lose future server access. Revocation cannot erase data or a vault key it already downloaded. Clear This Device erases all local records, settings, backup credentials, safety checkpoints, sync state, and the active draft, but leaves the relay vault untouched.</div>
      <div class="flex flex-col gap-2">
        <button class="btn btn-ghost btn-full" id="sync-disconnect">Disconnect and Keep Local Data</button>
        <button class="btn btn-ghost btn-full text-danger" id="sync-clear-device">Clear This Device and Disconnect</button>
        <button class="btn btn-ghost btn-full text-danger" id="sync-delete-data">Delete Synchronized Data Everywhere</button>
        <button class="btn btn-danger btn-full" id="sync-delete-vault">Permanently Delete Remote Vault</button>
      </div>`;

    container.querySelector('#sync-now').addEventListener('click', async event => {
        const button = event.currentTarget;
        try {
            button.disabled = true;
            button.textContent = 'Syncing…';
            await sync();
            showToast('Synchronization complete', 'success');
            await renderSyncSettings(container, options);
        } catch (error) {
            showToast(`Sync unavailable: ${error.message}`, 'danger');
        } finally {
            if (button.isConnected) { button.disabled = false; button.textContent = 'Sync Now'; }
        }
    });

    container.querySelector('#sync-create-invitation').addEventListener('click', async () => {
        const detail = container.querySelector('#sync-detail-area');
        try {
            const invitation = await createInvitation({ ttlSeconds: 600 });
            const text = pairingText(invitation);
            detail.innerHTML = `
              <label class="input-label" for="sync-invitation-output">Single-use pairing payload (expires soon)</label>
              <textarea class="input" id="sync-invitation-output" rows="6" readonly spellcheck="false">${escapeHTML(text)}</textarea>
              <button class="btn btn-secondary btn-full" id="sync-copy-invitation" style="margin-top:var(--sp-2)">Copy Pairing Payload</button>`;
            detail.querySelector('#sync-copy-invitation').addEventListener('click', async () => {
                await copyText(text);
                showToast('Pairing payload copied', 'success');
            });
        } catch (error) {
            showToast(error.message, 'danger');
        }
    });

    container.querySelector('#sync-manage-devices').addEventListener('click', async () => {
        await renderDevices(container.querySelector('#sync-detail-area'), status.deviceId);
    });
    container.querySelector('#sync-review-conflicts').addEventListener('click', async () => {
        await renderConflicts(container.querySelector('#sync-detail-area'));
    });

    installTwoStepAction(container.querySelector('#sync-disconnect'), {
        confirmation: 'Tap again to disconnect',
        action: async () => {
            await disconnect();
            showToast('Sync disconnected; local data was kept', 'info');
            await renderSyncSettings(container, options);
        },
    });
    installTwoStepAction(container.querySelector('#sync-clear-device'), {
        confirmation: 'Tap again: erase all LibreLift data on this device',
        action: () => (options.clearLocalDevice || clearLocalDevice)({ disconnectFirst: true }),
    });
    installTwoStepAction(container.querySelector('#sync-delete-data'), {
        confirmation: 'Tap again to tombstone all synchronized app data',
        action: async () => {
            // Pull every currently visible remote head before authoring the
            // destructive operation. Otherwise an offline/stale replica would
            // create concurrent tombstones and leave unseen live heads behind.
            await sync();
            const count = await deleteSynchronizedDataEverywhere();
            await sync();
            showToast(`${count} records deleted everywhere`, 'success');
            await renderSyncSettings(container, options);
        },
    });
    installTwoStepAction(container.querySelector('#sync-delete-vault'), {
        confirmation: 'Tap again: remote vault deletion cannot be undone',
        action: async () => {
            await deleteVault(`delete:${status.vaultId}`);
            showToast('Remote vault permanently deleted; local app data was kept', 'info');
            await renderSyncSettings(container, options);
        },
    });
}

function installTwoStepAction(button, { confirmation, action }) {
    const initial = button.textContent;
    let armed = false;
    let timer = null;
    button.addEventListener('click', async () => {
        if (!armed) {
            armed = true;
            button.textContent = confirmation;
            timer = setTimeout(() => {
                armed = false;
                button.textContent = initial;
            }, 5000);
            return;
        }
        clearTimeout(timer);
        button.disabled = true;
        button.textContent = 'Working…';
        try { await action(); }
        catch (error) {
            showToast(error.message, 'danger');
            if (button.isConnected) {
                armed = false;
                button.disabled = false;
                button.textContent = initial;
            }
        }
    });
}

async function renderDevices(container, currentDeviceId) {
    try {
        const devices = await listDevices();
        container.innerHTML = `
          <div class="text-sm font-medium" style="margin-bottom:var(--sp-2)">Authorized Devices</div>
          <div class="flex flex-col gap-2">${devices.map(device => `
            <div class="list-item" data-device-id="${escapeHTML(device.deviceId)}">
              <div style="flex:1">
                <div class="text-sm">${escapeHTML(device.label || device.deviceLabel || device.deviceId)}</div>
                <div class="text-xs text-muted">${device.deviceId === currentDeviceId
                    ? 'This device'
                    : device.revokedAt
                        ? `Revoked ${escapeHTML(formatDate(device.revokedAt))}`
                        : `Added ${escapeHTML(formatDate(device.createdAt))}`}</div>
              </div>
              ${device.deviceId === currentDeviceId || device.revokedAt
                    ? ''
                    : '<button class="btn btn-ghost btn-sm text-danger" data-revoke>Revoke</button>'}
            </div>`).join('')}</div>`;
        container.onclick = async event => {
            const button = event.target.closest('[data-revoke]');
            if (!button) return;
            const row = button.closest('[data-device-id]');
            if (button.dataset.confirm !== 'yes') {
                button.dataset.confirm = 'yes';
                button.textContent = 'Confirm Revoke';
                return;
            }
            await revokeDevice(row.dataset.deviceId);
            showToast('Device revoked', 'success');
            await renderDevices(container, currentDeviceId);
        };
    } catch (error) {
        showToast(error.message, 'danger');
    }
}

async function renderConflicts(container) {
    try {
        const conflicts = await listConflicts();
        if (conflicts.length === 0) {
            container.innerHTML = '<div class="text-sm text-muted">No conflicts need review.</div>';
            return;
        }
        container.innerHTML = `<div class="flex flex-col gap-3">${conflicts.map((conflict, index) => {
          const alternatives = conflict.alternatives || conflict.projection?.alternatives || [];
          const projectedPayload = conflict.materialized?.payload ?? conflict.projection?.payload;
          return `
          <div class="card" data-conflict-index="${index}" style="padding:var(--sp-3)">
            <div class="text-sm font-medium">${escapeHTML(displayEntityType(conflict.entityType))}</div>
            <div class="text-xs text-muted">${escapeHTML(conflict.entityId || conflict.entityKey)}</div>
            <div class="flex flex-col gap-2" style="margin-top:var(--sp-2)">
              ${alternatives.map((alternative, alternativeIndex) => `
                <button class="btn btn-secondary btn-full text-sm" data-keep-alternative="${alternativeIndex}">
                  Keep: ${escapeHTML(summarizePayload(alternative.payload))}
                </button>`).join('')}
              <textarea class="input" rows="5" data-merged-json spellcheck="false" aria-label="Merged JSON value">${escapeHTML(JSON.stringify(projectedPayload ?? alternatives.find(item => item.kind !== 'delete')?.payload ?? {}, null, 2))}</textarea>
              <button class="btn btn-primary btn-full text-sm" data-save-merge>Use Intentional Merge</button>
            </div>
          </div>`;
        }).join('')}</div>`;

        container.onclick = async event => {
            const card = event.target.closest('[data-conflict-index]');
            if (!card) return;
            const conflict = conflicts[Number(card.dataset.conflictIndex)];
            const alternatives = conflict.alternatives || conflict.projection?.alternatives || [];
            const keep = event.target.closest('[data-keep-alternative]');
            try {
                if (keep) {
                    const alternative = alternatives[Number(keep.dataset.keepAlternative)];
                    await resolveConflict(conflict, {
                        kind: alternative.kind || (alternative.payload === undefined ? 'delete' : 'put'),
                        payload: alternative.payload,
                        headId: alternative.headId || alternative.opId,
                    });
                } else if (event.target.closest('[data-save-merge]')) {
                    const payload = JSON.parse(card.querySelector('[data-merged-json]').value);
                    await resolveConflict(conflict, { kind: 'put', payload });
                } else return;
                showToast('Conflict resolved and queued for sync', 'success');
                await renderConflicts(container);
            } catch (error) {
                showToast(`Could not resolve conflict: ${error.message}`, 'danger');
            }
        };
    } catch (error) {
        showToast(error.message, 'danger');
    }
}
