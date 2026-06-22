
## YYYY-MM-DD - URI-based XSS via unescaped URL parameter in exercise media
**Vulnerability:** In `src/pages/exercises.js`, `ex.mediaUrl` is placed directly into the `href` attribute of an anchor tag without sanitizing the protocol (to block `javascript:` URIs) or escaping HTML entities, leading to potential XSS or attribute breakout.
**Learning:** Even when links expect legitimate URLs like `https://youtube.com/`, failing to enforce safe protocols and failing to HTML-escape URL strings used inside template literals injected via `innerHTML` can enable XSS payloads if user inputs are malicious.
**Prevention:** Always implement a `sanitizeUrl` function to enforce `http:`/`https:` protocols (and return safe fallbacks like `#` for others) and ALWAYS wrap user-controlled variables in `escapeHTML` even for URL attributes when using `innerHTML`.
