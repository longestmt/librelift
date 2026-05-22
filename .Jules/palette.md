## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-02-14 - Icon-Only Button Accessibility in Dynamic Templates
**Learning:** When generating HTML via template literals (like in workout logs), icon-only buttons (containing just `<svg>` elements) lack discernible text for screen readers. This makes essential actions (History, Swap, Calculator) invisible to assistive technologies.
**Action:** Always add explicit, context-aware `aria-label` attributes to the `<button>` elements (e.g., interpolating the exercise name for uniqueness), and strictly add `aria-hidden="true"` to the inner `<svg>` elements to hide the decorative content.
