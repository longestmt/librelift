## 2025-05-15 - Contextual ARIA labels for repeating list items
**Learning:** Screen reader users struggle to distinguish between identical icon-only buttons (like "History", "Swap", "Note") when they appear repeatedly in lists (like multiple exercise cards).
**Action:** Always interpolate the relevant item context (e.g., `aria-label="History for ${escapeHTML(ex.exerciseName)}"`) rather than using generic labels, ensuring screen reader users can uniquely distinguish between them.
