## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-02-14 - Dynamically Generated Icon-Only Buttons Missing Context
**Learning:** When generating icon-only buttons via DOM APIs (like `document.createElement('button')` for FABs), inner SVGs do not inherently provide an accessible name for screen readers, causing the button to be unlabelled.
**Action:** Explicitly set `aria-label` and `title` via `.setAttribute()` and `.title`, and inject `aria-hidden="true"` into the inner `<svg>` string so screen readers read the label instead of the SVG geometry.
