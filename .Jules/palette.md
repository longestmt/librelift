## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-05-03 - Contextual ARIA labels on Exercise Action Buttons
**Learning:** Icon-only action buttons within repeated list items (like the "History" or "Plates" buttons inside an exercise card) can be confusing for screen reader users if they lack context. Simply adding `aria-label="History"` is insufficient because the user won't know *which* exercise history they are accessing.
**Action:** When adding ARIA labels to actions inside a list or grid, always interpolate the relevant item context (e.g., `aria-label="History for ${escapeHTML(ex.exerciseName)}"`).
