## 2024-05-09 - Contextual ARIA labels for repeatable UI components
**Learning:** Screen reader users lose context when encountering multiple instances of identically labeled icon-only action buttons (e.g., "History", "Swap") within a list or grid layout like exercise cards.
**Action:** Always interpolate the relevant item's context into the `aria-label` (e.g., `aria-label="History for ${escapeHTML(ex.exerciseName)}"`) and apply `aria-hidden="true"` to the inner SVG/icon to prevent redundant or confusing screen reader announcements.
