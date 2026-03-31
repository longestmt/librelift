/**
 * format.js — Shared formatting utilities
 */

/** Format duration in seconds to human-readable string (e.g. "1h 36m", "45m") */
export function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}
