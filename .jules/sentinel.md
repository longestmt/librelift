## 2024-03-20 - XSS in User-Generated HTML String Templates
**Vulnerability:** Found multiple Cross-Site Scripting (XSS) vulnerabilities in `src/pages/plans.js` where user-provided plan details (name, description, schedule, and exercise names) were injected directly into `innerHTML` using template literals without sanitization.
**Learning:** The application heavily relies on vanilla JS template literals for UI rendering (e.g., `container.innerHTML = \`...${userVariable}...\``). This pattern is inherently risky if any interpolated variable originates from user input. While `escapeHTML` exists in `src/utils/sanitize.js`, it wasn't consistently applied across all pages, particularly in the Plans feature where users can import entire workout JSON configurations.
**Prevention:** Always wrap user-controlled variables in `escapeHTML()` when interpolating them into `innerHTML` strings. Conduct a codebase-wide audit searching for `innerHTML = \`` to identify other potential missed sanitization points. When importing the `escapeHTML` utility, verify it's also used for attributes like `value` and `aria-label` which are rendered within the same template strings.

## 2024-05-24 - Cross-Site Scripting (XSS) in Analytics page innerHTML interpolation

**Vulnerability:** Unsanitized dynamic user data (such as unit strings, exercise names, dates) were being directly interpolated into `container.innerHTML` strings in `src/pages/analytics.js`.
**Learning:** Even internal data loaded from IndexedDB (like setting values or exercise strings) can carry XSS payloads if not properly sanitized prior to being set into the DOM, especially when constructing complex HTML blocks using template strings.
**Prevention:** All dynamic variables inserted into `innerHTML` using template strings should be systematically wrapped with `escapeHTML` (or a similar sanitization function), and their type coerced to String as a defensive measure.
