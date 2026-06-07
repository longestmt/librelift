export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  try {
    const parsed = new URL(url, window.location.href);
    const protocol = parsed.protocol.toLowerCase();
    if (['javascript:', 'data:', 'vbscript:'].includes(protocol)) {
      return '#';
    }
    return url;
  } catch (e) {
    // If it can't be parsed as a URL and doesn't match our strict blocklist, let it pass (could be a valid relative path)
    // but we can also just strip out obvious protocol attempts if parsing fails.
    if (/^(javascript|data|vbscript):/i.test(url.trim())) {
      return '#';
    }
    return url;
  }
}

export function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
