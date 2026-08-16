import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as AppBskyRichtextFacet from "@atcute/bluesky/types/app/richtext/facet";

const _mainSchema = /*#__PURE__*/ v.record(
	/*#__PURE__*/ v.tidString(),
	/*#__PURE__*/ v.object(
		{
			"$type": /*#__PURE__*/ v.literal("app.bulleted.comment"),
			/**
			 * When the comment was created.
			 */
			"createdAt": /*#__PURE__*/ v.datetimeString(),
			/**
			 * Rich text annotations over text.
			 */
			get "facets"() {
				return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(AppBskyRichtextFacet.mainSchema))
			},
			/**
			 * The node this comment is about.
			 */
			"subject": /*#__PURE__*/ v.resourceUriString(),
			/**
			 * The comment's content.
			 * @maxLength 10000
			 */
			"text": /*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[/*#__PURE__*/ v.stringLength(0, 10000)]
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
		"app.bulleted.comment": mainSchema;
	}
}
