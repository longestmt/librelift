## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2024-05-18 - Added ARIA labels to SVG Icon-Only Buttons
**Learning:** Found an accessibility issue pattern across multiple components (`workout.js`, `plans.js`, `modal.js`) where icon-only buttons lacked descriptive labels for screen readers. The SVGs within these buttons also weren't hidden, which could cause redundant or confusing announcements.
**Action:** When implementing or updating icon-only buttons with SVGs in template literals, ensure that the button element has a descriptive `aria-label` attribute (often matching the `title` attribute if present) and that the internal `<svg>` element has `aria-hidden="true"` to prevent screen readers from reading the SVG markup.
