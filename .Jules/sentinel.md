
## 2024-06-02 - Prevent javascript: URI XSS in hrefs
**Vulnerability:** User-controlled URLs (like exercise media links or backup info URLs) were interpolated directly into `href` attributes. This could allow an attacker to inject `javascript:alert(1)` to achieve XSS.
**Learning:** Even if HTML content is escaped via `escapeHTML`, special URI protocols like `javascript:`, `data:`, or `vbscript:` must be rejected when a user-controlled string is used as an `href` or `src` attribute.
**Prevention:** Always validate and sanitize URLs using a strict protocol allowlist (e.g., `http:`, `https:`, `mailto:`) before placing them into attributes that evaluate URIs.
