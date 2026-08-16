import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _mainSchema = /*#__PURE__*/ v.record(
	/*#__PURE__*/ v.tidString(),
	/*#__PURE__*/ v.object(
		{
			"$type": /*#__PURE__*/ v.literal("app.bulleted.mirror"),
			/**
			 * When the mirror was created.
			 */
			"createdAt": /*#__PURE__*/ v.datetimeString(),
			/**
			 * The node being mirrored. A bare AT-URI rather than a strongRef, because a mirror must track the live bullet including later edits; a strongRef would pin a CID and freeze the content.
			 */
			"original": /*#__PURE__*/ v.resourceUriString(),
			/**
			 * The node this mirror hangs under. Absent means top level.
			 */
			"parent": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.resourceUriString()),
			/**
			 * Fractional index ordering this mirror among its siblings.
			 * @maxLength 512
			 */
			"sortKey": /*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[/*#__PURE__*/ v.stringLength(0, 512)]
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
		"app.bulleted.mirror": mainSchema;
	}
}
