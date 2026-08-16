import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as AppBskyRichtextFacet from "@atcute/bluesky/types/app/richtext/facet";

const _mainSchema = /*#__PURE__*/ v.query(
	"app.bulleted.getOutline",
	{
		"params": /*#__PURE__*/ v.object(
			{
				/**
				 * Levels below the root to return; 1 is the root's children only. Clamped rather than rejected, so a value outside the range is answered with the nearest one in range.
				 * @minimum 1
				 * @maximum 5
				 * @default 3
				 */
				"depth": /*#__PURE__*/ v.optional(
					/*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.integer(),
						[/*#__PURE__*/ v.integerRange(1, 5)]
					),
					3
				),
				/**
				 * The identity whose outline to read. A DID and never a handle: a handle is a lease on a name, and resolving one here would make this endpoint an open resolver somebody else pays for.
				 */
				"did": /*#__PURE__*/ v.didString(),
				/**
				 * Ceiling on nodes returned across ALL levels, not per level. Clamped rather than rejected. A per-level reading would make depth 5 with limit 100 a five-hundred-node answer to a request that said one hundred.
				 * @minimum 1
				 * @maximum 100
				 * @default 10
				 */
				"limit": /*#__PURE__*/ v.optional(
					/*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.integer(),
						[/*#__PURE__*/ v.integerRange(1, 100)]
					),
					10
				),
				/**
				 * Record key of the bullet to zoom into. Absent means the whole outline. The record key rather than an AT-URI, matching /public/{did}/{rkey}: the identity is already named by did, and two fields that can disagree about it is a bug waiting to be written.
				 */
				"node": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
			}
		),
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					/**
					 * The identity this outline belongs to, echoed back.
					 */
					"did": /*#__PURE__*/ v.didString(),
					/**
					 * The handle this appview last observed for did. Absent when none has been observed. Never resolved on demand, so it may lag the network and must not be treated as authoritative.
					 */
					"handle": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.handleString()),
					/**
					 * Pre-order, siblings in sortKey order. Flat, not nested: parentage is in each node's parent field, exactly as it is in the records themselves.
					 */
					get "nodes"() {
						return /*#__PURE__*/ v.array(nodeSchema)
					},
					/**
					 * The app.bulleted.outline record in effect at this level. It may have been written at an ancestor rather than here; uri says which, and there is deliberately no separate inherited flag because the URI already answers it.
					 */
					get "outline"() {
						return /*#__PURE__*/ v.optional(outlineSchema)
					},
					/**
					 * The zoomed bullet itself, so a caller can title the level without a second request. Absent when the whole outline was asked for.
					 */
					get "root"() {
						return /*#__PURE__*/ v.optional(nodeSchema)
					},
					/**
					 * Which bound ended the walk. Present alongside truncated on purpose: one boolean is what most callers want, and a caller deciding whether to ask again with a larger depth needs to know which limit it hit.
					 */
					"stop": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string<"complete" | "depth" | "limit" | (string & {})>()),
					/**
					 * Whether anything was left out. True whenever stop is not 'complete'.
					 */
					"truncated": /*#__PURE__*/ v.boolean(),
				}
			),
		}
	}
);
const _mirrorSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("app.bulleted.getOutline#mirror")),
		/**
		 * The app.bulleted.node this mirror renders.
		 */
		"original": /*#__PURE__*/ v.resourceUriString(),
	}
);
const _nodeSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("app.bulleted.getOutline#node")),
		/**
		 * How many children this bullet has, whether or not they are in this response. Without it a leaf and a bullet cut off by depth or limit are the same absence.
		 */
		"childCount": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
		/**
		 * The record CID as this appview last indexed it.
		 */
		"cid": /*#__PURE__*/ v.cidString(),
		/**
		 * Presence means completed; there is no separate boolean anywhere in this system.
		 */
		"completedAt": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
		"createdAt": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
		/**
		 * The repository this record lives in. Usually the identity the request named, and NOT always: an outline whose app.bulleted.outline admits contributors answers with their records too, rendered in place among the author's own. Read this rather than parsing the authority out of uri.
		 */
		"did": /*#__PURE__*/ v.didString(),
		/**
		 * Whether this row's children are shown when a reader has no preference of their own, verbatim as stored. Absent means expanded, as does any unrecognized value. Absent on a mirror, which renders another repository's subtree and has no hint of its own.
		 */
		"display": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string<"collapsed" | "expanded" | (string & {})>()),
		/**
		 * Rich text annotations over text, as stored. Byte ranges, so they index text as UTF-8.
		 */
		get "facets"() {
			return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(AppBskyRichtextFacet.mainSchema))
		},
		/**
		 * How the bullet renders, verbatim as stored. An open set: a value written by a later version arrives unchanged rather than folded onto bullet.
		 */
		"layout": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string<"bullet" | "codeBlock" | "h1" | "h2" | "h3" | "quoteBlock" | "todo" | (string & {})>()),
		get "mirror"() {
			return /*#__PURE__*/ v.optional(mirrorSchema)
		},
		/**
		 * The body of this bullet's app.bulleted.note, if it has one. Co-keyed with the bullet by the parallel-key rule, so it needs no URI of its own here.
		 */
		"note": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
		/**
		 * The bullet this one hangs under. Absent means top level of the identity's outline, which is not the same as top level of this response — a zoomed answer's rows all carry a parent.
		 */
		"parent": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.resourceUriString()),
		/**
		 * The record key.
		 */
		"rkey": /*#__PURE__*/ v.string(),
		/**
		 * Fractional index ordering this row among its siblings.
		 */
		"sortKey": /*#__PURE__*/ v.string(),
		/**
		 * The bullet's text, unrendered.
		 */
		"text": /*#__PURE__*/ v.string(),
		/**
		 * The record's own AT-URI.
		 */
		"uri": /*#__PURE__*/ v.resourceUriString(),
	}
);
const _outlineSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("app.bulleted.getOutline#outline")),
		"description": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
		/**
		 * Absolute URL of the preview image, served through this appview's blob proxy rather than as a raw blob reference, because a caller cannot fetch a blob without also knowing the PDS.
		 */
		"image": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.genericUriString()),
		"imageAlt": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
		"title": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
		/**
		 * The outline record this came from. Compare its rkey against the level to tell an inherited title from one written here.
		 */
		"uri": /*#__PURE__*/ v.resourceUriString(),
	}
);
type main$schematype = typeof _mainSchema;
type mirror$schematype = typeof _mirrorSchema;
type node$schematype = typeof _nodeSchema;
type outline$schematype = typeof _outlineSchema;

export interface mainSchema extends main$schematype {}

export interface mirrorSchema extends mirror$schematype {}

export interface nodeSchema extends node$schematype {}

export interface outlineSchema extends outline$schematype {}
export const mainSchema = _mainSchema as mainSchema;
export const mirrorSchema = _mirrorSchema as mirrorSchema;
export const nodeSchema = _nodeSchema as nodeSchema;
export const outlineSchema = _outlineSchema as outlineSchema;

export interface Mirror extends v.InferInput<typeof mirrorSchema> {}

export interface Node extends v.InferInput<typeof nodeSchema> {}

export interface Outline extends v.InferInput<typeof outlineSchema> {}

export interface $params extends v.InferInput<mainSchema['params']> {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		"app.bulleted.getOutline": mainSchema;
	}
}
