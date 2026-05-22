
## 2024-05-22 - XSS via Unsanitized href Attributes
**Vulnerability:** Dynamic URLs were interpolated directly into `href` attributes (e.g., `ex.mediaUrl`, `info.url`) without protocol validation, allowing arbitrary JavaScript execution via the `javascript:` protocol.
**Learning:** `escapeHTML` only escapes HTML tags/entities; it does not validate the URL protocol. A malicious payload like `javascript:alert(1)` remains completely valid and executable even after HTML escaping.
**Prevention:** Always use a dedicated `sanitizeUrl` function that strictly enforces `http://` or `https://` protocols (and drops/replaces invalid protocols with `#`) before applying `escapeHTML` to dynamic links.
