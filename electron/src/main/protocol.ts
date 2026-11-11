import { protocol } from 'electron';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
};

function csp(nonce: string): string {
  return [
    "default-src 'none'",
    "script-src 'self'",
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; ');
}

/** Serves the built renderer from `root` over folio://app/. Refuses anything outside root. */
export function registerAppProtocol(root: string): void {
  const rootResolved = path.resolve(root);
  protocol.handle('folio', async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'app') return new Response('Not found', { status: 404 });
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const full = path.resolve(rootResolved, '.' + rel);
    if (full !== rootResolved && !full.startsWith(rootResolved + path.sep)) return new Response('Forbidden', { status: 403 });
    try {
      const ext = path.extname(full).toLowerCase();
      const nonce = randomBytes(16).toString('base64');
      let body: Buffer | string = await readFile(full);
      if (ext === '.html') body = body.toString('utf8').replaceAll('__CSP_NONCE__', nonce);
      return new Response(body, {
        headers: {
          'content-type': MIME[ext] ?? 'application/octet-stream',
          'content-security-policy': csp(nonce),
          'x-content-type-options': 'nosniff',
          'cache-control': 'no-store',
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}
