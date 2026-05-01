## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-02-14 - Redundant Text in Icon-Only Buttons
**Learning:** When adding `aria-hidden="true"` to hide decorative content inside an icon-only button (like `×` characters or SVGs), NEVER apply the attribute directly to the `<button>` element itself. This hides the interactive element from screen readers while keeping it focusable, creating confusing "ghost tab stops".
**Action:** Always wrap inner text characters like `×` in a `<span>` and apply `aria-hidden="true"` to the `<span>` (or directly to `<svg>` children), ensuring the parent `<button>` retains its `aria-label` and remains visible to assistive technology.
