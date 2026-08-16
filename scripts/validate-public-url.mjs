// Guard against the HappyView boot panic "Failed to create OAuth client:
// ClientMetadata(InvalidClientId)" caused by a malformed PUBLIC_URL.
// Usage: PUBLIC_URL=https://... node scripts/validate-public-url.mjs
const url = process.env.PUBLIC_URL;
if (!url) { console.error('PUBLIC_URL is not set'); process.exit(1); }
try {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error(`protocol must be http(s), got ${u.protocol}`);
  if (u.username || u.password) throw new Error('URL must not contain credentials');
  if (u.pathname && u.pathname !== '/') throw new Error('URL must not include a path (use BASE_PATH for subpaths)');
} catch (e) {
  console.error(`PUBLIC_URL invalid: ${url} — ${e.message}`);
  console.error('Expected format: https://<host> (no trailing slash, no path, no credentials)');
  process.exit(1);
}
console.log(`OK: PUBLIC_URL=${url}`);
