## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-04-29 - Missing 'for' attributes on labels
**Learning:** For form accessibility, all `<label>` elements must explicitly use the `for` attribute to link to the `id` of their corresponding input elements. This is crucial for screen reader accessibility and correct focus management, especially in dynamically generated modals and forms within a vanilla JS SPA.
**Action:** Always verify that every `<label>` tag has a `for` attribute matching the `id` of its input/select/textarea when creating or modifying forms.
