## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-02-14 - Contextual ARIA labels in Repeated UI Components
**Learning:** When using repeated components (like exercise cards in a workout view) that contain icon-only action buttons (e.g., History, Swap, Plates), providing generic `aria-label`s like "History" creates a confusing experience for screen reader users who hear "History, History, History" without knowing which item it corresponds to.
**Action:** Always interpolate the context or item name into the `aria-label` for buttons inside repeated lists or grids (e.g., `aria-label="History for ${escapeHTML(ex.exerciseName)}"`).
