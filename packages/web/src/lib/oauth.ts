// AT Protocol OAuth (browser) -- @atcute/oauth-browser-client.
// The web app is a third-party public client registered on the FoodWiki AppView
// (HappyView). Client metadata is served from /oauth-client-metadata.json.
import { Client, type FetchHandlerObject } from '@atcute/client';
import type { ActorIdentifier } from '@atcute/lexicons';
import {
  configureOAuth,
  createAuthorizationUrl,
  finalizeAuthorization,
  getSession,
  deleteStoredSession,
  listStoredSessions,
  OAuthUserAgent,
  type Session,
} from '@atcute/oauth-browser-client';
import {
  CompositeDidDocumentResolver,
  LocalActorResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  XrpcHandleResolver,
} from '@atcute/identity-resolver';

export const APPVIEW_URL =
  import.meta.env.VITE_APPVIEW_URL ?? 'https://happyview-atproto-foodwiki-production.up.railway.app';

// client_id = the URL where the client metadata itself is hosted (our SPA).
export const CLIENT_ID = `${window.location.origin}/oauth-client-metadata.json`;
export const REDIRECT_URI = `${window.location.origin}/oauth/callback`;

export const REQUEST_SCOPE = 'atproto transition:generic include:app.bulleted.authFull';

export function initOAuth() {
  configureOAuth({
    metadata: {
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
    },
    identityResolver: new LocalActorResolver({
      handleResolver: new XrpcHandleResolver({
        serviceUrl: 'https://public.api.bsky.app',
      }),
      didDocumentResolver: new CompositeDidDocumentResolver({
        methods: {
          plc: new PlcDidDocumentResolver(),
          web: new WebDidDocumentResolver(),
        },
      }),
    }),
  });
}

export async function signIn(identifier: string): Promise<never> {
  const url = await createAuthorizationUrl({
    target: { type: 'account', identifier: identifier as ActorIdentifier },
    scope: REQUEST_SCOPE,
  });
  // let the browser persist the auth state before leaving
  await new Promise((r) => setTimeout(r, 200));
  window.location.assign(url.toString());
  throw new Error('redirecting');
}

/** Handle the OAuth callback. Params may arrive in hash or search. */
export async function handleCallback(): Promise<{ session: Session; state: unknown }> {
  const raw = window.location.hash.slice(1) || window.location.search.slice(1);
  const params = new URLSearchParams(raw);
  const { session, state } = await finalizeAuthorization(params);
  // scrub params to prevent replay
  window.history.replaceState({}, '', window.location.pathname);
  return { session, state };
}

export function storedDids(): string[] {
  return listStoredSessions();
}

export async function getAuthorizedAgent(did: string): Promise<{ client: Client; agent: OAuthUserAgent; session: Session }> {
  const session = await getSession(did as `did:${string}:${string}`, { allowStale: true });
  const agent = new OAuthUserAgent(session);
  // README-blessed pattern: `new Client({ handler: agent })`. The private field
  // trips TS structural typing; cast to the handler interface.
  const client = new Client({ handler: agent as unknown as FetchHandlerObject });
  return { client, agent, session };
}

export async function signOut(did: string) {
  try {
    const { agent } = await getAuthorizedAgent(did);
    await agent.signOut();
  } catch {
    // local clear regardless
  }
  deleteStoredSession(did as `did:${string}:${string}`);
}
