import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';
import * as AppBskyRichtextFacet from "@atcute/bluesky/types/app/richtext/facet";

const _mainSchema = /*#__PURE__*/ v.record(
	/*#__PURE__*/ v.tidString(),
	/*#__PURE__*/ v.object(
		{
			"$type": /*#__PURE__*/ v.literal("app.bulleted.note"),
			/**
			 * When the note was created.
			 */
			"createdAt": /*#__PURE__*/ v.datetimeString(),
			/**
			 * Rich text annotations over text.
			 */
			get "facets"() {
				return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(AppBskyRichtextFacet.mainSchema))
			},
			/**
			 * The node this note supplements. Must be an app.bulleted.node in the same repository with the same rkey as this record. Derivable from this record's own address, but stored anyway so a third-party app encountering the record in isolation can tell what it supplements.
			 */
			"subject": /*#__PURE__*/ v.resourceUriString(),
			/**
			 * The note's content.
			 * @maxLength 100000
			 * @maxGraphemes 20000
			 */
			"text": /*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[
					/*#__PURE__*/ v.stringLength(0, 100000),
					/*#__PURE__*/ v.stringGraphemes(0, 20000)
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
		"app.bulleted.note": mainSchema;
	}
}
