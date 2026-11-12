// E5: does the EnableEmbeddedAsarIntegrityValidation fuse work? Launch untouched (must start), then with one byte appended to app.asar (must refuse).
// usage: node scripts/asar-integrity-check.mjs <packaged app dir>   (build with FOLIO_FUSE_ASAR_INTEGRITY=1 FOLIO_FUSE_INSPECT=1)
import { _electron as electron } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(process.argv[2]);
const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, '..', '..', 'fixtures');
const exe = process.platform === 'win32' ? path.join(dir, 'Folio.exe') : path.join(dir, 'Folio');
const asar = path.join(dir, 'resources', 'app.asar');
const args = process.platform === 'linux' ? ['--no-sandbox'] : [];
async function tryLaunch(label) {
  const t = Date.now();
  try {
    const app = await electron.launch({ executablePath: exe, args, timeout: 20000, env: { ...process.env, FOLIO_AUTOMATION: '1', FOLIO_DATA_DIR: fixtures, FOLIO_USER_DATA: fs.mkdtempSync(path.join(os.tmpdir(), 'folio-asar-')) } });
    const page = await app.firstWindow();
    await page.waitForFunction(() => window.__folio?.getState().ready, null, { timeout: 15000 });
    console.log(`${label}: STARTED and reached ready in ${Date.now() - t} ms`);
    await app.close();
    return true;
  } catch (e) { console.log(`${label}: DID NOT START (${String(e).split('\n')[0].slice(0, 160)}) after ${Date.now() - t} ms`); return false; }
}
const ok1 = await tryLaunch('untouched app.asar');
fs.appendFileSync(asar, Buffer.from([0]));
const ok2 = await tryLaunch('app.asar with one byte appended');
console.log(`RESULT: integrity validation ${ok1 && !ok2 ? 'WORKS (untouched starts, tampered refused)' : ok1 && ok2 ? 'NOT ENFORCED (tampered file still started)' : 'INCONCLUSIVE (untouched build did not start)'}`);
