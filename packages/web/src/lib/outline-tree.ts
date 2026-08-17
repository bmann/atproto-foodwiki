// Normalize HappyView's getOutline response into a common outline-node shape,
// and build a nested tree from the flat pre-order list.
//
// NOTE: HappyView v2.13.0 serves getOutline with key `records` where each row
// is the RAW `app.bulleted.node` record (uri, text, sortKey, parent?, layout?,
// completedAt?, facets? + $type). It does NOT yet include the annotated
// `#node` fields (cid, rkey, did, childCount) or the `nodes`/`did`/`handle`/
// `truncated` envelope from the newer bulleted.app lexicon. We therefore
// accept either shape and normalize to OUR OWN outline model here, so the UI
// doesn't depend on which the server returns.

export interface OutlineRow {
  uri: string;
  rkey: string;
  text: string;
  sortKey: string;
  parent?: string;
  layout?: string;
  completedAt?: string;
  createdAt?: string;
  facets?: unknown;
  /** fields present only in the annotated #node shape */
  cid?: string;
  did?: string;
  childCount?: number;
  display?: string;
}

export interface OutlineData {
  did?: string;
  handle?: string;
  outline?: { title?: string; description?: string; uri?: string };
  rows: OutlineRow[];
  truncated?: boolean;
}

function rkeyFromUri(uri: string): string {
  const i = uri.lastIndexOf('/');
  return i >= 0 ? uri.slice(i + 1) : uri;
}

export function normalizeOutline(raw: unknown): OutlineData {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(obj.records)
    ? (obj.records as Record<string, unknown>[])
    : Array.isArray(obj.nodes)
      ? (obj.nodes as Record<string, unknown>[])
      : [];

  const rows: OutlineRow[] = list.map((r) => ({
    uri: String(r.uri ?? ''),
    rkey: String(r.rkey ?? rkeyFromUri(String(r.uri ?? ''))),
    text: String(r.text ?? ''),
    sortKey: String(r.sortKey ?? ''),
    parent: r.parent ? String(r.parent) : undefined,
    layout: r.layout ? String(r.layout) : undefined,
    completedAt: r.completedAt ? String(r.completedAt) : undefined,
    createdAt: r.createdAt ? String(r.createdAt) : undefined,
    facets: r.facets,
    cid: r.cid ? String(r.cid) : undefined,
    did: r.did ? String(r.did) : undefined,
    childCount: typeof r.childCount === 'number' ? r.childCount : undefined,
    display: r.display ? String(r.display) : undefined,
  }));

  const outlineRaw = obj.outline as Record<string, unknown> | undefined;
  return {
    did: obj.did ? String(obj.did) : undefined,
    handle: obj.handle ? String(obj.handle) : undefined,
    outline: outlineRaw
      ? {
          title: outlineRaw.title ? String(outlineRaw.title) : undefined,
          description: outlineRaw.description ? String(outlineRaw.description) : undefined,
          uri: outlineRaw.uri ? String(outlineRaw.uri) : undefined,
        }
      : undefined,
    rows,
    truncated: typeof obj.truncated === 'boolean' ? obj.truncated : undefined,
  };
}

export interface OutlineTreeNode {
  row: OutlineRow;
  children: OutlineTreeNode[];
}

export function buildTree(nodes: OutlineRow[]): OutlineTreeNode[] {
  const byUri = new Map<string, OutlineTreeNode>();
  const roots: OutlineTreeNode[] = [];

  for (const row of nodes) {
    const node: OutlineTreeNode = { row, children: [] };
    byUri.set(row.uri, node);
  }

  for (const node of byUri.values()) {
    const parentUri = node.row.parent;
    const parent = parentUri ? byUri.get(parentUri) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sort = (a: OutlineTreeNode, b: OutlineTreeNode) =>
    a.row.sortKey.localeCompare(b.row.sortKey) || a.row.uri.localeCompare(b.row.uri);
  const visit = (nodes: OutlineTreeNode[]) => {
    nodes.sort(sort);
    for (const n of nodes) visit(n.children);
  };
  visit(roots);
  return roots;
}
