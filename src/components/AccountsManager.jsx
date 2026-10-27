/*
 * AccountsManager
 * What it is: a full page to list, register, edit, reset the password of, and activate/deactivate staff or HOD accounts.
 * Props: endpoint (API path, e.g. a staff or HOD list), title and subtitle (page heading), noun (word used in texts, e.g. "staff"),
 * canManage (show Edit / Reset password / Activate buttons), canCreate (show the Register button, defaults to canManage),
 * withDepartment (HOD mode: ask for a department when registering), departmentFilter (show a department filter).
 * Used in: pages/admin/DepartmentsPage.jsx, pages/admin/HodsPage.jsx and pages/StaffMembersPage.jsx.
 * Note: the server decides who is really allowed to do what; the props only decide which buttons are shown.
 */
import { useState } from "react";
import api from "../api/client";
import { useToast } from "../context/ToastContext";
import { useDebounce, useOptions, usePaginated } from "../hooks/useData";
import { fmtDateTime } from "../utils/format";
import { PagedTable } from "./DataTable";
import { DownloadButtons } from "./DownloadButtons";
import { FormModal } from "./FormModal";
import { ConfirmDialog } from "./Modal";
import { ACTIVE_OPTIONS, ActiveBadge, FilterSelect, PageHeader, SearchInput } from "./ui";

// Staff type choices for the dropdown.
export const EMPLOYMENT = [
  { value: "PERMANENT", label: "Permanent" },
  { value: "PROVISIONAL", label: "Provisional" },
];

// Builds the list of form fields for the account form.
// create = the Register form (false = the Edit form); withDepartment = ask for a department (only when creating);
// withCard = show the staff type and ID card fields. Some fields appear only in create mode or only in edit mode.
export const accountFields = ({ create, withDepartment, departments, withCard }) => [
  { name: "first_name", label: "First name", required: true },
  { name: "last_name", label: "Last name", required: true },
  { name: "username", label: "Username", required: true, readOnly: !create, help: create ? "Used to sign in. It cannot be changed later." : undefined },
  ...(withDepartment && create ? [{ name: "department", label: "Department", type: "select", required: true, options: departments }] : []),
  { name: "email", type: "email", label: "Email" },
  { name: "phone", label: "Phone", type: "tel", maxLength: 20, placeholder: "98765 43210" },
  ...(create ? [] : [{ name: "employee_id", label: "Employee ID / Staff ID" }]),
  { name: "designation", label: "Designation" },
  ...(withCard ? [{ name: "employment", label: "Staff type", type: "select", required: true, options: EMPLOYMENT, help: "Medical leave (ML) is for permanent staff only." }] : []),
  ...(withCard ? [{ name: "card_code", label: "ID card", type: "card", help: "Scan the staff ID card once so the HOD can mark attendance by scanning it. Optional." }] : []),
  ...(create
    ? [{ name: "password", type: "password", label: "Initial password", required: true, help: "At least 10 characters with a capital letter, a small letter, a digit and a symbol.", full: true }]
    : []),
];

/** The payload for PATCH: everything except fields that cannot change after creation. */
const editPayload = ({ username, department, password, ...rest }) => rest; // eslint-disable-line no-unused-vars

/**
 * List + create / edit / activate / reset-password for HOD or staff accounts.
 * The backend decides who may do what; `canManage` only decides which buttons are shown.
 */
export default function AccountsManager({ endpoint, title, subtitle, noun, canManage, canCreate = canManage, withDepartment = false, departmentFilter = false }) {
  // Small pop-up messages (success / error).
  const toast = useToast();
  // Filters chosen by the user: search text, active status and department.
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [department, setDepartment] = useState("");
  // Wait a moment after typing before asking the server, then load one page of accounts.
  // depts = active departments, used for the department filter.
  const q = useDebounce(search);
  const list = usePaginated(endpoint, { search: q, is_active: active, department });
  const depts = useOptions("/departments/", (d) => ({ value: d.id, label: d.name }), { is_active: "true" });
  // Which pop-up is open: null (none) or { type: "create" | "edit" | "password" | "toggle", user }.
  const [modal, setModal] = useState(null);

  // Runs after a successful save: close the pop-up, show a message and reload the table.
  const done = (message) => {
    setModal(null);
    toast.success(message);
    list.reload();
  };

  // Table columns. Some columns are added only when they make sense (department, staff type, action buttons).
  const columns = [
    {
      key: "name",
      header: "Name",
      render: (u) => (
        <>
          <strong>{u.full_name || u.username}</strong>
          <div className="muted small">{u.username}</div>
        </>
      ),
    },
    ...(withDepartment || departmentFilter ? [{ key: "department_name", header: "Department" }] : []),
    { key: "employee_id", header: "Staff ID", render: (u) => u.employee_id || <span className="muted">–</span> },
    { key: "designation", header: "Designation", render: (u) => u.designation || <span className="muted">–</span> },
    ...(!withDepartment ? [{ key: "employment", header: "Staff type", render: (u) => <span className={`badge ${u.employment === "PROVISIONAL" ? "warn" : "info"}`}>{u.employment_label}</span> }] : []),
    {
      key: "contact",
      header: "Contact",
      render: (u) => (
        <>
          <div>{u.email || <span className="muted">–</span>}</div>
          <div className="muted small">{u.phone}</div>
        </>
      ),
    },
    { key: "last_login", header: "Last sign-in", render: (u) => (u.last_login ? fmtDateTime(u.last_login) : <span className="muted">Never</span>) },
    { key: "is_active", header: "Status", render: (u) => <ActiveBadge active={u.is_active} /> },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            align: "right",
            render: (u) => (
              <div className="actions">
                <button className="btn ghost sm" onClick={() => setModal({ type: "edit", user: u })}>Edit</button>
                <button className="btn ghost sm" onClick={() => setModal({ type: "password", user: u })}>Reset password</button>
                <button className="btn ghost sm" onClick={() => setModal({ type: "toggle", user: u })}>
                  {u.is_active ? "Deactivate" : "Activate"}
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  // Page layout: heading with download / register buttons, filter bar, table, then the pop-ups.
  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={(
          <>
            <DownloadButtons what={endpoint.replace(/\//g, "")} params={{ department: departmentFilter ? department : "", status: active === "true" ? "active" : active === "false" ? "inactive" : "" }} />
            {canCreate && <button className="btn" onClick={() => setModal({ type: "create" })}>Register {noun}</button>}
          </>
        )}
      />
      {/* Filters and the table */}
      <div className="panel">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Name, username, email or employee ID" />
          <FilterSelect label="Status" value={active} onChange={setActive} options={ACTIVE_OPTIONS} />
          {departmentFilter && <FilterSelect label="Department" value={department} onChange={setDepartment} options={depts.options} allLabel="All departments" />}
        </div>
        <PagedTable
          query={list}
          columns={columns}
          emptyTitle={`No ${noun} accounts found`}
          emptyHint={canCreate ? `Register the first ${noun} to get started.` : "Nothing matches these filters."}
          emptyAction={canCreate && <button className="btn" onClick={() => setModal({ type: "create" })}>Register {noun}</button>}
        />
      </div>

      {/* Pop-ups. Only one is shown at a time, chosen by modal.type. */}
      {modal?.type === "create" && (
        <FormModal
          title={`Register ${noun}`}
          intro="The Employee ID (staff ID) is given automatically: EMP-001, EMP-002 and so on."
          fields={accountFields({ create: true, withDepartment, departments: depts.options, withCard: !withDepartment })}
          submitLabel="Register"
          initial={{ employment: "PERMANENT" }}
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.post(endpoint, v);
            done(`${noun[0].toUpperCase() + noun.slice(1)} registered`);
          }}
        />
      )}
      {modal?.type === "edit" && (
        <FormModal
          title={`Edit ${modal.user.full_name}`}
          fields={accountFields({ create: false, withDepartment, withCard: !withDepartment })}
          initial={modal.user}
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.patch(`${endpoint}${modal.user.id}/`, editPayload(v));
            done("Details saved");
          }}
        />
      )}
      {modal?.type === "password" && (
        <FormModal
          title={`Reset password for ${modal.user.full_name}`}
          intro="Choose a new password and share it with them securely. They can change it after signing in."
          fields={[{ name: "password", type: "password", label: "New password", required: true, full: true }]}
          submitLabel="Reset password"
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.post(`${endpoint}${modal.user.id}/reset-password/`, v);
            done("Password reset");
          }}
        />
      )}
      {modal?.type === "toggle" && (
        <ConfirmDialog
          title={`${modal.user.is_active ? "Deactivate" : "Activate"} ${modal.user.full_name}?`}
          message={
            modal.user.is_active
              ? "They will no longer be able to sign in. Their past records stay in the system."
              : "They will be able to sign in again."
          }
          confirmLabel={modal.user.is_active ? "Deactivate" : "Activate"}
          danger={modal.user.is_active}
          onCancel={() => setModal(null)}
          onConfirm={async () => {
            await api.post(`${endpoint}${modal.user.id}/${modal.user.is_active ? "deactivate" : "activate"}/`);
            done(modal.user.is_active ? "Account deactivated" : "Account activated");
          }}
        />
      )}
    </>
  );
}
