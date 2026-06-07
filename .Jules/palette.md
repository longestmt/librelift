## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-02-14 - Contextless Icon-Only Action Buttons in Repeated Layouts
**Learning:** When icon-only buttons (like 'History', 'Swap', 'Plates') are repeated across multiple cards in a list (like an active workout view), generic labels like 'History' cause screen readers to announce identical, indistinguishable actions. Users cannot determine *which* card the action applies to without visual proximity.
**Action:** Always interpolate the relevant item context into the `aria-label` for repeated action buttons (e.g., `aria-label="History for ${escapeHTML(ex.exerciseName)}"`).
