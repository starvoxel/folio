import { memo, useCallback, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowSortDown16Regular, ArrowSortUp16Regular } from '@fluentui/react-icons';
import { formatCents } from '../shared/money';
import type { Row, SortCol, SortState } from './model';

const ROW_H = 36;
const COLS: { col: SortCol; label: string; align?: 'right' }[] = [
  { col: 'date', label: 'Date' },
  { col: 'description', label: 'Description' },
  { col: 'account', label: 'Account' },
  { col: 'category', label: 'Category' },
  { col: 'amount', label: 'Amount', align: 'right' },
];

interface GridProps {
  rows: Row[];
  selectedId: string | null;
  sort: SortState;
  onSort: (col: SortCol) => void;
  onSelect: (id: string) => void;
}

const GridRow = memo(function GridRow(props: { row: Row; index: number; top: number; selected: boolean; onSelect: (id: string) => void }) {
  const { row, index, top, selected, onSelect } = props;
  const neg = row.tx.amount_cents < 0;
  return (
    <div
      role="row"
      id={`row-${row.tx.id}`}
      aria-rowindex={index + 2}
      aria-selected={selected}
      className={'grid-row' + (selected ? ' selected' : '')}
      style={{ transform: `translateY(${top}px)`, height: ROW_H }}
      onClick={() => onSelect(row.tx.id)}
    >
      <div role="gridcell" className="cell">{row.tx.date}</div>
      <div role="gridcell" className="cell" title={row.tx.description}>{row.tx.description}</div>
      <div role="gridcell" className="cell">{row.acct}</div>
      <div role="gridcell" className="cell">{row.cat}</div>
      <div role="gridcell" className={'cell right num' + (neg ? '' : ' pos')}>{formatCents(row.tx.amount_cents)}</div>
    </div>
  );
});

export function TransactionsGrid({ rows, selectedId, sort, onSort, onSelect }: GridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current, estimateSize: () => ROW_H, overscan: 10 });

  const selIndex = selectedId ? rows.findIndex((r) => r.tx.id === selectedId) : -1;

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (rows.length === 0) return;
      const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 400) / ROW_H) - 1);
      let next = selIndex;
      switch (e.key) {
        case 'ArrowDown': next = Math.min(rows.length - 1, selIndex + 1); break;
        case 'ArrowUp': next = Math.max(0, selIndex < 0 ? 0 : selIndex - 1); break;
        case 'PageDown': next = Math.min(rows.length - 1, selIndex + page); break;
        case 'PageUp': next = Math.max(0, selIndex - page); break;
        case 'Home': next = 0; break;
        case 'End': next = rows.length - 1; break;
        default: return;
      }
      e.preventDefault();
      const r = rows[next];
      if (r) {
        onSelect(r.tx.id);
        virt.scrollToIndex(next, { align: 'auto' });
      }
    },
    [rows, selIndex, onSelect, virt],
  );

  // Keep selection scrolled into view when the list is re-sorted.
  const sortKey = `${sort.col}:${sort.dir}`;
  useEffect(() => {
    if (selIndex >= 0) virt.scrollToIndex(selIndex, { align: 'auto' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey]);

  return (
    <div className="grid" role="grid" aria-label="Transactions" aria-rowcount={rows.length + 1} aria-colcount={5}>
      <div role="row" aria-rowindex={1} className="grid-head">
        {COLS.map((c) => {
          const active = sort.col === c.col;
          return (
            <div key={c.col} role="columnheader" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={'cell head' + (c.align ? ' right' : '')}>
              <button type="button" className="head-btn" data-col={c.col} onClick={() => onSort(c.col)}>
                {c.label}
                {active ? (sort.dir === 'asc' ? <ArrowSortUp16Regular /> : <ArrowSortDown16Regular />) : null}
              </button>
            </div>
          );
        })}
      </div>
      <div
        ref={scrollRef}
        className="grid-body"
        tabIndex={0}
        aria-label="Transaction rows"
        aria-activedescendant={selIndex >= 0 && selectedId ? `row-${selectedId}` : undefined}
        onKeyDown={onKey}
        data-testid="grid-scroll"
      >
        {rows.length === 0 ? (
          <div className="empty">No transactions match these filters.</div>
        ) : (
          <div style={{ height: virt.getTotalSize(), position: 'relative', width: '100%' }}>
            {virt.getVirtualItems().map((v) => {
              const row = rows[v.index];
              if (!row) return null;
              return <GridRow key={row.tx.id} row={row} index={v.index} top={v.start} selected={row.tx.id === selectedId} onSelect={onSelect} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
