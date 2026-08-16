// Shared atproto plumbing for the web app.
// Currently: public reads via the HappyView appview. Auth (OAuth) ships in Phase 5.
import { createClient, getOutline } from '@foodwiki/core';
import type {} from '@foodwiki/lexicons';

export const APPVIEW_URL = import.meta.env.VITE_APPVIEW_URL ?? 'https://atproto-foodwiki-production.up.railway.app';

/** Public, unauthenticated client pointed at the FoodWiki appview. */
export const rpc = createClient(APPVIEW_URL);

export { getOutline };
