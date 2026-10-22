import process from 'node:process';

// Exact branch alias verified in the existing Vercel project. Production and
// arbitrary deployment URLs are deliberately excluded; never infer from Host.
export const STORE_ALLOWED_ORIGINS = Object.freeze([
  'http://localhost:4176',
  'https://hex-solutions-git-codex-hex-plugin-fdcb17-ekterp-bots-projects.vercel.app',
]);
export const STORE_SUPABASE_URL = 'https://pujpznngwcgutujqgmkp.supabase.co';
export const STORE_MAX_BODY_BYTES = 16 * 1024;
// The current editor and API support only currencies with two decimal places.
// Add other minor-unit exponents together with an explicitly updated editor.
export const STORE_PRICE_CURRENCIES = Object.freeze(['USD', 'EUR', 'GBP', 'CAD', 'AUD']);

export function getStoreConfig() {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'preview') throw new Error('store_preview_only');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('store_backend_unconfigured');
  const url = process.env.SUPABASE_URL || STORE_SUPABASE_URL;
  if (url !== STORE_SUPABASE_URL) throw new Error('store_project_mismatch');
  return {
    url,
    serviceKey,
    authKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || serviceKey,
    invitePepper: process.env.INVITE_CODE_PEPPER || null,
  };
}

export function cookieNames(origin) {
  const prefix = origin.startsWith('https://') ? '__Host-' : '';
  return {
    access: `${prefix}hex-store-access`,
    refresh: `${prefix}hex-store-refresh`,
    csrf: `${prefix}hex-store-csrf`,
  };
}
