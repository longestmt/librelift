## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2026-04-09 - Icon-Only Buttons Missing ARIA Labels
**Learning:** Icon-only buttons relying solely on `title` attributes are not consistently read by all screen readers, leading to poor accessibility for visually impaired users.
**Action:** Always provide an explicit `aria-label` on icon-only buttons (like `.btn-icon` or FABs) to ensure their purpose is conveyed.
