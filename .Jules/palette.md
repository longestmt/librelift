## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2024-05-18 - Missing ARIA Labels on Icon-only Buttons
**Learning:** Found multiple instances where icon-only buttons (`.btn-icon`, timer actions) relied only on the `title` attribute for accessibility, which is insufficient for screen readers.
**Action:** Always add explicit `aria-label` attributes to buttons containing only SVG icons to ensure they are accessible to assistive technologies.
