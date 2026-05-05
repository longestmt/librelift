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
  if (typeof url !== 'string') return 'about:blank';
  const trimmedUrl = url.trim();
  const lowerUrl = trimmedUrl.toLowerCase();

  if (lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://')) {
    return escapeHTML(trimmedUrl);
  }

  return 'about:blank';
}
