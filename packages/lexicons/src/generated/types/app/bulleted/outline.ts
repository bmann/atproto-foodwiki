import type {} from '@atcute/lexicons';
import * as v from '@atcute/lexicons/validations';
import type {} from '@atcute/lexicons/ambient';

const _contributorSchema = /*#__PURE__*/ v.object(
	{
		"$type": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("app.bulleted.outline#contributor")),
		/**
		 * The contributing identity. A DID and never a handle: a handle is a lease, and a grant that followed one would move when the name did.
		 */
		"did": /*#__PURE__*/ v.didString(),
	}
);
const _mainSchema = /*#__PURE__*/ v.record(
	/*#__PURE__*/ v.string(),
	/*#__PURE__*/ v.object(
		{
			"$type": /*#__PURE__*/ v.literal("app.bulleted.outline"),
			/**
			 * Identities whose records render inside this outline at this level and below, interleaved with the author's own. Absent inherits the nearest ancestor record's list; an empty array grants nobody and stops inheriting. How many are rendered is bounded by the application, not here. The Lexicon cannot express any of that, so the application enforces all of it.
			 */
			get "contributors"() {
				return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.array(contributorSchema))
			},
			/**
			 * When the outline was created.
			 */
			"createdAt": /*#__PURE__*/ v.datetimeString(),
			/**
			 * Longer summary of the outline.
			 * @maxLength 3000
			 * @maxGraphemes 600
			 */
			"description": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[
					/*#__PURE__*/ v.stringLength(0, 3000),
					/*#__PURE__*/ v.stringGraphemes(0, 600)
				]
			)),
			/**
			 * Preview image for link cards and og:image. SVG is deliberately excluded because it can carry script.
			 * @accept image/png, image/jpeg, image/webp
			 * @maxSize 1000000
			 */
			"image": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.blob(),
				[
					/*#__PURE__*/ v.blobSize(1000000),
					/*#__PURE__*/ v.blobAccept(["image/png", "image/jpeg", "image/webp"])
				]
			)),
			/**
			 * Alt text for image. Required whenever image is present; enforced by the application.
			 * @maxLength 2000
			 */
			"imageAlt": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[/*#__PURE__*/ v.stringLength(0, 2000)]
			)),
			/**
			 * The node at the top of this outline. Absent means the whole forest; present if and only if the record key is not 'self'. The Lexicon cannot express that conditional, so the application enforces it.
			 */
			"root": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.resourceUriString()),
			/**
			 * Display title for the outline.
			 * @maxLength 1000
			 * @maxGraphemes 200
			 */
			"title": /*#__PURE__*/ v.optional(/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.string(),
				[
					/*#__PURE__*/ v.stringLength(0, 1000),
					/*#__PURE__*/ v.stringGraphemes(0, 200)
				]
			)),
		}
	)
);
type contributor$schematype = typeof _contributorSchema;
type main$schematype = typeof _mainSchema;

export interface contributorSchema extends contributor$schematype {}

export interface mainSchema extends main$schematype {}
export const contributorSchema = _contributorSchema as contributorSchema;
export const mainSchema = _mainSchema as mainSchema;

export interface Contributor extends v.InferInput<typeof contributorSchema> {}

export interface Main extends v.InferInput<typeof mainSchema> {}
declare module '@atcute/lexicons/ambient' {
	interface Records {
		"app.bulleted.outline": mainSchema;
	}
}
