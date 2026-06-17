
## 2025-06-17 - Prevent URI-based XSS in custom exercises
**Vulnerability:** The `mediaUrl` attribute for user-created exercises was vulnerable to URI-based XSS, as dangerous protocols (`javascript:`) were not filtered out when interpolated into anchor tag `href`s.
**Learning:** Even when interpolating URLs into attributes rather than pure text elements, user input must be sanitized against unsafe schemes before HTML escaping.
**Prevention:** Implement and use a `sanitizeUrl` utility to explicitly block `javascript:`, `data:`, and `vbscript:` schemes, and apply both `sanitizeUrl` and `escapeHTML` to user-controlled URLs before injection into HTML output.
