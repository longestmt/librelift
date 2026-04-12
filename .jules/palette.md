
## $(date +%Y-%m-%d) - Adding ARIA labels to SVG-only buttons
**Learning:** Found multiple instances where interactive buttons (`.btn-icon`) only possessed SVG icons and a `title` attribute, but lacked descriptive `aria-label`s, which means screen readers would struggle to convey the button's action. A `title` is not reliably announced by all screen readers.
**Action:** Always ensure `aria-label` attributes are included on any button where the text content is absent or replaced by icons, especially elements utilizing classes like `.btn-icon` or timer/modal controls. Use explicit string interpolation (e.g., `aria-label="Start ${escapeHTML(day.name)}"`) if the action depends on dynamic data.
