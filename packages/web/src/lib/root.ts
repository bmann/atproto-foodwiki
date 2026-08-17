// FoodWiki "root" feature: pick a bullet (or whole account) as the FoodWiki.
// Stored in the author's `app.bulleted.outline` records.
//   - rkey `self`     = whole forest (no `root` field)
//   - rkey <bullet>   = subtree rooted at that bullet (has `root` = that bullet's at-uri)
// The Bulleted lexicon enforces: root present if and only if the record key is not 'self'.
import type { Client } from '@atcute/client';
import { ComAtprotoRepoPutRecord, ComAtprotoRepoGetRecord, ComAtprotoRepoDeleteRecord } from '@atcute/atproto';
import type { ActorIdentifier } from '@atcute/lexicons';

export interface OutlineRecord {
  title?: string;
  description?: string;
  root?: string; // at-uri of the root bullet; only valid when the record key is not 'self'
  createdAt: string;
}

export const OUTLINE_COLLECTION = 'app.bulleted.outline';

/** Resolve a DID's PDS via the PLC directory (public). */
export async function resolvePds(did: string): Promise<string> {
  const res = await fetch(`https://plc.directory/${did}`);
  if (!res.ok) throw new Error(`PLC resolution failed (${res.status})`);
  const doc = (await res.json()) as { service?: { id?: string; serviceEndpoint?: string }[] };
  const pds = doc.service?.find((s) => s.id === '#atproto_pds')?.serviceEndpoint;
  if (!pds) throw new Error('no PDS service found for DID');
  return pds;
}

/** rkey for a bullet at-uri: the last path segment (used as the outline record key). */
export function rkeyFromUriForOutline(uri: string): string {
  return uri.slice(uri.lastIndexOf('/') + 1);
}

/**
 * Fetch the outline record that is in effect for a view level.
 * `self` = whole forest; any other rkey = subtree rooted at that bullet.
 * Public read from the author's PDS.
 */
export async function fetchOutlineRecord(did: string, rkey: string = 'self'): Promise<OutlineRecord | null> {
  const pds = await resolvePds(did);
  const url = new URL(`${pds}/xrpc/com.atproto.repo.getRecord`);
  url.searchParams.set('repo', did);
  url.searchParams.set('collection', OUTLINE_COLLECTION);
  url.searchParams.set('rkey', rkey);
  const res = await fetch(url);
  if (res.status === 400) return null; // not found
  if (!res.ok) throw new Error(`getRecord failed (${res.status})`);
  const body = (await res.json()) as { value?: Record<string, unknown> };
  const v = body.value ?? {};
  return {
    title: typeof v.title === 'string' ? v.title : undefined,
    description: typeof v.description === 'string' ? v.description : undefined,
    root: typeof v.root === 'string' ? v.root : undefined,
    createdAt: typeof v.createdAt === 'string' ? v.createdAt : new Date().toISOString(),
  };
}

/** List all outline records for a DID (public). Returns rkey → record. */
export async function listOutlineRecords(did: string): Promise<Map<string, OutlineRecord>> {
  const pds = await resolvePds(did);
  const url = new URL(`${pds}/xrpc/com.atproto.repo.listRecords`);
  url.searchParams.set('repo', did);
  url.searchParams.set('collection', OUTLINE_COLLECTION);
  url.searchParams.set('limit', '100');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`listRecords failed (${res.status})`);
  const body = (await res.json()) as { records?: { uri?: string; value?: Record<string, unknown> }[] };
  const out = new Map<string, OutlineRecord>();
  for (const r of body.records ?? []) {
    const uri = r.uri ?? '';
    const rkey = uri.slice(uri.lastIndexOf('/') + 1);
    const v = r.value ?? {};
    out.set(rkey, {
      title: typeof v.title === 'string' ? v.title : undefined,
      description: typeof v.description === 'string' ? v.description : undefined,
      root: typeof v.root === 'string' ? v.root : undefined,
      createdAt: typeof v.createdAt === 'string' ? v.createdAt : new Date().toISOString(),
    });
  }
  return out;
}

/**
 * Write (create/update) an outline record.
 * - rkey 'self': whole-forest record; must NOT carry a `root`.
 * - rkey <bullet>: subtree record; MUST carry `root` = that bullet's at-uri.
 * Preserves createdAt + any existing fields not being changed.
 */
export async function writeOutlineRecord(
  client: Client,
  did: string,
  rkey: string,
  record: { title?: string; description?: string; root?: string },
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await fetchOutlineRecord(did, rkey).catch(() => null);
  const isSelf = rkey === 'self';
  const root = record.root ?? existing?.root;
  const value: Record<string, unknown> = {
    $type: 'app.bulleted.outline',
    createdAt: existing?.createdAt ?? now,
  };
  if (record.title !== undefined) {
    value.title = record.title;
  } else if (existing?.title) {
    value.title = existing.title;
  }
  if (record.description !== undefined) {
    value.description = record.description;
  } else if (existing?.description) {
    value.description = existing.description;
  }
  if (!isSelf && root) {
    value.root = root;
  }
  const res = await client.call(ComAtprotoRepoPutRecord.mainSchema, {
    input: {
      collection: OUTLINE_COLLECTION,
      repo: did as ActorIdentifier,
      rkey,
      record: value,
    },
  });
  if (!res.ok) throw new Error(`write outline failed: ${res.data.error ?? res.status}`);
}

/** Delete an outline record (used when clearing a subtree root back to whole-forest). */
export async function deleteOutlineRecord(client: Client, did: string, rkey: string): Promise<void> {
  const res = await client.call(ComAtprotoRepoDeleteRecord.mainSchema, {
    input: { collection: OUTLINE_COLLECTION, repo: did as ActorIdentifier, rkey },
  });
  if (!res.ok) throw new Error(`delete outline failed: ${res.data.error ?? res.status}`);
}

export { ComAtprotoRepoGetRecord };
