/*
 * ui.jsx
 * What it is: small shared building blocks used by many pages.
 * Contains: Spinner, Loading, EmptyState, ErrorNote, PageHeader, StatCard, StatusBadge, ActiveBadge, Pct, SearchInput, FilterSelect and ACTIVE_OPTIONS.
 * Used in: DataTable, AccountsManager and most pages.
 */
import SearchSelect, { SEARCH_FROM } from "./SearchSelect";
import { Link } from "react-router-dom";
import { fmtPct } from "../utils/format";

/** A small turning circle that shows something is loading. */
export function Spinner() {
  return <span className="spinner" role="status" aria-label="Loading" />;
}

/** Spinner with a text next to it. */
export function Loading({ text = "Loading…" }) {
  return (
    <div className="loading">
      <Spinner /> <span>{text}</span>
    </div>
  );
}

/** Shown when a list has nothing in it: a title, an optional hint and an optional button (action). */
export function EmptyState({ title, hint, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  );
}

/** Shows an error message with an optional "Try again" button. Shows nothing if there is no message. */
export function ErrorNote({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="note" role="alert">
      {message}{" "}
      {onRetry && (
        <button className="btn sm secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** The top of a page: title, optional subtitle and optional buttons on the right (actions). */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

/** A figure box. With `to` the whole box is a link to the page behind the number. */
export function StatCard({ label, value, hint, tone = "", to }) {
  const body = (
    <>
      <div className="value">{value ?? "–"}</div>
      <div className="label">{label}</div>
      {hint && <div className="hint">{hint}</div>}
    </>
  );
  return to
    ? <Link to={to} className={`stat link ${tone}`} aria-label={`${label}: ${value ?? "none"}. Open`}>{body}</Link>
    : <div className={`stat ${tone}`}>{body}</div>;
}

// Maps a status code from the server to [badge colour, text shown to the user].
const STATUS = {
  SUBMITTED: ["good", "Submitted"],
  PENDING: ["warn", "Pending"],
  PROCESSING: ["info", "In process"],
  DRAFT: ["warn", "Draft"],
  SCHEDULED: ["info", "Scheduled"],
  CANCELLED: ["", "Cancelled"],
  WAITING_HOD: ["warn", "Waiting for HOD"],
  WAITING_ADMIN: ["info", "Waiting for admin"],
  DONE: ["good", "Promoted"],
  APPROVED: ["good", "Approved"],
  REJECTED: ["bad", "Rejected"],
  PRESENT: ["good", "Present"],
  ABSENT: ["bad", "Absent"],
  LATE: ["warn", "Late"],
  HALF_DAY: ["warn", "Half day"],
  LEAVE: ["info", "On leave"],
  ACTIVE: ["good", "Active"],
  INACTIVE: ["", "Inactive"],
};

/** A coloured label for a status code. An unknown status is shown as it is. */
export function StatusBadge({ status }) {
  const [tone, label] = STATUS[status] || ["", status];
  return <span className={`badge ${tone}`}>{label}</span>;
}

/** Active / Inactive label for a true / false value. */
export const ActiveBadge = ({ active }) => <StatusBadge status={active ? "ACTIVE" : "INACTIVE"} />;

/** Percentage with a small bar; below 75% reads as a warning. */
export function Pct({ value }) {
  if (value === null || value === undefined) return <span className="muted">–</span>;
  return (
    <span className="num">
      {fmtPct(value)}
      <span className={`bar ${value < 75 ? "low" : ""}`} aria-hidden="true">
        <span style={{ width: `${Math.min(100, value)}%` }} />
      </span>
    </span>
  );
}

/** A labelled search box. onChange receives the text. */
export function SearchInput({ value, onChange, placeholder = "Search…", label = "Search", id = "search-box" }) {
  return (
    <div className="field grow">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** A labelled <select> for toolbars. `options` is [{value, label}]. */
// With many options (more than SEARCH_FROM) a searchable select is used, otherwise a normal dropdown.
export function FilterSelect({ label, value, onChange, options, allLabel = "All" }) {
  if (options.length > SEARCH_FROM) {
    const id = `fs-${String(label).replace(/\W+/g, "-").toLowerCase()}`;
    return (
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <SearchSelect id={id} value={value} onChange={onChange} options={options} allLabel={allLabel} />
      </div>
    );
  }
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Options for an Active / Inactive filter (values are text because they are sent in the URL).
export const ACTIVE_OPTIONS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];
