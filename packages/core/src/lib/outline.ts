import type { Client } from '@atcute/client';
import type { OutlineParams, OutlineOutput } from '@foodwiki/lexicons';

/** Fetch the public Bulleted outline for a DID (flat pre-order node list). */
export async function getOutline(
  rpc: Client,
  params: OutlineParams,
): Promise<OutlineOutput> {
  const res = await rpc.get('app.bulleted.getOutline', { params });
  if (!res.ok) throw new Error(`outline error: ${res.data.error}`);
  return res.data;
}
