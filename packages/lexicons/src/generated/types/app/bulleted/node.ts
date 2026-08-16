import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as AppBskyRichtextFacet from "@atcute/bluesky/types/app/richtext/facet";

const _mainSchema = /*#__PURE__*/ v.record(
	/*#__PURE__*/ v.tidString(),
	/*#__PURE__*/ v.object(
		{
			"$type": /*#__PURE__*/ v.literal("app.bulleted.node"),
			/**
			 * Presence means completed; there is no separate boolean. Only meaningful for todo layout.
			 */
			"completedAt": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
			/**
			 * When the bullet was created.
			 */
			"createdAt": /*#__PURE__*/ v.datetimeString(),
			/**
			 * Whether this bullet's children are shown when a reader has no preference of their own. Treat an absent value as "expanded". A reader's own choice always wins; this is what a client shows before they have made one. An open set, so values added by later versions do not fail validation.
			 */
			"display": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string<"collapsed" | "expanded" | (string & {})>()),
			/**
			 * Rich text annotations over text.
			 */
			get "facets"() {
				return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(AppBskyRichtextFacet.mainSchema))
			},
			/**
			 * How the bullet renders. Defaults to bullet. An open set, so values added by later versions do not fail validation.
			 */
			"layout": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string<"bullet" | "codeBlock" | "h1" | "h2" | "h3" | "quoteBlock" | "todo" | (string & {})>()),
			/**
			 * The parent node. Absent means top level. A bare AT-URI rather than a strongRef, because a strongRef pins a CID and the parent's CID changes on every edit to its text.
			 */
			"parent": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.resourceUriString()),
			/**
			 * Fractional index ordering this node among its siblings. Kept separate from the record key because record keys are TIDs, which sort by creation time and cannot change without recreating the record and breaking every inbound reference.
			 * @maxLength 512
			 */
			"sortKey": /*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[/*#__PURE__*/ v.stringLength(0, 512)]
			),
			/**
			 * The bullet's content.
			 * @maxLength 10000
			 * @maxGraphemes 2000
			 */
			"text": /*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[
					/*#__PURE__*/ v.stringLength(0, 10000),
					/*#__PURE__*/ v.stringGraphemes(0, 2000)
				]
			),
		}
	)
);
type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}
export const mainSchema = _mainSchema as mainSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}
declare module '@atcute/lexicons/ambient' {
	interface Records {
		"app.bulleted.node": mainSchema;
	}
}
