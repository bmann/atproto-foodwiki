// Authenticated record writes against the user's PDS (via OAuth session).
import type { Client } from '@atcute/client';
import type { ActorIdentifier } from '@atcute/lexicons';
import {
  ComAtprotoRepoCreateRecord,
  ComAtprotoRepoPutRecord,
  ComAtprotoRepoDeleteRecord,
} from '@atcute/atproto';
import { generateKeyBetween } from 'fractional-indexing';

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Increment a base62-encoded key tail (bounded growth, never throws). */
function incTail(s: string): string {
  const cs = s.split('');
  let i = cs.length - 1;
  for (; i >= 0; i--) {
    const v = DIGITS.indexOf(cs[i]!);
    if (v === -1) { cs[i] = '0'; continue; }
    if (v < DIGITS.length - 1) { cs[i] = DIGITS[v + 1]!; break; }
    cs[i] = DIGITS[0]!;
    // else carry to the previous char
  }
  if (i < 0) cs.unshift(DIGITS[1]!); // all 'z's rolled over -> prefix '1'
  return cs.join('');
}

/** Decrement a base62-encoded key tail (bounded growth, never throws). */
function decTail(s: string): string {
  const cs = s.split('');
  let i = cs.length - 1;
  for (; i >= 0; i--) {
    const v = DIGITS.indexOf(cs[i]!);
    if (v === -1) { cs[i] = '0'; continue; }
    if (v > 0) { cs[i] = DIGITS[v - 1]!; break; }
    cs[i] = DIGITS[DIGITS.length - 1]!;
    // else borrow from the previous char
  }
  if (i < 0) return '0' + s; // first char rolled under
  return cs.join('');
}

/**
 * Fractional index: midpoint between prev and next (or below/above).
 * Uses the canonical `fractional-indexing` (rocicorp) base62 implementation for
 * valid keys — short keys (3 chars after 2000 appends), one-record insert.
 *
 * Legacy data (pre-2026-08) used non-canonical keys like `a20`/`a00`/`a200` that
 * the library rejects (they collapse to the same position as `a2`/`a0`). For
 * those we fall back to a bounded byte-order increment/decrement: monotone,
 * never grows unboundedly, never throws. Newly generated keys are always
 * canonical, so the fallback disappears as data is rewritten.
 */
export function midSortKey(prev: string | undefined, next: string | undefined): string {
  if (prev === undefined && next === undefined) return 'a0';
  if (prev === undefined) {
    try { return generateKeyBetween(null, next!); } catch { return decTail(next!); }
  }
  if (next === undefined) {
    try { return generateKeyBetween(prev, null); } catch { return incTail(prev); }
  }
  if (prev === next) {
    try { return generateKeyBetween(prev, null); } catch { return incTail(prev); }
  }
  try {
    return generateKeyBetween(prev, next);
  } catch {
    // Same position collision (legacy 'a2' vs 'a20'): place after prev.
    // New keys are canonical so this is a rare legacy-only path.
    return incTail(prev);
  }
}

/** Strict byte-order compare for fractional-order sort keys (never localeCompare). */
export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
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
