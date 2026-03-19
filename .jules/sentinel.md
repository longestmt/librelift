## 2024-03-15 - [XSS via unescaped user inputs in innerHTML]
**Vulnerability:** Unescaped user inputs (like exercise names, workout notes) directly passed to innerHTML in multiple files (e.g. workout.js, history.js).
**Learning:** The project relies heavily on template literals injected directly into innerHTML. Using a sanitization utility is critical since there's no native framework handling escaping.
**Prevention:** Always use an escapeHTML utility before injecting user-provided strings into the DOM via innerHTML.
## 2024-05-23 - Stored XSS in IndexedDB via `innerHTML` and `javascript:` URIs
**Vulnerability:** User-controlled data (exercise names, instructions, media URLs) was being saved to the client-side IndexedDB and later rendered directly into the DOM using template literals and `innerHTML` without sanitization. `mediaUrl` was rendered inside `href` attributes, allowing for `javascript:` URI execution.
**Learning:** Client-side databases in PWAs (like IndexedDB) still require input sanitization when rendering data back to the user to prevent Stored XSS attacks, as malicious payloads can be synced or entered locally.
**Prevention:** Always use `escapeHTML` when inserting user data into `innerHTML` using template literals. Validate URLs to ensure they use safe schemes (e.g., `http://` or `https://`) before saving or rendering them in `href` attributes.
