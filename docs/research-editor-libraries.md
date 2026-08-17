# Editor / tree-rendering library evaluation for a mobile-first outliner

Context: React 18 + TS + Vite, plain CSS, ~82 KB gzip today. One `<textarea>` per bullet, continuous
entry, sticky bottom action bar, AT Proto REST (record-per-bullet) + optimistic UI. Constraint: keep
our own data model; adopt primitives at most.

**Bundle numbers below are my own measurements** (esbuild bundle, `minify:true`, `NODE_ENV=production`,
react/react-dom external, target es2020), for the realistic import set named in each row — not the
package's published size. Dates/licenses come from the npm registry + GitHub API, checked 2026-08-17.

---

## 1. TipTap (ProseMirror + React) — MIT, `@tiptap/*` 3.30.1 (2026-08-13), very active
Yes, it can power a **per-row** editor: instantiate one `Editor` per focused row with a minimal
schema (`Document{paragraph}`, `Paragraph`, `Text`, plus `UndoRedo`, `Placeholder`) and keep the tree
in your own state. Docs: https://tiptap.dev/docs/editor/core-concepts/schema,
https://tiptap.dev/docs/editor/api/editor
- Cost: minimal single-row config = **323 KB min / 101 KB gzip**; `StarterKit` = **393/125**;
  `@tiptap/core` alone (no React) = 280/87. It re-exports all of ProseMirror, so there is no cheap
  entry point. That's a >100% increase over your current 82 KB.
- Nested lists: for one editor over the whole outline you'd use `prosemirror-schema-list` semantics
  (`bullet_list > list_item > paragraph (bullet_list)*`) via `@tiptap/extension-list` (+7 KB gz). PM's
  list commands assume "the first child of a list item is a plain paragraph"
  (https://prosemirror.net/docs/ref/#schema-list) — exactly Workflowy's shape, but it fights
  record-per-bullet: one PM transaction can restructure many list items, which you'd diff back into N
  REST calls.
- Mobile: `enterKeyHint` is not a first-class option; the working recipe is
  `editorProps: { attributes: { enterKeyHint: 'send', role: 'textbox' } }`
  (https://github.com/ueberdosis/tiptap/issues/3820). You inherit ProseMirror's contenteditable
  quirks (see §3).

## 2. Lexical (Meta) — MIT, 0.49.0 (2026-07-30), nightlies daily, still pre-1.0
Headless core + React bindings; custom nodes (`ElementNode`/`DecoratorNode`) could model a row or a
whole outline; Yjs collab package exists (`@lexical/yjs`, MIT).
Docs: https://lexical.dev/docs/concepts/nodes, https://lexical.dev/docs/collaboration/react
- Cost: `lexical` core alone **176 KB min / 58 KB gzip**; with `@lexical/react` plain-text +
  history plugins **296/97**; adding the list plugin **319/104**. Headless plain-text
  (`@lexical/plain-text` + `@lexical/history`, no React glue) = 273/90. Also heavy for one row.
- Mobile: officially Safari 15+/iOS 15+, Chrome 86+, Firefox 115+
  (https://lexical.dev/docs/getting-started/supported-browsers). Reconciliation runs in a
  `queueMicrotask` (https://lexical.dev/docs/faq) — async DOM writes, which interacts with optimistic
  re-render. Open mobile bugs are few but real (iOS dictation deleting words:
  https://github.com/facebook/lexical/issues/6940). No in-tree `enterKeyHint`; set it on the
  `ContentEditable` yourself. Pre-1.0 API churn is a real risk for a small team.

## 3. ProseMirror directly — MIT, `prosemirror-view` 1.42.2 (2026-07-24), actively maintained
- Cost: `view+model+state` only **180/55 gzip**; add keymap+history+commands **201/62**; +schema-list
  **205/63**. So bare PM is ~35–40 KB gzip cheaper than TipTap for the same job.
- Vs TipTap for a *custom* nested schema: PM gives the NodeSpec/`Schema` API and `NodeView` directly
  (https://prosemirror.net/docs/ref/#model.Schema), which is better when your node types (bullet,
  note, collapsed, recordUri attr) don't map to TipTap extensions anyway. TipTap buys React node
  views, a commands API, input rules and ecosystem. For "one paragraph per row" both are overkill;
  for a schema-driven whole-outline doc, bare PM is the leaner choice.
- iOS Safari reality check (open PM issues): keyboard overlays the editor on `EditorView.focus`
  (#1417), autocomplete continues on the next line (#982), IME + marks selection breakage (#1215),
  selection lost when app is switched (#1317), caret jumps near inline widgets (#1424). These are
  contenteditable platform bugs, not PM defects — but you'd own them.

## 4. Slate — MIT, `slate` 0.126.2 (2026-08-08), `slate-react` 0.126.0 (2026-07-09); maintained but perpetually "beta"
- Cost: `slate` core **114/28 gzip**; with `slate-react` + `slate-history` **212/58** — the cheapest
  of the four frameworks.
- Its own FAQ is the argument against it: on mobile "iOS devices are supported but not regularly
  tested", and Android uses a separate composition/mutation path that "may have more bugs"
  (https://github.com/ianstormtaylor/slate/blob/main/docs/general/faq.md). Issue traffic confirms:
  ~40 open Android/IME items (soft keyboard dismissing, Hangul/Chinese composition, first-char
  duplication) plus iOS ones (#4354 autocorrect duplication, #5391 void/caret placement). Don't put
  Slate on a mobile-first typing surface.

## 5. Milkdown — MIT, 7.22.1 (2026-08-12), active
`core + preset-commonmark + react` = **352 KB min / 107 KB gzip**. It's a markdown-round-tripping
WYSIWYG on top of ProseMirror; you'd inherit PM's mobile quirks *plus* a markdown serializer you
don't want (your records aren't markdown documents). **Overkill** — only interesting if you later want
paste-markdown into rows, which you can do in ~1 KB with your own parser.

## 6. CodeMirror 6 — MIT, `@codemirror/view` 6.43.9 (2026-08-16), extremely active
- Cost: `state+view+commands` **261/85 gzip**. Not prose-oriented; no nested-list/outline extension
  exists (only `@codemirror/language` folding for code). PM↔CM integration exists but in the reverse
  direction: CM embedded as a PM NodeView for code blocks (https://prosemirror.net/examples/codemirror/).
- Mobile handling is unusually deliberate for a code editor: `drawSelection` has an
  `iosSelectionHandles` option because hiding the native cursor also hides iOS selection handles, and
  the view exposes `compositionStarted` with an explicit note that Android composes constantly
  (https://codemirror.net/docs/ref/). Historic autocorrect/composition bugs on mobile are mostly
  fixed (codemirror/dev #1238–#1241, #1584).
- **Logseq claim: not confirmed — actually contradicted.** Logseq's `package.json` pins
  `codemirror: 5.65.18` (for code blocks) and edits blocks with `react-textarea-autosize`; its
  `ls-textarea` component hand-rolls `compositionstart/update/end` handling around a real
  `<textarea>` (https://github.com/logseq/logseq/blob/master/src/main/frontend/ui.cljs). There is no
  ProseMirror dependency in Logseq. It also ships `@dnd-kit/core` ^6.3.1 + `@dnd-kit/sortable` and
  `react-virtuoso`. A community experiment swapped the textarea for a CodeMirror editor
  (https://discuss.logseq.com/t/attempt-at-a-wysiwym-edit-mode-best-way-to-replace-the-default-textarea/26398),
  but that is not shipping Logseq.

## 7. Purpose-built outliners
- `react-outliner-neo` 0.8.1 (2026-05-27) implements exactly our keymap (Enter/Tab/Shift-Tab/Alt-arrows,
  collapse, DnD) but has **no license field on npm**, requires React 19 + lucide-react, and its repo
  (SSShooter/react-outliner) has 4 stars — good source of ideas, not a dependency.
- Anytype (`anyproto/anytype-ts`): **not Slate or ProseMirror.** It uses a hand-written
  `Editable` contenteditable component (`selection-ranges` + `raf`) with explicit IME
  composition guards in `component/block/text.tsx`, plus `@dnd-kit/*` and `react-virtualized`.
  License is "Any Source Available License 1.0" — source-available, **not** OSI open source.
- BlockNote: `@blocknote/core` MPL-2.0 (0.54.0, 2026-08-13), `xl-*` packages `GPL-3.0 OR PROPRIETARY`.
  Its block model already has `children` (nesting) — i.e. it *is* an outliner data model
  (https://www.blocknotejs.org/docs/foundations/document-structure) — but it's schema-driven
  TipTap/PM and owns the document; explicitly out of scope per your constraint.
- No maintained, mobile-tested "outliner engine" library exists. Everything credible (Workflowy,
  Logseq, Anytype, Roam) hand-rolls the row editor.

## 8. Tree rendering / virtualization / drag
- **@tanstack/react-virtual** 3.14.9 (2026-07-28), MIT, **23 KB min / 7.2 KB gzip** — headless, works
  with your DOM. Caveat: iOS momentum-scroll interruption with dynamic sizes is a live issue
  (TanStack/virtual #884, #1250, PRs #1189/#1254), and dynamic measurement + a resizing focused
  textarea is exactly that case. Adopt only past ~200–500 visible rows.
- **react-arborist** 3.16.0 (2026-07-25), MIT, **128/33 gzip** — pulls `react-dnd@14` +
  `react-dnd-html5-backend` + `react-window` + `redux`. Touch drag does not work; the maintainer:
  mobile "is not my first use case" and touch support "would need to change the dnd engine"
  (issues #12, #191). **Disqualified for mobile.**
- **dnd-kit** `@dnd-kit/core` 6.3.1 + `sortable` 10 (both 2024-12-05 — no releases in ~20 months),
  MIT, **40.5/14 gzip**. Best-documented touch story: TouchSensor with `delay`+`tolerance` activation
  and `touch-action: manipulation` (https://docs.dndkit.com/api-documentation/sensors/touch); this is
  what Logseq and Anytype both ship. Next-gen `@dnd-kit/react` 0.5.0 (2026-06-11) is 111/37 gzip and
  pre-1.0.
- **Pragmatic drag and drop** (Atlassian) `@atlaskit/pragmatic-drag-and-drop` 3.0.0 (2026-08-14),
  Apache-2.0, **21.5 KB min / 6.8 KB gzip** for element adapter + combine (README claims ~4.7 kB core)
  and it claims full iOS/Android support. But it is built on the *native* HTML5 drag-and-drop API, so
  on touch you get the OS long-press behaviour: users report press-and-hold too long and drops that
  usually fail ("the press + hold time frame is too long", drops succeeding ~10% of the time:
  https://github.com/atlassian/pragmatic-drag-and-drop/discussions/93), with no way to tune it. Great
  on desktop, risky as your only mobile reorder path.
- Given you already have indent/outdent/move buttons in the sticky bar, **the cheapest correct answer
  is: keep the buttons as the primary mobile reorder mechanism** and add dnd-kit later for desktop.

## 9. Undo/redo across async per-record saves — build it yourself (confirmed)
Nothing off-the-shelf models "one logical edit = N REST mutations that may partially fail".
- `prosemirror-history` / `@tiptap/extensions` UndoRedo and Lexical's history only undo *their own*
  document state; they know nothing about your PDS writes.
- Generic stacks (`undo-manager` 1.1.1 (2023), `redux-undo` 1.1.0 (2023), `zundo` 2.3.0 (2024),
  `@wordpress/undo-manager` 1.53.0 — all MIT) give a command stack but no conflict handling; you still
  write the inverse-op pairs.
- The only "real" option is Yjs `Y.UndoManager` (MIT, yjs 13.6.32, 2026-08-04,
  https://docs.yjs.dev/api/undo-manager), which gives correct undo under concurrent edits — but only
  if the outline becomes a CRDT, which conflicts with record-per-bullet AT Proto storage.
- Recommendation: a small typed inverse-command stack (`{do, undo}` closures over record URIs +
  `prevRev`), scoped to one session, cleared on remote conflict. ~150 lines, 0 KB of dependencies.

---

## Comparison

| Library | Bundle (min / gzip, realistic import set) | Mobile | Maintenance (latest) | Fit for us |
|---|---|---|---|---|
| TipTap 3 (min. per-row) | 323 / 101 KB | PM quirks; `enterKeyHint` only via `editorProps.attributes` | MIT, 3.30.1 2026-08-13, very active | ❌ >2× our bundle for rich text we don't need yet |
| TipTap 3 StarterKit | 393 / 125 KB | same | same | ❌ never |
| Lexical + @lexical/react | 296 / 97 KB (core alone 176 / 58) | iOS 15+ supported; async microtask reconcile; few but real dictation/IME bugs | MIT, 0.49.0 2026-07-30, daily nightlies, pre-1.0 | ⚠️ best custom-node ergonomics + Yjs path, but heavy & pre-1.0 |
| ProseMirror direct | 201 / 62 KB (+schema-list 205 / 63) | many open iOS contenteditable issues (#1417, #982, #1215) you'd own | MIT, view 1.42.2 2026-07-24, active | ⚠️ leanest schema-driven route if we ever unify the outline into one doc |
| Slate + slate-react | 212 / 58 KB | FAQ: iOS "not regularly tested"; ~40 open Android/IME issues | MIT, 0.126.2 2026-08-08, active but beta | ❌ mobile risk too high |
| Milkdown | 352 / 107 KB | PM quirks + markdown layer | MIT, 7.22.1 2026-08-12 | ❌ overkill |
| CodeMirror 6 | 261 / 85 KB | best-engineered mobile handling of the bunch (`iosSelectionHandles`, composition), but code-oriented | MIT, view 6.43.9 2026-08-16 | ❌ wrong tool; no outline extensions. (Logseq uses CM **5** for code blocks + `<textarea>` for blocks) |
| BlockNote | not measured (MPL-2.0 core; xl-* GPL/proprietary) | TipTap-based | 0.54.0 2026-08-13 | ❌ owns the document; excluded by constraint |
| react-outliner-neo | not measured | untested, React 19 only | v0.8.1 2026-05-27, **license unstated on npm**, 4★ | ❌ reference implementation only |
| @tanstack/react-virtual | 23 / 7.2 KB | headless; open iOS momentum-scroll issues w/ dynamic sizes | MIT, 3.14.9 2026-07-28 | ✅ adopt when trees exceed a few hundred rows |
| react-arborist | 128 / 33 KB | **touch drag broken by design** (react-dnd HTML5 backend) | MIT, 3.16.0 2026-07-25 | ❌ |
| dnd-kit (core+sortable) | 40.5 / 14 KB | TouchSensor delay+tolerance, `touch-action` guidance; used by Logseq & Anytype | MIT, but core/sortable last released 2024-12-05 | ✅ if/when we add drag; buttons still primary |
| Pragmatic drag and drop | 21.5 / 6.8 KB | native HTML5 DnD ⇒ long-press + flaky drops on touch, untunable | Apache-2.0, 3.0.0 2026-08-14, very active | ⚠️ desktop-only value |
| Undo/redo libs (undo-manager, zundo, redux-undo, Y.UndoManager) | 2–20 KB gz | n/a | mixed; Yjs 13.6.32 2026-08-04 | ❌ build a ~150-line inverse-command stack |

### Bottom line
**Keep `<textarea>`-per-row.** It is the only option that gives us native iOS/Android keyboards,
autocorrect/IME, `enterKeyHint` (WebKit shipped it in Safari 13.1 / iOS 13.4:
https://webkit.org/blog/10247/new-webkit-features-in-safari-13-1/) and zero bundle cost — and it is
what Logseq and (in contenteditable form) Anytype actually ship. Note that `inputmode` is reported not to work on
contenteditable in iOS Safari, which is another reason not to move off `<textarea>`; I could not
verify this against a WebKit bug ID.
Adopt, in priority order: (1) hand-rolled inverse-command undo stack, (2) `@tanstack/react-virtual`
when row counts demand it, (3) `dnd-kit` TouchSensor for optional drag. Revisit **Lexical custom
nodes** (not TipTap) only if we need inline marks/mentions inside a row *and* accept ~+60–100 KB gzip;
revisit **bare ProseMirror + prosemirror-schema-list** only if we abandon record-per-bullet for a
single-document model.
