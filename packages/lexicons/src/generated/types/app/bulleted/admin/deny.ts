import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _mainSchema = /*#__PURE__*/ v.procedure(
	"app.bulleted.admin.deny",
	{
		"params": null,
		"input": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					/**
					 * Free-text moderation note. Not the audit field: who performed the action is taken from the administrative credential and recorded separately, because a moderation log has to answer 'who removed this and when' as a queryable field rather than as a convention about comment text.
					 * @maxLength 2048
					 */
					"comment": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.string(),
						[/*#__PURE__*/ v.stringLength(0, 2048)]
					)),
					/**
					 * Remove what is already indexed. True by default and the reason this endpoint exists: adding to the list only stops future indexing. Pass false to pre-emptively block something that has not been indexed yet.
					 * @default true
					 */
					"nuke": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.boolean(), true),
					/**
					 * What to deny. The kind is DERIVED from this value and is never supplied by the caller: did: is a repository, at:// is one record, http:// or https:// is a PDS endpoint, and a canonical CIDv1 is a blob. A value matching none of the four is a 400 rather than a guess.
					 * @maxLength 2048
					 */
					"value": /*#__PURE__*/ v.constrain(
						/*#__PURE__*/ v.string(),
						[/*#__PURE__*/ v.stringLength(0, 2048)]
					),
				}
			),
		},
		"output": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					/**
					 * Cached blob files removed.
					 */
					"blobs": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
					/**
					 * The kind derived from the value.
					 */
					"kind": /*#__PURE__*/ v.string<"aturi" | "cid" | "did" | "pds" | (string & {})>(),
					/**
					 * Rows removed from the appview. Zero when nuke was false.
					 */
					"nuked": /*#__PURE__*/ v.integer(),
					/**
					 * Repositories emptied. One for a did nuke; zero or more for a pds nuke.
					 */
					"repos": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
					/**
					 * The value as stored. A PDS endpoint is normalized to one spelling, so this may differ from the input.
					 */
					"value": /*#__PURE__*/ v.string(),
				}
			),
		}
	}
);
type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}
export const mainSchema = _mainSchema as mainSchema;

export interface $params {}

export interface $input extends v.InferXRPCBodyInput<mainSchema['input']> {}

export interface $output extends v.InferXRPCBodyInput<mainSchema['output']> {}
declare module '@atcute/lexicons/ambient' {
	interface XRPCProcedures {
		"app.bulleted.admin.deny": mainSchema;
	}
}
