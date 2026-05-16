## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-05-16 - Icon-Only Buttons and Accessibility Context
**Learning:** Icon-only buttons (using `btn-icon` class with inline `<svg>`) inside dynamic list views, cards, or tables often lack accessible names, making them completely un-navigable for screen reader users. The application relies heavily on these for actions like "History", "Swap", "1RM Calc", and "Plates" within the workout view.
**Action:** Always add explicit `aria-label` attributes to icon-only buttons, and crucially, interpolate specific context (e.g., the exercise name) into the `aria-label` so users aren't met with twenty identical "Swap exercise" announcements on a single page.
