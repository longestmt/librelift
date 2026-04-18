## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-02-14 - Explicit 'for' attributes needed on dynamic labels
**Learning:** In vanilla JS applications where forms and modals are dynamically generated as innerHTML strings, `<label>` elements often miss their `for` attribute. Unlike React/JSX which warns about missing `htmlFor`, vanilla JS fails silently, leaving inputs unlinked for screen readers and disabling click-to-focus behavior on the label.
**Action:** Always explicitly add `for="[input-id]"` to `<label>` elements when creating dynamic forms or modals via innerHTML.
