## 2024-05-20 - XSS Vulnerability in Vanilla JS Template Literals
**Vulnerability:** XSS vulnerabilities found in multiple places due to use of `innerHTML` with string interpolation for user-provided data like `workout.notes` and `ex.notes`.
**Learning:** In vanilla JavaScript apps, using template literals and `innerHTML` is a common pattern for rendering UI, but it completely lacks the auto-escaping features provided by frameworks like React or Vue.
**Prevention:** Always escape user-provided strings before interpolating them into HTML strings that will be assigned to `innerHTML`. A utility function `escapeHTML` should be used for this purpose.
