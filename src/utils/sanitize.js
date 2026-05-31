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
  const trimmedUrl = url.trim();
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    return escapeHTML(trimmedUrl);
  }
  return '';
}
