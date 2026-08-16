import { useCallback, useEffect, useState } from 'react';
import { fetchOutline, resolveHandle, isDid } from './lib/atproto';
import { buildTree, type OutlineData, type OutlineRow, type OutlineTreeNode } from './lib/outline-tree';

function NodeView({ node, depth }: { node: OutlineTreeNode; depth: number }) {
  const { text, layout, completedAt, childCount } = node.row;
  const cls = ['node'];
  if (layout && layout !== 'bullet') cls.push(layout);
  if (completedAt) cls.push('done');
  return (
    <li className={cls.join(' ')} style={{ marginLeft: depth > 0 ? '1.2rem' : undefined }}>
      <span className="bullet">{layout === 'todo' ? (completedAt ? '☑' : '☐') : '•'}</span>
      <span className="text">{text}</span>
      {typeof childCount === 'number' && childCount > 0 && !node.children?.length && (
        <span className="count" title={`${childCount} more nested`}>
          +{childCount}
        </span>
      )}
      {node.children.length > 0 && (
        <ul className="children">
          {node.children.map((c) => (
            <NodeView key={c.row.uri} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function identityFromPath(path: string): string | null {
  const m = path.match(/^\/user\/([^/]+)\/?/);
  const g = m?.[1];
  return g ? decodeURIComponent(g) : null;
}

export function App() {
  const pathIdentity = identityFromPath(window.location.pathname);
  const [input, setInput] = useState(pathIdentity ?? '');
  const [did, setDid] = useState<string | null>(null); // resolved DID
  const [data, setData] = useState<OutlineData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Default landing: our own appview identity (foodwiki.bmann.ca).
  const DEFAULT = 'did:plc:kwclrfytscd4udqzmsv42rj3';

  const load = useCallback(async (target: string, fromPath?: string) => {
    setLoading(true);
    setError(null);
    const show = (d: OutlineData | null, err: string | null) => {
      setData(d);
      setError(err);
      setLoading(false);
    };
    try {
      // Accept DIDs or handles. Resolve handles → DID.
      const finalDid = isDid(target) ? target : await resolveHandle(target);
      if (!finalDid) {
        show(null, `Could not resolve "${target}" to a DID. Try a full did:plc:... or a handle like bmann.ca`);
        return;
      }
      setDid(finalDid);
      const res = await fetchOutline(finalDid);
      if (res.error) {
        show(null, res.error);
        return;
      }
      show(res.data, null);
    } catch (e) {
      show(null, e instanceof Error ? e.message : String(e));
    }
  }, []);

  // On mount or path change: load identity at path (or default)
  useEffect(() => {
    const target = identityFromPath(window.location.pathname) ?? DEFAULT;
    setInput(target);
    load(target, window.location.pathname);
    // eslint-disables are not needed; path change reloads via popstate/hash below.
  }, [load]);

  // React to back/forward navigation.
  useEffect(() => {
    const onPop = () => {
      const target = identityFromPath(window.location.pathname);
      if (target) load(target);
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

  const handleInput = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(input);
  };

  const title =
    data?.outline?.title ??
    data?.handle ??
    (data?.did === did ? did ?? 'FoodWiki' : did ?? 'FoodWiki');

  return (
    <main className="app">
      <header className="topbar">
        <h1>🍲 FoodWiki</h1>
        <form onSubmit={handleInput} className="did-form">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="bmann.ca or did:plc:..."
            aria-label="Identity"
          />
          <button type="submit">Go</button>
        </form>
      </header>

      {error && <p className="error">⚠️ {error}</p>}
      {loading && <p className="status">Loading…</p>}

      {data && (
        <section className="outline">
          <h2>{title}</h2>
          <p className="meta">
            <a className="did-link" href={`/user/${encodeURIComponent(data.did ?? did ?? '')}/`}>
              {data.did ? <code>{data.did}</code> : did ? <code>{did}</code> : null}
            </a>
            {data.rows.length > 0 && (
              <span className="count">{data.rows.length} {data.rows.length === 1 ? 'bullet' : 'bullets'}</span>
            )}
            {data.truncated && <span className="truncated"> (truncated)</span>}
          </p>
          {data.rows.length === 0 ? (
            <p className="empty">No bullets yet — this garden is a blank slate.</p>
          ) : (
            <ul className="nodes">
              {buildTree(data.rows).map((n) => (
                <NodeView key={n.row.uri} node={n} depth={0} />
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
