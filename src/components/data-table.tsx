import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc';

export interface ColumnDef<T> {
  /** Stable column id for sorting. Falls back to accessorKey or header. */
  id?: string;
  header: string;
  accessorKey?: keyof T;
  /** Enable stacked up/down sort controls in the header. */
  sortable?: boolean;
  /** Custom value extractor for sorting when using `render`. */
  sortValue?: (item: T) => string | number | null | undefined;
  render?: (item: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T) => string | number;
  onRowClick?: (item: T) => void;
  /** Optional per-row class names (e.g. highlight paid rows). */
  rowClassName?: (item: T) => string | undefined;
  /** Rows per page. Default 10. */
  defaultPageSize?: number;
  /** Page-size dropdown values. Default [10, 25, 50, 100]. */
  pageSizeOptions?: number[];
  /**
   * When true (default), freezes the first 1–2 columns with Merit `#F8F9FF` tint
   * (matches Merit DataTable frozen-band pattern). Pass false for compact/embedded tables.
   */
  highlightFirstColumn?: boolean;
  /**
   * When true, drops the inner white card frame (rounded-2xl, shadow) so the table
   * can sit flush inside a parent Card without a double border/box.
   */
  embedded?: boolean;
  /**
   * When true, keeps the table header visible while scrolling table body.
   */
  stickyHeader?: boolean;
  /** Extra classes on the `<table>` element (e.g. `table-fixed` for fit-to-width layouts). */
  tableClassName?: string;
  /** Tighter cell padding for wide tables that must fit without horizontal scroll. */
  compact?: boolean;
  /** Lock table to container width (no horizontal scroll). */
  fitWidth?: boolean;
  /**
   * Optional summary row rendered in `<tfoot>` (e.g. totals), above pagination.
   */
  footerRow?: React.ReactNode;
}

function columnSortKey<T>(col: ColumnDef<T>): string {
  if (col.id) return col.id;
  if (col.accessorKey != null) return String(col.accessorKey);
  return col.header;
}

function getSortValue<T>(col: ColumnDef<T>, item: T): string | number | null | undefined {
  if (col.sortValue) return col.sortValue(item);
  if (col.accessorKey) return item[col.accessorKey] as string | number | null | undefined;
  return null;
}

function compareSortValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  direction: SortDirection,
): number {
  const mul = direction === 'asc' ? 1 : -1;
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * mul;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }) * mul;
}

/** Merit primary cell text (IDs, names in list tables) */
export const meritCellPrimaryClass =
  'text-[13px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-100';

/** Merit accent cell text (building / key id in brand blue) */
export const meritCellAccentClass =
  'text-[13px] font-black uppercase tracking-tight text-brand-blue';

/** Merit muted meta under a primary cell */
export const meritCellMetaClass =
  'text-[11px] font-bold uppercase tracking-wider text-slate-400';

/** Merit status pill */
export const meritStatusPillClass =
  'inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest';

function frozenColCount(columns: { header: string }[], highlightFirstColumn: boolean): number {
  if (!highlightFirstColumn) return 0;
  // Merit: first 2 cols frozen, or first 3 when leading col is empty/checkbox
  return columns[0]?.header === '' ? 3 : 2;
}

function isFrozenCol(frozenCount: number, index: number): boolean {
  return index < frozenCount;
}

function MeritPlainCell({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  if (children == null || children === '') return null;
  if (typeof children === 'string' || typeof children === 'number') {
    return (
      <span className={accent ? meritCellAccentClass : meritCellPrimaryClass}>{children}</span>
    );
  }
  return <>{children}</>;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  rowClassName,
  highlightFirstColumn = true,
  embedded = false,
  stickyHeader = false,
  tableClassName,
  compact = false,
  fitWidth = false,
  defaultPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  footerRow,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(defaultPageSize);
  const [perPageOpen, setPerPageOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null);

  const frozenCount = frozenColCount(columns, highlightFirstColumn);

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return data;
    const col = columns.find((c) => columnSortKey(c) === sortColumn);
    if (!col) return data;
    return [...data].sort((a, b) => compareSortValues(getSortValue(col, a), getSortValue(col, b), sortDirection));
  }, [columns, data, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = sortedData.slice(startIndex, endIndex);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const cycleSort = (col: ColumnDef<T>) => {
    const key = columnSortKey(col);
    if (sortColumn !== key) {
      setSortColumn(key);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortColumn(null);
      setSortDirection(null);
    }
    setCurrentPage(1);
  };

  const cellPad = compact ? 'px-2.5 py-2' : 'px-4 py-3';

  return (
    <div
      className={cn(
        'data-table w-full overflow-hidden font-sans',
        embedded
          ? ''
          : 'rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none',
      )}
    >
      <div
        className={cn(
          'w-full',
          fitWidth ? 'overflow-x-hidden' : 'overflow-x-auto',
          stickyHeader && 'max-h-[min(70vh,40rem)] overflow-y-auto',
        )}
      >
        <table className={cn('w-full border-collapse text-left', fitWidth && 'table-fixed', tableClassName)}>
          <thead className={cn(stickyHeader && 'sticky top-0 z-10')}>
            <tr className="data-table-head-row">
              {columns.map((col, i) => {
                const sortKey = columnSortKey(col);
                const isSorted = sortColumn === sortKey;
                const frozen = isFrozenCol(frozenCount, i);
                return (
                  <th
                    key={sortKey}
                    onClick={col.sortable ? () => cycleSort(col) : undefined}
                    className={cn(
                      cellPad,
                      'text-[10px] font-black whitespace-nowrap uppercase tracking-[0.1em]',
                      col.sortable && 'cursor-pointer select-none hover:text-brand-blue',
                      frozen
                        ? 'bg-[#F8F9FF] text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                        : 'bg-white text-slate-400 dark:bg-slate-900 dark:text-slate-500',
                      col.className,
                      col.headerClassName,
                    )}
                    aria-sort={
                      isSorted
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : col.sortable
                          ? 'none'
                          : undefined
                    }
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.header}
                      {col.sortable ? (
                        isSorted ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5 text-brand-blue" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-brand-blue" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
                        )
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {currentData.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={cn(
                  'data-table-row group text-sm transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/40',
                  onRowClick ? 'cursor-pointer' : '',
                  rowClassName?.(item),
                )}
              >
                {columns.map((col, i) => {
                  const frozen = isFrozenCol(frozenCount, i);
                  const content = col.render
                    ? col.render(item)
                    : col.accessorKey
                      ? (item[col.accessorKey] as React.ReactNode)
                      : null;
                  return (
                    <td
                      key={i}
                      className={cn(
                        cellPad,
                        'transition-colors duration-150',
                        frozen
                          ? 'border-r border-slate-50/50 bg-[#F8F9FF] text-brand-text group-hover:bg-[#e2e7ff] dark:border-slate-700/50 dark:bg-slate-800 dark:text-slate-100 dark:group-hover:bg-slate-700'
                          : 'bg-white text-brand-text group-hover:bg-blue-50/50 dark:bg-slate-900 dark:text-slate-200 dark:group-hover:bg-slate-800/70',
                        col.className,
                        col.cellClassName,
                      )}
                    >
                      {col.render ? (
                        content
                      ) : (
                        <MeritPlainCell accent={frozen && i === 0}>{content}</MeritPlainCell>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {currentData.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-8 py-12 text-center text-slate-400 font-medium italic dark:text-slate-500"
                >
                  {t('datatable.no_data')}
                </td>
              </tr>
            )}
          </tbody>
          {footerRow && sortedData.length > 0 ? (
            <tfoot>
              <tr className="border-t border-slate-50 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-800/80">
                {footerRow}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {/* Pagination — Merit style */}
      <div
        className={cn(
          'data-table-footer flex flex-col gap-3 border-t border-slate-50 sm:flex-row sm:items-center sm:justify-between',
          compact ? 'px-3 py-3' : 'px-4 py-4 sm:px-6 lg:px-8 sm:py-5',
          embedded ? 'bg-slate-50/60 dark:bg-slate-800/90' : 'bg-white dark:bg-slate-900',
        )}
      >
        <div className="flex w-full items-center gap-3 text-[13px] font-bold text-slate-400 sm:w-auto">
          <span>{t('datatable.show')}</span>
          <div className="relative flex-1 sm:flex-none">
            <button
              type="button"
              onClick={() => setPerPageOpen(!perPageOpen)}
              className="flex min-w-[70px] w-full items-center justify-between gap-4 rounded-xl border border-slate-100 bg-white px-4 py-2 font-black text-slate-700 shadow-sm transition-all hover:border-brand-blue/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-auto"
            >
              {itemsPerPage}
              <ChevronDown
                size={16}
                className={cn('text-slate-300 transition-transform', perPageOpen && 'rotate-180')}
              />
            </button>

            {perPageOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setPerPageOpen(false)} aria-hidden />
                <div className="absolute bottom-full left-0 z-20 mb-2 w-full overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                  {pageSizeOptions.map((num) => (
                    <button
                      type="button"
                      key={num}
                      onClick={() => {
                        setItemsPerPage(num);
                        setCurrentPage(1);
                        setPerPageOpen(false);
                      }}
                      className={cn(
                        'w-full px-4 py-2.5 text-left text-xs font-bold transition-colors hover:bg-brand-blue/5',
                        itemsPerPage === num
                          ? 'bg-brand-blue/5 text-brand-blue'
                          : 'text-slate-600 dark:text-slate-300',
                      )}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:gap-6">
          <span className="text-center text-[12px] font-bold text-slate-400 tabular-nums sm:text-left sm:text-[13px]">
            {t('datatable.showing_info', {
              from: sortedData.length > 0 ? startIndex + 1 : 0,
              to: Math.min(endIndex, sortedData.length),
              total: sortedData.length,
            })}
          </span>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || sortedData.length === 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-all hover:bg-brand-blue/5 hover:text-brand-blue disabled:opacity-30"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  type="button"
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-black transition-all',
                    currentPage === page
                      ? 'bg-[#4B89CD] text-white'
                      : 'text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
                  )}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || sortedData.length === 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-all hover:bg-brand-blue/5 hover:text-brand-blue disabled:opacity-30"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
