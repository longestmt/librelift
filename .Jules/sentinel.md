
## 2025-02-17 - URI-based XSS via javascript: protocol in hrefs
**Vulnerability:** XSS payload can be injected through dynamic `href` attributes if an attacker controls the URL and uses `javascript:...` instead of `http(s)://`.
**Learning:** `escapeHTML` alone does not prevent XSS in `href` properties. Browsers will execute `javascript:` URIs when clicked, leading to XSS vulnerabilities.
**Prevention:** Always validate and sanitize URLs using a strict protocol allowlist (e.g., `http://` or `https://`) and then apply HTML escaping before injecting dynamic URLs into `href` attributes.
