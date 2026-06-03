## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-06-03 - Icon-only Buttons in Exercise Cards Missing Screen Reader Context
**Learning:** In repeated lists or grid views (like the exercise cards in a workout view), generic titles or missing ARIA labels on icon-only buttons create a confusing experience for screen reader users. They hear "History button" multiple times without knowing *which* exercise it refers to, and visible SVG icons might be read aloud confusingly if not hidden.
**Action:** Always combine the action name with the specific item context (e.g., `aria-label="History for ${escapeHTML(ex.exerciseName)}"`) on the `<button>` element, and explicitly hide the decorative `<svg>` child from screen readers using `aria-hidden="true"`.
