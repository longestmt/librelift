## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-06-08 - Icon-only buttons lacking context
**Learning:** Icon-only buttons inside lists or grids (like exercise actions: History, Swap, Plates) can cause confusion for screen reader users if they don't include the item context. Just hearing "History" isn't as helpful as "History for Squat".
**Action:** Add explicit, context-aware `aria-label` attributes to icon-only action buttons that interpolate the relevant item context (e.g., `aria-label="History for ${escapeHTML(ex.exerciseName)}"`).
