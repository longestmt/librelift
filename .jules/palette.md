
## 2024-05-13 - Contextual ARIA labels in Repeated Components
**Learning:** When action buttons (like History or Plates) appear repeatedly for different items (like exercises) in a list, generic `aria-label`s aren't enough. Screen reader users need item-specific context to distinguish them.
**Action:** Always interpolate the specific item's context (e.g. `aria-label="History for ${escapeHTML(ex.exerciseName)}"`) into the label for repeated action buttons, and explicitly add `aria-hidden="true"` to the inner SVG.
