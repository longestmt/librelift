
## 2024-05-31 - XSS in Exercise Grid and Modal
**Vulnerability:** User-controlled exercise fields (name, muscleGroup, equipment, category, instructions) were interpolated directly into `innerHTML` strings. Additionally, the `mediaUrl` field was placed directly in an `href` attribute, making it susceptible to `javascript:` URI attacks.
**Learning:** Any dynamic content inserted into the DOM via `innerHTML` must be properly escaped. URLs must be validated to enforce secure protocols (http/https).
**Prevention:** Always use `escapeHTML` for text content inserted into HTML. Create and apply a `sanitizeUrl` function to ensure URLs in `href` or `src` attributes use safe protocols.
