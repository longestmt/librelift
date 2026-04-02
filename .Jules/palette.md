## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").
## 2026-04-02 - ARIA Labels on Icon-Only Buttons
**Learning:** This app heavily relies on icon-only buttons (like `.fab`, `.btn-icon`, `.rest-timer-btn`) for compact UI. While they often have `title` attributes, this isn't sufficient for all screen readers.
**Action:** Always add explicit `aria-label` attributes to any button that doesn't contain text, especially those using SVGs as their primary visual.
