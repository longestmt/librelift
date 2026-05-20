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
  let safeUrl = url.trim();
  try {
    const parsedUrl = new URL(safeUrl, 'http://localhost'); // Provide dummy base for relative URLs
    // Allow standard protocols, but disallow javascript:, data:, vbscript:, etc.
    if (!['http:', 'https:', 'ftp:', 'mailto:', 'tel:'].includes(parsedUrl.protocol)) {
      return '#';
    }
  } catch(e) {
      // Ignore parse errors, just fallback to basic check
  }

  if (safeUrl.toLowerCase().startsWith('javascript:') ||
      safeUrl.toLowerCase().startsWith('data:') ||
      safeUrl.toLowerCase().startsWith('vbscript:')) {
    return '#';
  }
  return escapeHTML(safeUrl);
}
