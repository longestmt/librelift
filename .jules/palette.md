
## 2024-05-14 - Context-Aware ARIA Labels for Repeated UI Cards
**Learning:** In lists of cards (like workout exercises), identical icon-only buttons (e.g., "History", "Swap") across multiple cards create an accessibility issue for screen reader users who navigate by interactive elements (e.g., using "B" key to jump between buttons), because they only hear "History" repeated without knowing *which* exercise it applies to.
**Action:** When adding ARIA labels to icon buttons within repeated UI elements (like cards or list items), make the label context-aware by including the item's name/title in the label (e.g., `aria-label="History for Bench Press"` instead of just `"History"`).
