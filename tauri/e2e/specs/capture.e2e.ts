// G1 driven scenario for the network capture (run inside scripts/capture.sh): launch, every page, use, then idle.
import { chooseOption, goto, press, settle } from './helpers';

const idleS = Number(process.env.CAPTURE_IDLE_S ?? 300);
const log = (m: string) => console.log(`${new Date().toISOString()} ${m}`);

describe('capture scenario', () => {
  it('uses every page then idles', async function () {
    await browser.waitUntil(async () => browser.execute(() => window.__folio?.getState().ready === true), { timeout: 60_000 });
    log('LAUNCHED');
    for (const n of ['Overview', 'Transactions', 'Reporting', 'Net worth', 'Accounts', 'Rules & categories', 'Settings']) {
      await goto(n); await browser.pause(500); log(`PAGE ${n}`);
    }
    await goto('Transactions');
    await (await $('input[aria-label="Search transactions"]')).setValue('sobeys');
    await chooseOption('Account filter', 'acc-visa');
    await (await $('.head-btn[data-col="amount"]')).click();
    await (await $$('.grid-row'))[2]!.click();
    log('USED transactions search/filter/sort/select');
    await goto('Reporting');
    await (await $$('[data-testid="legend"] button'))[0]!.click(); await settle();
    await goto('Settings');
    await (await $('//input[@type="radio" and @value="dark"]')).click();
    await (await $('//button[contains(normalize-space(.),"Reset settings")]')).click();
    await $('[role="dialog"]').waitForExist();
    await press('Escape'); await browser.pause(500);
    log('USED reporting click-through, theme, dialog');
    log(`IDLE START ${idleS}s`);
    await new Promise((r) => setTimeout(r, idleS * 1000));
    log('IDLE END');
  });
});
