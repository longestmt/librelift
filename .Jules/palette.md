## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-02-14 - Inputs missing explicit associated labels
**Learning:** For screen readers to appropriately announce an input element, it must either have an explicit label referencing its `id` attribute via the `for` attribute, or be implicitly wrapped in a `<label>` element. Missing these explicit links (such as using a `class="input-label"` without a `for` attribute in adjacent inputs) degrades form accessibility severely.
**Action:** Always ensure that when defining `<label>` elements adjacent to `<input>`, `<select>`, or `<textarea>` tags, a `for="[id]"` attribute is included matching the input's `id`.
