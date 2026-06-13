
## 2025-02-27 - Fix URI-based XSS in href attributes
**Vulnerability:** User-controlled URLs (like exercise video links and external gist backup URLs) were injected directly into `href` attributes within template literals without any sanitization or proper escaping.
**Learning:** Even if `href` attributes expect a URL, inserting strings with malicious schemas (like `javascript:` or `data:`) can trigger XSS when clicked. Using `escapeHTML` alone does not protect against this; it only prevents escaping the attribute context, not the scheme of the URL.
**Prevention:** Always use a scheme sanitization function (like `sanitizeUrl` filtering out `javascript:`, `data:`, and `vbscript:`) combined with `escapeHTML` for dynamic URLs before rendering them into an HTML `href` or `src` attribute.
