## 2025-02-14 - Visual Grid Layouts Hiding Context from Screen Readers
**Learning:** In a visual grid layout (like a workout log) where column headers (Weight, Reps, RPE) exist separately from the rows, screen readers lose context. Inputs appear unlabelled, making it difficult for users to know what data they are entering.
**Action:** Add explicit `aria-label` attributes to each input that combine the column meaning with the row context (e.g., "Weight for set 1").

## 2025-02-14 - Icon-Only Buttons Missing Screen Reader Context
**Learning:** Icon-only buttons (like those using SVGs for 'History', 'Swap', or 'Close') are inaccessible to screen readers unless explicitly labeled. Furthermore, if the button's action is tied to a specific item in a list (like an exercise), a generic label like "History" is insufficient when multiple such buttons exist on the page.
**Action:** Always add an `aria-label` to icon-only buttons that describes the action *and* includes the context of the item it affects (e.g., `aria-label="History for Bench Press"`). Additionally, always apply `aria-hidden="true"` to the inner `<svg>` element to prevent screen readers from redundantly announcing the graphic.
