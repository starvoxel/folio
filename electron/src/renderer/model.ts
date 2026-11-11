import type { Dataset, Transaction } from '../shared/types';

export interface Row {
  tx: Transaction;
  acct: string;
  cat: string;
  mainId: string;
  mainName: string;
  month: string; // YYYY-MM
  hay: string; // lowercase search text
}

export interface Model {
  ds: Dataset;
  rows: Row[];
  accountName: Map<string, string>;
  accountProvider: Map<string, string>;
  mains: { id: string; name: string }[];
  catOptions: { id: string; name: string; depth: 0 | 1 }[];
  months: string[]; // YYYY-MM present in data
}

export type SortCol = 'date' | 'description' | 'account' | 'category' | 'amount';
export interface SortState { col: SortCol; dir: 'asc' | 'desc' }
export interface Filters {
  search: string;
  account: string; // '' = all
  category: string; // '' = all; main or sub category id
  month: string; // '' = all; YYYY-MM
  flow: '' | 'in' | 'out';
}
export const NO_FILTERS: Filters = { search: '', account: '', category: '', month: '', flow: '' };

export function buildModel(ds: Dataset): Model {
  const accountName = new Map(ds.accounts.map((a) => [a.id, a.name]));
  const accountProvider = new Map(ds.accounts.map((a) => [a.id, a.provider]));
  const catById = new Map(ds.categories.map((c) => [c.id, c]));
  const mains = ds.categories.filter((c) => c.parent_id === null).map((c) => ({ id: c.id, name: c.name }));
  const catOptions: Model['catOptions'] = [];
  for (const m of mains) {
    catOptions.push({ id: m.id, name: m.name, depth: 0 });
    for (const c of ds.categories) if (c.parent_id === m.id) catOptions.push({ id: c.id, name: c.name, depth: 1 });
  }
  const monthSet = new Set<string>();
  const rows: Row[] = ds.transactions.map((tx) => {
    const cat = tx.category_id ? catById.get(tx.category_id) : undefined;
    const main = cat ? (cat.parent_id ? catById.get(cat.parent_id) ?? cat : cat) : undefined;
    const month = tx.date.slice(0, 7);
    monthSet.add(month);
    const acct = accountName.get(tx.account_id) ?? tx.account_id;
    return {
      tx,
      acct,
      cat: cat?.name ?? 'Uncategorized',
      mainId: main?.id ?? 'uncategorized',
      mainName: main?.name ?? 'Uncategorized',
      month,
      hay: `${tx.description}\n${tx.note ?? ''}`.toLowerCase(),
    };
  });
  return { ds, rows, accountName, accountProvider, mains, catOptions, months: [...monthSet].sort() };
}

export function filterRows(m: Model, f: Filters): Row[] {
  const q = f.search.trim().toLowerCase();
  return m.rows.filter((r) => {
    if (q && !r.hay.includes(q)) return false;
    if (f.account && r.tx.account_id !== f.account) return false;
    if (f.category && r.tx.category_id !== f.category && r.mainId !== f.category) return false;
    if (f.month && r.month !== f.month) return false;
    if (f.flow === 'in' && r.tx.amount_cents <= 0) return false;
    if (f.flow === 'out' && r.tx.amount_cents >= 0) return false;
    return true;
  });
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function sortRows(rows: Row[], s: SortState): Row[] {
  const sign = s.dir === 'asc' ? 1 : -1;
  const cmp = (a: Row, b: Row): number => {
    switch (s.col) {
      case 'date': return a.tx.date < b.tx.date ? -1 : a.tx.date > b.tx.date ? 1 : 0;
      case 'description': return collator.compare(a.tx.description, b.tx.description);
      case 'account': return collator.compare(a.acct, b.acct);
      case 'category': return collator.compare(a.cat, b.cat);
      case 'amount': return a.tx.amount_cents - b.tx.amount_cents;
    }
  };
  return [...rows].sort((a, b) => sign * cmp(a, b) || (a.tx.id < b.tx.id ? -1 : 1));
}

export interface Slice { id: string; name: string; cents: number; pct: number }

/** Spending = negative amounts, grouped by main (parent) category, as positive cents. */
export function spendingByMain(m: Model, month: string): Slice[] {
  const sums = new Map<string, { name: string; cents: number }>();
  let total = 0;
  for (const r of m.rows) {
    if (r.month !== month || r.tx.amount_cents >= 0) continue;
    const e = sums.get(r.mainId) ?? { name: r.mainName, cents: 0 };
    e.cents += -r.tx.amount_cents;
    sums.set(r.mainId, e);
    total += -r.tx.amount_cents;
  }
  return [...sums.entries()]
    .map(([id, e]) => ({ id, name: e.name, cents: e.cents, pct: total ? Math.round((e.cents * 100) / total) : 0 }))
    .sort((a, b) => b.cents - a.cents);
}

export interface MonthFlow { month: string; inCents: number; outCents: number }
export function flowByMonth(m: Model): MonthFlow[] {
  const map = new Map<string, MonthFlow>(m.months.map((mo) => [mo, { month: mo, inCents: 0, outCents: 0 }]));
  for (const r of m.rows) {
    const e = map.get(r.month);
    if (!e) continue;
    if (r.tx.amount_cents > 0) e.inCents += r.tx.amount_cents;
    else e.outCents += -r.tx.amount_cents;
  }
  return [...map.values()];
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function monthLabel(ym: string): string {
  const mi = Number(ym.slice(5, 7)) - 1;
  return `${MONTH_NAMES[mi] ?? ym} ${ym.slice(0, 4)}`;
}
export function monthShort(ym: string): string {
  return (MONTH_NAMES[Number(ym.slice(5, 7)) - 1] ?? ym).slice(0, 3);
}
