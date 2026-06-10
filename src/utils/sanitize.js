export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  const trimmedUrl = url.trim();
  // Allow safe protocols (http, https, mailto, tel) and relative paths. Block javascript:, data:, vbscript:
  const urlPattern = /^(?:javascript|data|vbscript):/i;
  if (urlPattern.test(trimmedUrl)) {
    return '#';
  }
  return trimmedUrl;
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
