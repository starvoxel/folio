// ------------------------------
// log-file.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createRotatingFileWriter,
  nodeLogFileOperations,
} from '../../apps/desktop/src/main/log-file.js';

describe('createRotatingFileWriter', () => {
  describe('theRealFileSystem', () => {
    let root = '';

    beforeEach(async () => {
      root = await mkdtemp(join(tmpdir(), 'folio-log-'));
    });

    afterEach(async () => {
      await rm(root, { recursive: true, force: true });
    });

    it('createsTheFolderAppendsAndRotatesWithoutErrors', async () => {
      const folder = join(root, 'a', 'logs');
      const write = createRotatingFileWriter({
        folder,
        files: nodeLogFileOperations,
        maxBytes: 12,
        backups: 2,
      });
      for (const line of ['aaaa', 'bbbb', 'cccc', 'dddd', 'eeee']) {
        write(line);
      }
      expect((await readdir(folder)).sort()).toEqual(['folio.log', 'folio.log.1', 'folio.log.2']);
      expect(await readFile(join(folder, 'folio.log'), 'utf8')).toBe('eeee\n');
      expect(await readFile(join(folder, 'folio.log.1'), 'utf8')).toBe('cccc\ndddd\n');
      expect(await readFile(join(folder, 'folio.log.2'), 'utf8')).toBe('aaaa\nbbbb\n');
    });
  });
});
