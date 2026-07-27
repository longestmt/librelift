/**
 * Add standard arrow-key navigation to a horizontal group of controls.
 * Controls still own their selected/checked state; this helper only moves
 * focus and activates the next item.
 */
export function enableRovingKeyboard(
    container,
    { selector = 'button', orientation = 'horizontal' } = {}
) {
    if (!container) return;

    container.addEventListener('keydown', event => {
        const current = event.target.closest(selector);
        if (!current || !container.contains(current)) return;

        const controls = [...container.querySelectorAll(selector)]
            .filter(control => !control.disabled && !control.hidden);
        const index = controls.indexOf(current);
        if (index < 0 || controls.length < 2) return;

        const previousKeys = orientation === 'vertical'
            ? ['ArrowUp']
            : ['ArrowLeft'];
        const nextKeys = orientation === 'vertical'
            ? ['ArrowDown']
            : ['ArrowRight'];

        let nextIndex = null;
        if (previousKeys.includes(event.key)) {
            nextIndex = (index - 1 + controls.length) % controls.length;
        } else if (nextKeys.includes(event.key)) {
            nextIndex = (index + 1) % controls.length;
        } else if (event.key === 'Home') {
            nextIndex = 0;
        } else if (event.key === 'End') {
            nextIndex = controls.length - 1;
        }

        if (nextIndex === null) return;
        event.preventDefault();
        controls[nextIndex].focus();
        controls[nextIndex].click();
    });
}

export function setInvalidField(input, message) {
    if (!input) return;
    input.setAttribute('aria-invalid', 'true');
    if (message) input.setAttribute('aria-errormessage', message);
    input.focus();
}

export function clearInvalidField(input) {
    if (!input) return;
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-errormessage');
}
