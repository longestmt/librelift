## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-02-14 - Contextual ARIA Labels for Repeated Icon Buttons
**Learning:** When using icon-only buttons inside repeated list items or grids (like exercise cards), generic `aria-label`s or `title`s (e.g., "History") are insufficient because screen reader users cannot easily determine which item the action applies to.
**Action:** Always interpolate the relevant item context into the `aria-label` (e.g., `aria-label="History for ${escapeHTML(ex.exerciseName)}"`) to provide unique, clear actions for each item in the list.
