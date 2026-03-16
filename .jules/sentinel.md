## 2024-03-15 - [XSS via unescaped user inputs in innerHTML]
**Vulnerability:** Unescaped user inputs (like exercise names, workout notes) directly passed to innerHTML in multiple files (e.g. workout.js, history.js).
**Learning:** The project relies heavily on template literals injected directly into innerHTML. Using a sanitization utility is critical since there's no native framework handling escaping.
**Prevention:** Always use an escapeHTML utility before injecting user-provided strings into the DOM via innerHTML.
