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
  if (typeof url !== 'string') return '';
  const clean = escapeHTML(url);
  const lower = clean.trim().toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://')) return clean;
  return 'about:blank';
}
