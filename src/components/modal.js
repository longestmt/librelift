/**
 * modal.js — Modal / bottom sheet component
 */

import { escapeHTML } from '../utils/sanitize.js';

const modalStack = [];
let modalCounter = 0;

function getTopModal() {
    return modalStack[modalStack.length - 1] || null;
}

function getFocusableElements(content) {
    return [...content.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter(element =>
        !element.hidden
        && element.getAttribute('aria-hidden') !== 'true'
        && element.getClientRects().length > 0
    );
}

export function openModal(contentHTML, { title = '', onClose = null } = {}) {
    const trigger = document.activeElement;
    const previousModal = getTopModal();
    if (previousModal) {
        previousModal.backdrop.setAttribute('aria-hidden', 'true');
        previousModal.content.setAttribute('aria-hidden', 'true');
        previousModal.content.removeAttribute('aria-modal');
        previousModal.content.inert = true;
    } else {
        const app = document.getElementById('app');
        if (app) app.inert = true;
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeModal();
    });

    const content = document.createElement('div');
    content.className = 'modal-content';
    content.setAttribute('role', 'dialog');
    content.setAttribute('aria-modal', 'true');
    content.tabIndex = -1;
    const titleId = `modal-title-${++modalCounter}`;
    if (title) content.setAttribute('aria-labelledby', titleId);
    else content.setAttribute('aria-label', 'Dialog');
    content.innerHTML = `
    <div class="modal-handle" aria-hidden="true"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-2)">
      ${title ? `<h2 class="modal-title" id="${titleId}" style="margin:0;flex:1">${escapeHTML(String(title))}</h2>` : '<div style="flex:1"></div>'}
      <button type="button" class="btn btn-ghost btn-icon modal-close-btn" aria-label="Close dialog"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="modal-body">${contentHTML}</div>
  `;

    backdrop.appendChild(content);
    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';

    content.querySelector('.modal-close-btn').addEventListener('click', () => closeModal());

    const modal = {
        backdrop,
        content,
        onClose,
        previousFocus: trigger,
        closing: false,
    };
    modalStack.push(modal);

    const handleKeydown = (e) => {
        if (getTopModal() !== modal) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            closeModal();
            return;
        }
        if (e.key !== 'Tab') return;

        const focusable = getFocusableElements(content);
        if (focusable.length === 0) {
            e.preventDefault();
            content.focus();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    };
    document.addEventListener('keydown', handleKeydown);
    modal.handleKeydown = handleKeydown;

    queueMicrotask(() => {
        if (getTopModal() !== modal) return;
        const autofocus = content.querySelector('[autofocus]');
        (autofocus || content).focus({ preventScroll: true });
    });

    return content.querySelector('.modal-body');
}

export function closeModal() {
    const modal = getTopModal();
    if (!modal || modal.closing) return;
    modal.closing = true;
    modalStack.pop();

    const { backdrop, content, onClose, handleKeydown, previousFocus } = modal;
    document.removeEventListener('keydown', handleKeydown);
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.style.opacity = '0';
    content.classList.add('modal-closing');
    backdrop.style.transition = 'opacity 150ms ease-out';

    const previousModal = getTopModal();
    if (previousModal) {
        previousModal.backdrop.removeAttribute('aria-hidden');
        previousModal.content.removeAttribute('aria-hidden');
        previousModal.content.setAttribute('aria-modal', 'true');
        previousModal.content.inert = false;
    }

    setTimeout(() => {
        backdrop.remove();
        if (modalStack.length === 0) {
            document.body.style.overflow = '';
            const app = document.getElementById('app');
            if (app) app.inert = false;
        }
        if (onClose) onClose();

        if (
            previousModal
            && previousFocus
            && previousModal.content.contains(previousFocus)
        ) {
            previousFocus.focus({ preventScroll: true });
        } else if (previousModal && document.body.contains(previousModal.content)) {
            previousModal.content.focus({ preventScroll: true });
        } else if (previousFocus && document.body.contains(previousFocus)) {
            previousFocus.focus({ preventScroll: true });
        }
    }, 150);
}

export function isModalOpen() {
    return modalStack.length > 0;
}
