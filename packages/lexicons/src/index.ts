// FoodWiki lexicon surface — re-exports generated Bulleted types + registers the
// atcute ambient types (Records / Queries) so `@atcute/client` calls are fully typed.
export * as bulleted from './generated/index.js';
import type {} from './generated/index.js';
export type { Main as NodeRecord } from './generated/types/app/bulleted/node.js';
export type { Main as NoteRecord } from './generated/types/app/bulleted/note.js';
export type { Main as OutlineRecord } from './generated/types/app/bulleted/outline.js';
export type { $output as OutlineOutput, $params as OutlineParams } from './generated/types/app/bulleted/getOutline.js';
