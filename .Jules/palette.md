## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-02-23 - Icon-Only Buttons Lacking Screen Reader Context
**Learning:** Icon-only buttons relying purely on visual context or standard \`title\` attributes lack semantic meaning for screen readers. This particularly affects action buttons (e.g., Close, Delete, Swap, History, timer skip).
**Action:** Add explicit `aria-label` attributes to all icon-only buttons. The \`aria-label\` should clearly describe the button's action rather than simply its visual appearance.
