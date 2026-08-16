import { defineLexiconConfig } from '@atcute/lex-cli';

export default defineLexiconConfig({
	generate: {
		files: ['packages/lexicons/schemas/*.json'],
		outdir: 'packages/lexicons/src/generated/',
		imports: ['@atcute/bluesky', '@atcute/atproto'],
	},
});
