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
import { fetchOutlineRecord, writeOutlineRecord, deleteOutlineRecord, listOutlineRecords, type OutlineRecord } from './lib/root';

function rkeyFromUri(uri: string): string {
  return uri.slice(uri.lastIndexOf('/') + 1);
}
function didFromUri(uri: string): string {
  const m = uri.match(/at:\/\/([^/]+)\//);
  return m ? m[1]! : '';
}

/** Flatten rows into a sorted (by sortKey) tree walk with depth, for indented selects. */
function flattenRows(rows: OutlineRow[]): { row: OutlineRow; depth: number }[] {
  const byParent = new Map<string | undefined, OutlineRow[]>();
  for (const r of rows) {
    const k = r.parent ?? undefined;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(r);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const out: { row: OutlineRow; depth: number }[] = [];
  const walk = (parent: string | undefined, depth: number) => {
    for (const r of byParent.get(parent) ?? []) {
      out.push({ row: r, depth });
      walk(r.uri, depth + 1);
    }
  };
  walk(undefined, 0);
  return out;
}

function NodeView({
  node,
  depth,
  signedInAs,
  selectedUri,
  editingUri,
  onSelect,
  onEdit,
  onToggleTodo,
  editingText,
  onEditingText,
  onSaveEdit,
  onCancelEdit,
  onEnterFromEdit,
}: {
  node: OutlineTreeNode;
  depth: number;
  signedInAs: string | null;
  selectedUri: string | null;
  editingUri: string | null;
  onSelect: (row: OutlineRow) => void;
  onEdit: (row: OutlineRow) => void;
  onToggleTodo: (row: OutlineRow) => void;
  editingText: string;
  onEditingText: (t: string) => void;
  onSaveEdit: (row: OutlineRow, text: string) => void;
  onCancelEdit: () => void;
  /** Enter in the edit box: save current + insert a new sibling below (same level). */
  onEnterFromEdit: (row: OutlineRow, text: string) => void;
}) {
  const { row } = node;
  const { text, layout, completedAt } = row;
  const mine = signedInAs && didFromUri(row.uri) === signedInAs;
  const selected = selectedUri === row.uri;
  const editing = editingUri === row.uri;
  const cls = ['node'];
  if (layout && layout !== 'bullet') cls.push(layout);
  if (completedAt) cls.push('done');
  if (selected) cls.push('selected');
  if (editing) cls.push('editing');

  return (
    <li className={cls.join(' ')} style={{ marginLeft: depth > 0 ? '1.1rem' : undefined }}>
      {editing ? (
        <div className="edit-row">
          <span className="bullet">{layout === 'todo' ? (completedAt ? '☑' : '☐') : '•'}</span>
          <textarea
            className="editor"
            value={editingText}
            rows={Math.max(1, editingText.split('\n').length)}
            autoFocus
            enterKeyHint="enter"
            placeholder="Type… Enter adds a bullet on the same level · Shift+Enter newline · Esc cancel"
            onChange={(e) => onEditingText(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return; // IME composition (mobile CJK)
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onEnterFromEdit(row, editingText.trim());
              } else if (e.key === 'Escape') {
                onCancelEdit();
              }
            }}
            aria-label="Edit bullet text"
          />
          <span className="editor-actions">
            <button className="link" onClick={() => onSaveEdit(row, editingText.trim())} title="Save">✓</button>
            <button className="link danger" onClick={onCancelEdit} title="Cancel">✕</button>
          </span>
        </div>
      ) : (
        <>
          <span
            className={'bullet' + (layout === 'todo' ? ' bullet-toggle' : '')}
            onClick={() => (layout === 'todo' && mine ? onToggleTodo(row) : onSelect(row))}
            title={layout === 'todo' && mine ? 'Toggle done' : undefined}
          >
            {layout === 'todo' ? (completedAt ? '☑' : '☐') : '•'}
          </span>
          <span className="text" onClick={() => onSelect(row)}>
            {text}
          </span>
          {mine && (
            <button className="row-edit" onClick={() => onEdit(row)} title="Edit" aria-label="Edit">
              ✎
            </button>
          )}
        </>
      )}
      {node.children.length > 0 && (
        <ul className="children">
          {node.children.map((c) => (
            <NodeView
              key={c.row.uri}
              node={c}
              depth={depth + 1}
              signedInAs={signedInAs}
              selectedUri={selectedUri}
              editingUri={editingUri}
              onSelect={onSelect}
              onEdit={onEdit}
              onToggleTodo={onToggleTodo}
              editingText={editingText}
              onEditingText={onEditingText}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              onEnterFromEdit={onEnterFromEdit}
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

/** Inline settings: edit garden title/description + pick the FoodWiki root bullet. */
function SettingsPane({
  rec,
  rows,
  myDid,
  rootUri,
  level,
  onSave,
  onSaveRoot,
  onClose,
}: {
  rec: OutlineRecord | null;
  rows: OutlineRow[];
  myDid: string | null;
  rootUri: string | null;
  level: string; // 'self' = whole forest, else subtree rkey
  onSave: (title: string, description: string) => void;
  onSaveRoot: (uri: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(rec?.title ?? '');
  const [description, setDescription] = useState(rec?.description ?? '');
  // Sync when the outline record at this level (re)loads — e.g. after sign-in or navigation.
  useEffect(() => {
    setTitle(rec?.title ?? '');
    setDescription(rec?.description ?? '');
  }, [rec]);
  const flat = flattenRows(rows);
  const isSubtree = level !== 'self';

  return (
    <section className="settings">
      <h2>Garden Settings</h2>
      <p className="hint">
        {isSubtree ? (
          <>Editing the outline at <code>rkey {level}</code> (this subtree). Title and description apply to this level.</>
        ) : (
          <>Editing your whole-account outline (<code>rkey self</code>).</>
        )}
      </p>
      <label className="field">
        <span>Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. My FoodWiki"
          aria-label="Garden title"
        />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="A sentence or two about this garden…"
          aria-label="Garden description"
        />
      </label>
      {myDid && (
        <label className="field">
          <span>FoodWiki root bullet</span>
          <select
            value={rootUri ?? ''}
            onChange={(e) => onSaveRoot(e.target.value)}
            aria-label="FoodWiki root bullet"
          >
            <option value="">Whole account (no root)</option>
            {flat.map(({ row, depth }) => (
              <option key={row.uri} value={row.uri}>
                {'　'.repeat(Math.min(depth, 4))}
                {row.text.length > 60 ? row.text.slice(0, 60) + '…' : row.text}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="settings-actions">
        <button onClick={() => onSave(title, description)}>Save</button>
        <button className="link" onClick={onClose}>
          Close
        </button>
      </p>
      <p className="hint">
        The root bullet sets the entry point of your FoodWiki garden. Choose “Whole account (no root)” to show every bullet.
        {isSubtree && ' You are currently viewing a subtree — picking a root here jumps to that bullet\u2019s level; “Whole account” returns to your whole forest.'}
      </p>
    </section>
  );
}


function ActionBar({
  mine,
  selected,
  isRoot,
  showRootBtn,
  onAddChild,
  onEdit,
  onMoveUp,
  onMoveDown,
  onIndent,
  onOutdent,
  onSetRoot,
  onDelete,
  onClose,
  inlineText,
}: {
  mine: boolean;
  selected: OutlineRow | null;
  isRoot: boolean;
  showRootBtn: boolean;
  onAddChild?: () => void;
  onEdit?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onIndent?: () => void;
  onOutdent?: () => void;
  onSetRoot?: () => void;
  onDelete?: () => void;
  onClose: () => void;
  inlineText?: string;
}) {
  if (!selected) return null;
  return (
    <div className="actionbar">
      <div className="actionbar-row">
        {mine && (
          <>
            <button className="ab" onClick={onMoveUp} title="Move up" aria-label="Move up">▲</button>
            <button className="ab" onClick={onMoveDown} title="Move down" aria-label="Move down">▼</button>
            <button className="ab" onClick={onIndent} title="Indent (make child of previous)" aria-label="Indent">⤶</button>
            <button className="ab" onClick={onOutdent} title="Outdent (sibling of parent)" aria-label="Outdent">⤺</button>
            <button className="ab" onClick={onAddChild} title="Add child bullet" aria-label="Add child bullet">＋</button>
            <button className="ab" onClick={onEdit} title="Edit" aria-label="Edit">✎</button>
            {onSetRoot && (
              <button
                className={isRoot ? 'ab on' : 'ab'}
                onClick={isRoot ? undefined : onSetRoot}
                title={isRoot ? 'This is the FoodWiki root' : 'Make this the FoodWiki root'}
                aria-label="Make this the FoodWiki root"
              >
                ●
              </button>
            )}
            <button className="ab danger" onClick={onDelete} title="Delete" aria-label="Delete">🗑</button>
          </>
        )}
        <button className="ab" onClick={onClose} title="Close" aria-label="Close">✕</button>
      </div>
      <div className="actionbar-text">{inlineText ? inlineText.slice(0, 60) : '—'}</div>
    </div>
  );
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
  const [outlineRkey, setOutlineRkey] = useState<string>('self'); // 'self' = whole forest; else subtree rkey
  const [showSettings, setShowSettings] = useState(false);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [editingUri, setEditingUri] = useState<string | null>(null);
  const [editingIsNew, setEditingIsNew] = useState(false); // editing a freshly created (empty) bullet
  const [editingText, setEditingTextState] = useState('');
  const [topAddText, setTopAddText] = useState('');
  const [addChildTarget, setAddChildTarget] = useState<OutlineRow | null>(null);

  const DEFAULT = 'did:plc:kwclrfytscd4udqzmsv42rj3';

  const load = useCallback(async (target: string, targetRkey?: string | null) => {
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
      // Which outline record is "in effect" at this level: 'self' = whole forest, else the subtree rkey.
      let levelRkey = targetRkey && targetRkey !== 'self' ? targetRkey : 'self';
      try {
        let all = await listOutlineRecords(finalDid).catch(() => new Map<string, OutlineRecord>());
        let rec = await fetchOutlineRecord(finalDid, levelRkey).catch(() => null);
        // For a subtree, the record may have been written at the ancestor (self) — inherit its title/desc.
        let recInherited: OutlineRecord | null = rec;
        if (levelRkey !== 'self' && !rec) {
          recInherited = await fetchOutlineRecord(finalDid, 'self').catch(() => null);
        }
        // FoodWiki-root convention: if the user has exactly ONE subtree outline record
        // (an rkey != 'self' with a root), that IS their FoodWiki root. The user page
        // (self level) then honors it, showing the root's children as the garden.
        let effectiveRoot: string | null = null;
        if (levelRkey === 'self' && !all.has('self')) {
          // No whole-forest record: the single subtree outline record is the user's FoodWiki root.
          const subs = [...all.entries()].filter(([rk]) => rk !== 'self');
          if (subs.length === 1 && subs[0]![1].root) {
            effectiveRoot = subs[0]![1].root!;
            levelRkey = subs[0]![0];
            // reload the record for that level (title/desc inherit from the subtree)
            const subRec = await fetchOutlineRecord(finalDid, levelRkey).catch(() => null);
            if (subRec) recInherited = subRec;
          }
        }
        setOutlineRkey(levelRkey);
        setOutlineRec(recInherited);
        // Scoping: subtree record's root, else the zoomed bullet itself (URL zoom even without a record).
        let scope: string | null = effectiveRoot ?? null;
        if (levelRkey !== 'self' && !scope) {
          const bullet = res.data.rows.find((r) => r.uri.endsWith('/' + levelRkey));
          scope = rec?.root ?? (bullet?.uri ?? null);
        }
        setRootUri(scope);
      } catch {
        setOutlineRec(null);
        setOutlineRkey(levelRkey);
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
      const rk = rkeyFromPath(window.location.pathname);
      await load(target, rk);
    })();
  }, [load]);

  // React to back/forward
  useEffect(() => {
    const onPop = () => {
      const target = identityFromPath(window.location.pathname);
      if (target) {
        setInput(target);
        load(target, rkeyFromPath(window.location.pathname));
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
    if (did) await load(did, outlineRkey === 'self' ? undefined : outlineRkey);
  };

  async function addChild(parent: OutlineRow, text: string) {
    try {
      const { client, did: myDid } = await requireClient();
      const children = data?.rows.filter((r) => r.parent === parent.uri) ?? [];
      const keys = children.map((c) => c.sortKey).sort();
      const sortKey = midSortKey(keys[keys.length - 1] ?? undefined, undefined);
      await createBullet(client, myDid, {
        text,
        sortKey,
        parent: parent.uri,
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

  async function editText(row: OutlineRow, text: string) {
    try {
      const { client, did: myDid } = await requireClient();
      await putBullet(client, myDid, rkeyFromUri(row.uri), {
        text,
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
      // Subtree outline record: rkey = the bullet's rkey, root = its at-uri
      await writeOutlineRecord(client, myDid, rkeyFromUri(row.uri), { root: row.uri });
      setRootUri(row.uri);
      setOutlineRkey(rkeyFromUri(row.uri));
      setWriteMsg('FoodWiki root set ✓');
      if (did) {
        const path = `/user/${encodeURIComponent(did)}/${encodeURIComponent(uriToRkey(row.uri))}/`;
        if (window.location.pathname !== path) window.history.pushState({}, '', path);
      }
      await load(myDid, rkeyFromUri(row.uri));
    } catch (e) {
      setWriteMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    window.setTimeout(() => setWriteMsg(null), 3000);
  }

  async function clearRoot() {
    try {
      const { client, did: myDid } = await requireClient();
      const subRkey = outlineRkey !== 'self' ? outlineRkey : null;
      if (subRkey) {
        await deleteOutlineRecord(client, myDid, subRkey);
      }
      setRootUri(null);
      setOutlineRkey('self');
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

  /** Save title/description/root at the CURRENT view level (self or subtree). */
  async function saveSettings(title: string, description: string) {
    try {
      const { client, did: myDid } = await requireClient();
      const rkey = outlineRkey !== 'self' ? outlineRkey : 'self';
      await writeOutlineRecord(client, myDid, rkey, {
        title: title.trim() || undefined,
        description: description.trim() || undefined,
      });
      setWriteMsg('Settings saved ✓');
      await load(myDid, rkey === 'self' ? undefined : rkey);
    } catch (e) {
      setWriteMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    window.setTimeout(() => setWriteMsg(null), 3000);
  }

  /** Pick root from the settings page selector: '' = whole account (clear), else root = that bullet. */
  async function saveRootFromSettings(uri: string) {
    try {
      const { client, did: myDid } = await requireClient();
      if (uri === '' || uri === myDid) {
        // Clear: delete the current subtree outline record, return to whole-forest
        if (outlineRkey !== 'self') {
          await deleteOutlineRecord(client, myDid, outlineRkey);
        }
        setRootUri(null);
        setOutlineRkey('self');
        setWriteMsg('Back to whole-account view ✓');
        if (did) {
          const path = `/user/${encodeURIComponent(did)}/`;
          if (window.location.pathname !== path) window.history.pushState({}, '', path);
        }
        await load(myDid);
      } else {
        const rkey = rkeyFromUri(uri);
        await writeOutlineRecord(client, myDid, rkey, { root: uri });
        setRootUri(uri);
        setOutlineRkey(rkey);
        setWriteMsg('FoodWiki root updated ✓');
        if (did) {
          const path = `/user/${encodeURIComponent(did)}/${encodeURIComponent(rkey)}/`;
          if (window.location.pathname !== path) window.history.pushState({}, '', path);
        }
        await load(myDid, rkey);
      }
    } catch (e) {
      setWriteMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    window.setTimeout(() => setWriteMsg(null), 3000);
  }

  // --- outline editing helpers (Workflowy-style) ---

  /** Rows grouped by parent for sibling math. */
  function siblingsOf(row: OutlineRow): OutlineRow[] {
    return (data?.rows ?? []).filter((r) => (r.parent ?? undefined) === (row.parent ?? undefined)).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }

  /** Insert a new bullet as the next sibling below `row` (same parent). Returns new URI. */
  async function insertSiblingBelow(row: OutlineRow, text: string): Promise<string | null> {
    try {
      const { client, did: myDid } = await requireClient();
      const sibs = siblingsOf(row);
      const idx = sibs.findIndex((r) => r.uri === row.uri);
      const next = idx >= 0 ? sibs[idx + 1] : undefined;
      const sortKey = midSortKey(row.sortKey, next?.sortKey);
      const uri = await createBullet(client, myDid, {
        text,
        sortKey,
        parent: row.parent,
        layout: 'bullet',
        createdAt: new Date().toISOString(),
      });
      await refreshOwn();
      return uri;
    } catch (e) {
      setWriteMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  /** Enter in an edit box: save the current bullet, then create a new sibling below and edit it. */
  async function enterFromEdit(row: OutlineRow, text: string) {
    // Save the current bullet first (if it's an old bullet with changed text,
    // or a new empty one that now has text).
    if (editingIsNew) {
      // The "new" bullet: if it has text now, persist it; then create the NEXT one.
      if (text) {
        try {
          const { client, did: myDid } = await requireClient();
          await putBullet(client, myDid, rkeyFromUri(row.uri), {
            text,
            sortKey: row.sortKey,
            createdAt: row.createdAt,
            parent: row.parent,
            layout: row.layout,
            completedAt: row.completedAt,
          });
          await refreshOwn();
        } catch (e) {
          setWriteMsg(`Error saving: ${e instanceof Error ? e.message : String(e)}`);
          window.setTimeout(() => setWriteMsg(null), 3000);
          return; // don't advance if save failed
        }
      }
    } else if (text && text !== row.text) {
      await editText(row, text); // save existing bullet
    }
    // create the next bullet at the same level, empty, and immediately edit it
    const uri = await insertSiblingBelow(row, '');
    if (uri) {
      setEditingUri(uri);
      setEditingIsNew(true);
      setEditingTextState('');
      setSelectedUri(uri);
    } else {
      cancelEdit(); // write failed; leave the saved bullet
    }
  }

  async function moveRow(row: OutlineRow, dir: -1 | 1) {
    try {
      const { client, did: myDid } = await requireClient();
      const sibs = siblingsOf(row);
      const idx = sibs.findIndex((r) => r.uri === row.uri);
      const swap = sibs[idx + dir];
      if (!swap) return; // already at edge
      // swap sortKeys
      await putBullet(client, myDid, rkeyFromUri(row.uri), {
        text: row.text,
        sortKey: swap.sortKey,
        createdAt: row.createdAt,
        parent: row.parent,
        layout: row.layout,
        completedAt: row.completedAt,
      });
      await putBullet(client, myDid, rkeyFromUri(swap.uri), {
        text: swap.text,
        sortKey: row.sortKey,
        createdAt: swap.createdAt,
        parent: swap.parent,
        layout: swap.layout,
        completedAt: swap.completedAt,
      });
      await refreshOwn();
    } catch (e) {
      setWriteMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    window.setTimeout(() => setWriteMsg(null), 3000);
  }

  async function indentRow(row: OutlineRow) {
    try {
      const { client, did: myDid } = await requireClient();
      // find previous sibling at the same level → become its child
      const sibs = siblingsOf(row);
      const idx = sibs.findIndex((r) => r.uri === row.uri);
      const prev = sibs[idx - 1];
      if (!prev) return;
      const newParent = prev.uri;
      // new sortKey: after last child of prev
      const children = (data?.rows ?? []).filter((r) => r.parent === newParent).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
      const sortKey = children.length ? midSortKey(children[children.length - 1]!.sortKey, undefined) : 'a0';
      await putBullet(client, myDid, rkeyFromUri(row.uri), {
        text: row.text,
        sortKey,
        createdAt: row.createdAt,
        parent: newParent,
        layout: row.layout,
        completedAt: row.completedAt,
      });
      await refreshOwn();
    } catch (e) {
      setWriteMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    window.setTimeout(() => setWriteMsg(null), 3000);
  }

  async function outdentRow(row: OutlineRow) {
    try {
      const { client, did: myDid } = await requireClient();
      if (!row.parent) return; // already top level
      // find the parent row; the row becomes a sibling AFTER the parent
      const parent = (data?.rows ?? []).find((r) => r.uri === row.parent);
      if (!parent) return;
      const newParent = parent.parent;
      // sortKey: after the previous parent itself → insert right after it
      const pSibs = siblingsOf(parent);
      const idx = pSibs.findIndex((r) => r.uri === parent.uri);
      const next = idx >= 0 ? pSibs[idx + 1] : undefined;
      const sortKey = midSortKey(parent.sortKey, next?.sortKey);
      await putBullet(client, myDid, rkeyFromUri(row.uri), {
        text: row.text,
        sortKey,
        createdAt: row.createdAt,
        parent: newParent,
        layout: row.layout,
        completedAt: row.completedAt,
      });
      await refreshOwn();
    } catch (e) {
      setWriteMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    window.setTimeout(() => setWriteMsg(null), 3000);
  }

  function startEdit(row: OutlineRow) {
    setEditingUri(row.uri);
    setEditingIsNew(false);
    setEditingTextState(row.text);
    setSelectedUri(row.uri);
  }

  function cancelEdit() {
    // Escaping a freshly created empty bullet should remove it (Workflowy behavior)
    const uri = editingUri;
    const isNew = editingIsNew;
    const empty = editingText.trim() === '';
    setEditingUri(null);
    setEditingIsNew(false);
    setEditingTextState('');
    if (uri && isNew && empty) {
      remove({ uri, rkey: rkeyFromUri(uri) } as OutlineRow).catch(() => {});
    }
  }

  function select(row: OutlineRow) {
    setSelectedUri(row.uri);
    if (editingUri && editingUri !== row.uri) setEditingUri(null); // selecting elsewhere closes the editor
  }

  const title = outlineRec?.title ?? data?.outline?.title ?? data?.handle ?? (did ?? 'FoodWiki');
  const scopedRows = rootUri ? subtreeRows(data?.rows ?? [], rootUri) : (data?.rows ?? []);
  const rootRow = rootUri ? (data?.rows.find((r) => r.uri === rootUri) ?? null) : null;
  const selectedRow = selectedUri ? (data?.rows.find((r) => r.uri === selectedUri) ?? null) : null;

  // When a root is set, the root bullet is the page's title (heading); the garden's
  // top level is the root's CHILDREN, not the root itself.
  const tree = buildTree(scopedRows);
  const rootNode = rootUri ? (tree.find((n) => n.row.uri === rootUri) ?? null) : null;
  const topLevel = rootNode ? rootNode.children : tree;

  /** Sanitize + guard before a write. */
  function plainText(t: string): string {
    return t.replace(/\r\n/g, '\n').trim();
  }

  /** Edit (already sanitized) — used by the editor save path. */
  async function saveEditText(row: OutlineRow, text: string) {
    const t = plainText(text);
    if (!t) return;
    if (t === row.text) { cancelEdit(); return; }
    await editText(row, t);
    cancelEdit();
  }

  /** The add-row textarea's Enter → used for both top-level add and add-child. */
  function onAddRowEnter() {
    const t = topAddText.trim();
    if (!t) return;
    if (addChildTarget) commitAddChild(t);
    else addTopBullet(t);
    setTopAddText('');
  }

  /** Add a bullet at the top level (below all existing top-level). */
  async function addTopBullet(text: string) {
    try {
      const { client, did: myDid } = await requireClient();
      const tops = (data?.rows ?? []).filter((r) => !r.parent).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
      const sortKey = tops.length ? midSortKey(tops[tops.length - 1]!.sortKey, undefined) : 'a0';
      const uri = await createBullet(client, myDid, {
        text,
        sortKey,
        layout: 'bullet',
        createdAt: new Date().toISOString(),
      });
      setWriteMsg('Added ✓');
      setSelectedUri(uri);
      await refreshOwn();
    } catch (e) {
      setWriteMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    window.setTimeout(() => setWriteMsg(null), 3000);
  }

  /** Trigger the empty-state "add first" → opens the top add row. */
  function startAddTop() {
    setTopAddText('');
    requestAnimationFrame(() => {
      const el = document.querySelector('.addrow .editor') as HTMLTextAreaElement | null;
      if (el) el.focus();
    });
  }

  /** Action bar “add child”. */
  function addChildFromBar(row: OutlineRow) {
    setEditingUri(null);
    // Focus the add row after creating an empty child? Simpler: create with placeholder text focused via editor below.
    setAddChildTarget(row);
    requestAnimationFrame(() => {
      const el = document.querySelector('.addrow .editor') as HTMLTextAreaElement | null;
      if (el) {
        el.placeholder = `New child of “${row.text.slice(0, 40)}”…`;
        el.focus();
      }
    });
  }

  /** Actually create the child when the user hits Enter in the add row while a child target is set. */
  async function commitAddChild(text: string) {
    if (!addChildTarget) return;
    const target = addChildTarget;
    setAddChildTarget(null);
    try {
      const { client, did: myDid } = await requireClient();
      const children = (data?.rows ?? []).filter((r) => r.parent === target.uri).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
      const sortKey = children.length ? midSortKey(children[children.length - 1]!.sortKey, undefined) : 'a0';
      const uri = await createBullet(client, myDid, {
        text: plainText(text),
        sortKey,
        parent: target.uri,
        layout: 'bullet',
        createdAt: new Date().toISOString(),
      });
      setWriteMsg('Added ✓');
      setSelectedUri(uri);
      await refreshOwn();
    } catch (e) {
      setWriteMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    window.setTimeout(() => setWriteMsg(null), 3000);
  }

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
              {signedInAs === did && (
                <button className="link" onClick={() => setShowSettings(true)} title="Settings">
                  ⚙ Settings
                </button>
              )}
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

      {showSettings ? <SettingsPane
          key={outlineRkey + '|' + (did ?? '')}
          rec={outlineRec}
          rows={data?.rows ?? []}
          myDid={signedInAs}
          rootUri={rootUri}
          level={outlineRkey}
          onSave={saveSettings}
          onSaveRoot={saveRootFromSettings}
          onClose={() => setShowSettings(false)}
        /> : (
        data && (
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
              <div className="empty-wrap">
                <p className="empty">
                  {signedInAs ? 'No bullets yet — start your garden below.' : 'No bullets yet — this garden is a blank slate.'}
                </p>
                {signedInAs === did && (
                  <button className="button-primary" onClick={() => startAddTop()}>
                    ＋ Add first bullet
                  </button>
                )}
              </div>
            ) : (
              <ul className="nodes">
                {topLevel.map((n) => (
                  <NodeView
                    key={n.row.uri}
                    node={n}
                    depth={0}
                    signedInAs={signedInAs}
                    selectedUri={selectedUri}
                    editingUri={editingUri}
                    onSelect={select}
                    onEdit={startEdit}
                    onToggleTodo={toggleTodo}
                    editingText={editingText}
                    onEditingText={setEditingTextState}
                    onSaveEdit={saveEditText}
                    onCancelEdit={cancelEdit}
                    onEnterFromEdit={enterFromEdit}
                  />
                ))}
              </ul>
            )}
            {signedInAs === did && (
              <div className="addrow">
                <textarea
                  className="editor"
                  rows={1}
                  enterKeyHint="enter"
                  placeholder="Type here to add a bullet… Enter to add · Esc to clear"
                  value={topAddText}
                  onChange={(e) => setTopAddText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onAddRowEnter();
                    } else if (e.key === 'Escape') {
                      setTopAddText('');
                      setAddChildTarget(null);
                    }
                  }}
                  aria-label="Add a top-level bullet"
                />
              </div>
            )}
          </section>
        )
      )}

      <ActionBar
        mine={!!(selectedRow && signedInAs === did)}
        selected={selectedRow}
        isRoot={!!(rootUri && selectedRow && selectedUri === rootUri)}
        showRootBtn={signedInAs === did}
        onAddChild={selectedRow ? () => addChildFromBar(selectedRow) : undefined}
        onEdit={selectedRow ? () => startEdit(selectedRow) : undefined}
        onMoveUp={selectedRow ? () => moveRow(selectedRow, -1) : undefined}
        onMoveDown={selectedRow ? () => moveRow(selectedRow, 1) : undefined}
        onIndent={selectedRow ? () => indentRow(selectedRow) : undefined}
        onOutdent={selectedRow ? () => outdentRow(selectedRow) : undefined}
        onSetRoot={selectedRow ? () => setRoot(selectedRow) : undefined}
        onDelete={selectedRow ? () => remove(selectedRow) : undefined}
        onClose={() => setSelectedUri(null)}
        inlineText={selectedRow ? selectedRow.text : undefined}
      />
    </main>
  );
}
