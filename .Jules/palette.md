## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-02-14 - Redundant screen reader announcements in custom action buttons
**Learning:** Icon-only action buttons relying purely on `title` attributes (e.g. History, Swap, Plates in exercise cards) are often read confusingly by screen readers (e.g. reading the `title` AND attempting to parse the inner `<svg>` tree if it isn't hidden). Without item-specific context, multiple buttons announce identically on the page.
**Action:** When rendering custom SVG icon buttons dynamically, always explicitly define `aria-label` with item-specific context (e.g. "History for Bench Press"), and always add `aria-hidden="true"` to the inner SVG element.
