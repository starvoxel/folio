// Positive control for the Windows socket sampler: make the web view itself reach a public host, so the sampler must show
// a connection owned by a msedgewebview2 process. The shipped app cannot do this (CSP); here the driver navigates the window away.
describe('sampler positive control', () => {
  it('navigates the web view to a public site for a few seconds', async () => {
    await browser.waitUntil(async () => browser.execute(() => window.__folio?.getState().ready === true), { timeout: 60_000 });
    console.log(`${new Date().toISOString()} CONTROL start`);
    await browser.url('https://example.com/');
    await browser.pause(15_000);
    console.log(`${new Date().toISOString()} CONTROL end, title=${await browser.getTitle()}`);
  });
});
