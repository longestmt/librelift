
## 2025-03-01 - Fix XSS Vulnerability in Anchor Tags via javascript: URIs
**Vulnerability:** Dynamic URLs (like `ex.mediaUrl` and `info.url`) were injected into `href` attributes without validating the protocol. This allowed potential execution of `javascript:` URIs, leading to Cross-Site Scripting (XSS).
**Learning:** While `escapeHTML` prevents HTML injection, it does not prevent executing scripts if a payload uses the `javascript:` pseudo-protocol within an `href` attribute. Local-first apps still require strict URL protocol enforcement when rendering user-supplied or external data.
**Prevention:** Always validate and enforce safe protocols (`http://`, `https://`) on any dynamic URL before injecting it into an `href` attribute. A helper function like `sanitizeUrl` should be used universally.
