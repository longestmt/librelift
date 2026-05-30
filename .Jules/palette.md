## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-05-30 - Contextual ARIA labels in Repeated Components
**Learning:** In repeated list items (like workout exercise cards), adding generic 'aria-label="History"' creates a confusing screen reader experience when tabbing through multiple exercises, as the user hears "History, History, History" without knowing which exercise it belongs to.
**Action:** Always interpolate the item's context (e.g., `aria-label="History for ${escapeHTML(ex.exerciseName)}"`) into action buttons within list or grid components.
