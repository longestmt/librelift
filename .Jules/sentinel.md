
## 2025-06-10 - URI-based XSS via user-provided exercise URLs
**Vulnerability:** A cross-site scripting (XSS) vulnerability was found in the exercise library page where a user-provided exercise `mediaUrl` was injected directly into an anchor (`<a>`) tag's `href` attribute without any protocol validation or escaping.
**Learning:** Even if HTML entities are escaped using `escapeHTML`, injecting an unsanitized URL into an `href` attribute allows for URI-based XSS using dangerous schemes like `javascript:`, `vbscript:`, or `data:`. Also, all user inputs populated into template literals used for `innerHTML` generation must have HTML entity escaping applied to prevent breakout.
**Prevention:** Always use both protocol validation (e.g., blocking `javascript:`, `data:`, `vbscript:`) and HTML entity escaping (e.g., `escapeHTML`) when injecting user-provided URLs into `href` or `src` attributes. For generic user data like strings, always apply `escapeHTML` when using `innerHTML`.
