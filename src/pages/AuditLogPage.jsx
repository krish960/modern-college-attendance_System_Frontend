/*
 * Audit log page. Opened by the Admin (all departments) and the HOD (own department).
 * A read-only history of who changed what (attendance, corrections, accounts).
 * Entries cannot be edited or deleted. Data: GET /api/audit-logs/.
 */

import { useState } from "react";
import { PagedTable } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { FilterSelect, PageHeader, SearchInput } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useDebounce, useOptions, usePaginated } from "../hooks/useData";
import { fmtDateTime } from "../utils/format";

// Turns an old/new value object into short text like 'status: PRESENT, note: late'. Nested objects are shown as JSON.
const brief = (value) => (value && Object.keys(value).length ? Object.entries(value).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(", ") : "");

export default function AuditLogPage() {
  // Role decides if the Department filter and column are shown.
  const { user } = useAuth();
  // Filter values: text search, department and a date range.
  const [f, setF] = useState({ search: "", department: "", date_from: "", date_to: "" });
  // Returns a handler that updates one filter value.
  const set = (key) => (value) => setF((old) => ({ ...old, [key]: value }));
  // Search text is delayed a little so the server is not called on every key press.
  const q = useDebounce(f.search);
  // Loads GET /api/audit-logs/ page by page with the filters. The server limits an HOD to their own department.
  const list = usePaginated("/audit-logs/", { ...f, search: q });
  // Department choices for the Admin filter (GET /api/departments/).
  const depts = useOptions("/departments/", (d) => ({ value: d.id, label: d.name }), undefined);
  // The log entry opened in the detail modal, or null.
  const [selected, setSelected] = useState(null);

  // Table columns. Only the Admin sees the Department column.
  const columns = [
    { key: "created_at", header: "When", render: (l) => fmtDateTime(l.created_at) },
    { key: "actor_name", header: "Who" },
    { key: "action", header: "Action", render: (l) => <strong>{l.action.replaceAll("_", " ").toLowerCase()}</strong> },
    { key: "entity", header: "Record", render: (l) => `${l.entity_type} #${l.entity_id}` },
    ...(user.role === "ADMIN" ? [{ key: "department_name", header: "Department", render: (l) => l.department_name || "–" }] : []),
    {
      // Shows 'old value -> new value' and the reason if there is one.
      key: "change",
      header: "Change",
      render: (l) => (
        <span className="small">
          {l.old_value && <span className="muted">{brief(l.old_value)} → </span>}
          {brief(l.new_value)}
          {l.reason && <div className="muted">Reason: {l.reason}</div>}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Audit log" subtitle="A permanent record of who changed what. Entries cannot be edited or deleted." />
      {/* Table card with filters. */}
      <div className="panel">
        {/* Toolbar: search, department (Admin only) and date range. */}
        <div className="toolbar">
          <SearchInput value={f.search} onChange={set("search")} placeholder="Action, person or reason" />
          {user.role === "ADMIN" && <FilterSelect label="Department" value={f.department} onChange={set("department")} options={depts.options} allLabel="All departments" />}
          <div className="field">
            <label htmlFor="a-from">From</label>
            <input id="a-from" type="date" value={f.date_from} onChange={(e) => set("date_from")(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="a-to">To</label>
            <input id="a-to" type="date" value={f.date_to} onChange={(e) => set("date_to")(e.target.value)} />
          </div>
        </div>
        {/* Paged table. Clicking a row opens the full entry. */}
        <PagedTable query={list} columns={columns} onRowClick={setSelected} emptyTitle="No audit entries" emptyHint="Actions such as submitting attendance or approving corrections are recorded here." />
      </div>
      {/* Detail modal: the raw entry as formatted JSON, read-only. */}
      {selected && (
        <Modal title="Audit entry" wide onClose={() => setSelected(null)} footer={<button className="btn secondary" onClick={() => setSelected(null)}>Close</button>}>
          <div className="modal-body">
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "0.85rem" }}>{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </Modal>
      )}
    </>
  );
}
