import { Client, simpleFetchHandler } from '@atcute/client';

/** Create a public (unauthenticated) XRPC client to an atproto service. */
export function createClient(service: string | URL): Client {
  return new Client({ handler: simpleFetchHandler({ service }) });
}
