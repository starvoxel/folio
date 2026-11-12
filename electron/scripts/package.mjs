// Builds the app, packages it with @electron/packager and flips the production fuses.
// The resulting binary is the one the tests drive; there is no separate "test build".
import { packager } from '@electron/packager';
import { flipFuses, FuseVersion, FuseV1Options } from '@electron/fuses';
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const t0 = Date.now();
execSync('npm run build', { cwd: root, stdio: 'inherit' });
console.log(`build: ${((Date.now() - t0) / 1000).toFixed(1)} s`);

const t1 = Date.now();
const [appPath] = await packager({
  dir: root,
  out: path.join(root, process.env.FOLIO_OUT ?? 'out'),
  name: 'Folio',
  overwrite: true,
  asar: true,
  prune: false,
  // Ship only the compiled app: no sources, no node_modules (the renderer is bundled by Vite).
  ignore: (p) => !(p === '' || p === '/package.json' || p === '/dist' || p.startsWith('/dist/')),
  quiet: true,
});
console.log(`package: ${((Date.now() - t1) / 1000).toFixed(1)} s -> ${appPath}`);

const exe = {
  linux: path.join(appPath, 'Folio'),
  win32: path.join(appPath, 'Folio.exe'),
  darwin: path.join(appPath, 'Folio.app'),
}[process.platform];

const t2 = Date.now();
await flipFuses(exe, {
  version: FuseVersion.V1,
  resetAdHocDarwinSignature: process.platform === 'darwin',
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableCookieEncryption]: true,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: process.env.FOLIO_FUSE_INSPECT === '1',
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: process.env.FOLIO_FUSE_ASAR_INTEGRITY === '1',
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
});
console.log(`fuses: ${((Date.now() - t2) / 1000).toFixed(1)} s`);
console.log(`APP_PATH=${appPath}`);
