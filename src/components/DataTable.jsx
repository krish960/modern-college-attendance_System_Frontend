/*
 * DataTable.jsx
 * What it is: the standard table used by the list pages.
 * Exports: DataTable (the table with loading / error / empty states), Pager (Previous / Next buttons) and PagedTable (a DataTable connected to usePaginated).
 * Used in: AccountsManager and most pages in pages/.
 */
import { EmptyState, ErrorNote, Loading } from "./ui";

/**
 * columns: [{ key, header, render?(row), className?, align? }]
 * pagination (optional): { page, setPage, count, pageSize }
 */
// DataTable props: columns, rows, loading, error, onRetry, empty-state texts, pagination, onRowClick, rowKey (unique id field) and rowClass (extra row class).
export function DataTable({ columns, rows, loading, error, onRetry, emptyTitle = "Nothing here yet", emptyHint, emptyAction, pagination, onRowClick, rowKey = "id", rowClass }) {
  // Show an error, a loading spinner, or the empty message before trying to draw the table.
  if (error) return <div className="panel-pad"><ErrorNote message={error} onRetry={onRetry} /></div>;
  if (loading && !rows.length) return <Loading />;
  if (!rows.length) return <EmptyState title={emptyTitle} hint={emptyHint} action={emptyAction} />;

  return (
    <>
      <div className="table-wrap" aria-busy={loading}>
        {/* class cards-on-phone: on a phone every row becomes a small card (see index.css), labels come from data-label */}
        <table className="cards-on-phone">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.align === "right" ? "right" : ""}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          {/* While new data loads, the old rows stay visible but faded. */}
          <tbody style={loading ? { opacity: 0.55 } : undefined}>
            {rows.map((row, i) => (
              <tr
                key={row[rowKey] ?? i}
                className={`${onRowClick ? "clickable" : ""} ${rowClass ? rowClass(row) : ""}`.trim()}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} data-label={typeof c.header === "string" ? c.header : ""} className={`${c.className || ""} ${c.align === "right" ? "right" : ""}`}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && <Pager {...pagination} />}
    </>
  );
}

// Page numbers: `from` and `to` = first and last row shown on this page, `pages` = total pages.
export function Pager({ page, setPage, count, pageSize }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const from = count ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(count, page * pageSize);
  return (
    <div className="pager">
      <span>
        {from}–{to} of {count}
      </span>
      <div className="row">
        <button className="btn sm secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button className="btn sm secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

/** Convenience: a DataTable wired to a usePaginated() result. */
// Shows the Pager only when there is more than one page of rows.
export function PagedTable({ query, columns, ...rest }) {
  return (
    <DataTable
      columns={columns}
      rows={query.rows}
      loading={query.loading}
      error={query.error}
      onRetry={query.reload}
      pagination={query.count > query.pageSize ? { page: query.page, setPage: query.setPage, count: query.count, pageSize: query.pageSize } : null}
      {...rest}
    />
  );
}
