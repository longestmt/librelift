## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In visual grid layouts where column headers are decoupled from input rows, screen readers lose context. Inputs appear unlabelled.
**Action:** Apply explicit aria-label attributes to each input that combine the column meaning, row number, and overall item context (e.g., `aria-label="Weight for set 1 of Squat"`).
