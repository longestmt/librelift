## 2024-05-01 - Missing Sanitization in Dynamic Template Strings
**Vulnerability:** XSS vulnerabilities in multiple pages (e.g. `src/pages/exercises.js`, `src/pages/workout.js`, `src/pages/settings.js`, `src/pages/history.js`) due to direct injection of object properties into HTML strings without sanitization.
**Learning:** `escapeHTML` was imported in some files but not applied to all dynamic content, and `sanitizeUrl` was completely missing for dynamically generated URLs (like `ex.mediaUrl` and `info.url`).
**Prevention:** Always use `escapeHTML(String(value || ''))` for dynamic text content and `sanitizeUrl(value)` for dynamic URLs being interpolated into HTML template strings.
