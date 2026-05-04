## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-05-04 - Contextual ARIA Labels for Icon-Only Action Buttons in Repeated Lists
**Learning:** Generic icon-only action buttons (like "History" or "Swap") inside repeated list items or grids create ambiguity for screen reader users because they don't know which item the action applies to.
**Action:** Always interpolate the relevant item context into the `aria-label` attribute (e.g., `aria-label="History for ${escapeHTML(ex.exerciseName)}"`) rather than using generic labels. Also, remember to add `aria-hidden="true"` to the inner SVG to hide it from screen readers.
