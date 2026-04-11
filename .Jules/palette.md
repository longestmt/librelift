## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2024-04-11 - Widespread Missing aria-label on Icon Buttons
**Learning:** Across the entire application (modals, timers, workout cards, plan management), icon-only buttons rely heavily on `title` attributes for accessible names. While `title` provides a tooltip on hover, it is inconsistently announced by screen readers depending on user settings and specific AT software, making it insufficient as the sole accessible name for interactive elements.
**Action:** When auditing custom vanilla JS components or adding new icon-only buttons in this codebase, explicitly enforce the pairing of `aria-label` alongside `title`.
