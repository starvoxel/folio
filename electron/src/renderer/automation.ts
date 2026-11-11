import type { Filters, SortState } from './model';

export type PageId = 'overview' | 'transactions' | 'reporting' | 'networth' | 'accounts' | 'rules' | 'settings';

/** Structured page state, read by tests and agents. JSON-serialisable. */
export interface PageSnapshot {
  ready: boolean;
  page: PageId;
  title: string;
  theme: { preference: 'light' | 'dark' | 'system'; effective: 'light' | 'dark' };
  shell: { fileName: string; unsaved: boolean; navItems: string[] };
  dialog: { open: boolean; title: string | null; focusInside: boolean };
  focus: { tag: string; role: string | null; label: string | null };
  transactions?: {
    totalRows: number;
    visibleRows: number;
    filters: Filters;
    sort: SortState;
    selected: null | { id: string; date: string; description: string; amountCents: number; amount: string; account: string; category: string; note: string | null };
    detailsPanel: { shown: boolean; text: string };
    renderedRows: number;
    firstRows: { id: string; date: string; description: string; amount: string }[];
  };
  reporting?: {
    month: string;
    donut: { id: string; name: string; cents: number; pct: number }[];
    donutTotalCents: number;
    bars: { month: string; inCents: number; outCents: number }[];
    legend: { label: string; tabbable: boolean }[];
  };
}

export interface AutomationApi {
  getState(): PageSnapshot;
  navigate(page: PageId): void;
  /** Resolves after React has committed and the browser has painted twice. */
  settled(): Promise<void>;
}

export const settled = (): Promise<void> =>
  new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
