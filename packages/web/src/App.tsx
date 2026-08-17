import { useCallback, useEffect, useState } from 'react';
import {
  fetchOutline,
  resolveHandle,
  isDid,
} from './lib/atproto';
import {
  initOAuth,
  handleCallback,
  signIn,
  signOut,
  storedDids,
  getAuthorizedAgent,
  CLIENT_ID,
  REDIRECT_URI,
} from './lib/oauth';
import { buildTree, type OutlineData, type OutlineRow, type OutlineTreeNode } from './lib/outline-tree';
import { createBullet, putBullet, deleteBullet, midSortKey } from './lib/writes';
import { fetchOutlineRecord, writeOutlineRecord, type OutlineRecord } from './lib/root';

function rkeyFromUri(uri: string): string {
  return uri.slice(uri.lastIndexOf('/') + 1);
}
function didFromUri(uri: string): string {
  const m = uri.match(/at:\/\/([^/]+)\//);
  return m ? m[1]! : '';
}

function NodeView({
  node,
  depth,
  signedInAs,
  onAddChild,
  onToggleTodo,
  onDelete,
  onEdit,
  onSetRoot,
}: {
  node: OutlineTreeNode;
  depth: number;
  signedInAs: string | null;
  onAddChild: (parent: OutlineRow) => void;
  onToggleTodo: (row: OutlineRow) => void;
  onDelete: (row: OutlineRow) => void;
  onEdit: (row: OutlineRow) => void;
  onSetRoot: (row: OutlineRow) => void;
}) {
  const { text, layout, completedAt } = node.row;
  const mine = signedInAs && didFromUri(node.row.uri) === signedInAs;
  const cls = ['node'];
  if (layout && layout !== 'bullet') cls.push(layout);
  if (completedAt) cls.push('done');
  return (
    <li className={cls.join(' ')} style={{ marginLeft: depth > 0 ? '1.2rem' : undefined }}>
      <span className="bullet">{layout === 'todo' ? (completedAt ? '☑' : '☐') : '•'}</span>
      <span className="text">{text}</span>
      {mine && (
        <span className="actions">
          {layout === 'todo' && (
            <button className="link" onClick={() => onToggleTodo(node.row)}>
              {completedAt ? '↺' : '✓'}
            </button>
          )}
          <button className="link" onClick={() => onAddChild(node.row)} title="Add child bullet">
            +
          </button>
          <button className="link" onClick={() => onEdit(node.row)} title="Edit text">
            ✎
          </button>
          <button className="link" onClick={() => onSetRoot(node.row)} title="Make this the FoodWiki root">
            ●
          </button>
          <button className="link danger" onClick={() => onDelete(node.row)} title="Delete">
            ✕
          </button>
        </span>
      )}
      {node.children.length > 0 && (
        <ul className="children">
          {node.children.map((c) => (
            <NodeView
              key={c.row.uri}
              node={c}
              depth={depth + 1}
              signedInAs={signedInAs}
              onAddChild={onAddChild}
              onToggleTodo={onToggleTodo}
              onDelete={onDelete}
              onEdit={onEdit}
              onSetRoot={onSetRoot}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Return rows that are in the subtree rooted at `rootUri` (inclusive). */
function subtreeRows(rows: OutlineRow[], rootUri: string): OutlineRow[] {
  const byUri = new Map(rows.map((r) => [r.uri, r]));
  const isDescendant = (uri: string | undefined, ancestor: string): boolean => {
    let cur = uri;
    const seen = new Set<string>();
    while (cur) {
      if (seen.has(cur)) return false;
      seen.add(cur);
      if (cur === ancestor) return true;
      cur = byUri.get(cur)?.parent;
    }
    return false;
  };
  return rows.filter((r) => r.uri === rootUri || isDescendant(r.parent, rootUri));
}

function identityFromPath(path: string): string | null {
  const m = path.match(/^\/user\/([^/]+)(?:\/([^/]+))?\/?/);
  const g = m?.[1];
  return g ? decodeURIComponent(g) : null;
}
function rkeyFromPath(path: string): string | null {
  const m = path.match(/^\/user\/([^/]+)\/([^/]+)\/?/);
  const g = m?.[2];
  return g ? decodeURIComponent(g) : null;
}
function uriToRkey(uri: string): string {
  return uri.slice(uri.lastIndexOf('/') + 1);
}

export function App() {
  const [input, setInput] = useState('');
  const [did, setDid] = useState<string | null>(null);
  const [data, setData] = useState<OutlineData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [writeMsg, setWriteMsg] = useState<string | null>(null);
  const [outlineRec, setOutlineRec] = useState<OutlineRecord | null>(null);
  const [rootUri, setRootUri] = useState<string | null>(null);

  const DEFAULT = 'did:plc:kwclrfytscd4udqzmsv42rj3';

  const load = useCallback(async (target: string) => {
    setLoading(true);
    setError(null);
    try {
      const finalDid = isDid(target) ? target : (await resolveHandle(target)) ?? null;
      if (!finalDid) {
        setError(`Could not resolve "${target}" to a DID.`);
        setData(null);
        return;
      }
      setDid(finalDid);
      const res = await fetchOutline(finalDid);
      if (res.error) {
        setError(res.error);
        setData(null);
        return null;
      }
      setData(res.data);
      // fetch the author's outline record (rkey self) for root/title
      try {
        const rec = await fetchOutlineRecord(finalDid);
        setOutlineRec(rec);
        setRootUri(rec?.root ?? null);
      } catch {
        setOutlineRec(null);
        setRootUri(null);
      }
      return res.data;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Boot: init OAuth, check for callback, restore session, load default outline
  useEffect(() => {
    initOAuth();
    (async () => {
      if (window.location.pathname.startsWith('/oauth/callback')) {
        try {
          const { session } = await handleCallback();
          const sub = session.info.sub;
          setSignedInAs(sub);
          // clean the query string (no reload needed)
          window.history.replaceState({}, '', '/');
          // load that user's outline
          load(sub);
          return;
        } catch (e) {
          setAuthError(e instanceof Error ? e.message : String(e));
        }
      }
      // restore existing session
      const stored = storedDids();
      if (stored.length > 0) {
        setSignedInAs(stored[0]!);
      }
      const target = identityFromPath(window.location.pathname) ?? DEFAULT;
      setInput(target);
      const loaded = await load(target);
      const rk = rkeyFromPath(window.location.pathname);
      if (rk && loaded) {
        const full = loaded.rows.find((r) => r.uri.endsWith('/' + rk));
        if (full) setRootUri(full.uri);
      }
    })();
  }, [load]);

  // React to back/forward
  useEffect(() => {
    const onPop = () => {
      const target = identityFromPath(window.location.pathname);
      if (target) {
        setInput(target);
        load(target);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [load]);

  function navigate(target: string) {
    const clean = target.trim();
    if (!clean) return;
    const path = `/user/${encodeURIComponent(clean)}/`;
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setInput(clean);
    load(clean);
  }

  async function doSignIn(handle: string) {
    setAuthError(null);
    try {
      await signIn(handle.trim());
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e));
    }
  }

  async function doSignOut() {
    if (!signedInAs) return;
    await signOut(signedInAs);
    setSignedInAs(null);
  }

  async function requireClient(): Promise<{ client: Awaited<ReturnType<typeof getAuthorizedAgent>>['client']; did: string }> {
    if (!signedInAs) throw new Error('not signed in');
    const { client } = await getAuthorizedAgent(signedInAs);
    return { client, did: signedInAs };
  }

  const refreshOwn = async () => {
    if (did) await load(did);
  };

  async function addChild(parent: OutlineRow) {
    try {
      const { client, did: myDid } = await requireClient();
      // find sibling sortKeys under the same parent
      const siblings = data?.rows.filter((r) => (r.parent ?? undefined) === (parent.parent ?? undefined) && r.parent === parent.uri);
      // simpler: children of this parent
      const children = data?.rows.filter((r) => r.parent === parent.uri) ?? [];
      const keys = children.map((c) => c.sortKey).sort();
      const parentUri = parent.uri;
      const text = prompt('New child bullet text:');
      if (text === null) return;
      const sortKey = midSortKey(keys[keys.length - 1] ?? undefined, undefined);
      await createBullet(client, myDid, {
        text,
        sortKey,
        parent: parentUri,
        layout: 'bullet',
        createdAt: new Date().toISOString(),
      });
      setWriteMsg('Added ✓');
      await refreshOwn();
    } catch (e) {
      setWriteMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    window.setTimeout(() => setWriteMsg(null), 3000);
  }

  async function toggleTodo(row: OutlineRow) {
    try {
      const { client, did: myDid } = await requireClient();
      const completed = row.completedAt ? undefined : new Date().toISOString();
      await putBullet(client, myDid, rkeyFromUri(row.uri), {
        text: row.text,
        sortKey: row.sortKey,
        createdAt: row.createdAt,
        parent: row.parent,
        layout: row.layout,
        completedAt: completed,
      });
      await refreshOwn();
    } catch (e) {
      setWriteMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    window.setTimeout(() => setWriteMsg(null), 3000);
  }

  async function editText(row: OutlineRow) {
    try {
      const newText = prompt('Edit bullet text:', row.text);
      if (newText === null) return;
      const { client, did: myDid } = await requireClient();
      await putBullet(client, myDid, rkeyFromUri(row.uri), {
        text: newText,
        sortKey: row.sortKey,
        createdAt: row.createdAt,
        parent: row.parent,
        layout: row.layout,
        completedAt: row.completedAt,
      });
      await refreshOwn();
    } catch (e) {
      setWriteMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    window.setTimeout(() => setWriteMsg(null), 3000);
  }

  async function setRoot(row: OutlineRow) {
    try {
      const { client, did: myDid } = await requireClient();
      await writeOutlineRecord(client, myDid, { root: row.uri });
      setRootUri(row.uri);
      setWriteMsg('FoodWiki root set ✓');
      if (did) {
        const path = `/user/${encodeURIComponent(did)}/${encodeURIComponent(uriToRkey(row.uri))}/`;
        if (window.location.pathname !== path) window.history.pushState({}, '', path);
      }
      await load(myDid);
    } catch (e) {
      setWriteMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    window.setTimeout(() => setWriteMsg(null), 3000);
  }

  async function clearRoot() {
    try {
      const { client, did: myDid } = await requireClient();
      await writeOutlineRecord(client, myDid, { root: undefined });
      setRootUri(null);
      setWriteMsg('Back to whole-account view ✓');
      if (did) {
        const path = `/user/${encodeURIComponent(did)}/`;
        if (window.location.pathname !== path) window.history.pushState({}, '', path);
      }
      await load(myDid);
    } catch (e) {
      setWriteMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    window.setTimeout(() => setWriteMsg(null), 3000);
  }

  async function remove(row: OutlineRow) {
    try {
      const { client, did: myDid } = await requireClient();
      await deleteBullet(client, myDid, rkeyFromUri(row.uri));
      await refreshOwn();
    } catch (e) {
      setWriteMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    window.setTimeout(() => setWriteMsg(null), 3000);
  }

  const title = outlineRec?.title ?? data?.outline?.title ?? data?.handle ?? (did ?? 'FoodWiki');
  const scopedRows = rootUri ? subtreeRows(data?.rows ?? [], rootUri) : (data?.rows ?? []);
  const rootRow = rootUri ? (data?.rows.find((r) => r.uri === rootUri) ?? null) : null;

  return (
    <main className="app">
      <header className="topbar">
        <h1>🍲 FoodWiki</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate(input);
          }}
          className="did-form"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="bmann.ca or did:plc:..."
            aria-label="Identity"
          />
          <button type="submit">Go</button>
        </form>
        <div className="auth">
          {signedInAs ? (
            <>
              <span className="who">
                👤 <code>{signedInAs.slice(0, 20)}…</code>
              </span>
              <button className="link" onClick={doSignOut}>
                sign out
              </button>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const h = new FormData(e.currentTarget).get('handle') as string;
                if (h.trim()) doSignIn(h);
              }}
              className="signin"
            >
              <input name="handle" placeholder="your.bsky.social" aria-label="Handle to sign in" />
              <button type="submit">Sign in</button>
            </form>
          )}
        </div>
      </header>

      {error && <p className="error">⚠️ {error}</p>}
      {authError && <p className="error">🔐 {authError}</p>}
      {writeMsg && <p className="status">{writeMsg}</p>}
      {loading && <p className="status">Loading…</p>}

      {data && (
        <section className="outline">
          <h2>{title}</h2>
          {rootUri && (
            <p className="rootbanner">
              🌱 Viewing subtree rooted at {rootRow ? <em>“{rootRow.text.slice(0, 40)}”</em> : <code>{uriToRkey(rootUri)}</code>}
              {signedInAs === did && (
                <button className="link" onClick={clearRoot}>
                  clear root
                </button>
              )}
            </p>
          )}
          <p className="meta">
            {did && <code>{did}</code>}
            {scopedRows.length > 0 && (
              <span className="count">
                {scopedRows.length} {scopedRows.length === 1 ? 'bullet' : 'bullets'}
              </span>
            )}
            {data.truncated && <span className="truncated">(truncated)</span>}
          </p>
          {scopedRows.length === 0 ? (
            <p className="empty">
              {signedInAs ? 'No bullets yet — add one below.' : 'No bullets yet — this garden is a blank slate.'}
            </p>
          ) : (
            <ul className="nodes">
              {buildTree(scopedRows).map((n) => (
                <NodeView
                  key={n.row.uri}
                  node={n}
                  depth={0}
                  signedInAs={signedInAs}
                  onAddChild={addChild}
                  onToggleTodo={toggleTodo}
                  onDelete={remove}
                  onEdit={editText}
                  onSetRoot={setRoot}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
