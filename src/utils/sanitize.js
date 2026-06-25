export function sanitizeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url, 'https://dummy.com');
    const protocol = parsed.protocol.toLowerCase();
    if (['javascript:', 'data:', 'vbscript:'].includes(protocol)) {
      return '#';
    }
    return url;
  } catch (e) {
    return '#';
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
