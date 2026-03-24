## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-02-14 - Icon-Only Buttons Missing Context for Screen Readers
**Learning:** Buttons relying solely on visual icons (`.btn-icon`, `.fab`, `.rest-timer-btn`) provide no context to screen reader users, even if they have a `title` attribute, which is not reliably read by all assistive technologies. This pattern is common in vanilla JS dynamic apps.
**Action:** Always add descriptive `aria-label` attributes (e.g., `aria-label="Close modal"`) to icon-only buttons to ensure their purpose is clearly communicated to screen reader users.
