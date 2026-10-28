import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Search } from "lucide-react";

import { SelectControl } from "@/components/ui/SelectControl";
import styles from "@/css/Browse.module.css";

export interface BrowseColumn<Row> {
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
}

export type SortDirection = "asc" | "desc";

interface BrowseTableProps<Row> {
  entityNoun: string;
  toolbarLeading?: ReactNode;
  showChevron?: boolean;
  columns: BrowseColumn<Row>[];
  gridTemplate: string;
  minWidth?: number;
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  expandedRowId: string | null;
  getRowId: (row: Row) => string;
  renderExpanded: (row: Row) => ReactNode;
  onToggleRow: (row: Row) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sortKey?: string;
  sortDirection?: SortDirection;
  onSortChange?: (key: string, direction: SortDirection) => void;
}

export function BrowseTable<Row>({
  entityNoun,
  toolbarLeading,
  showChevron = true,
  columns,
  gridTemplate,
  minWidth = 760,
  rows,
  total,
  page,
  pageSize,
  loading,
  error,
  expandedRowId,
  getRowId,
  renderExpanded,
  onToggleRow,
  onPageChange,
  onPageSizeChange,
  sortKey,
  sortDirection = "asc",
  onSortChange,
}: BrowseTableProps<Row>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pageNumbers = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => firstPage + index,
  );

  return (
    <div className={styles.tableArea}>
      <div className={styles.tableToolbar}>
        {toolbarLeading && (
          <div className={styles.tableToolbarLeading}>{toolbarLeading}</div>
        )}
        <div className={styles.pageSizeControl}>
          <span>Rows per page</span>
          <SelectControl
            className={styles.pageSizeSelect}
            ariaLabel="Rows per page"
            value={String(pageSize)}
            options={[
              { value: "10", label: "10" },
              { value: "30", label: "30" },
              { value: "50", label: "50" },
            ]}
            onValueChange={(nextPageSize) =>
              onPageSizeChange(Number(nextPageSize))
            }
          />
        </div>
        <label className={styles.tableSearch}>
          <Search aria-hidden="true" size={18} />
          <input
            type="search"
            aria-label={`Search ${entityNoun}`}
            placeholder={`Search ${entityNoun}`}
          />
        </label>
        <p className={styles.matchCount}>
          <strong>{total.toLocaleString()}</strong> {entityNoun} match
        </p>
      </div>

      <div className={styles.tableCard} aria-busy={loading}>
        <div
          className={styles.tableHeader}
          role="row"
          style={{ gridTemplateColumns: gridTemplate, minWidth }}
        >
          {columns.map((column) => {
            const active = sortKey === column.key;
            return (
              <div
                className={styles.tableHeaderCell}
                key={column.key}
                role="columnheader"
                aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
              >
                {onSortChange ? (
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => onSortChange(
                      column.key,
                      active && sortDirection === "asc" ? "desc" : "asc",
                    )}
                  >
                    <span>{column.label}</span>
                    <span className={styles.sortIndicators} aria-hidden="true">
                      <ChevronUp className={active && sortDirection === "asc" ? styles.sortActive : ""} size={11} />
                      <ChevronDown className={active && sortDirection === "desc" ? styles.sortActive : ""} size={11} />
                    </span>
                  </button>
                ) : (
                  <span>{column.label}</span>
                )}
              </div>
            );
          })}
        </div>

        {loading && rows.length === 0 && (
          <div className={styles.tableState} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            Loading {entityNoun}…
          </div>
        )}

        {error && (
          <div className={styles.tableState} role="alert">
            <strong>{entityNoun} could not be loaded</strong>
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className={styles.tableState}>
            <strong>No records match these filters</strong>
            <span>Try removing one or more filters.</span>
          </div>
        )}

        {!error && rows.map((row) => {
          const rowId = getRowId(row);
          const isExpanded = expandedRowId === rowId;
          return (
            <div key={rowId} className={styles.tableRecord} style={{ minWidth }}>
              <button
                type="button"
                className={`${styles.tableRow} ${isExpanded ? styles.tableRowOpen : ""}`}
                style={{ gridTemplateColumns: gridTemplate }}
                aria-expanded={isExpanded}
                onClick={() => onToggleRow(row)}
              >
                {columns.map((column, index) => (
                  <span key={column.key} className={styles.tableCell}>
                    {index === 0 && showChevron && (
                      <ChevronRight
                        aria-hidden="true"
                        className={isExpanded ? styles.chevronOpen : styles.chevron}
                        size={15}
                      />
                    )}
                    {column.render(row)}
                  </span>
                ))}
              </button>
              {isExpanded && (
                <div className={styles.expandedRow}>{renderExpanded(row)}</div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.paginationCard}>
        <span>
          {total > 0
            ? `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`
            : "Nothing to show"}
        </span>
        <div className={styles.paginationButtons}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Prev
          </button>
          {pageNumbers.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              className={pageNumber === page ? styles.currentPage : ""}
              aria-current={pageNumber === page ? "page" : undefined}
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
