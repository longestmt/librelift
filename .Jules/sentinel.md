
## 2024-05-01 - Prevent javascript: URI XSS in href Attributes
**Vulnerability:** XSS vulnerability through `javascript:` URI injection in `href` attributes for `ex.mediaUrl` and `info.url` (e.g. `<a href="${ex.mediaUrl}">`).
**Learning:** `escapeHTML` mitigates standard XSS but not URI-based XSS when user-controlled URLs are injected directly into `href` without protocol validation, allowing `javascript:alert(1)` to be executed upon clicking.
**Prevention:** Always validate and enforce safe protocols (`http://` or `https://`) for URLs dynamically injected into attributes like `href` or `src` using a function like `sanitizeUrl()`.
