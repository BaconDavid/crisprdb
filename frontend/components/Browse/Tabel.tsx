import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import styles from "@/css/Browse.module.css";

export interface BrowseColumn<Row> {
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
}

interface BrowseTableProps<Row> {
  entityNoun: string;
  showChevron?: boolean;
  columns: BrowseColumn<Row>[];
  gridTemplate: string;
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
}

export function BrowseTable<Row>({
  entityNoun,
  showChevron = true,
  columns,
  gridTemplate,
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
        <p>
          <strong>{total.toLocaleString()}</strong> {entityNoun} match
        </p>
        <label className={styles.pageSizeControl}>
          Rows per page
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            <option value={10}>10</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>
        </label>
      </div>

      <div className={styles.tableCard} aria-busy={loading}>
        <div className={styles.tableHeader} style={{ gridTemplateColumns: gridTemplate }}>
          {columns.map((column) => (
            <span key={column.key}>{column.label}</span>
          ))}
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
            <div key={rowId} className={styles.tableRecord}>
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
