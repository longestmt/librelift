## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-04-22 - Explicit Association for Labels
**Learning:** In many forms where a generic `<label>` element is placed visually near an input, screen readers do not automatically associate the label with the input. The `<label>` element needs a `for` attribute that strictly matches the `id` of the input element it represents.
**Action:** When adding labels to forms, always include a `for` attribute and ensure the associated input element has a corresponding `id` attribute.
