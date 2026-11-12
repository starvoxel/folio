import { state, goto, press, settle } from './helpers';

describe('probe', () => {
  it('select + tab', async () => {
    await browser.waitUntil(async () => browser.execute(() => window.__folio?.getState().ready === true), { timeout: 30000 });
    await goto('Transactions');
    const sel = await $('select[aria-label="Account filter"]');
    await sel.selectByAttribute('value', 'acc-visa');
    await settle();
    console.log('PROBE select by attr:', JSON.stringify((await state()).transactions!.filters), await sel.getValue());
    const opts = await sel.$$('option');
    await sel.selectByVisibleText(await opts[2]!.getText());
    await settle();
    console.log('PROBE select by text:', JSON.stringify((await state()).transactions!.filters));
    await browser.execute(() => (document.querySelector('input[aria-label="Search transactions"]') as HTMLElement).focus());
    const before = (await state()).focus;
    await press('Tab');
    await settle();
    console.log('PROBE tab:', JSON.stringify(before), '->', JSON.stringify((await state()).focus));
    await browser.execute(() => {
      (window as any).__keys = [];
      document.addEventListener('keydown', (e) => (window as any).__keys.push([e.key, e.isTrusted]), true);
    });
    await press('Tab');
    console.log('PROBE keydown events:', JSON.stringify(await browser.execute(() => (window as any).__keys)));
    console.log('PROBE winsize', JSON.stringify(await browser.getWindowSize()), JSON.stringify(await browser.execute(() => [innerWidth, innerHeight, devicePixelRatio])));
  });
});
