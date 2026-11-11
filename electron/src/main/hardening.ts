import { app, protocol, session, net as _net } from 'electron';
import type { Session, WebContents } from 'electron';

void _net; // net is deliberately unused: the main process never makes a network request.

export const APP_ORIGIN = 'folio://app/';

/** Requests the deny-all filter refused. Exposed on globalThis so tests can assert it stays empty. */
export const blockedRequests: string[] = [];
(globalThis as Record<string, unknown>)['__folioBlocked'] = blockedRequests;

/** Must run before app 'ready'. */
export function hardenBeforeReady(): void {
  // No network access of any kind through proxies; also stops WPAD / system proxy auto-detect.
  app.commandLine.appendSwitch('no-proxy-server');
  // A stray key in the environment would enable Google services in Chromium builds that read it.
  for (const k of ['GOOGLE_API_KEY', 'GOOGLE_DEFAULT_CLIENT_ID', 'GOOGLE_DEFAULT_CLIENT_SECRET']) delete process.env[k];
  // Custom scheme for the UI instead of file://.
  protocol.registerSchemesAsPrivileged([
    { scheme: 'folio', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
  // NOTE (deliberate absences): crashReporter is never imported or started, there is no autoUpdater,
  // and no code anywhere checks for updates.
}

function isAppUrl(url: string): boolean {
  return url.startsWith(APP_ORIGIN);
}

/** Must run after app 'ready'. */
export function hardenSession(ses: Session): void {
  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    const ok = isAppUrl(details.url) || details.url.startsWith('devtools://') || details.url.startsWith('data:') || details.url.startsWith('blob:');
    if (!ok) blockedRequests.push(`${details.method} ${details.url}`);
    callback({ cancel: !ok });
  });
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  ses.setDevicePermissionHandler(() => false);
  // Spellcheck would otherwise download dictionaries from a Google CDN.
  ses.setSpellCheckerEnabled(false);
  ses.setSpellCheckerDictionaryDownloadURL('http://127.0.0.1:9/disabled/');
}

export function hardenWebContents(wc: WebContents): void {
  wc.on('will-navigate', (e, url) => {
    if (!isAppUrl(url)) e.preventDefault();
  });
  wc.on('will-redirect', (e, url) => {
    if (!isAppUrl(url)) e.preventDefault();
  });
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-attach-webview', (e) => e.preventDefault());
}

export function installHardening(): void {
  app.on('web-contents-created', (_e, wc) => hardenWebContents(wc));
  hardenSession(session.defaultSession);
}
