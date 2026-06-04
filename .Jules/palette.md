## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-02-14 - Icon-only Buttons Lacking Accessible Context
**Learning:** Icon-only buttons (like `btn-icon` classes using inline `<svg>` for things like "History", "Swap", or "Close") in complex interfaces fail to provide context for screen reader users when they lack an `aria-label`, especially when context is split between visual elements (e.g. an exercise name header and an adjacent icon group).
**Action:** Consistently audit `.btn-icon` elements and add an explicit, contextual `aria-label` (e.g., `aria-label="Exercise History"`) instead of relying solely on `title` attributes, which are often insufficient for accessibility.
