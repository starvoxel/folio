// Run as its own wdio invocation: the app exits during the test, so the driver's session teardown reports ECONNREFUSED.
// What matters is that the process is gone afterwards with exit code 0 (checked by scripts/run-e2e.sh).
describe('quit', () => {
  it('quit_app command ends the process', async () => {
    await browser.waitUntil(async () => browser.execute(() => window.__folio?.getState().ready === true), { timeout: 30_000 });
    await browser.execute(() => { void (window as any).__TAURI_INTERNALS__.invoke('quit_app'); }).catch(() => undefined);
  });
});
