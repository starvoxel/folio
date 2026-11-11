import type { Account, Category, Dataset, Transaction } from './types';

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function str(o: Record<string, unknown>, k: string): string {
  const v = o[k];
  if (typeof v !== 'string') throw new Error(`field ${k} must be a string`);
  return v;
}
function strOrNull(o: Record<string, unknown>, k: string): string | null {
  const v = o[k];
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') throw new Error(`field ${k} must be a string or null`);
  return v;
}

export function parseAccounts(raw: unknown): Account[] {
  if (!Array.isArray(raw)) throw new Error('accounts.json must be an array');
  return raw.map((r) => {
    if (!isObj(r)) throw new Error('bad account');
    return { id: str(r, 'id'), name: str(r, 'name'), type: str(r, 'type'), provider: str(r, 'provider') };
  });
}
export function parseCategories(raw: unknown): Category[] {
  if (!Array.isArray(raw)) throw new Error('categories.json must be an array');
  return raw.map((r) => {
    if (!isObj(r)) throw new Error('bad category');
    return { id: str(r, 'id'), name: str(r, 'name'), parent_id: strOrNull(r, 'parent_id') };
  });
}
export function parseTransactions(raw: unknown): Transaction[] {
  if (!Array.isArray(raw)) throw new Error('transactions.json must be an array');
  return raw.map((r, i) => {
    if (!isObj(r)) throw new Error(`bad transaction at ${i}`);
    const cents = r['amount_cents'];
    if (typeof cents !== 'number' || !Number.isSafeInteger(cents)) throw new Error(`amount_cents must be an integer at ${i}`);
    const date = str(r, 'date');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`bad date at ${i}`);
    return {
      id: str(r, 'id'), date, description: str(r, 'description'), amount_cents: cents,
      account_id: str(r, 'account_id'), category_id: strOrNull(r, 'category_id'), note: strOrNull(r, 'note'),
    };
  });
}
export function parseDataset(a: unknown, c: unknown, t: unknown): Dataset {
  return { accounts: parseAccounts(a), categories: parseCategories(c), transactions: parseTransactions(t) };
}
