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
    ${title ? `<h2 class="modal-title">${title}</h2>` : ''}
    <div class="modal-body">${contentHTML}</div>
  `;

    backdrop.appendChild(content);
    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';

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
