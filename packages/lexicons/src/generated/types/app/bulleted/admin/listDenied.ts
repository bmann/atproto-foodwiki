import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _entrySchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("app.bulleted.admin.listDenied#entry")),
		/**
		 * The free-text moderation note, if one was given.
		 */
		"comment": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
		"createdAt": /*#__PURE__*/ v.datetimeString(),
		/**
		 * The administrative identifier that added the entry. Never caller-supplied.
		 */
		"createdBy": /*#__PURE__*/ v.string(),
		/**
		 * The kind derived from the value when it was added.
		 */
		"kind": /*#__PURE__*/ v.string<"aturi" | "cid" | "did" | "pds" | (string & {})>(),
		/**
		 * The denied value, as stored.
		 */
		"value": /*#__PURE__*/ v.string(),
	}
);
const _mainSchema = /*#__PURE__*/ v.query(
	"app.bulleted.admin.listDenied",
	{
		"params": /*#__PURE__*/ v.object(
			{
				/**
				 * The cursor from the previous page. Encodes the created-at instant and the value together, so an entry added mid-scan can neither appear twice nor be skipped.
				 */
				"cursor": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
				/**
				 * Entries per page.
				 * @minimum 1
				 * @maximum 200
				 * @default 50
				 */
				"limit": /*#__PURE__*/ v.optional(
					/*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.integer(),
						[/*#__PURE__*/ v.integerRange(1, 200)]
					),
					50
				),
			}
		),
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					/**
					 * Pass back as cursor for the next page. Absent at the end.
					 */
					"cursor": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
					get "entries"() {
						return /*#__PURE__*/ v.array(entrySchema)
					},
				}
			),
		}
	}
);
type entry$schematype = typeof _entrySchema;
type main$schematype = typeof _mainSchema;

export interface entrySchema extends entry$schematype {}

export interface mainSchema extends main$schematype {}
export const entrySchema = _entrySchema as entrySchema;
export const mainSchema = _mainSchema as mainSchema;

export interface Entry extends v.InferInput<typeof entrySchema> {}

export interface $params extends v.InferInput<mainSchema['params']> {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCQueries {
		"app.bulleted.admin.listDenied": mainSchema;
	}
}
