## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-02-26 - Explicit 'for' attributes needed on vanilla JS templates
**Learning:** In vanilla JavaScript projects that generate HTML via template literals, automatic linking of labels and inputs (e.g., via wrapping) might be missed by accessibility scanners or result in poor screen reader experience. Explicit `for` attributes on labels must always be paired with corresponding input `id`s to ensure robust form accessibility and correct focus management when the label is clicked.
**Action:** When adding form fields or updating templates, ensure every `<label>` has a `for` attribute that strictly matches the `id` of its related input element.
