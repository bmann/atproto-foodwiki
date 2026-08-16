// Build a nested tree from getOutline's flat, pre-order node list.
import type { OutlineOutput } from '@foodwiki/lexicons';

type Row = OutlineOutput['nodes'][number];

export interface OutlineTreeNode {
  row: Row;
  children: OutlineTreeNode[];
}

export function buildTree(nodes: Row[]): OutlineTreeNode[] {
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

  // Deterministic: pre-order from the server wins; sort siblings by sortKey, fallback to uri.
  const sort = (a: OutlineTreeNode, b: OutlineTreeNode) =>
    a.row.sortKey.localeCompare(b.row.sortKey) || a.row.uri.localeCompare(b.row.uri);
  const visit = (nodes: OutlineTreeNode[]) => {
    nodes.sort(sort);
    for (const n of nodes) visit(n.children);
  };
  visit(roots);
  return roots;
}
