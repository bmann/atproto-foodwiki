// CI helper: verify deploy/happyview/Dockerfile (clone-source form) produces the
// SAME runtime stages as the upstream HappyView Dockerfile at the pinned REF.
// Normalize: drop comments/blanks, drop the git-clone source stage, strip
// "--from=source /src/" from COPY sources, and unify destination "./" vs ".".
const REF = process.env.HAPPYVIEW_REF || 'v2.13.0';
const UPSTREAM = `https://raw.githubusercontent.com/gamesgamesgamesgamesgames/happyview/${REF}/Dockerfile`;
const LOCAL = new URL('../deploy/happyview/Dockerfile', import.meta.url);
import { readFile } from 'node:fs/promises';

function canonical(lines) {
  const out = [];
  let inSourceStage = false;
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    if (l.startsWith('#')) continue;
    if (l.startsWith('FROM alpine/git')) { inSourceStage = true; continue; }
    if (inSourceStage) {
      if (l.startsWith('FROM ')) inSourceStage = false;
      else continue;
    }
    let cmd = l;
    if (cmd.startsWith('COPY --from=source')) {
      cmd = 'COPY ' + cmd.replace(/^COPY --from=source /, '').replace(/\/src\//g, '');
    } else if (cmd === 'COPY --from=builder /app/migrations /app/migrations') {
      cmd = 'COPY migrations/ /app/migrations';
    }
    // unify trailing destination: "X ./" → "X .", "X ." stays
    cmd = cmd.replace(/(\S+) \.\/$/, '$1 .');
    out.push(cmd);
  }
  return out.join('\n');
}

try {
  const [upRaw, localRaw] = await Promise.all([
    fetch(UPSTREAM).then((r) => r.text()),
    readFile(LOCAL, 'utf8'),
  ]);
  const up = canonical(upRaw.split('\n'));
  const local = canonical(localRaw.split('\n'));
  if (up !== local) {
    console.error(`Mismatch: deploy/happyview/Dockerfile differs from upstream HappyView Dockerfile @ ${REF}`);
    process.exit(1);
  }
  console.log(`OK: deploy/happyview/Dockerfile matches upstream HappyView Dockerfile @ ${REF}`);
} catch (e) {
  console.error('Could not check upstream:', e.message);
  process.exit(2);
}
