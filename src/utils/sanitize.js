export function sanitizeUrl(url) {
  if (typeof url !== 'string' || !url) return '#';
  const cleanUrl = url.replace(/[\x00-\x1F\x7F-\x9F\s]/g, '');
  if (/^(javascript|data|vbscript):/i.test(cleanUrl)) {
    return '#';
  }
  return cleanUrl;
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
