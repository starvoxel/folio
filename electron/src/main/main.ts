import { app, BrowserWindow, ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { APP_ORIGIN, hardenBeforeReady, installHardening } from './hardening';
import { registerAppProtocol } from './protocol';
import { parseDataset } from '../shared/validate';
import type { AppConfig, Dataset } from '../shared/types';

hardenBeforeReady();

const automation = process.env['FOLIO_AUTOMATION'] === '1';
// Chromium's remote-debugging switches (pipe or port) give full control of the app. They are available on every Chromium-based
// binary and no fuse turns them off, so the app refuses to run with them unless automation was requested explicitly.
// (The automation hook in the renderer is gated by the same environment variable.) See FOLLOWUP-RESULTS.md, E3.
if (!automation && process.argv.some((a) => /^--(remote-debugging-(port|pipe)|remote-allow-origins|inspect(-brk)?(=|$)|inspect-port)/.test(a))) {
  console.error('Remote debugging switches are refused unless FOLIO_AUTOMATION=1.');
  app.exit(2);
}
if (process.env['FOLIO_USER_DATA']) app.setPath('userData', process.env['FOLIO_USER_DATA']);

function dataDir(): string {
  const arg = process.argv.find((a) => a.startsWith('--data-dir='));
  const dir = arg ? arg.slice('--data-dir='.length) : process.env['FOLIO_DATA_DIR'];
  if (!dir) throw new Error('No data directory: pass --data-dir=<path> or set FOLIO_DATA_DIR');
  return path.resolve(dir);
}

async function loadDataset(): Promise<Dataset> {
  const dir = dataDir();
  const read = async (f: string): Promise<unknown> => JSON.parse(await readFile(path.join(dir, f), 'utf8')) as unknown;
  const [a, c, t] = await Promise.all([read('accounts.json'), read('categories.json'), read('transactions.json')]);
  return parseDataset(a, c, t);
}

let dataPromise: Promise<Dataset> | null = null;

function assertTrusted(e: IpcMainInvokeEvent): void {
  const url = e.senderFrame?.url ?? '';
  if (!url.startsWith(APP_ORIGIN)) throw new Error('untrusted sender');
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: true,
    title: 'Folio',
    backgroundColor: '#f3f3f3',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      webviewTag: false,
      allowRunningInsecureContent: false,
    },
  });
  win.removeMenu();
  void win.loadURL(APP_ORIGIN);
  return win;
}

app.whenReady().then(() => {
  installHardening();
  registerAppProtocol(path.join(__dirname, '..', 'renderer'));
  ipcMain.handle('folio:get-config', (e): AppConfig => {
    assertTrusted(e);
    return { fileName: 'Household 2026.folio', automation, platform: process.platform };
  });
  ipcMain.handle('folio:load-data', (e) => {
    assertTrusted(e);
    dataPromise ??= loadDataset();
    return dataPromise;
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((err: unknown) => {
  console.error(err);
  app.exit(1);
});

app.on('window-all-closed', () => app.quit());
