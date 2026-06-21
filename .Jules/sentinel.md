
## 2025-06-21 - URI-Based XSS in Exercise Media Links
**Vulnerability:** The application was injecting user-provided exercise video URLs (`ex.mediaUrl`) directly into the `href` attribute of an `<a>` tag without any sanitization in `src/pages/exercises.js`.
**Learning:** This is a classic URI-based XSS vulnerability. If a user sets a video URL to `javascript:alert(1)`, clicking the link executes arbitrary JavaScript. Both protocol sanitization and HTML escaping are necessary to completely neutralize this threat, as attackers can also break out of the `href` quotes.
**Prevention:** Always validate and sanitize URLs before rendering them into HTML attributes. Implemented a `sanitizeUrl` utility that parses URLs (using a dummy base for relative URLs) and explicitly blocks dangerous protocols (`javascript:`, `data:`, `vbscript:`), falling back to `#` if malicious or invalid.
