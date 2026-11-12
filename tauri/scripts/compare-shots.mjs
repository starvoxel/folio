// Pixel comparison of two screenshot directories. Tolerance: an image passes when at most MAX_RATIO of its pixels
// differ (pixelmatch per-pixel colour threshold 0.1, anti-aliasing ignored) and the sizes are identical.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const [a, b, maxRatioArg = '0.001'] = process.argv.slice(2);
const maxRatio = Number(maxRatioArg);
if (!a || !b) { console.error('usage: compare-shots.mjs <dirA> <dirB> [maxRatio]'); process.exit(2); }
const files = fs.readdirSync(a).filter((f) => f.endsWith('.png')).sort();
let failed = 0;
const rows = [];
for (const f of files) {
  const pb = path.join(b, f);
  if (!fs.existsSync(pb)) { rows.push(`${f}: MISSING in B`); failed++; continue; }
  const A = PNG.sync.read(fs.readFileSync(path.join(a, f)));
  const B = PNG.sync.read(fs.readFileSync(pb));
  if (A.width !== B.width || A.height !== B.height) { rows.push(`${f}: SIZE ${A.width}x${A.height} vs ${B.width}x${B.height}`); failed++; continue; }
  const diff = pixelmatch(A.data, B.data, undefined, A.width, A.height, { threshold: 0.1 });
  const ratio = diff / (A.width * A.height);
  const ok = ratio <= maxRatio;
  if (!ok) failed++;
  rows.push(`${f}: ${diff} px differ (${(ratio * 100).toFixed(4)}%) ${ok ? 'ok' : 'FAIL'}`);
}
console.log(rows.join('\n'));
console.log(`compared ${files.length} screenshots, tolerance ${(maxRatio * 100).toFixed(3)}% of pixels, ${failed} failed`);
process.exit(failed ? 1 : 0);
