## 2025-02-18 - Dynamically injected Floating Action Buttons lack ARIA labels
**Learning:** Dynamically created icon-only FABs via document.createElement('button') often miss essential accessibility attributes like `aria-label` and `title` which makes them invisible to screen readers, unlike inline HTML where developers might be more mindful.
**Action:** When dynamically generating icon-only buttons via DOM APIs, always explicitly set `.setAttribute('aria-label', ...)` and `title`, and add `aria-hidden="true"` to the inner SVG.
