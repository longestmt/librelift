/**
 * modal.js — Modal / bottom sheet component
 */

let activeModal = null;

export function openModal(contentHTML, { title = '', onClose = null } = {}) {
    closeModal();

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeModal();
    });

    const content = document.createElement('div');
    content.className = 'modal-content';
    content.innerHTML = `
    <div class="modal-handle"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-2)">
      ${title ? `<h2 class="modal-title" style="margin:0;flex:1">${title}</h2>` : '<div style="flex:1"></div>'}
      <button class="btn btn-ghost btn-icon modal-close-btn" style="width:32px;height:32px;flex-shrink:0" title="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="modal-body">${contentHTML}</div>
  `;

    backdrop.appendChild(content);
    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';

    content.querySelector('.modal-close-btn').addEventListener('click', () => closeModal());

    activeModal = { backdrop, content, onClose };

    // Escape key
    const handleKeydown = (e) => {
        if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', handleKeydown);
    activeModal.handleKeydown = handleKeydown;

    return content.querySelector('.modal-body');
}

export function closeModal() {
    if (!activeModal) return;
    const { backdrop, onClose, handleKeydown } = activeModal;
    document.removeEventListener('keydown', handleKeydown);
    backdrop.style.opacity = '0';
    backdrop.querySelector('.modal-content').style.transform = 'translateY(16px)';
    backdrop.style.transition = 'opacity 150ms ease-out';
    setTimeout(() => {
        backdrop.remove();
        document.body.style.overflow = '';
        if (onClose) onClose();
    }, 150);
    activeModal = null;
}

export function isModalOpen() {
    return activeModal !== null;
}
