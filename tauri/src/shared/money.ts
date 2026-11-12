/** Money is integer cents everywhere. Formatting never converts to a float. */
function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error('cents must be a safe integer');
  const abs = Math.abs(cents);
  const rem = abs % 100;
  return `${cents < 0 ? '-' : ''}$${group(Math.floor(abs / 100))}.${rem < 10 ? '0' : ''}${rem}`;
}
export function formatCentsWhole(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error('cents must be a safe integer');
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100) + (abs % 100 >= 50 ? 1 : 0);
  return `${cents < 0 ? '-' : ''}$${group(dollars)}`;
}
