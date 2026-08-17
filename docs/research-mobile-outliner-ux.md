# Mobile-web UX in outliners: field research for FoodWiki

Scope: how the major outliners handle indent/outdent, reorder, continuous entry, narrow-viewport
rendering on **touch**; known weaknesses; published lessons. Claims below are sourced. Where I
could not verify behaviour first-hand or in docs, it is marked **[unverified]**.

---

## Logseq (best-documented gesture model; source code readable)

- **Indent/outdent = horizontal swipe on the block**, not toolbar buttons. Logseq PR #5552
  ("enhance gestures") explicitly: "Switch outdent and more buttons to make swipe more natural /
  disable the swipe action-bar when editing. Only allow indent/outdent when editing / resolve
  conflicts between selection and swipe when editing / **Remove the indent/outdent button on the
  mobile toolbar**" — https://github.com/logseq/logseq/pull/5552
- The 0.10.x implementation (`src/main/frontend/handler/block.cljs`) is worth copying wholesale:
  swipe is only armed if `selection-type != "Range"` and either not editing **or** within 600 ms of
  touchstart; it requires `|dy| < 30 && |dx| > 30` before it reveals a left/right menu; crossing
  40 px commits indent (right) / outdent (left); crossing 80 px on the left-swipe opens the block
  action bar instead. Haptic feedback fires on commit (`haptics/with-haptics-impact ... :light`).
  A config key `:mobile {:gestures/disabled-in-block-with-tags ...}` lets users disable gestures per
  block, and swipe is force-disabled inside `.dsl-query`, `.drawer`, `.draw-wrap`.
- **Move up/down = toolbar buttons above the keyboard**, not drag. `mobile/mobile_bar.cljs` renders
  `#mobile-editor-toolbar` with, in order: outdent, indent, move-up, move-down, newline, todo,
  camera, undo, redo, date submenu, `[[`, `((`, `/`, plus a hide-keyboard button. (Note: indent
  buttons live in the *editor* toolbar even though the gesture PR removed them at one point — the
  community forced them back, see below.)
- **IME handling is explicit and non-obvious**: every toolbar command calls `blur-if-compositing`,
  which blurs the textarea when `state/editor-in-composition?` so the IME commits pending composing
  text before the structural edit runs; the source comment says "The composing text can be committed
  by losing focus. 100ms is enough to commit the composing text to db." This is a real trap for
  CJK/predictive keyboards that FoodWiki will hit with plain textareas.
- **Density**: indentation per level is *tuned down 4x on mobile* — `block.css`:
  `.ls-block-content-indent { padding-left: 45px }` vs `html.is-mobile ... { padding-left: 12px }`.
  No horizontal scroll; text wraps.
- Toolbar positioning is done in JS against `window.visualViewport.height` plus a tracked
  `keyboard-height` atom, and the editor auto-scrolls the caret to ~1/4 viewport height
  (`util/scroll-editor-cursor`, `:to-vw-one-quarter?`).
- **Weaknesses (documented complaints)**
  - Swipe-to-indent collides with text selection: "You can't drag to select text anymore without
    the app thinking you are trying to indent or unindent a block" (App Store review,
    https://apps.apple.com/us/app/logseq/id1601013908).
  - Users hated losing the buttons: "the swiping gestures are generally awkward on phone screens.
    an option for indent/outdent buttons to be on the toolbar again would be nice" —
    https://github.com/logseq/logseq/discussions/7894
  - Floating toolbar detaches from the keyboard: "While typing the toolbar does not stay above my
    keyboard and shift instead getting stuck in the centre of the screen" —
    https://github.com/logseq/logseq/issues/11251
  - Swipe-right on a block with collapsed children crashed the app —
    https://github.com/logseq/logseq/issues/8378
  - Enter semantics confuse users on mobile: Return sometimes makes a new *line* not a new *block*
    (App Store review), and the toolbar `↪` button is new-line not new-block —
    https://discuss.logseq.com/t/swaping-enter-and-shift-enter-on-mobile-toolbar-button-still-creates-a-new-line-instead-of-a-new-block/27019
  - "Half the time tapping on the text to make edits doesn't bring up the editor bar (for indents,
    etc.)" (App Store review).

## Dynalist (buttons-only; the best written design critique of any outliner)

- **Indent/outdent/move-up/move-down/delete are all buttons in an editing toolbar above the
  keyboard.** Justin Li's design critique: "This is accomplished by the buttons in the editing
  toolbar above the keyboard — to indent, to dedent, to move it up, to move it down, and to delete.
  Although no conventions exist for these actions … their meaning is relatively clear within the
  context of a nested list."
  https://justinnhli.com/posts/2018/12/a-design-critique-of-the-dynalist-app.html
- Same critique names the gap: "The conventional affordance for moving items in a list is to
  long-press and drag, which does not work in Dynalist."
  https://justinnhli.com/posts/2018/11/a-design-critique-of-dynalist.html
- **Continuous entry**: "Pressing enter in the middle of an item will split it in two, and doing it
  at the beginning will insert a new item above… Dynalist could have allowed multi-line items…
  but instead chose to use the enter key to create new notes instead. Given that multi-line items
  are relatively uncommon, this choice optimizes for the common case." (Same source.) Exactly the
  FoodWiki continuous-entry bet, with a rationale you can reuse.
- **Tree rendering**: "organized hierarchically, with a slight indent to indicate nesting … further
  reinforced by the vertical line that runs down the left side between sibling notes, guiding the
  eye towards notes at the same indent." (Same source.) Indentation guides earn their keep on narrow
  screens.
- Pro users can **customise which commands appear in the mobile toolbar** —
  https://help.dynalist.io/article/140-customize-mobile-toolbar
- **Mobile-web-specific weakness that FoodWiki will share**: the toolbar fails to position above the
  keyboard *in the browser* while working in the native wrapper — "Open Dynalist on mobile browser…
  Expected: Mobile toolbar displays above the keyboard. Actual: Mobile toolbar is not shown. On my
  wife's phone it appears partially cut off… The native Android app works correctly."
  https://talk.dynalist.io/t/mobile-toolbar-not-displaying-above-keyboard-on-web-app/8754
- Users also report the buttons "are a little challenged sometimes when the keyboard slides up and
  down while editing", and propose a text-based alternative used by MyLifeOrganized: typing a space
  as the first character indents and consumes the space —
  https://talk.dynalist.io/t/android-better-faster-ui-for-bullet-indent-level/665

## Workflowy

- **Swipe is spent on other actions, not indentation.** Official: "in our mobile apps you can simply
  swipe right on any item to complete it, and swipe right once more to un-complete it… if you swipe
  left on an item, you bring up the bullet menu."
  https://blog.workflowy.com/swipe-right-on-us-mobile-shortcuts/ — and in the comments of that very
  post users ask "Any way to indent/outdent using a touchscreen? I wish swiping did that. I can't
  figure out how to."
- Indent/outdent on mobile is via the **keyboard accessory row**, which is horizontally scrollable —
  a Workflowy staffer replies in that thread: "as there are several new buttons above the keyboard,
  you might have to scroll horizontally to get to the notes button." The App Store listing markets
  "Mobile keyboard shortcuts" as a feature (https://apps.apple.com/app/id551139514), and the
  changelog refers to "the mobile keyboard accessory."
- **Reorder on mobile is long-press → multi-select → drag handle**, and it only shipped in Sept 2025:
  "Long-requested, you can now select multiple nodes on Mobile. Long-press a node, select several,
  then use the drag-handle to move them. Use the bottom toolbar to change item type…" —
  https://workflowy.com/whats-new/ ; also "Long pressing a selected node now initiates drag-and-drop".
- Desktop/keyboard model (the thing FoodWiki mirrors): Enter = new sibling, Tab / Shift+Tab =
  indent/outdent, Alt/Ctrl+Shift+↑/↓ = move — https://workflowy.com/help/hotkeys/
- **Published lessons / hard-won mobile fixes** (all from https://workflowy.com/whats-new/, useful as
  a bug checklist for a textarea-based web outliner):
  - "Fixed mobile auto-scrolling on new lines—text will no longer jump too high and disappear above
    the keyboard when you press Enter."
  - "iOS keyboard no longer covers the node you're editing." / "Fixed annoying micro-bounce when
    typing on iOS."
  - "Hiding the keyboard or switching apps on Android no longer does weird things to editing and
    searching."
  - "iOS keyboard suggestions now work correctly when Workflowy capitalizes the first word of an item."
  - "Selecting nodes in search mode won't auto-outdent them anymore (iOS)."
  - "Moving nodes on mobile no longer leaves a phantom bullet stuck on the screen."
  - "Fixed that annoying iPad bug where you had to double-tap on UI controls to expand, collapse, and zoom."
- **Weaknesses**: swipe actions fight horizontal scroll containers — "When I try to scroll a board
  left or right I usually end up swiping an item instead… Sometimes the board will scroll and the
  item will swipe simultaneously" (workaround: two-finger scroll). Long-standing iOS complaints
  about external-keyboard arrow navigation and "the user experience on the iOS app is vastly
  inferior to the web app" —
  https://workflowy.zendesk.com/hc/en-us/articles/202609809-iOS-app-for-iPhones-and-iPads
  A user in the same thread notes expand/collapse controls placed far from the text are hard to hit:
  "having the expand buttons on the right side of the screen… It usually takes me two to three
  attempts to expand the right thing because the text is so far away from these buttons."

## RemNote (shipped swipe-to-indent, then had to defend it)

- **Both** models: toolbar has "Indent / Outdent bullet" and "Move Rem up or down" among ~14
  commands behind a `+` and `/` menu — https://help.remnote.com/en/articles/7000505-mobile-app
- Swipe-to-indent shipped Jan 2024: "you can now smoothly swipe to indent the current Rem you're
  editing on mobile" — https://x.com/remnote/status/1749570398251839979
- **The canonical cautionary tale**: an App Store review — "Whenever you scroll down or up… a Rem
  almost ALWAYS gets accidentally indented or outdented, often ruining entire tree structures…
  An easy fix would be… 'Disable swipe to indent'." RemNote replied "we're looking into your
  suggestion to disable swipe to indent", and the reviewer later edited: "EDIT: Swipe to indent on
  the mobile app has been fixed!" — https://apps.apple.com/us/app/remnote-notes-flashcards/id1545429784
  Forum version: "by scrolling my documents I very often move rems to somewhere or indent/outdent
  them unintended… **Indent and Outdent work well on mobile with the buttons in the button-bar**" —
  https://forum.remnote.io/t/drag-drop-vs-scrolling-on-mobile/4810
- Outdent semantics are a *product decision worth copying*: by default outdenting moves the Rem
  up/down as needed to preserve parent/child relations, with a setting for "Google-Docs Style"
  literal outdent — https://help.remnote.com/en/articles/8196578-outlines-and-terminology
  (Workflowy shipped and then reverted a similar outdent change after backlash —
  https://blog.workflowy.com/moving-bullets-is-now-easier-than-ever/)

## Obsidian (the customisable-toolbar reference)

- Mobile toolbar = a row of icons at the bottom while editing; if crowded, "you can swipe left and
  right on the toolbar to reveal more actions"; fully user-configurable via Settings → Mobile →
  Manage toolbar options, including arbitrary global commands — https://help.obsidian.md/mobile
- Users add "indent list", "toggle bullet list", "toggle checkbox" to the toolbar precisely because
  phones have no Tab key: "It was quicker to insert links and indents (since I don't have a tab key)"
  — https://ryan.himmelwright.net/post/my-obsidian-mobile-setup/
- **Quick Action**: one action bound to pull-down-from-top, like pull-to-refresh (defaults to command
  palette) — a cheap gesture slot that doesn't collide with row-level swipes.
- The Commander plugin's option list is a good spec for toolbar ergonomics: rows 0–5, default button
  size **48 px**, and a "Bottom Offset… useful if the toolbar is obscured by the iPhone home bar or
  Android navigation gestures" — https://thedocumentation.org/obsidian-commander/usage/mobile_toolbar/
- Obsidian is not an outliner; nesting is markdown list indentation, so there is no per-row
  action bar / tap-to-select model to copy.

## Apple Notes (the gesture users already know)

- Official: "**Swipe the list item right to indent and left to reverse the indent**"; reorder by
  dragging the handle — https://support.apple.com/en-us/102296
- This is why swipe-right = indent feels "native" to iPhone users and why RemNote/Logseq chose the
  same direction. It also means **swipe-right must not mean "complete"** if you also want it to mean
  indent (Workflowy's conflict).

## Checkvist (mobile *web* app, closest architectural analogue to FoodWiki)

- Explicitly a PWA at m.checkvist.com, "save it to the homescreen"; interaction model:
  "**Double-tap to edit list items, tap-n-drag to change indentation or reorder.**" Plus hoist/focus
  on one branch "to edit or add list items conveniently in large hierarchical lists" —
  https://checkvist.com/auth/mobile
- Note the two ideas: (a) a *single* drag gesture handles both axes (horizontal = indent, vertical =
  reorder); (b) **hoist/zoom is a mobile feature, not a power feature** — narrowing the visible
  subtree is how you make a deep tree usable on a phone.
- Desktop model: Tab/Shift-Tab indentation, Enter saves and creates the next item, Esc leaves entry
  mode — https://checkvist.com/help ,
  https://web.appstorm.net/how-to/productivity-how-to/checkvist-collaborative-outliner-task-manager/
- **Weakness**: reviewers say the mobile web app is thin — "It is very difficult to use on small
  screen mobile devices. It would benefit greatly from a dedicated app with a good GUI";
  "The mobile version is quite simple. It's more than adequate if you just want to view your lists
  or mark a task as complete." — https://www.capterra.com/p/158379/Checkvist/reviews/
  (Other reviewers call it "great mobile web app (feels like native)" —
  https://alternativeto.net/software/checkvist/about — so opinions split.)

## OmniOutliner for iOS (pre-swipe, selection + edit-bar model — i.e. FoodWiki's current design)

- Exactly the tap-to-select + action-bar pattern: "When a row has content that belongs inside the row
  above it, **tap to select it, then tap Indent in the edit bar**" —
  https://support.omnigroup.com/omnioutliner-ios-getting-started/
  Manual: "Outdent — tap to reduce the indent level of a selected row; **Outdent isn't available if a
  row is not indented**. Indent — tap to indent the row." —
  https://support.omnigroup.com/documentation/omnioutliner/ios/2.9.6/en/a-quick-tour-of-omnioutliner-for-ios/
  (Disabling impossible actions instead of failing silently is a small, cheap win.)
- Reorder: press-and-hold a **dedicated row handle**, with an insertion line showing the drop target;
  dropping *onto* a row makes it a child rather than a peer. Multi-select via hold-then-tap-others.
- They also concede keyboard supremacy: "Entry goes much faster if you have a Bluetooth keyboard".

## Roam Research (mobile web; instructive failure)

- Roam's mobile bar is where indent lives, and it has silently vanished for users:
  "When I type a note on mobile, the mobile bar is missing, so I can't indent, upload a picture etc."
  reproducible across iOS Safari, Brave, Android Chrome/Firefox —
  https://github.com/Roam-Research/issues/issues/594
- The single best statement of the core problem, from a Roam power user writing custom mobile CSS:
  "one thing that's tough with outliner apps is getting the toggle touch points right. Instead of
  just having text, you have to have a toggle, a bullet, and then text. That's a lot of stuff to have
  on a screen… with a touchscreen and your finger… touch is less precise and your finger is larger
  than a mouse pointer. The touch points need to be bigger which is hard because you are already
  dealing with significantly less screen real estate." Their fix (borrowed from Craft): pad the
  toggle generously and accept that text starts further right — "You have to make some concessions on
  mobile." In stock Roam "the toggle is cut off which makes expanding the bullet super difficult."
  https://pkmdiaries.substack.com/p/better-mobile-roam-css
- General assessment from the outliner community: "access on mobile is usable to some respect but
  full of little bugs and usability problems" —
  https://www.outlinersoftware.com/topics/viewt/9454/0/

## Anytype

- **No touch indent for years.** Feature request "A way to indent bullet lists natively on mobile app
  (Android and iOS)" opened Jan 2022, still accumulating "+1 for such features" in late 2023 —
  https://community.anytype.io/t/indent-blocks-natively-on-mobile/4268 ; a separate Help thread
  "How can I indent and outdent bullet points on mobile? I can't figure it out" (2023) —
  https://community.anytype.io/t/how-can-i-indent-and-outdent-bullet-points-on-mobile/10133
- Its model is Notion-style: nesting comes from **dragging the block handle** ("Click and hold, then
  drag the block: Up or down to a different position…"; most block types support nesting) —
  https://doc.anytype.io/anytype/create/editor . On desktop that's fine; on a phone the handle is the
  bottleneck.
- Mobile does have an above-keyboard editor toolbar that they keep adding to (recent iOS release
  notes: "Added the @ mention button back to the editor toolbar above the keyboard"; "Prominent
  Undo / Redo Buttons: We've added dedicated buttons to the toolbar above the keyboard so they're
  always visible while editing") — https://apps.apple.com/us/app/anytype-the-everything-app/id6449487029
- **Lesson**: a block-drag-only nesting model is effectively "no nesting" on mobile. FoodWiki's
  explicit indent/outdent buttons are strictly better than Anytype here.

## TiddlyWiki

- No first-party outliner; nesting/mobile behaviour depends on plugins (e.g. JD's "Mobile Layout"
  plugin, "improves the usability of TiddlyWiki on smartphones", listed on tiddlywiki.com). I could
  **not** verify any TiddlyWiki outliner plugin with touch indent gestures — treat "TW5 + plugin" as
  unproven for this use case. **[unverified]**
- Community consensus on mobile is poor: "My conclusion, after three days of experiments, is that
  TiddlyWiki is not actually usable on Android at this point"
  (https://groups.google.com/d/topic/tiddlywiki/OmMiYXhJXKY); "editing tiddlers on a TiddlyWiki in a
  phone is very painstaking… the layout of my TiddlyWiki doesn't scale nicely"
  (https://groups.google.com/g/tiddlywikidev/c/O9eRkb-lnw8). A core-adjacent reply in that thread
  makes a defensible general point: "Creating, entering text strings, editing blocks of text is a
  kind of activity that small screen touch devices do not do well with… your observation is I believe
  not about tiddlywiki but about mobile-first use."
- Editor-plugin thread notes the narrow-viewport toolbar failure mode: "with a narrower frame, they
  cause the editor toolbar buttons to bunch together" —
  https://groups.google.com/g/TiddlyWiki/c/U6z83W5vZNA

## Twos (small app, unusually good mobile-native shortcuts — worth stealing)

- "**Space to indent**: At the front of anything you can press space to indent it. You can also
  outdent by pressing backspace at the front of a thing." Plus swipe-right = complete,
  swipe-left = select, press-and-hold = reorder —
  https://parkerklein.substack.com/p/10-essential-shortcuts-for-twos-app
  Space/Backspace-at-start is the only indent affordance that works on *every* soft keyboard with
  zero chrome and zero gesture conflicts. The same idea was requested for Dynalist (MyLifeOrganized
  precedent, link above).

## Sigma Notes / OneNote / AT-Protocol outliners

- **Not verified.** I found no citable documentation of Sigma Notes' mobile indent gestures, and no
  AT Protocol outliner (Bulleted, "ghostwriter", Tauri natives) with published mobile-UX docs; the
  curated awesome-atproto app list (https://github.com/atblueprints/awesome-atproto) contains no
  outliner/PKM app as of this research. Treat the atproto-outliner space as greenfield — there is no
  prior art to copy or differentiate against. **[unverified]**

---

## Shared patterns: what the credible players do consistently

1. **A persistent action bar pinned above the keyboard is the primary structural-edit surface.**
   Dynalist, Logseq, RemNote, Obsidian, Anytype, OmniOutliner all put indent/outdent (and usually
   move up/down) there. Every tool that tried to *remove* those buttons in favour of gestures got
   pushback (Logseq #5585/#7894). FoodWiki's sticky bottom bar is the mainstream, defensible choice.
2. **Gestures are an accelerator layered on top of buttons, never a replacement.** Where swipe-indent
   exists (Logseq, RemNote, Apple Notes) the buttons still exist too.
3. **Swipe-right = indent, swipe-left = outdent** is the de-facto standard because Apple Notes taught
   it. Do not repurpose swipe-right for "complete"/delete if you ever want indent gestures.
4. **Reorder = long-press to pick up, then drag, with an insertion indicator.** OmniOutliner (row
   handle), Workflowy (long-press → drag handle), Checkvist (tap-n-drag), Anytype (block handle).
   Notably, Dynalist and Logseq *don't* do drag-reorder on mobile and instead use ↑/↓ buttons — which
   the Dynalist critique flags as a missing conventional affordance but which nobody reports losing
   data to. Buttons are the safe default; drag is the delight upgrade.
5. **Enter = new sibling is universal and uncontroversial**, with multi-line deliberately sacrificed
   (Dynalist critique: "optimizes for the common case"). Provide a separate explicit newline command
   if you need one (Logseq's `↪` toolbar button).
6. **Reduce indentation width dramatically on narrow screens, keep the vertical guide lines.**
   Logseq: 45 px → 12 px. Dynalist keeps the sibling guide line as the primary hierarchy cue. Nobody
   horizontally scrolls the tree; text wraps.
7. **Zoom/hoist into a subtree is a mobile necessity, not a power feature** (Workflowy zoom-on-bullet,
   Checkvist "hoist one branch to edit or add list items conveniently in large hierarchical lists").
8. **Big touch targets, generous padding around the bullet/toggle, and accept the text starting
   further right** (Roam CSS post; Commander's 48 px default button size).

## What NOT to do — mobile pitfalls, with receipts

- **Don't let swipe-to-indent compete with scrolling.** This is the single most damaging failure in
  the category: RemNote ("a Rem almost ALWAYS gets accidentally indented or outdented… ruining
  entire tree structures") and Logseq (accidental indent while selecting text). Mitigations proven in
  Logseq's source: require `|dx| > 30 px` **and** `|dy| < 30 px`, arm the gesture only within 600 ms
  of touchstart, abort if a text Range selection exists, commit only past a 40 px threshold, and
  provide an opt-out setting.
- **Don't let swipe compete with horizontally scrollable content** (Workflowy boards: "When I try to
  scroll a board left or right I usually end up swiping an item instead").
- **Don't trust `position: fixed`/`sticky` for the action bar on iOS.** Dynalist's toolbar is missing
  or clipped in mobile browsers while working in the native shell
  (talk.dynalist.io/t/8754); Roam's mobile bar disappears entirely (Roam issue #594); Logseq's
  toolbar "gets stuck in the centre of the screen" (#11251). Additionally, iOS 26 has an active
  regression where `visualViewport.offsetTop` doesn't reset after keyboard dismissal, leaving fixed
  headers/footers misaligned — Apple developer forums thread 800154 /
  https://developer.apple.com/forums/thread/801028 ("position: sticky; bottom: 0 … stops at the
  height where the toolbar was"). Drive the bar off `window.visualViewport` height/offset with a
  debounce (Safari "fires visualViewport resize for all kinds of subtle reasons: suggestion bar
  adjustments, autocomplete popping up… Without a filter, keyboardIsOpen would flip constantly" —
  https://medium.com/@ivangrsk.it/taming-the-ios-keyboard-in-react-...), and budget a bottom offset
  for the home bar / Android gesture nav.
- **Don't ignore caret auto-scroll on Enter.** Workflowy shipped fixes for "text will no longer jump
  too high and disappear above the keyboard when you press Enter", "iOS keyboard no longer covers the
  node you're editing", and "micro-bounce when typing on iOS". Logseq solves it by explicitly
  scrolling the caret to ~¼ viewport height using `visualViewport.height - keyboardHeight - toolbar`.
- **Don't ignore IME/composition.** Logseq must blur the textarea to force the IME to commit before
  running indent/move; predictive keyboards + auto-capitalisation also bit Workflowy ("iOS keyboard
  suggestions now work correctly when Workflowy capitalizes the first word of an item"). Any
  app-controlled mutation of a focused textarea's value mid-composition is a bug factory.
- **Don't make expand/collapse and bullet targets small or far from the text.** Roam's cut-off toggle;
  Workflowy iPad users needing "two to three attempts to expand the right thing".
- **Don't put nesting behind drag-only affordances** — that's Anytype, and it produced a 2-year-old
  "please let me indent on mobile" thread.
- **Don't silently no-op invalid structural edits.** OmniOutliner greys out Outdent when the row is
  at root; Workflowy users complained loudly when "Shift-Tab does nothing at all" in certain
  configurations (blog comments), and Workflowy reverted the change.
- **Don't lose edits to sync latency.** Logseq's top App Store complaint: typing before sync settles
  "will either get lost or it will overwrite something else you had written previously." For FoodWiki
  this is the AT-Proto per-bullet-record risk: local-first write, optimistic UI, queue + reconcile,
  never block input on a network round-trip.
- **Don't assume search substitutes for structure on mobile.** Every tool leans on zoom/hoist and
  collapse to make deep trees navigable; FoodWiki has *no* server-side search, so hoist + collapse +
  breadcrumbs carry proportionally more weight.

## Direct implications for FoodWiki (opinionated)

- Keep the sticky bottom action bar as primary; that's the consensus design. Size buttons ~48 px,
  add safe-area bottom padding, and position with `visualViewport`, debounced.
- Add swipe-right/left = indent/outdent *later*, as an accelerator, with Logseq's exact thresholds
  (dx>30, dy<30, 600 ms arming window, abort on text selection, 40 px commit, haptic on commit) and
  a settings toggle from day one.
- Consider Twos' **space-at-start = indent / backspace-at-start = outdent** — zero chrome, zero
  gesture conflict, works with the textarea you already have, and lets a user build a whole nested
  list without leaving the keyboard. This is the highest-leverage cheap win in this report.
- Ship hoist/zoom-into-bullet and collapse early; they matter more for you than for others because
  there is no server-side search.
- Reduce per-level indent to ~12–16 px on phones and rely on a left guide line; never horizontal-scroll.
- Decide outdent semantics explicitly (RemNote's relation-preserving default vs Google-Docs literal)
  and don't change it later — both Workflowy and RemNote got burned here.
- Grey out impossible actions (indent when first child, outdent at root) rather than no-oping.
