import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { PageSnapshot } from '../../src/renderer/automation';

declare global {
  interface Window {
    __folio?: { getState(): PageSnapshot; navigate(p: string): void; settled(): Promise<void> };
  }
}

export const resultsDir = path.resolve(process.cwd(), '..', 'test-results');
export const shotDir = path.join(resultsDir, 'shots', process.platform);
fs.mkdirSync(shotDir, { recursive: true });

export const state = (): Promise<PageSnapshot> => browser.execute(() => window.__folio!.getState()) as Promise<PageSnapshot>;
export const settle = (): Promise<void> =>
  browser.executeAsync((done: () => void) => {
    window.__folio!.settled().then(done);
  });

export async function goto(label: string) {
  const el = await $(`//*[@aria-label="Main navigation"]//*[(self::button or self::a or @role="tab") and normalize-space(.)="${label}"]`);
  await el.click();
  await settle();
}
export const shot = (name: string) => browser.saveScreenshot(path.join(shotDir, name));
export const byLabel = (tag: string, label: string) => $(`${tag}[aria-label="${label}"]`);

/** Real pointer click at viewport coordinates through the WebDriver actions API. */
export async function clickAt(x: number, y: number) {
  await browser
    .action('pointer', { parameters: { pointerType: 'mouse' } })
    .move({ x: Math.round(x), y: Math.round(y), origin: 'viewport' })
    .down()
    .up()
    .perform();
}

/**
 * Finding: the embedded WebDriver's `browser.keys()` dispatches synthetic DOM events (isTrusted=false). Those run key
 * handlers but do not move focus on Tab. So real key presses go through the OS instead, where the runner allows it.
 */
export async function press(k: 'Tab' | 'Enter' | 'Escape') {
  if (process.env.FOLIO_SYNTHETIC_KEYS === '1') {
    await browser.keys(k);
    return;
  }
  if (process.platform === 'linux') {
    execFileSync('xdotool', ['key', '--clearmodifiers', k === 'Escape' ? 'Escape' : k === 'Enter' ? 'Return' : 'Tab']);
  } else if (process.platform === 'win32') {
    const map = { Tab: '{TAB}', Enter: '{ENTER}', Escape: '{ESC}' };
    execFileSync('powershell', ['-NoProfile', '-Command', `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${map[k]}')`]);
  } else {
    const code = { Tab: 48, Enter: 36, Escape: 53 }[k];
    execFileSync('osascript', ['-e', `tell application "System Events" to key code ${code}`]);
  }
  await new Promise((r) => setTimeout(r, 60));
}

/** Fallback for native <select>: the driver's select commands do not fire React's change event. Synthetic, not a user path. */
export async function chooseOption(label: string, value: string) {
  await browser.execute(
    (l: string, v: string) => {
      const el = document.querySelector(`select[aria-label="${l}"]`) as HTMLSelectElement;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(el, v);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    label,
    value,
  );
}
