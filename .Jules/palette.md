## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-02-14 - Contextual ARIA labels for repeated action buttons
**Learning:** Generic titles (like "History") on icon-only buttons inside list items create ambiguity for screen reader users when multiple instances exist on the page.
**Action:** Always interpolate the relevant item context into the `aria-label` (e.g., `aria-label="History for ${escapeHTML(ex.exerciseName)}"`) for repeated action buttons, and apply `aria-hidden="true"` to their inner SVG elements.
