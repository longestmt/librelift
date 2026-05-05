## 2024-05-18 - XSS in dynamic href attributes
**Vulnerability:** XSS vulnerability through 'javascript:' protocol in dynamic URLs injected into 'href' attributes (ex.mediaUrl and info.url).
**Learning:** In local-first or any apps, URLs that are user-provided or stored need to be sanitized to ensure they only use safe protocols ('http://' or 'https://') before being placed into HTML template strings.
**Prevention:** Always use a 'sanitizeUrl' function to check URL protocols and apply 'escapeHTML' before injecting dynamic URLs into 'href' attributes.
