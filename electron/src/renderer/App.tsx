import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger,
  FluentProvider, Input, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger, MessageBar, MessageBarBody,
  NavDrawer, NavDrawerBody, NavDrawerFooter, NavDrawerHeader, NavItem, Radio, RadioGroup, Select, Tooltip,
  webDarkTheme, webLightTheme,
} from '@fluentui/react-components';
import type { Theme } from '@fluentui/react-components';
import {
  ArrowImport24Regular, ArrowRedo24Regular, ArrowUndo24Regular, BuildingBank24Regular, DataBarVertical24Regular,
  DataPie24Regular, Home24Regular, Navigation24Regular, Receipt24Regular, Savings24Regular, Settings24Regular,
  TagMultiple24Regular, Circle12Filled, Dismiss16Regular,
} from '@fluentui/react-icons';
import { formatCents, formatCentsWhole } from '../shared/money';
import type { Dataset } from '../shared/types';
import type { AppConfig } from '../shared/types';
import { TransactionsGrid } from './Grid';
import { Donut, InOutBars, PALETTE } from './Charts';
import { settled } from './automation';
import type { PageId, PageSnapshot } from './automation';
import {
  NO_FILTERS, buildModel, filterRows, flowByMonth, monthLabel, sortRows, spendingByMain,
} from './model';
import type { Filters, Model, SortCol, SortState } from './model';

type ThemePref = 'light' | 'dark' | 'system';

const BRAND = { colorBrandBackground: '#0078D4', colorBrandBackgroundHover: '#106EBE', colorBrandBackgroundPressed: '#005A9E', colorBrandForeground1: '#0078D4', colorBrandForegroundLink: '#0078D4', colorCompoundBrandStroke: '#0078D4', colorCompoundBrandBackground: '#0078D4' };
const lightTheme: Theme = { ...webLightTheme, ...BRAND };
const darkTheme: Theme = { ...webDarkTheme, ...BRAND, colorBrandBackgroundHover: '#2B88D8', colorBrandForeground1: '#4CA3EC', colorBrandForegroundLink: '#4CA3EC' };

const NAV: { id: PageId; label: string; icon: React.ReactElement }[] = [
  { id: 'overview', label: 'Overview', icon: <Home24Regular /> },
  { id: 'transactions', label: 'Transactions', icon: <Receipt24Regular /> },
  { id: 'reporting', label: 'Reporting', icon: <DataPie24Regular /> },
  { id: 'networth', label: 'Net worth', icon: <DataBarVertical24Regular /> },
  { id: 'accounts', label: 'Accounts', icon: <BuildingBank24Regular /> },
  { id: 'rules', label: 'Rules & categories', icon: <TagMultiple24Regular /> },
];
const PAGE_TITLE: Record<PageId, string> = {
  overview: 'Overview', transactions: 'Transactions', reporting: 'Reporting', networth: 'Net worth',
  accounts: 'Accounts', rules: 'Rules & categories', settings: 'Settings',
};

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return dark;
}

export function App(props: { config: AppConfig; dataset: Dataset }) {
  const { config, dataset } = props;
  const model = useMemo(() => buildModel(dataset), [dataset]);
  const [page, setPage] = useState<PageId>('overview');
  const [pref, setPref] = useState<ThemePref>('system');
  const systemDark = useSystemDark();
  const effective: 'light' | 'dark' = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;

  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<SortState>({ col: 'date', dir: 'asc' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reportMonth, setReportMonth] = useState(model.months[2] ?? model.months[0] ?? '');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const filtered = useMemo(() => filterRows(model, filters), [model, filters]);
  const sorted = useMemo(() => sortRows(filtered, sort), [filtered, sort]);

  const onSort = useCallback((col: SortCol) => setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'amount' || col === 'date' ? 'desc' : 'asc' })), []);
  const onSelect = useCallback((id: string) => setSelectedId(id), []);
  const openTransactions = useCallback((f: Partial<Filters>) => {
    setFilters({ ...NO_FILTERS, ...f });
    setSelectedId(null);
    setPage('transactions');
  }, []);

  // ---- automation API (off unless FOLIO_AUTOMATION=1) ----
  const snapshotRef = useRef<() => PageSnapshot>(() => { throw new Error('not ready'); });
  snapshotRef.current = () => {
    const ae = document.activeElement as HTMLElement | null;
    const sel = selectedId ? model.rows.find((r) => r.tx.id === selectedId) : undefined;
    const snap: PageSnapshot = {
      ready: true,
      page,
      title: PAGE_TITLE[page],
      theme: { preference: pref, effective },
      shell: { fileName: config.fileName, unsaved: false, navItems: [...NAV.map((n) => n.label), 'Settings'] },
      dialog: { open: dialogOpen, title: dialogOpen ? 'Reset settings?' : null, focusInside: !!ae?.closest('[role="dialog"], [role="alertdialog"]') },
      focus: { tag: ae?.tagName.toLowerCase() ?? '', role: ae?.getAttribute('role') ?? null, label: ae?.getAttribute('aria-label') ?? ae?.textContent?.trim().slice(0, 60) ?? null },
    };
    if (page === 'transactions') {
      snap.transactions = {
        totalRows: model.rows.length,
        visibleRows: sorted.length,
        filters,
        sort,
        selected: sel ? { id: sel.tx.id, date: sel.tx.date, description: sel.tx.description, amountCents: sel.tx.amount_cents, amount: formatCents(sel.tx.amount_cents), account: sel.acct, category: sel.cat, note: sel.tx.note } : null,
        detailsPanel: { shown: !!sel, text: document.querySelector('[data-testid="details"]')?.textContent ?? '' },
        renderedRows: document.querySelectorAll('.grid-row').length,
        firstRows: sorted.slice(0, 5).map((r) => ({ id: r.tx.id, date: r.tx.date, description: r.tx.description, amount: formatCents(r.tx.amount_cents) })),
      };
    }
    if (page === 'reporting') {
      const slices = spendingByMain(model, reportMonth);
      snap.reporting = {
        month: reportMonth,
        donut: slices,
        donutTotalCents: slices.reduce((a, s) => a + s.cents, 0),
        bars: flowByMonth(model),
        legend: [...document.querySelectorAll<HTMLElement>('[data-testid="legend"] button')].map((b) => ({ label: b.getAttribute('aria-label') ?? '', tabbable: b.tabIndex >= 0 })),
      };
    }
    return snap;
  };
  useEffect(() => {
    if (!config.automation) return;
    window.__folio = {
      getState: () => snapshotRef.current(),
      navigate: (p) => setPage(p),
      settled,
    };
    return () => { delete window.__folio; };
  }, [config.automation]);

  const theme = effective === 'dark' ? darkTheme : lightTheme;

  return (
    <FluentProvider theme={theme} className="fluent-root" data-theme={effective}>
      <div className="shell">
        <NavDrawer open type="inline" selectedValue={page} onNavItemSelect={(_, d) => setPage(d.value as PageId)} className="nav" aria-label="Main navigation">
          <NavDrawerHeader><div className="brand">Folio</div></NavDrawerHeader>
          <NavDrawerBody>
            {NAV.map((n) => (
              <NavItem key={n.id} value={n.id} icon={n.icon}>{n.label}</NavItem>
            ))}
          </NavDrawerBody>
          <NavDrawerFooter>
            <NavItem value="settings" icon={<Settings24Regular />}>Settings</NavItem>
          </NavDrawerFooter>
        </NavDrawer>
        <div className="main">
          <TopBar fileName={config.fileName} months={model.months} reportMonth={reportMonth} onSettings={() => setPage('settings')} />
          <main className="content" aria-label={PAGE_TITLE[page]} data-page={page}>
            {banner ? (
              <MessageBar intent="success" className="banner">
                <MessageBarBody>{banner}</MessageBarBody>
                <Button appearance="transparent" icon={<Dismiss16Regular />} aria-label="Dismiss" onClick={() => setBanner(null)} />
              </MessageBar>
            ) : null}
            {page === 'transactions' ? (
              <TransactionsPage model={model} filters={filters} setFilters={setFilters} rows={sorted} total={model.rows.length} selectedId={selectedId} sort={sort} onSort={onSort} onSelect={onSelect} />
            ) : page === 'reporting' ? (
              <ReportingPage model={model} month={reportMonth} setMonth={setReportMonth} dark={effective === 'dark'} openTransactions={openTransactions} />
            ) : page === 'settings' ? (
              <SettingsPage pref={pref} setPref={setPref} dialogOpen={dialogOpen} setDialogOpen={setDialogOpen} onConfirm={() => { setPref('system'); setBanner('Settings were reset.'); }} />
            ) : (
              <div className="placeholder"><h1>{PAGE_TITLE[page]}</h1><p className="muted">Placeholder page for the stack spike.</p></div>
            )}
          </main>
        </div>
      </div>
    </FluentProvider>
  );
}

function TopBar(props: { fileName: string; months: string[]; reportMonth: string; onSettings: () => void }) {
  return (
    <header className="topbar" role="banner">
      <span className="file-name">{props.fileName}</span>
      <span className="saved muted" data-testid="unsaved-indicator"><Circle12Filled className="dot" /> Saved automatically</span>
      <span className="spacer" />
      <Tooltip content="Undo (not in this slice)" relationship="label"><Button appearance="subtle" icon={<ArrowUndo24Regular />} disabled>Undo</Button></Tooltip>
      <Tooltip content="Redo (not in this slice)" relationship="label"><Button appearance="subtle" icon={<ArrowRedo24Regular />} disabled>Redo</Button></Tooltip>
      <Button appearance="subtle" icon={<ArrowImport24Regular />} disabled>Import CSV</Button>
      <Select disabled aria-label="Month (placeholder)" value={props.reportMonth}>
        <option value={props.reportMonth}>{monthLabel(props.reportMonth)}</option>
      </Select>
      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <Button appearance="subtle" icon={<Navigation24Regular />} aria-label="Menu" />
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuItem disabled>New</MenuItem>
            <MenuItem disabled>Open</MenuItem>
            <MenuItem disabled>Save</MenuItem>
            <MenuItem onClick={props.onSettings}>Settings</MenuItem>
            <MenuItem disabled>About</MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
    </header>
  );
}

function TransactionsPage(props: { model: Model; filters: Filters; setFilters: (f: Filters) => void; rows: ReturnType<typeof sortRows>; total: number; selectedId: string | null; sort: SortState; onSort: (c: SortCol) => void; onSelect: (id: string) => void }) {
  const { model, filters, setFilters, rows, total, selectedId, sort, onSort, onSelect } = props;
  const sel = selectedId ? rows.find((r) => r.tx.id === selectedId) : undefined;
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  return (
    <div className="tx-page">
      <div className="page-head">
        <h1>Transactions</h1>
        <span className="muted" data-testid="row-count">{rows.length === total ? `${total.toLocaleString('en-US')} transactions` : `${rows.length.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} transactions`}</span>
      </div>
      <div className="filters">
        <Input value={filters.search} onChange={(_, d) => set({ search: d.value })} placeholder="Search description or note" aria-label="Search transactions" className="search" />
        <Select aria-label="Account filter" value={filters.account} onChange={(_, d) => set({ account: d.value })}>
          <option value="">All accounts</option>
          {model.ds.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <Select aria-label="Category filter" value={filters.category} onChange={(_, d) => set({ category: d.value })}>
          <option value="">All categories</option>
          {model.catOptions.map((c) => <option key={c.id} value={c.id}>{c.depth ? ' ' : ''}{c.name}</option>)}
        </Select>
        {filters.month ? <Button size="small" appearance="outline" icon={<Dismiss16Regular />} iconPosition="after" onClick={() => set({ month: '' })}>Month: {monthLabel(filters.month)}</Button> : null}
        {filters.flow ? <Button size="small" appearance="outline" icon={<Dismiss16Regular />} iconPosition="after" onClick={() => set({ flow: '' })}>{filters.flow === 'in' ? 'Money in' : 'Money out'}</Button> : null}
      </div>
      <div className="tx-body">
        <section className="card grid-card">
          <TransactionsGrid rows={rows} selectedId={selectedId} sort={sort} onSort={onSort} onSelect={onSelect} />
        </section>
        <aside className="card details" data-testid="details" aria-label="Transaction details">
          {sel ? (
            <dl>
              <h2>{sel.tx.description}</h2>
              <div className={'big num' + (sel.tx.amount_cents < 0 ? '' : ' pos')}>{formatCents(sel.tx.amount_cents)}</div>
              <dt>Date</dt><dd>{sel.tx.date}</dd>
              <dt>Account</dt><dd>{sel.acct} <span className="muted">({model.accountProvider.get(sel.tx.account_id)})</span></dd>
              <dt>Category</dt><dd>{sel.mainName === sel.cat ? sel.cat : `${sel.mainName} › ${sel.cat}`}</dd>
              <dt>Note</dt><dd>{sel.tx.note ?? <span className="muted">No note</span>}</dd>
            </dl>
          ) : (
            <p className="muted">Select a transaction to see its details.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function ReportingPage(props: { model: Model; month: string; setMonth: (m: string) => void; dark: boolean; openTransactions: (f: Partial<Filters>) => void }) {
  const { model, month, setMonth, dark, openTransactions } = props;
  const slices = useMemo(() => spendingByMain(model, month), [model, month]);
  const flows = useMemo(() => flowByMonth(model), [model]);
  const total = slices.reduce((a, s) => a + s.cents, 0);
  const theme = useMemo(() => (dark ? { text: '#FFFFFF', muted: '#FFFFFFC5', grid: '#FFFFFF1F', bg: '#2b2b2b' } : { text: '#1b1b1b', muted: '#00000099', grid: '#0000001A', bg: '#ffffff' }), [dark]);
  const pickCat = useCallback((id: string) => openTransactions({ category: id, month, flow: 'out' }), [openTransactions, month]);
  const pickBar = useCallback((m: string, flow: 'in' | 'out') => openTransactions({ month: m, flow }), [openTransactions]);
  return (
    <div className="report-page">
      <div className="page-head">
        <h1>Reporting</h1>
        <Select aria-label="Report month" value={month} onChange={(_, d) => setMonth(d.value)}>
          {model.months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </Select>
      </div>
      <div className="report-grid">
        <section className="card" aria-labelledby="h-spend">
          <h2 id="h-spend">Spending by category, {monthLabel(month)}</h2>
          <div className="donut-wrap">
            <Donut slices={slices} theme={theme} totalCents={total} onPick={pickCat} />
            <ul className="legend" data-testid="legend" aria-label="Spending legend">
              {slices.map((s, i) => (
                <li key={s.id}>
                  <button type="button" className="legend-row" aria-label={`${s.name}: ${formatCentsWhole(s.cents)}, ${s.pct} percent. Show transactions`} onClick={() => pickCat(s.id)}>
                    <span className="swatch" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="legend-name">{s.name}</span>
                    <span className="num">{formatCentsWhole(s.cents)}</span>
                    <span className="muted pct">{s.pct}%</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="card" aria-labelledby="h-flow">
          <h2 id="h-flow">Money in vs money out, 2026</h2>
          <InOutBars flows={flows} theme={theme} onPick={pickBar} />
          <table className="flow-table" data-testid="flow-table">
            <caption className="sr-only">Money in and out by month. Activate an amount to show those transactions.</caption>
            <thead><tr><th scope="col">Month</th><th scope="col" className="right">In</th><th scope="col" className="right">Out</th></tr></thead>
            <tbody>
              {flows.map((f) => (
                <tr key={f.month}>
                  <th scope="row">{monthLabel(f.month)}</th>
                  <td className="right"><button type="button" className="link-btn num" aria-label={`${monthLabel(f.month)} money in ${formatCentsWhole(f.inCents)}. Show transactions`} onClick={() => pickBar(f.month, 'in')}>{formatCentsWhole(f.inCents)}</button></td>
                  <td className="right"><button type="button" className="link-btn num" aria-label={`${monthLabel(f.month)} money out ${formatCentsWhole(f.outCents)}. Show transactions`} onClick={() => pickBar(f.month, 'out')}>{formatCentsWhole(f.outCents)}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function SettingsPage(props: { pref: ThemePref; setPref: (p: ThemePref) => void; dialogOpen: boolean; setDialogOpen: (o: boolean) => void; onConfirm: () => void }) {
  const { pref, setPref, dialogOpen, setDialogOpen, onConfirm } = props;
  return (
    <div className="settings-page">
      <div className="page-head"><h1>Settings</h1></div>
      <section className="card">
        <h2>Theme</h2>
        <RadioGroup value={pref} onChange={(_, d) => setPref(d.value as ThemePref)} aria-label="Theme" layout="horizontal">
          <Radio value="light" label="Light" />
          <Radio value="dark" label="Dark" />
          <Radio value="system" label="System" />
        </RadioGroup>
      </section>
      <section className="card">
        <h2>Reset</h2>
        <p className="muted">Restore the settings on this page to their defaults.</p>
        <Dialog open={dialogOpen} onOpenChange={(_, d) => setDialogOpen(d.open)} modalType="modal">
          <DialogTrigger disableButtonEnhancement><Button>Reset settings…</Button></DialogTrigger>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Reset settings?</DialogTitle>
              <DialogContent>This returns the theme to System. Your budget data is not affected.</DialogContent>
              <DialogActions>
                <DialogTrigger disableButtonEnhancement><Button appearance="secondary">Cancel</Button></DialogTrigger>
                <DialogTrigger disableButtonEnhancement><Button appearance="primary" onClick={onConfirm}>Reset</Button></DialogTrigger>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      </section>
    </div>
  );
}
