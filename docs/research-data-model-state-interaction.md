# FoodWiki: sort keys, sync model, undo, touch interaction, scale, mobile keyboard

Research report. Verified claims carry links; guesses are marked **[unverified]**.
Versions checked against the npm registry on 2026-08-17.

---

## 1. Sibling sort order

**Recommended library: `fractional-indexing` (rocicorp), latest `4.0.0`**, MIT-free (CC0-1.0),
~1.7M weekly downloads, `github.com/rocicorp/fractional-indexing`. It is the canonical
implementation of David Greenspan's *Implementing Fractional Indexing*
(https://observablehq.com/@dgreensp/implementing-fractional-indexing) and includes the
variable-length-integer + prepend/append optimisations from that article. Default alphabet is
`BASE_62_DIGITS` (`0-9A-Za-z`). Byte-compatible ports exist for Go (`rocicorp/fracdex`), Python
(`httpie/fractional-indexing-python`), Kotlin, Ruby — useful if a Go/Python appview ever needs to
generate keys. There is *no* Figma library ("fz-strings" does not exist as a package **[unverified /
likely misremembered]**); Figma's ordering write-up is prose only, and Bartosz Sypytkowski's
"Replacing Yjs move feature" recommends exactly this technique for CRDT contexts too.

Measured behaviour of 4.0.0 (I ran it):

| keys | result |
|---|---|
| `generateKeyBetween(null,null)` | `a0` |
| 2000 sequential appends | `a0 … az bVG`, **max length 3 chars** |
| 20 repeated midpoints in the same gap | `a0V a0G a08 a04 a02 a01 a00V …` → grows ~1 char per 4 splits |
| 5 prepends | `Zz Zy Zx Zw Zv` |
| `generateNKeysBetween(a,b,3)` | `['a0G','a0V','a0l']` (evenly spaced, shorter keys) |

Comparison for a server-serialised, per-record model:

| scheme | round trips for insert-between | key growth | offline / delegation safe |
|---|---|---|---|
| fractional (base62 strings) | **1 PUT** (only the new record) | O(log n) worst case, 3 chars for 2000 appends | yes — keys are generated client-side, no coordination |
| lexicographic base62 with fixed width | 1 PUT until the gap is exhausted, then **rewrite N siblings** | fixed, then breaks | no (rewrite storms) |
| integers with gaps (100, 200, …) | 1 PUT until gap exhausted, then renumber siblings (N PUTs, batched ≤10–200 via `applyWrites`) | none, but renumbering is O(N) | poor: two offline clients renumber differently |

**Two live bugs in the current code.**

1. `packages/web/src/lib/writes.ts: after(s) => s + '0'`. Every append adds a character, so 1000
   appends produce a 1002-char key. The lexicon caps `sortKey` at 512 chars
   (`stringLength(0,512)` in `app/bulleted/node.ts`), so append-only usage will eventually be
   *rejected by the PDS*. rocicorp keeps it at 3 chars for the same workload.
2. `packages/web/src/lib/outline-tree.ts: buildTree` sorts with
   `a.row.sortKey.localeCompare(b.row.sortKey)`. `localeCompare` is case-insensitive/collation
   based: `'YzZ'.localeCompare('Yza') === 1` while `'YzZ' < 'Yza'` is `true`; `['Zz','a0','A0']`
   sorts differently under the two comparators. The rocicorp README calls this out explicitly.
   Use raw `<`/`>` comparison.

Note the existing `"aaaa"/"zzzz"` seeds are *not valid* rocicorp order keys
(`generateKeyBetween('aaaa','zzzz')` throws `invalid order key: zzzz`), so adopting the library
requires a one-time migration: read each sibling group in current display order and reassign with
`generateNKeysBetween(null, null, n)`.

**Tiebreak / soft delete.** There is no standard. Practical rule: sort by
`(sortKey, rkey)`. Record keys are usually TIDs — 13-char, lexicographically sortable, monotonic
per repo (https://atproto.com/specs/record-key) — so an rkey tiebreak is a de-facto creation-time
tiebreak; but the spec warns record keys are user-controlled and must not be trusted as
timestamps, so treat it as a *stable* tiebreak, not a semantic one. Do not reuse `sortKey` for
soft deletion; keep `completedAt` (already in the lexicon) and, if you need tombstones, add an
explicit `deletedAt` rather than encoding state in the key.

```js
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'; // ^4.0.0

const bySort = (a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1
  : a.rkey < b.rkey ? -1 : a.rkey > b.rkey ? 1 : 0);          // never localeCompare

const siblings = (rows, parent) =>
  rows.filter(r => (r.parent ?? null) === (parent ?? null)).sort(bySort);

/** key for a bullet dropped at index `i` among `sibs` (0 = first, sibs.length = last) */
export function keyForIndex(sibs, i) {
  return generateKeyBetween(sibs[i - 1]?.sortKey ?? null, sibs[i]?.sortKey ?? null);
}

/** paste / import: one call, evenly spaced, shorter keys than N successive midpoints */
export const keysForRange = (prev, next, n) =>
  generateNKeysBetween(prev ?? null, next ?? null, n);

/** indent: becomes last child of previous sibling → 1 record write (parent + sortKey) */
export function indent(rows, node) {
  const sibs = siblings(rows, node.parent);
  const i = sibs.findIndex(s => s.uri === node.uri);
  if (i <= 0) return null;                       // no previous sibling: greyed out, not a no-op
  const newParent = sibs[i - 1];
  const kids = siblings(rows, newParent.uri);
  return { uri: node.uri, parent: newParent.uri,
           sortKey: generateKeyBetween(kids.at(-1)?.sortKey ?? null, null) };
}
```
Move/indent/outdent = **one** `putRecord` per moved bullet (plus its subtree stays attached because
children point at the URI, not at an index). Adding jitter is only needed if two devices can insert
into the same gap while offline; `jittered-fractional-indexing` (nathanhleung) wraps this library
for that case.

## 2. CRDTs vs single-owner writes

Not now. On atproto every bullet lives in *its owner's* repo and is written only by that owner's
authenticated client, so the concurrency you actually face is "same user, two tabs/devices",
which last-write-wins per record already handles acceptably; and fractional indexing removes the
one genuinely hard case (concurrent reorder) without any CRDT — this is why Yjs *removed* its
`move` operation and Sypytkowski's follow-up recommends fractional indexes instead
(https://www.bartoszsypytkowski.com/replacing-yjs-move-feature/, yjs 13.6.32). You would need
Yjs/Automerge only when two *different* identities edit one outline concurrently with character-level
merging — e.g. shared-document mode where a bullet's text must merge instead of clobber. Even then
the atproto-shaped answer is likely "one owner's repo holds the doc; collaborators propose via
their own records", not a CRDT per bullet. Recommendation: keep LWW per record, keep the
tree-shape data in scalar fields (parent, sortKey) so a CRDT can be introduced later *only* for
`text` (e.g. store an Automerge/Yjs update blob alongside plain text) without a data migration.

## 3. Undo/redo over async per-record saves

Pattern: an **inverse-command stack**, where each pushed entry stores the *prior record value* (not
a pointer to history), executed through a **serial queue** so an undo can never interleave with an
in-flight save — this is precisely the design Isaac Hagoel documents for Replicache
(https://dev.to/isaachagoel/you-dont-know-undoredo-4hol: async ops "can complete in different
order… query the system while it's between states", solved with a serial queue). Collabs' docs
describe the same inverse-op discipline (https://collabs.readthedocs.io/en/latest/advanced/undo_redo.html).

atproto specifics: `com.atproto.repo.putRecord` and `deleteRecord` accept `swapRecord` (CAS on the
previous record CID) and `swapCommit` (CAS on repo commit), returning `InvalidSwap`; `applyWrites`
takes `swapCommit` and is capped around 200 writes per call, with a maintainer noting it is
"meant for applying transactional writes" (PR #1571). Repo `rev` is a monotonic TID logical clock
(https://atproto.com/specs/repository). So: keep the last-known `cid` per row (the normalizer
already has a `cid` field, though HappyView doesn't populate it yet) and pass it as `swapRecord`;
on `InvalidSwap`, refetch and *drop* that undo entry rather than replaying blindly — Figma's
"undo does nothing, keep pressing" behaviour is the failure mode to avoid.

Worth building now? **Partially.** Build (a) one-level "Undo" toast for destructive actions
(delete-with-children, complete) — Workflowy shipped exactly this for swipe-delete
(blog.workflowy.com/2018/04/12/workflowy-mobile-swipe-to-delete/) and it prevents the worst data
loss; and (b) the serial write queue, because you need it anyway for optimistic writes and it is
the hard part. Defer the full multi-step stack until the write queue and `swapRecord` handling are
in place; retrofitting the queue later means rewriting undo.

## 4. Mobile interaction patterns

| approach | shipped by | pros | cons / evidence |
|---|---|---|---|
| (a) swipe L/R = indent/outdent | **Logseq** (PR #5552 removed the toolbar indent buttons in favour of swipe; thresholds `|dx|>30 && |dy|<30`, 40px commit, 600ms arming) | zero chrome, one-handed | collides with text selection & horizontal scroll. **Workflowy does *not* do this**: swipe right = complete, swipe left = bullet menu (blog.workflowy.com/swipe-right-on-us-mobile-shortcuts/), with users asking "Any way to indent/outdent using a touchscreen? I wish swiping did that". **Dynalist** also uses swipe for check/delete only (App Store notes: "Swipe right to check an item; swipe left to delete it"), later gated behind a confirm tap after mis-swipes |
| (b) sticky toolbar buttons (current) | Logseq mobile bar, Dynalist (customisable toolbar), Roam | discoverable, no gesture conflicts, works mid-composition | vertical space; iOS `position: fixed`/`sticky` misbehaves with the keyboard open (medium.com/@im_rahul/safari-and-position-fixed-978122be5f29; WebKit bug 191204 still NEW) |
| (c) long-press drag + drop indicator | Dynalist ("long hold the bullet point to start dragging, and land your finger at the right side of the screen" = drag-to-indent); Workflowy desktop drag-to-indent | direct manipulation, subtree moves | least reliable on touch web. dnd-kit's own docs: touch activation is `{delay: 250, tolerance: 5}`, constraints are mutually exclusive, `touch-action: manipulation` required, and with the Pointer sensor "any changes to the `touch-action` value will be ignored" once `pointerdown` fired — they recommend Mouse+Touch sensors instead of Pointer for scrollable lists (docs.dndkit.com/api-documentation/sensors/{touch,pointer}). Real-world: clauderic/dnd-kit#1398 (iPad drags only on long press even with `delay: 0`). pragmatic-drag-and-drop claims iOS/Android support but atlassian/pragmatic-drag-and-drop discussion #93 ("It wasn't usable… press + hold time frame is too long", no way to configure) and issue #204 say otherwise for touch |
| (d) tap-to-select + arrow buttons (current) | Logseq move-up/down live in the toolbar, not drag | reliable, accessible, cheap; each press = 1 record write | slow for long moves; needs a visible selection state |

Versions if you go the drag route: `@dnd-kit/core@6.3.1` (legacy stable, `TouchSensor` +
`activationConstraint: {delay: 250, tolerance: 5}` + a drag handle with `touch-action: none` on the
handle only), or the rewrite `@dnd-kit/dom@0.5.0`/`@dnd-kit/react@0.5.0` whose
`PointerSensor.configure({activationConstraints: [Distance, Delay]})` is *composable* (unlike v6);
`@atlaskit/pragmatic-drag-and-drop@3.0.0`. Recommendation: keep (b)+(d) as primary, add (a) behind
a setting with Logseq's thresholds, treat (c) as an accelerator for tablets only.

## 5. Large trees on mobile

DOM budget first: Lighthouse warns above ~800 body nodes and errors above ~1,400
(developer.chrome.com/docs/lighthouse/performance/dom-size). A bullet row is realistically 3–6
elements, so **1,000 bullets ≈ 3,000–6,000 nodes** — past the point where style recalc and INP
suffer on a mid-range phone, even with plain CSS. Practical thresholds: ≤300 rows fine unvirtualised;
300–800 fine if each row is 2–3 elements and you avoid layout-thrashing CSS; >1,000 rows in the DOM
is where you should assume jank **[my estimate, not a measured benchmark]**.

Logseq's own answer is lazy loading (not true virtualisation) and it is visibly imperfect: issues
#9076 ("Lazy loading often doesn't work on large pages") and logseq/db-test#971 (lazy load "moves
the view around" while scrolling up), plus longstanding whole-graph performance complaints
(#5132 at 2,700 entries; discuss.logseq.com/t/22314). I found **no Workflowy engineering blog post
on virtualisation [unverified]** — their public blog is product-facing.

For FoodWiki the binding constraint is the *network*, not the DOM: `com.atproto.repo.listRecords`
caps `limit` at 100 per page, and your own `app.bulleted.getOutline` caps `limit` at 100 nodes with
`depth` ≤ 5 and returns `truncated`/`stop`. So 1,000 bullets = ≥10 sequential round trips today.
Recommended order of work: (1) progressive disclosure — fetch/expand by subtree using
`getOutline(node:, depth:)` and the existing `childCount` to render collapsed affordances without
the children; (2) cache the flat rows in IndexedDB (`dexie@4.4.5`) keyed by DID + repo `rev` so
reopening is instant and offline works; (3) only then virtualise the *flattened visible list* with
`@tanstack/react-virtual@3.14.9` (`useVirtualizer` + `measureElement` for variable row heights;
note its two-pass estimate→measure can make rows jump if `estimateSize` is far off). Virtualising a
tree is easy once the render model is already "flatten visible nodes to an array", which
`buildTree` + a collapse set gives you.

## 6. Virtual keyboard with per-row editors

Facts to build on: `enterkeyhint` is supported in Chrome 77+ / iOS Safari 13.4+
(ionicframework.com/docs/developing/keyboard, WebKit 13.1 release notes) — safe to use *on inputs
and textareas*. On **contenteditable** in iOS Safari, `inputmode` is reported not to work at all and
`enterkeyhint`+`inputmode` interact inconsistently
(contenteditable.realerror.com/scenarios/scenario-ios-viewport-keyboard/ — secondary source,
**partly unverified**), and the keyboard-reveal scroll shifts the layout viewport (WebKit bug
191204, still NEW; a 2026 write-up on the fix is
dev.to/deanliu/the-ios-safari-keyboard-scroll-bug-fixed-with-one-line-of-css).

Recommendation: **mount a single `<textarea>` for the focused row only** (render every other row as
plain text), which is what Logseq does — its mobile code has a `blur-if-compositing` helper that
blurs the textarea when `editor-in-composition?` so the IME commits before a structural edit; this
is impossible to get right if you mutate a focused contenteditable mid-composition. Set
`enterkeyhint="enter"`, `autocapitalize="sentences"`, `spellcheck`, and on focus **synchronously
scroll the tapped row to ~⅓ (Logseq: ¼) of `visualViewport.height`** so iOS's own reveal-scroll
becomes a no-op and your sticky toolbar doesn't ride off-screen. Drive toolbar position from
`visualViewport` height/offset, debounced (Safari fires `resize` for suggestion bars etc.).
Android/Samsung keyboards on contenteditable are a known minefield
(discuss.prosemirror.net/t/contenteditable-on-android-is-the-absolute-worst/3810) — another vote for
textarea. I could **not verify** what RemNote's mobile web uses (their editor is custom; no public
issue found) **[unverified]**; Logseq's textarea approach is verifiable from source.
