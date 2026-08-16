import { useEffect, useState } from 'react';
import type { OutlineOutput } from '@foodwiki/lexicons';
import { rpc, getOutline } from './lib/atproto';
import type { OutlineParams } from '@foodwiki/lexicons';
import { buildTree, type OutlineTreeNode } from './lib/outline-tree';

// Dev default: the appview's own account (foodwiki.bmann.ca) — will hold the first garden content.
const DEFAULT_DID = 'did:plc:kwclrfytscd4udqzmsv42rj3';

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

export function App() {
  const [did, setDid] = useState<OutlineParams['did']>(DEFAULT_DID);
  const [outline, setOutline] = useState<OutlineOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(target: OutlineParams['did']) {
    setLoading(true);
    setError(null);
    try {
      const data = await getOutline(rpc, { did: target, depth: 5, limit: 100 });
      setOutline(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setOutline(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(did);
  }, [did]);

  const title =
    outline?.outline?.title ?? (outline?.handle ? `${outline.handle}'s FoodWiki` : outline?.did ?? 'FoodWiki');

  return (
    <main className="app">
      <header className="topbar">
        <h1>🍲 FoodWiki</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = (new FormData(e.currentTarget).get('did') as string).trim();
            if (/^did:[^:]+:[^:]+$/.test(input)) setDid(input as OutlineParams['did']);
            else setError('Enter a valid DID, e.g. did:plc:...');
          }}
          className="did-form"
        >
          <input name="did" defaultValue={did} placeholder="DID or handle" aria-label="Identity" />
          <button type="submit">Load</button>
        </form>
      </header>

      {error && <p className="error">⚠️ {error}</p>}
      {loading && <p className="status">Loading…</p>}

      {outline && (
        <section className="outline">
          <h2>{title}</h2>
          <p className="meta">
            <code>{outline.did}</code>
            {outline.truncated && <span className="truncated"> (truncated)</span>}
          </p>
          {outline.nodes.length === 0 ? (
            <p className="empty">No bullets yet — the garden is a blank slate. Auth is coming in Phase 5.</p>
          ) : (
            <ul className="nodes">
              {buildTree(outline.nodes).map((n) => (
                <NodeView key={n.row.uri} node={n} depth={0} />
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
