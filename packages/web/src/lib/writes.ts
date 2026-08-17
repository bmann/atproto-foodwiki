// Authenticated record writes against the user's PDS (via OAuth session).
import type { Client } from '@atcute/client';
import type { ActorIdentifier } from '@atcute/lexicons';
import {
  ComAtprotoRepoCreateRecord,
  ComAtprotoRepoPutRecord,
  ComAtprotoRepoDeleteRecord,
} from '@atcute/atproto';

/** Fractional index: midpoint between prev and next (or below/above). */
export function midSortKey(prev: string | undefined, next: string | undefined): string {
  if (prev === undefined && next === undefined) return 'a0';
  if (prev === undefined) return before(next!);
  if (next === undefined) return after(prev);
  if (prev >= next) return after(prev);
  // Try ASCII midpoint
  let a = prev;
  let b = next;
  const common = commonPrefix(a, b);
  const sa = a.slice(common.length);
  const sb = b.slice(common.length);
  if (sa.length === 0) {
    // a is prefix of b: e.g. "a" and "a1"
    const firstB = sb[0]!;
    const c = String.fromCharCode(firstB.charCodeAt(0) - 1 >= 48 ? firstB.charCodeAt(0) - 1 : firstB.charCodeAt(0));
    const cand = common + c;
    if (cand > a && cand < b) return cand;
    return after(a);
  }
  let i = 0;
  while (i < sa.length && i < sb.length && sa[i] === sb[i]) i++;
  const ca = sa.charCodeAt(i);
  const cb = sb.charCodeAt(i);
  const avg = Math.floor((ca + cb) / 2);
  if (avg === ca) return after(a);
  const cand = common + sa.slice(0, i) + String.fromCharCode(avg) + '0';
  if (cand > a && cand < b) return cand;
  return after(a);
}

function commonPrefix(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return a.slice(0, i);
}
function after(s: string): string {
  const bumped = s + '0';
  return bumped;
}
function before(s: string): string {
  const first = s.charCodeAt(0);
  const half = String.fromCharCode(Math.max(48, Math.floor((48 + first) / 2)));
  return half + s.slice(1);
}

export interface NodeRecordInput {
  text: string;
  sortKey: string;
  createdAt?: string;
  parent?: string;
  layout?: string;
  display?: string;
  completedAt?: string;
  facets?: unknown;
}

function toRecord(r: NodeRecordInput) {
  return {
    $type: 'app.bulleted.node',
    text: r.text,
    sortKey: r.sortKey,
    createdAt: r.createdAt ?? new Date().toISOString(),
    ...(r.parent ? { parent: r.parent } : {}),
    ...(r.layout ? { layout: r.layout } : {}),
    ...(r.display ? { display: r.display } : {}),
    ...(r.completedAt ? { completedAt: r.completedAt } : {}),
    ...(r.facets ? { facets: r.facets } : {}),
  };
}

/** Create a new bullet. Returns the created AT-URI. */
export async function createBullet(client: Client, did: string, record: NodeRecordInput): Promise<string> {
  const res = await client.call(ComAtprotoRepoCreateRecord.mainSchema, {
    input: {
      collection: 'app.bulleted.node',
      repo: did as ActorIdentifier,
      record: toRecord(record),
    },
  });
  if (!res.ok) throw new Error(`create failed: ${res.data.error ?? res.status}`);
  return res.data.uri;
}

/** Update an existing bullet (by rkey). */
export async function putBullet(client: Client, did: string, rkey: string, record: NodeRecordInput): Promise<string> {
  const res = await client.call(ComAtprotoRepoPutRecord.mainSchema, {
    input: {
      collection: 'app.bulleted.node',
      repo: did as ActorIdentifier,
      rkey,
      record: toRecord(record),
    },
  });
  if (!res.ok) throw new Error(`update failed: ${res.data.error ?? res.status}`);
  return res.data.uri;
}

/** Delete a bullet by rkey. */
export async function deleteBullet(client: Client, did: string, rkey: string): Promise<void> {
  const res = await client.call(ComAtprotoRepoDeleteRecord.mainSchema, {
    input: { collection: 'app.bulleted.node', repo: did as ActorIdentifier, rkey },
  });
  if (!res.ok) throw new Error(`delete failed: ${res.data.error ?? res.status}`);
}
