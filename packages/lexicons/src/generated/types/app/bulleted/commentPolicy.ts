import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _mainSchema = /*#__PURE__*/ v.record(
	/*#__PURE__*/ v.string(),
	/*#__PURE__*/ v.object(
		{
			"$type": /*#__PURE__*/ v.literal("app.bulleted.commentPolicy"),
			/**
			 * Rules granting permission to comment. An empty array closes comments, which is how a level turns off a policy it would otherwise inherit; a rule this app does not know grants nothing rather than everything.
			 * @maxLength 16
			 */
			"allow": /*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.array(/*#__PURE__*/ v.constrain(
					/*#__PURE__*/ v.string<"mentioned" | (string & {})>(),
					[/*#__PURE__*/ v.stringLength(0, 64)]
				)),
				[/*#__PURE__*/ v.arrayLength(0, 16)]
			),
			/**
			 * When the policy was written.
			 */
			"createdAt": /*#__PURE__*/ v.datetimeString(),
			/**
			 * The node this policy governs, along with its descendants. Absent means the whole repository; present if and only if the record key is not 'self'. The Lexicon cannot express that conditional, so the application enforces it — the same rule app.bulleted.outline follows.
			 */
			"root": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.resourceUriString()),
		}
	)
);
type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}
export const mainSchema = _mainSchema as mainSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}
declare module '@atcute/lexicons/ambient' {
	interface Records {
		"app.bulleted.commentPolicy": mainSchema;
	}
}
