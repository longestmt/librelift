## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-05-28 - Missing ARIA Labels on Icon-Only Floating Action Buttons (FABs)
**Learning:** Floating action buttons (FABs) implemented solely with inner SVG elements and no text content lack accessible names, making them uninterpretable to screen reader users. Furthermore, missing `title` attributes prevents tooltips for visual users.
**Action:** When rendering icon-only buttons (like FABs) dynamically via DOM APIs or inside HTML template strings, always explicitly include `aria-label` and `title` attributes on the parent button element, and add `aria-hidden="true"` to the inner SVG.
