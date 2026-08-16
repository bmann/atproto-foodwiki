import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _mainSchema = /*#__PURE__*/ v.procedure(
	"app.bulleted.admin.undeny",
	{
		"params": null,
		"input": {
			"type": "lex",
			"schema": /*#__PURE__*/ v.object(
				{
					/**
					 * The value to remove. Normalized the same way it was on the way in, so a PDS endpoint written with a trailing slash still matches.
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
					 * The kind the entry had.
					 */
					"kind": /*#__PURE__*/ v.string<"aturi" | "cid" | "did" | "pds" | (string & {})>(),
					/**
					 * How the content comes back, which depends entirely on the kind. backfillOnView: the repository has zero rows, so the next view is an ordinary first view and backfill returns the content by itself. refetchEnqueued: an aturi undeny, where the repository still has all its other rows and NOTHING would ever trigger a backfill, so a targeted com.atproto.repo.getRecord has been queued. immediate: a cid undeny, where the record was never removed and the blob returns on the next cache miss.
					 */
					"restoration": /*#__PURE__*/ v.string<"backfillOnView" | "immediate" | "refetchEnqueued" | (string & {})>(),
					/**
					 * The value as stored.
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
		"app.bulleted.admin.undeny": mainSchema;
	}
}
