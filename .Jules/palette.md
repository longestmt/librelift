## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-02-14 - Repeated Context-less Actions Hinder Screen Readers
**Learning:** In repeated UI components (like exercise cards in a workout log), identical icon-only buttons (like "History", "Swap", "Plates", "+ Set", "Note") are indistinguishable to screen reader users because they all announce the same generic label (or no label at all) without the surrounding context. A screen reader user navigating by form elements or buttons will hear "History, Swap, Note, History, Swap, Note" and won't know which button corresponds to which exercise.
**Action:** When adding ARIA labels to utility or action buttons inside repeated list items or grid components, always interpolate the context of the specific item into the label (e.g., `aria-label="History for ${escapeHTML(ex.exerciseName)}"`). This ensures unique, descriptive announcements for screen reader users and significantly improves navigation.
