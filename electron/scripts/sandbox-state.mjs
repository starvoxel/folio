// E5: is Chromium's sandbox active for each Electron process? Uses app.getAppMetrics() (sandboxed / integrityLevel are Windows and macOS fields).
import { _electron as electron } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const app = await electron.launch({ executablePath: path.resolve(process.argv[2]), args: process.platform === 'linux' ? ['--no-sandbox'] : [], timeout: 30000, env: { ...process.env, FOLIO_AUTOMATION: '1', FOLIO_DATA_DIR: path.resolve(here, '..', '..', 'fixtures'), FOLIO_USER_DATA: fs.mkdtempSync(path.join(os.tmpdir(), 'folio-sbx-')) } });
const page = await app.firstWindow();
await page.waitForFunction(() => window.__folio?.getState().ready);
await page.waitForTimeout(3000);
const m = await app.evaluate(({ app }) => app.getAppMetrics().map((p) => ({ pid: p.pid, type: p.type, name: p.name ?? null, sandboxed: p.sandboxed ?? null, integrityLevel: p.integrityLevel ?? null })));
console.log(JSON.stringify(m, null, 1));
const w = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((b) => b.webContents.getLastWebPreferences()));
console.log('webPreferences actually in effect:', JSON.stringify(w.map((p) => ({ sandbox: p.sandbox, contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration }))));
await app.close();
