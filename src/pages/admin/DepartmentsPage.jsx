/*
 * Departments page. Opened by the Admin only.
 * Lists departments from /api/departments/ with search and an Active filter.
 * The Admin can create, edit, view, activate or deactivate a department and
 * register its HOD (Head of Department).
 */

import { useState } from "react";
import api from "../../api/client";
import { accountFields } from "../../components/AccountsManager";
import { PagedTable } from "../../components/DataTable";
import { FormModal } from "../../components/FormModal";
import { ConfirmDialog, Modal } from "../../components/Modal";
import { ACTIVE_OPTIONS, ActiveBadge, FilterSelect, PageHeader, SearchInput } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { useDebounce, usePaginated } from "../../hooks/useData";
import { fmtDate } from "../../utils/format";

// Form fields used for both 'New department' and 'Edit department'.
const DEPT_FIELDS = [
  { name: "name", label: "Department name", required: true, placeholder: "e.g. Computer Science" },
  { name: "code", label: "Code", required: true, placeholder: "e.g. CS", help: "Letters and digits only. Must be unique." },
  { name: "description", label: "Description", type: "textarea" },
];

export default function DepartmentsPage() {
  const toast = useToast();
  // search = what the user typed. active = status filter ('' means all).
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  // Wait a moment after typing before calling the server, to avoid too many requests.
  const q = useDebounce(search);
  // Paged list from /api/departments/. Filters are sent as query parameters.
  const list = usePaginated("/departments/", { search: q, is_active: active });
  // Which popup is open. null means none. Shape: { type, dept }. Types: create, edit, hod, toggle, view.
  const [modal, setModal] = useState(null);

  // Run after any successful save: close the popup, show a message, reload the table.
  const done = (message) => {
    setModal(null);
    toast.success(message);
    list.reload();
  };

  // Table columns. 'render' draws custom content for a cell.
  const columns = [
    {
      key: "name",
      header: "Department",
      render: (d) => (
        <>
          <strong>{d.name}</strong>
          <div className="muted small">{d.code}</div>
        </>
      ),
    },
    {
      // HOD column: show the name, or a button to register one (not allowed while the department is inactive).
      key: "hod",
      header: "HOD",
      render: (d) =>
        d.hod ? (
          d.hod.name
        ) : (
          <button className="btn sm secondary" onClick={() => setModal({ type: "hod", dept: d })} disabled={!d.is_active}>
            Register HOD
          </button>
        ),
    },
    // Count columns. The server sends these numbers ready to show.
    { key: "staff_count", header: "Staff", align: "right", className: "num" },
    { key: "student_count", header: "Students", align: "right", className: "num" },
    { key: "class_count", header: "Classes", align: "right", className: "num" },
    { key: "is_active", header: "Status", render: (d) => <ActiveBadge active={d.is_active} /> },
    {
      // Row buttons. Each one opens a popup for that department.
      key: "actions",
      header: "",
      align: "right",
      render: (d) => (
        <div className="actions">
          <button className="btn ghost sm" onClick={() => setModal({ type: "view", dept: d })}>View</button>
          <button className="btn ghost sm" onClick={() => setModal({ type: "edit", dept: d })}>Edit</button>
          <button className="btn ghost sm" onClick={() => setModal({ type: "toggle", dept: d })}>
            {d.is_active ? "Deactivate" : "Activate"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Page title with the 'New department' button */}
      <PageHeader
        title="Departments"
        subtitle="Create departments and register the head of each one."
        actions={<button className="btn" onClick={() => setModal({ type: "create" })}>New department</button>}
      />
      <div className="panel">
        {/* Toolbar: search box and status filter */}
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Department name or code" />
          <FilterSelect label="Status" value={active} onChange={setActive} options={ACTIVE_OPTIONS} />
        </div>
        {/* Table with paging. Shows the empty message when there are no departments. */}
        <PagedTable
          query={list}
          columns={columns}
          emptyTitle="No departments yet"
          emptyHint="Create your first department, then register its HOD."
          emptyAction={<button className="btn" onClick={() => setModal({ type: "create" })}>New department</button>}
        />
      </div>

      {/* Popup: create a department (POST /api/departments/) */}
      {modal?.type === "create" && (
        <FormModal
          title="New department"
          fields={DEPT_FIELDS}
          submitLabel="Create department"
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.post("/departments/", v);
            done("Department created");
          }}
        />
      )}
      {/* Popup: edit a department (PATCH /api/departments/{id}/) */}
      {modal?.type === "edit" && (
        <FormModal
          title={`Edit ${modal.dept.name}`}
          fields={DEPT_FIELDS}
          initial={modal.dept}
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.patch(`/departments/${modal.dept.id}/`, v);
            done("Department saved");
          }}
        />
      )}
      {/* Popup: register the HOD login account for this department (POST /api/hods/) */}
      {modal?.type === "hod" && (
        <FormModal
          title={`Register HOD for ${modal.dept.name}`}
          fields={accountFields({ create: true })}
          submitLabel="Register HOD"
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.post("/hods/", { ...v, department: modal.dept.id });
            done("HOD registered");
          }}
        />
      )}
      {/* Confirm popup: activate or deactivate. Inactive departments block sign in for their HOD and staff, but no data is deleted. */}
      {modal?.type === "toggle" && (
        <ConfirmDialog
          title={`${modal.dept.is_active ? "Deactivate" : "Activate"} ${modal.dept.name}?`}
          message={
            modal.dept.is_active
              ? "The HOD and staff of this department will not be able to sign in. All records are kept."
              : "People in this department will be able to sign in again."
          }
          confirmLabel={modal.dept.is_active ? "Deactivate" : "Activate"}
          danger={modal.dept.is_active}
          onCancel={() => setModal(null)}
          onConfirm={async () => {
            await api.post(`/departments/${modal.dept.id}/${modal.dept.is_active ? "deactivate" : "activate"}/`);
            done(modal.dept.is_active ? "Department deactivated" : "Department activated");
          }}
        />
      )}
      {/* Popup: read only details of the department */}
      {modal?.type === "view" && (
        <Modal title={modal.dept.name} onClose={() => setModal(null)} footer={<button className="btn secondary" onClick={() => setModal(null)}>Close</button>}>
          <div className="modal-body">
            <dl className="stack" style={{ margin: 0 }}>
              {[
                ["Code", modal.dept.code],
                ["Status", <ActiveBadge key="s" active={modal.dept.is_active} />],
                ["Head of department", modal.dept.hod?.name || "Not assigned"],
                ["Active staff", modal.dept.staff_count],
                ["Active students", modal.dept.student_count],
                ["Active classes", modal.dept.class_count],
                ["Created", fmtDate(modal.dept.created_at?.slice(0, 10))],
                ["Description", modal.dept.description || "–"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="muted small">{k}</dt>
                  <dd style={{ margin: 0 }}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Modal>
      )}
    </>
  );
}
