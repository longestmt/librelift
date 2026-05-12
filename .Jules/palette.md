## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-05-12 - Contextual ARIA labels for icon buttons in lists
**Learning:** Icon-only buttons in repeated lists or grids (like exercise cards) need explicit `aria-label` attributes with interpolated context so screen readers can uniquely distinguish them. Also, `aria-hidden="true"` should be applied to the inner SVGs.
**Action:** Always interpolate the relevant item context (e.g., `aria-label="History for ${escapeHTML(ex.exerciseName)}"`) rather than using generic labels, and add `aria-hidden="true"` to the inner SVG.
