import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
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
  /** Rows per page. Default 10. */
  defaultPageSize?: number;
  /** Page-size dropdown values. Default [10, 25, 50, 100]. */
  pageSizeOptions?: number[];
  /**
   * When false, the first column uses the same neutral styling as other columns
   * (no violet highlight stripe). Default true for backward compatibility.
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

function ColumnSortControl({
  direction,
  onAsc,
  onDesc,
}: {
  direction: SortDirection | null;
  onAsc: () => void;
  onDesc: () => void;
}) {
  return (
    <span className="ml-1.5 inline-flex flex-col items-center justify-center leading-none">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAsc();
        }}
        className={cn(
          'rounded p-0.5 transition-colors hover:bg-slate-200/80 dark:hover:bg-slate-700/80',
          direction === 'asc' ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500',
        )}
        aria-label="Sort ascending"
      >
        <ChevronUp className="h-3 w-3" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDesc();
        }}
        className={cn(
          '-mt-1 rounded p-0.5 transition-colors hover:bg-slate-200/80 dark:hover:bg-slate-700/80',
          direction === 'desc' ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500',
        )}
        aria-label="Sort descending"
      >
        <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
      </button>
    </span>
  );
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  highlightFirstColumn = false,
  embedded = false,
  stickyHeader = false,
  tableClassName,
  compact = false,
  fitWidth = false,
  defaultPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(defaultPageSize);
  const [perPageOpen, setPerPageOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null);

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return data;
    const col = columns.find((c) => columnSortKey(c) === sortColumn);
    if (!col) return data;
    return [...data].sort((a, b) => compareSortValues(getSortValue(col, a), getSortValue(col, b), sortDirection));
  }, [columns, data, sortColumn, sortDirection]);

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(sortedData.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = sortedData.slice(startIndex, endIndex);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const applySort = (col: ColumnDef<T>, direction: SortDirection) => {
    const key = columnSortKey(col);
    if (sortColumn === key && sortDirection === direction) {
      setSortColumn(null);
      setSortDirection(null);
    } else {
      setSortColumn(key);
      setSortDirection(direction);
    }
    setCurrentPage(1);
  };

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

  return (
    <div
      className={cn(
        'data-table w-full overflow-hidden font-sans',
        embedded ? '' : 'rounded-2xl bg-white dark:bg-slate-900 shadow-sm',
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
            <tr className="data-table-head-row border-b bg-white dark:bg-slate-900">
              {columns.map((col, i) => {
                const sortKey = columnSortKey(col);
                const isSorted = sortColumn === sortKey;
                return (
                <th
                  key={sortKey}
                  onClick={col.sortable ? () => cycleSort(col) : undefined}
                  className={cn(
                    'font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400',
                    compact ? 'px-2.5 py-2 text-[10px] leading-tight' : 'px-6 py-3.5 text-xs whitespace-nowrap',
                    highlightFirstColumn && !compact && 'py-4',
                    col.sortable && 'cursor-pointer select-none',
                    highlightFirstColumn && i === 0
                      ? 'bg-violet-50 text-brand-text dark:bg-indigo-500/10 dark:text-slate-200'
                      : 'bg-white dark:bg-slate-900',
                    col.className,
                    col.headerClassName,
                    highlightFirstColumn && i === 0 && 'border-r-[3px] border-transparent',
                  )}
                >
                  <div className="inline-flex items-center">
                    <span>{col.header}</span>
                    {col.sortable ? (
                      <ColumnSortControl
                        direction={isSorted ? sortDirection : null}
                        onAsc={() => applySort(col, 'asc')}
                        onDesc={() => applySort(col, 'desc')}
                      />
                    ) : null}
                  </div>
                </th>
              );
              })}
            </tr>
          </thead>
          <tbody>
            {currentData.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={cn(
                  'data-table-row group border-b transition-colors',
                  onRowClick ? 'cursor-pointer' : '',
                )}
              >
                {columns.map((col, i) => (
                  <td
                    key={i}
                    className={cn(
                      'text-sm font-normal leading-5 text-brand-text dark:text-slate-200',
                      compact ? 'px-2.5 py-2 align-middle' : 'px-6',
                      !compact && (highlightFirstColumn ? 'py-4 align-top' : 'py-3 align-middle'),
                      highlightFirstColumn && i === 0
                        ? 'border-r-[3px] border-transparent bg-violet-50 font-medium group-hover:bg-violet-100 dark:bg-indigo-500/10 dark:group-hover:bg-indigo-500/20'
                        : 'bg-white group-hover:bg-slate-50/80 dark:bg-slate-900 dark:group-hover:bg-slate-800/70',
                      col.className,
                      col.cellClassName,
                    )}
                  >
                    {col.render
                      ? col.render(item)
                      : col.accessorKey
                        ? (item[col.accessorKey] as React.ReactNode)
                        : null}
                  </td>
                ))}
              </tr>
            ))}
            {currentData.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-8 text-center text-brand-muted dark:text-slate-400">
                  {t('datatable.no_data')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Container */}
      <div
        className={cn(
          'data-table-footer flex items-center justify-between border-t',
          compact ? 'px-3 py-3' : 'px-6 py-4',
          embedded ? 'bg-slate-50/60 dark:bg-slate-800/90' : 'bg-white dark:bg-slate-900',
        )}
      >
        <div className="flex items-center gap-2 text-sm font-normal text-brand-muted dark:text-slate-300">
          <span>{t('datatable.show')}</span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPerPageOpen(!perPageOpen)}
              className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-transparent hover:border-transparent transition-all text-brand-text dark:text-slate-100 font-medium min-w-[60px] justify-between"
            >
              {itemsPerPage}
              <ChevronDown
                size={14}
                className={cn("text-brand-muted dark:text-slate-400 transition-transform", perPageOpen && "rotate-180")}
              />
            </button>

            {perPageOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setPerPageOpen(false)} aria-hidden />
                <div className="absolute bottom-full left-0 mb-1 w-full bg-white dark:bg-slate-900 border border-transparent rounded-lg shadow-lg z-20 py-1 overflow-hidden">
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
                        "w-full text-left px-3 py-1.5 text-sm hover:bg-brand-primary/5 transition-colors",
                        itemsPerPage === num
                          ? "text-brand-orange font-bold bg-brand-orange/5"
                          : "text-brand-text dark:text-slate-200"
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

        <div className="flex items-center gap-2 text-sm">
          <span className="mr-4 text-brand-muted dark:text-slate-400 tabular-nums">
            {t('datatable.showing_info', {
              from: sortedData.length > 0 ? startIndex + 1 : 0,
              to: Math.min(endIndex, sortedData.length),
              total: sortedData.length
            })}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || sortedData.length === 0}
              className="p-1.5 rounded-lg text-brand-muted dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  type="button"
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-all",
                    currentPage === page
                      ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20"
                      : "text-brand-muted dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-brand-text dark:hover:text-slate-200"
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
              className="p-1.5 rounded-lg text-brand-muted dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
