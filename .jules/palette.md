## 2024-05-14 - Icon-only Buttons Missing Accessibility
**Learning:** Found multiple instances in `src/pages/plans.js` where icon-only buttons (FAB, delete plan, start day, remove exercise) lack proper `aria-label`, `title`, or `aria-hidden="true"` attributes, rendering them inaccessible to screen readers.
**Action:** Ensure all icon-only buttons have descriptive `aria-label` and `title` attributes, and inner icons/characters are hidden with `aria-hidden="true"`.
