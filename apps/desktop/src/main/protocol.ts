// ------------------------------
// protocol.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

import { protocol } from 'electron';

import { APP_SCHEME } from './app-origin.js';
import { resolveAppFile } from './app-files.js';
import { buildContentSecurityPolicy } from './csp.js';

const NONCE_PLACEHOLDER = '__CSP_NONCE__';

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
};

/** Declare the app protocol. Must run before the app is ready. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

/**
 * Serve the built renderer from a directory over the app protocol. Every page gets the content
 * security policy with a fresh nonce; nothing outside the directory is ever served (AD-18).
 * @param root - The directory that holds the built renderer.
 */
export function registerAppProtocol(root: string): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'app') {
      return new Response('Not found', { status: 404 });
    }
    const file = resolveAppFile(root, url.pathname);
    if (file === null) {
      return new Response('Forbidden', { status: 403 });
    }
    try {
      const extension = extname(file).toLowerCase();
      const nonce = randomBytes(16).toString('base64');
      const content = await readFile(file);
      const body =
        extension === '.html'
          ? content.toString('utf8').replaceAll(NONCE_PLACEHOLDER, nonce)
          : new Uint8Array(content);
      return new Response(body, {
        headers: {
          'content-type': MIME_TYPES[extension] ?? 'application/octet-stream',
          'content-security-policy': buildContentSecurityPolicy(nonce),
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'no-referrer',
          'cache-control': 'no-store',
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}
