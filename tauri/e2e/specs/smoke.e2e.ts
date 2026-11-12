describe('smoke', () => {
  it('reads state', async () => {
    await browser.waitUntil(async () => browser.execute(() => (window as any).__folio?.getState().ready === true), { timeout: 30000 });
    const s = await browser.execute(() => (window as any).__folio.getState());
    console.log(JSON.stringify(s).slice(0, 400));
    await browser.saveScreenshot('./test-results/smoke.png');
  });
});
