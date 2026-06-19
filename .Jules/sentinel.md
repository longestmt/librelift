
## 2025-02-27 - URI-based XSS in Exercise Media Links
**Vulnerability:** User-controlled data (`ex.mediaUrl`) was being interpolated directly into an `href` attribute without protocol sanitization, creating a Cross-Site Scripting (XSS) vulnerability via `javascript:` URIs.
**Learning:** `escapeHTML` alone is insufficient for `<a href="...">` attributes because it does not block execution of malicious URIs like `javascript:alert(1)`. A custom URL parsing utility is needed to validate the scheme.
**Prevention:** Both sanitize the URL scheme (e.g., using a `sanitizeUrl` function to block `javascript:`, `data:`, `vbscript:`) AND escape the output (e.g., `escapeHTML`) whenever dynamically injecting user-controlled data into `href` or `src` attributes.
