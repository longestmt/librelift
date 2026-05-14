
## 2025-02-20 - Context-Aware ARIA Labels for Dynamic Lists
**Learning:** When adding ARIA labels to icon buttons generated dynamically inside lists or repeated grids (like exercise workout cards), generic labels ("History", "Swap") are insufficient for screen reader users who might tab through dozens of identical buttons without visual context.
**Action:** Always interpolate the specific list item's context into the ARIA label (e.g., `aria-label="History for ${escapeHTML(ex.exerciseName)}"`). This transforms ambiguous controls into highly specific actions for assistive technologies.
