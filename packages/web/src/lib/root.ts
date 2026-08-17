// FoodWiki "root" feature: pick a bullet (or whole account) as the FoodWiki.
// Stored in the author's `app.bulleted.outline` record (rkey `self`).
import type { Client } from '@atcute/client';
import { ComAtprotoRepoPutRecord, ComAtprotoRepoGetRecord } from '@atcute/atproto';
import type { ActorIdentifier } from '@atcute/lexicons';

export interface OutlineRecord {
  title?: string;
  description?: string;
  root?: string; // at-uri of the root bullet; absent = whole account
  createdAt: string;
}

const OUTLINE_COLLECTION = 'app.bulleted.outline';

/** Resolve a DID's PDS via the PLC directory (public). */
export async function resolvePds(did: string): Promise<string> {
  const res = await fetch(`https://plc.directory/${did}`);
  if (!res.ok) throw new Error(`PLC resolution failed (${res.status})`);
  const doc = (await res.json()) as { service?: { id?: string; serviceEndpoint?: string }[] };
  const pds = doc.service?.find((s) => s.id === '#atproto_pds')?.serviceEndpoint;
  if (!pds) throw new Error('no PDS service found for DID');
  return pds;
}

/** Fetch the author's outline record (rkey self) from their PDS. Public. */
export async function fetchOutlineRecord(did: string): Promise<OutlineRecord | null> {
  const pds = await resolvePds(did);
  const url = new URL(`${pds}/xrpc/com.atproto.repo.getRecord`);
  url.searchParams.set('repo', did);
  url.searchParams.set('collection', OUTLINE_COLLECTION);
  url.searchParams.set('rkey', 'self');
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

/** Write (create/update) the author's outline record. Authed. */
export async function writeOutlineRecord(
  client: Client,
  did: string,
  record: { title?: string; description?: string; root?: string },
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await fetchOutlineRecord(did).catch(() => null);
  const value = {
    $type: 'app.bulleted.outline',
    createdAt: existing?.createdAt ?? now,
    ...(record.title !== undefined ? { title: record.title } : existing?.title ? { title: existing.title } : {}),
    ...(record.description !== undefined
      ? { description: record.description }
      : existing?.description
        ? { description: existing.description }
        : {}),
    ...(record.root !== undefined && record.root !== null ? { root: record.root } : {}),
  };
  const res = await client.call(ComAtprotoRepoPutRecord.mainSchema, {
    input: {
      collection: OUTLINE_COLLECTION,
      repo: did as ActorIdentifier,
      rkey: 'self',
      record: value,
    },
  });
  if (!res.ok) throw new Error(`write outline failed: ${res.data.error ?? res.status}`);
}

export { ComAtprotoRepoGetRecord };
