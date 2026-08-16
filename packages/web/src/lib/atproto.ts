// Shared atproto plumbing for the web app.
// Currently: public reads via the HappyView appview. Auth (OAuth) ships in Phase 5.
import { createClient } from '@foodwiki/core';
import type { OutlineData } from './outline-tree';
import { normalizeOutline } from './outline-tree';

export const APPVIEW_URL = import.meta.env.VITE_APPVIEW_URL ?? 'https://atproto-foodwiki-production.up.railway.app';
export const BSKY_PUBLIC = 'https://public.api.bsky.app';

/** Public, unauthenticated client pointed at the FoodWiki appview. */
export const rpc = createClient(APPVIEW_URL);

export interface OutlineResult {
  data: OutlineData;
  error?: string;
}

/** Fetch a DID's outline from the appview and normalize it. */
export async function fetchOutline(did: string): Promise<OutlineResult> {
  const url = new URL(`${APPVIEW_URL}/xrpc/app.bulleted.getOutline`);
  url.searchParams.set('did', did);
  url.searchParams.set('depth', '5');
  url.searchParams.set('limit', '100');
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    return { data: { rows: [] }, error: body?.message ?? body?.error ?? `HTTP ${res.status}` };
  }
  return { data: normalizeOutline(body) };
}

/** Resolve a handle to a DID via a public resolver (bsky appview). */
export async function resolveHandle(handle: string): Promise<string | null> {
  try {
    const url = new URL(`${BSKY_PUBLIC}/xrpc/com.atproto.identity.resolveHandle`);
    url.searchParams.set('handle', handle);
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = await res.json();
    return typeof body.did === 'string' ? body.did : null;
  } catch {
    return null;
  }
}

/** True when the value looks like a DID (did:plc:..., did:web:...). */
export const isDid = (v: string) => /^did:[^:]+:[^:]+$/.test(v);
