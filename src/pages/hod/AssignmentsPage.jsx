/*
 * Teacher assignments page. Opened by the HOD only.
 * An assignment says which teacher teaches which subject to which class in an
 * academic year. Data comes from /api/assignments/ (the HOD sees only their department).
 * Business rule: a teacher can take attendance only for an active assignment.
 */

import { useState } from "react";
import api from "../../api/client";
import { PagedTable } from "../../components/DataTable";
import { FormModal } from "../../components/FormModal";
import { ConfirmDialog } from "../../components/Modal";
import { ACTIVE_OPTIONS, ActiveBadge, FilterSelect, PageHeader, SearchInput } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { useDebounce, useOptions, usePaginated } from "../../hooks/useData";
import { currentAcademicYear } from "../../utils/format";

export default function AssignmentsPage() {
  const toast = useToast();
  // Filters. teacher and classroom hold an id ('' = all). active defaults to 'true' so
  // the HOD first sees only current assignments.
  const [teacher, setTeacher] = useState("");
  const [classroom, setClassroom] = useState("");
  const [active, setActive] = useState("true");
  const [search, setSearch] = useState("");
  // Wait a moment after typing before calling the server, to avoid too many requests.
  const q = useDebounce(search);
  // Paged list from /api/assignments/. Every filter is sent as a query parameter.
  const list = usePaginated("/assignments/", { search: q, teacher, classroom, is_active: active });
  // Dropdown choices for the filters and the create form. Only active records are offered,
  // because an inactive teacher, subject or class must not get new assignments.
  const teachers = useOptions("/staff/", (u) => ({ value: u.id, label: u.full_name }), { is_active: "true" });
  const subjects = useOptions("/subjects/", (s) => ({ value: s.id, label: `${s.name} (${s.code})` }), { is_active: "true" });
  const classes = useOptions("/classes/", (c) => ({ value: c.id, label: c.label }), { is_active: "true" });
  // Which popup is open. null means none. 'type' says which one and the other key holds the row being worked on.
  const [modal, setModal] = useState(null);

  // Run after any successful save: close the popup, show a message, reload the table.
  const done = (message) => {
    setModal(null);
    toast.success(message);
    list.reload();
  };

  // Table columns. The last column holds the Activate / Deactivate button.
  const columns = [
    { key: "teacher_name", header: "Teacher", render: (a) => <strong>{a.teacher_name}</strong> },
    { key: "subject_name", header: "Subject", render: (a) => <>{a.subject_name} <span className="muted small">{a.subject_code}</span></> },
    { key: "classroom_name", header: "Class" },
    { key: "academic_year", header: "Year" },
    { key: "is_active", header: "Status", render: (a) => <ActiveBadge active={a.is_active} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (a) => (
        <button className="btn ghost sm" onClick={() => setModal({ type: "toggle", assignment: a })}>
          {a.is_active ? "Deactivate" : "Activate"}
        </button>
      ),
    },
  ];

  return (
    <>
      {/* Page title with the 'New assignment' button */}
      <PageHeader
        title="Teacher assignments"
        subtitle="Who teaches which subject to which class. Teachers can only take attendance for their active assignments."
        actions={<button className="btn" onClick={() => setModal({ type: "create" })}>New assignment</button>}
      />
      <div className="panel">
        {/* Toolbar: search box and filters */}
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Teacher, subject or class" />
          <FilterSelect label="Teacher" value={teacher} onChange={setTeacher} options={teachers.options} allLabel="All teachers" />
          <FilterSelect label="Class" value={classroom} onChange={setClassroom} options={classes.options} allLabel="All classes" />
          <FilterSelect label="Status" value={active} onChange={setActive} options={ACTIVE_OPTIONS} allLabel="Any status" />
        </div>
        {/* Table with paging. Shows the empty message when nothing matches. */}
        <PagedTable
          query={list}
          columns={columns}
          emptyTitle="No assignments found"
          emptyHint="Assign a teacher to a subject and class so they can start taking attendance."
          emptyAction={<button className="btn" onClick={() => setModal({ type: "create" })}>New assignment</button>}
        />
      </div>
      {/* Popup: create an assignment (POST /api/assignments/). Ids come from the selects as text, so they are turned into numbers. The three main fields cannot be edited later. */}
      {modal?.type === "create" && (
        <FormModal
          title="New teacher assignment"
          intro="The teacher, subject and class cannot be changed later. To change them, deactivate this assignment and create a new one."
          fields={[
            { name: "teacher", label: "Teacher", type: "select", required: true, options: teachers.options },
            { name: "subject", label: "Subject", type: "select", required: true, options: subjects.options },
            { name: "classroom", label: "Class", type: "select", required: true, options: classes.options },
            { name: "academic_year", label: "Academic year", required: true, placeholder: "2026-27" },
          ]}
          initial={{ academic_year: currentAcademicYear() }}
          submitLabel="Create assignment"
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.post("/assignments/", { ...v, teacher: Number(v.teacher), subject: Number(v.subject), classroom: Number(v.classroom) });
            done("Assignment created");
          }}
        />
      )}
      {/* Confirm popup: activate or deactivate. Deactivating stops new attendance but keeps past attendance. */}
      {modal?.type === "toggle" && (
        <ConfirmDialog
          title={`${modal.assignment.is_active ? "Deactivate" : "Activate"} this assignment?`}
          message={
            modal.assignment.is_active
              ? `${modal.assignment.teacher_name} will no longer be able to take attendance for ${modal.assignment.subject_name} in ${modal.assignment.classroom_name}. Past attendance is kept.`
              : `${modal.assignment.teacher_name} will be able to take attendance again.`
          }
          confirmLabel={modal.assignment.is_active ? "Deactivate" : "Activate"}
          danger={modal.assignment.is_active}
          onCancel={() => setModal(null)}
          onConfirm={async () => {
            await api.post(`/assignments/${modal.assignment.id}/${modal.assignment.is_active ? "deactivate" : "activate"}/`);
            done(modal.assignment.is_active ? "Assignment deactivated" : "Assignment activated");
          }}
        />
      )}
    </>
  );
}
