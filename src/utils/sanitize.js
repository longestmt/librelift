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
  if (typeof url !== 'string') return '#';
  try {
    const parsed = new URL(url, 'https://dummy.com');
    if (['javascript:', 'data:', 'vbscript:'].includes(parsed.protocol)) {
      return '#';
    }
    return url;
  } catch (e) {
    return '#';
  }
}
