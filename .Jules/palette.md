## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-03-09 - Missing Form Label Associations
**Learning:** In vanilla JavaScript UIs where forms are dynamically generated using template literals, `<label>` elements often lack the `for` attribute linking them to their corresponding input `id`s. This pattern was observed across multiple modal forms (`exercises.js`, `plans.js`, and `workout.js`). Without this explicit association, screen readers cannot properly announce the input's purpose, and users cannot click the label text to focus the input, negatively impacting both accessibility and general usability.
**Action:** Always ensure that every `<label>` element includes a `for` attribute that exactly matches the `id` of its corresponding input, select, or textarea element, especially when dealing with dynamically generated HTML strings.
