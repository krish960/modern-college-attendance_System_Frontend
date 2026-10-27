/*
 * Subjects page. Opened by the HOD only.
 * Lists and edits the subjects of the HOD's department using /api/subjects/.
 */

import { useState } from "react";
import api from "../../api/client";
import { PagedTable } from "../../components/DataTable";
import { FormModal } from "../../components/FormModal";
import { ACTIVE_OPTIONS, ActiveBadge, FilterSelect, PageHeader, SearchInput } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { useDebounce, usePaginated } from "../../hooks/useData";

// Form fields. 'Active' shows only when editing. Business rule: an inactive subject cannot be assigned to teachers.
const fields = (editing) => [
  { name: "name", label: "Subject name", required: true, placeholder: "e.g. Database Management Systems" },
  { name: "code", label: "Subject code", required: true, placeholder: "e.g. CS-301" },
  { name: "semester", label: "Semester", type: "number", min: 1, max: 12, help: "Optional." },
  ...(editing ? [{ name: "is_active", label: "Active", type: "checkbox", help: "Inactive subjects cannot be assigned to teachers." }] : []),
];

// Semester is optional. An empty box is sent as null, otherwise as a number.
const payload = (v) => ({ ...v, semester: v.semester === "" || v.semester === null ? null : Number(v.semester) });

export default function SubjectsPage() {
  const toast = useToast();
  // search = typed text. active = status filter ('' means all).
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  // Wait a moment after typing before calling the server, to avoid too many requests.
  const q = useDebounce(search);
  // Paged list from /api/subjects/
  const list = usePaginated("/subjects/", { search: q, is_active: active });
  // Which popup is open. null means none. 'type' says which one and the other key holds the row being worked on.
  const [modal, setModal] = useState(null);

  // Run after any successful save: close the popup, show a message, reload the table.
  const done = (message) => {
    setModal(null);
    toast.success(message);
    list.reload();
  };

  // Table columns
  const columns = [
    { key: "name", header: "Subject", render: (s) => <strong>{s.name}</strong> },
    { key: "code", header: "Code" },
    { key: "semester", header: "Semester", render: (s) => s.semester ?? <span className="muted">–</span> },
    { key: "is_active", header: "Status", render: (s) => <ActiveBadge active={s.is_active} /> },
    { key: "actions", header: "", align: "right", render: (s) => <button className="btn ghost sm" onClick={() => setModal({ type: "edit", subject: s })}>Edit</button> },
  ];

  return (
    <>
      {/* Page title with the 'New subject' button */}
      <PageHeader title="Subjects" subtitle="The subjects taught in your department." actions={<button className="btn" onClick={() => setModal({ type: "create" })}>New subject</button>} />
      <div className="panel">
        {/* Toolbar: search box and filters */}
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Subject name or code" />
          <FilterSelect label="Status" value={active} onChange={setActive} options={ACTIVE_OPTIONS} />
        </div>
        {/* Table with paging. Shows the empty message when nothing matches. */}
        <PagedTable
          query={list}
          columns={columns}
          emptyTitle="No subjects yet"
          emptyHint="Add the subjects your teachers will take attendance for."
          emptyAction={<button className="btn" onClick={() => setModal({ type: "create" })}>New subject</button>}
        />
      </div>
      {/* Popup: create a subject (POST /api/subjects/) */}
      {modal?.type === "create" && (
        <FormModal
          title="New subject"
          fields={fields(false)}
          submitLabel="Create subject"
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.post("/subjects/", payload(v));
            done("Subject created");
          }}
        />
      )}
      {/* Popup: edit a subject (PATCH /api/subjects/{id}/) */}
      {modal?.type === "edit" && (
        <FormModal
          title={`Edit ${modal.subject.name}`}
          fields={fields(true)}
          initial={modal.subject}
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.patch(`/subjects/${modal.subject.id}/`, payload(v));
            done("Subject saved");
          }}
        />
      )}
    </>
  );
}
