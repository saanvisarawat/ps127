// Single source of truth for the product name — change VITE_APP_NAME in .env
// (or this fallback) to rebrand everywhere, including index.html's <title>.
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'TRAFFIC';
export const APP_TAGLINE = 'City-Wide ANPR';
