import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const exeName = process.platform === 'win32' ? 'folio.exe' : 'folio';
const application = process.env.FOLIO_EXE ?? path.resolve(here, '..', 'src-tauri', 'target', 'e2e', 'release', exeName);
fs.mkdirSync(path.join(here, '..', 'test-results'), { recursive: true });

// Automation is opt-in at run time as well: the Rust side registers the WebDriver plugin only when this is "1".
process.env.FOLIO_AUTOMATION = '1';
process.env.FOLIO_DATA_DIR = path.resolve(here, '..', '..', 'fixtures');
// Software rendering on hosted runners; see TAURI-FINDINGS.md for which of these were actually needed.
if (process.env.FOLIO_WEBKIT_ENV) for (const kv of process.env.FOLIO_WEBKIT_ENV.split(',')) { const [k, v] = kv.split('='); process.env[k!] = v!; }

export const config = {
  runner: 'local',
  specs: [process.env.FOLIO_SPEC ?? './specs/slice.e2e.ts'],
  maxInstances: 1,
  capabilities: [{ browserName: 'tauri', 'tauri:options': { application } }],
  services: [['@wdio/tauri-service', { driverProvider: 'embedded' }]],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 120_000 },
  logLevel: 'info',
  outputDir: path.join(here, '..', 'test-results', 'wdio-logs'),
};
