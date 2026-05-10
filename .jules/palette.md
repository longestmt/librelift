## 2025-05-10 - Contextual ARIA Labels in Repeated Item Grids
**Learning:** When action buttons inside repeated list items (like exercise cards) only have generic tooltips (e.g., "History"), screen reader users cannot distinguish between identical actions for different items.
**Action:** Always explicitly add context-aware aria-label attributes to these buttons interpolating the item's context (e.g., aria-label="History for ${escapeHTML(ex.exerciseName)}"), and add aria-hidden="true" to inner SVGs to prevent them from reading as text characters or empty elements.
