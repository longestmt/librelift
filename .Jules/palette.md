## Palette Journal

## 2024-04-26 - Add ARIA Labels to Icon-Only Template Strings
**Learning:** In Vanilla JS applications generating UI via template strings (`innerHTML`), icon-only buttons often miss `aria-label`s, relying solely on `title`. Additionally, inline SVG icons within these buttons are incorrectly interpreted by screen readers if `aria-hidden="true"` is omitted.
**Action:** When adding or reviewing icon-only buttons created with template strings, ensure they explicitly include both an `aria-label` attribute on the `<button>` and an `aria-hidden="true"` attribute on the inner `<svg>` element to ensure full screen reader accessibility.
