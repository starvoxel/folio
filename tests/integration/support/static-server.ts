// ------------------------------
// static-server.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

/** A running loopback file server. */
export interface StaticServer {
  readonly url: string;
  close(): Promise<void>;
}

/**
 * Serve a directory over HTTP on the loopback interface, on a free port. Requests outside the
 * directory get a 403.
 * @param directory - The directory to serve.
 * @returns The server's address and a way to stop it.
 */
export async function serveDirectory(directory: string): Promise<StaticServer> {
  const root = resolve(directory);
  const server: Server = createServer((request, response) => {
    const serve = async (): Promise<void> => {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      const file = resolve(join(root, pathname === '/' ? 'index.html' : pathname));
      if (file !== root && !file.startsWith(root + sep)) {
        response.writeHead(403).end();
        return;
      }
      try {
        const info = await stat(file);
        if (!info.isFile()) {
          throw new Error('not a file');
        }
        response.writeHead(200, {
          'content-type': MIME_TYPES[extname(file)] ?? 'application/octet-stream',
        });
        createReadStream(file).pipe(response);
      } catch {
        response.writeHead(404).end();
      }
    };
    void serve();
  });
  await new Promise<void>((done) => {
    server.listen(0, '127.0.0.1', done);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('The static server has no TCP address');
  }
  return {
    url: `http://127.0.0.1:${String(address.port)}/`,
    close: () =>
      new Promise<void>((done, fail) => {
        server.close((error) => {
          if (error === undefined) {
            done();
          } else {
            fail(error);
          }
        });
      }),
  };
}
