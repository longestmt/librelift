export function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeUrl(url) {
  if (typeof url !== 'string' || !url) return '#';
  try {
    const parsed = new URL(url, 'http://dummy.com');
    // If it's a relative URL, we might want to allow it, but for mediaUrl/info.url we probably expect absolute.
    // Let's enforce http/https only for absolute URLs.
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol) && url.includes(':')) {
       // if it has a scheme that is not http/https/mailto, reject
       if (parsed.protocol === 'javascript:' || parsed.protocol === 'data:' || parsed.protocol === 'vbscript:') {
           return 'about:blank';
       }
    }
  } catch(e) {
      // ignore
  }

  const sanitized = url.trim();
  if (/^javascript:/i.test(sanitized) || /^data:/i.test(sanitized) || /^vbscript:/i.test(sanitized)) {
    return 'about:blank';
  }
  return escapeHTML(sanitized);
}
