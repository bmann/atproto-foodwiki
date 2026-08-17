import { describe, it, expect } from 'vitest';
import { midSortKey } from './writes';
import { buildTree, type OutlineRow } from './outline-tree';

describe('midSortKey tolerant fractional-indexing', () => {
  it('gives a key between valid prev and next', () => {
    const k = midSortKey('a0', 'a1');
    expect(k > 'a0' && k < 'a1').toBe(true);
  });
  it('stays short over 1000 appends (canonical keys)', () => {
    let prev: string | undefined;
    let key = '';
    for (let i = 0; i < 1000; i++) {
      key = midSortKey(prev, undefined);
      prev = key;
    }
    expect(key.length).toBeLessThanOrEqual(10);
  });
  it('legacy collision a2/a20: never throws, produces a key > a2', () => {
    const k = midSortKey('a2', 'a20');
    expect(k > 'a2').toBe(true);
    expect(k.length).toBeGreaterThanOrEqual(2);
  });
  it('legacy after a20: never throws, key > a20, bounded length', () => {
    const k = midSortKey('a20', undefined);
    expect(k > 'a20').toBe(true);
    expect(k.length).toBeLessThanOrEqual(4);
  });
  it('legacy before a00: never throws, key < a00', () => {
    const k = midSortKey(undefined, 'a00');
    expect(k < 'a00').toBe(true);
  });
  it('legacy before a20: never throws, key < a20', () => {
    const k = midSortKey(undefined, 'a20');
    expect(k < 'a20').toBe(true);
    expect(k.length).toBeLessThanOrEqual(4);
  });
  it('live data: keys stay in byte order through many inserts', () => {
    // Real top-level keys on bmann: a0O, a1, a2, a20, a200
    const rows = [
      { k: 'a0O', t: 'Love the mirror' },
      { k: 'a1', t: 'Started' },
      { k: 'a2', t: 'Duck Ramen' },
      { k: 'a20', t: 'Another bullet' },
      { k: 'a200', t: 'I am adding' },
    ];
    const mk = (k: string, i: number): OutlineRow => ({ uri: `at://d/app.bulleted.node/${i}`, rkey: `${i}`, text: '', sortKey: k });
    const tree = buildTree(rows.map((r, i) => mk(r.k, i)));
    expect(tree.map((n) => n.row.sortKey)).toEqual(['a0O', 'a1', 'a2', 'a20', 'a200']);
  });
  it('incTail bounded growth: 1000 legacy appends stay under 6 chars', () => {
    let prev = 'a20';
    let key = prev;
    for (let i = 0; i < 1000; i++) {
      key = midSortKey(key, undefined);
      prev = key;
    }
    expect(key.length).toBeLessThanOrEqual(6);
  });
});

describe('buildTree sort (compareRows)', () => {
  const mk = (uri: string, sortKey: string): OutlineRow => ({ uri, rkey: uri, text: '', sortKey });
  it('sorts a200 after a20 a2 (raw byte order, not localeCompare)', () => {
    const rows = [mk('a', 'a200'), mk('b', 'a2'), mk('c', 'a20')];
    const tree = buildTree(rows);
    expect(tree.map((n) => n.row.sortKey)).toEqual(['a2', 'a20', 'a200']);
  });
  it('matches live bmann data order (a0O between a0 and a1)', () => {
    const rows = [mk('1', 'a1'), mk('2', 'a0O'), mk('3', 'a0')];
    const tree = buildTree(rows);
    expect(tree.map((n) => n.row.sortKey)).toEqual(['a0', 'a0O', 'a1']);
  });
});
