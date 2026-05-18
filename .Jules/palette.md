## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-05-18 - Missing ARIA labels and aria-hidden on icon buttons in exercise cards
**Learning:** Icon-only buttons in repeated lists (like exercise cards) often lack proper screen reader labels. Without contextual labels (e.g., "History for Bench Press" instead of just "History"), screen reader users cannot distinguish between identical buttons across multiple exercises. SVG icons inside these buttons should also have `aria-hidden="true"` so they aren't read out incorrectly.
**Action:** Added contextual `aria-label`s referencing the specific exercise name (`${escapeHTML(ex.exerciseName)}`) and added `aria-hidden="true"` to the internal SVG icons in `src/pages/workout.js`.
