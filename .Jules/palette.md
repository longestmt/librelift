## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-02-14 - Icon-Only Buttons Missing Accessibility Labels
**Learning:** Icon-only buttons (using SVGs) often lack text content, making them completely opaque to screen readers. Relying only on `title` attributes is not sufficient for proper accessibility, as it may not be read consistently across different screen readers and devices.
**Action:** Always add explicit `aria-label` attributes to icon-only buttons to ensure they have an accessible name, even if a `title` attribute is present for visual tooltips.
