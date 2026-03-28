## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-03-28 - Icon-Only Buttons Lacking Accessible Context
**Learning:** In complex layouts, icon-only buttons rely heavily on context and `title` attributes to convey their purpose. This is problematic for screen reader users or users without a pointer device.
**Action:** Add `aria-label` to all icon-only buttons (such as timer skips, modals close, swap, note, or delete functions) to provide clear and actionable context for screen reader users.