## 2024-05-25 - Icon-Only Buttons Accessibility
**Learning:** Found multiple icon-only buttons in `src/pages/workout.js` missing `aria-label`s and `aria-hidden` on SVGs (e.g., History, Swap, RM, Plates).
**Action:** When adding ARIA labels to action buttons inside repeated list items or grids (like exercise cards), always interpolate the relevant item context (e.g., `aria-label="History for ${escapeHTML(ex.exerciseName)}"`) rather than using generic labels, ensuring screen reader users can uniquely distinguish between them. Add `aria-hidden="true"` to inner SVGs.
