/*
 * Classes page. Opened by the HOD only.
 * Lists the classes of the HOD's department from /api/classes/. A class has a
 * name, semester, division and academic year. Students are registered into a class.
 */

import { useState } from "react";
import api from "../../api/client";
import { PagedTable } from "../../components/DataTable";
import { FormModal } from "../../components/FormModal";
import { ACTIVE_OPTIONS, ActiveBadge, FilterSelect, PageHeader, SearchInput } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { useDebounce, usePaginated } from "../../hooks/useData";
import { currentAcademicYear } from "../../utils/format";

// Form fields for the class popup. The 'Active' checkbox is shown only when editing,
// because a new class is always active.
const fields = (editing) => [
  { name: "name", label: "Class name", required: true, placeholder: "e.g. MCS Part I" },
  { name: "semester", label: "Semester", type: "number", min: 1, max: 12, required: true },
  { name: "division", label: "Division", required: true, placeholder: "A" },
  { name: "academic_year", label: "Academic year", required: true, placeholder: "2026-27", help: "Format YYYY-YY." },
  ...(editing ? [{ name: "is_active", label: "Active", type: "checkbox", full: true }] : []),
];

export default function ClassesPage() {
  const toast = useToast();
  // search = typed text. active = status filter ('' means all).
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  // Wait a moment after typing before calling the server, to avoid too many requests.
  const q = useDebounce(search);
  // Paged list from /api/classes/
  const list = usePaginated("/classes/", { search: q, is_active: active });
  // Which popup is open. null means none. 'type' says which one and the other key holds the row being worked on.
  const [modal, setModal] = useState(null);

  // Run after any successful save: close the popup, show a message, reload the table.
  const done = (message) => {
    setModal(null);
    toast.success(message);
    list.reload();
  };

  // Table columns. 'Active students' is a count sent by the server.
  const columns = [
    { key: "label", header: "Class", render: (c) => <strong>{c.label}</strong> },
    { key: "academic_year", header: "Academic year" },
    { key: "student_count", header: "Active students", align: "right", className: "num" },
    { key: "is_active", header: "Status", render: (c) => <ActiveBadge active={c.is_active} /> },
    { key: "actions", header: "", align: "right", render: (c) => <button className="btn ghost sm" onClick={() => setModal({ type: "edit", cls: c })}>Edit</button> },
  ];

  return (
    <>
      {/* Page title with the 'New class' button */}
      <PageHeader title="Classes" subtitle="Each class has a semester and a division. Students are registered into a class." actions={<button className="btn" onClick={() => setModal({ type: "create" })}>New class</button>} />
      <div className="panel">
        {/* Toolbar: search box and filters */}
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Class name, division or year" />
          <FilterSelect label="Status" value={active} onChange={setActive} options={ACTIVE_OPTIONS} />
        </div>
        {/* Table with paging. Shows the empty message when nothing matches. */}
        <PagedTable
          query={list}
          columns={columns}
          emptyTitle="No classes yet"
          emptyHint="Create a class, then assign teachers and subjects to it."
          emptyAction={<button className="btn" onClick={() => setModal({ type: "create" })}>New class</button>}
        />
      </div>
      {/* Popup: create a class (POST /api/classes/). Division starts as A and the year as the current academic year. Semester is sent as a number. */}
      {modal?.type === "create" && (
        <FormModal
          title="New class"
          fields={fields(false)}
          initial={{ division: "A", academic_year: currentAcademicYear() }}
          submitLabel="Create class"
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.post("/classes/", { ...v, semester: Number(v.semester) });
            done("Class created");
          }}
        />
      )}
      {/* Popup: edit a class (PATCH /api/classes/{id}/), including the Active checkbox */}
      {modal?.type === "edit" && (
        <FormModal
          title={`Edit ${modal.cls.label}`}
          fields={fields(true)}
          initial={modal.cls}
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.patch(`/classes/${modal.cls.id}/`, { ...v, semester: Number(v.semester) });
            done("Class saved");
          }}
        />
      )}
    </>
  );
}
