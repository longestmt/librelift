export function sanitizeUrl(url) {
  if (typeof url !== 'string') return '#';
  let parsed;
  try {
    parsed = new URL(url, 'https://dummy.com');
  } catch (e) {
    return '#';
  }
  const blockedProtocols = ['javascript:', 'data:', 'vbscript:'];
  if (blockedProtocols.includes(parsed.protocol)) {
    return '#';
  }
  return url;
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
