## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").
## 2026-06-13 - Contextual ARIA labels for Workout Grid
**Learning:** In complex, deeply nested grids containing repeating action buttons (like per-exercise History, Swap, Plates, and per-set Weight/Reps inputs), generic ARIA labels like 'Weight' or 'History' lack necessary context. Screen reader users won't know which specific exercise a button or input relates to when navigating via rotor or focus.
**Action:** Inject the specific, escaped entity name (`${escapeHTML(exName)}`) into the `aria-label` of all repeating action buttons and inputs, creating labels like 'Weight for set 1 of Bench Press' or 'History for Bench Press'.
