/*
  StudentsPage - the list of students.
  Opened by: HOD, Staff and Admin (menu: Students).
  What it does: search and filter students, register / import / edit / deactivate them,
  register ID cards, promote a class, and send a removal request to the HOD (staff only).
  API endpoints used: GET/POST /students/, PATCH /students/:id/, POST/DELETE /students/:id/photo/,
  GET /classes/, GET /staff/ (HOD only), POST /student-removals/.
  Some endpoints are also called inside the modals (import, ID cards, promote class).
*/
import { useState } from "react";
import api from "../api/client";
import { PagedTable } from "../components/DataTable";
import { FormModal } from "../components/FormModal";
import { ImportStudentsModal } from "../components/ImportStudentsModal";
import StudentPhoto from "../components/StudentPhoto";
import { DownloadButtons } from "../components/DownloadButtons";
import { PromoteClassModal } from "../components/PromoteClassModal";
import { RegisterCardsModal } from "../components/RegisterCardsModal";
import { ConfirmDialog, Modal } from "../components/Modal";
import { ACTIVE_OPTIONS, ActiveBadge, FilterSelect, PageHeader, SearchInput } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useDebounce, useOptions, usePaginated } from "../hooks/useData";
import { fmtDate } from "../utils/format";

// Helper: send a photo file to the server for one student (multipart form upload).
const uploadPhoto = (id, blob) => {
  const form = new FormData();
  form.append("photo", blob, "photo.jpg");
  return api.post(`/students/${id}/photo/`, form);
};

export default function StudentsPage() {
  // Who is logged in, and the toast (small message) helper.
  const { user } = useAuth();
  const toast = useToast();
  // Permission flags built from the user's role; they decide which buttons are shown.
  const canWrite = user.role === "HOD" || user.role === "STAFF";
  const isHod = user.role === "HOD";
  const isAdmin = user.role === "ADMIN";
  const canEdit = canWrite || isAdmin; // the college admin can correct and deactivate students, but registers them through the HOD
  const mayMove = isHod || isAdmin; // HOD or admin: change class, active or not

  // Filter values typed or chosen by the user. Staff only see active students by default.
  const [search, setSearch] = useState("");
  const [classroom, setClassroom] = useState("");
  const [active, setActive] = useState(canWrite ? "true" : "");
  const [createdBy, setCreatedBy] = useState("");
  // Wait a moment after typing before searching (debounce), then load the students page from the API with the filters.
  const q = useDebounce(search);
  const list = usePaginated("/students/", { search: q, classroom, is_active: active, created_by: createdBy });
  // Dropdown options: active classes, and (HOD only) the staff list for the 'Registered by' filter.
  const classes = useOptions("/classes/", (c) => ({ value: c.id, label: c.label }), { is_active: "true" });
  const staff = useOptions("/staff/", (u) => ({ value: u.id, label: u.full_name }), undefined, isHod);
  // Which popup is open (null = none). It holds the type and the selected student.
  const [modal, setModal] = useState(null);

  // Called after a popup action succeeds: close the popup, show a message and reload the list.
  const done = (message) => {
    setModal(null);
    toast.success(message);
    list.reload();
  };

  // Table column definitions. Each column has a key, a header and an optional render function.
  const columns = [
    // Roll number column
    { key: "roll_number", header: "Roll no.", className: "num", render: (s) => <strong>{s.roll_number}</strong> },
    // Student column: photo and name
    { key: "name", header: "Student", render: (s) => <span className="with-avatar"><StudentPhoto student={s} size={30} /> {s.name}</span> },
    // Class column
    { key: "classroom_name", header: "Class" },
    // ID card column: shows Linked if a card code is saved
    { key: "card_code", header: "ID card", render: (s) => (s.card_code ? <span className="badge ok">Linked</span> : <span className="muted">Not registered</span>) },
    // 'Registered by' column is hidden from staff
    ...(user.role !== "STAFF" ? [{ key: "created_by_name", header: "Registered by", render: (s) => s.created_by_name || <span className="muted">–</span> }] : []),
    // Registered date column (only the date part is shown)
    { key: "created_at", header: "Registered", render: (s) => fmtDate(s.created_at?.slice(0, 10)) },
    // Status column: Active or Inactive badge
    { key: "is_active", header: "Status", render: (s) => <ActiveBadge active={s.is_active} /> },
    // Actions column: Edit for everyone who can edit; HOD/Admin can Deactivate, staff can only request removal
    ...(canEdit
      ? [{ key: "actions", header: "", align: "right", render: (s) => (
        <>
          <button className="btn ghost sm" onClick={() => setModal({ type: "edit", student: s })}>Edit</button>
          {s.is_active && (mayMove
            ? <button className="btn ghost sm" onClick={() => setModal({ type: "deactivate", student: s })}>Deactivate</button>
            : <button className="btn ghost sm" onClick={() => setModal({ type: "removal", student: s })}>Request removal</button>)}
        </>
      ) }]
      : []),
  ];

  // Page layout: header with buttons, popups, then the filter toolbar and the table.
  return (
    <>
      <PageHeader
        title="Students"
        subtitle={
          user.role === "STAFF"
            ? "Students of the classes you teach. Roll numbers are unique within a class."
            : isHod
              ? "All students in your department, including those registered by your staff."
              : "Students across all departments. You can correct a student with Edit; students are registered by the HOD or teachers."
        }
        actions={(
          <>
            <DownloadButtons what="students" params={{ classroom, status: active === "true" ? "active" : active === "false" ? "inactive" : "" }} />
            {canWrite && <>
            <button className="btn secondary" onClick={() => setModal({ type: "cards" })}>Register ID cards</button>
            <button className="btn secondary" onClick={() => setModal({ type: "promote" })}>Promote class</button>
            <button className="btn secondary" onClick={() => setModal({ type: "import" })}>Import CSV</button>
            <button className="btn" onClick={() => setModal({ type: "create" })}>Register student</button>
            </>}
          </>
        )}
      />
      {/* Popup: register ID cards for a class */}
      {modal?.type === "cards" && (
        <RegisterCardsModal classes={classes.options} initialClass={classroom} onClose={() => setModal(null)} onChanged={list.reload} />
      )}
      {/* Popup: promote a class to the next class */}
      {modal?.type === "promote" && (
        <PromoteClassModal
          classRows={classes.rows}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); list.reload(); }}
        />
      )}
      {/* Popup: import students from a CSV file */}
      {modal?.type === "import" && (
        <ImportStudentsModal
          classes={classes.options}
          onClose={() => setModal(null)}
          onImported={(r) => done(`${r.created} student${r.created === 1 ? "" : "s"} imported${r.skipped.length ? `, ${r.skipped.length} skipped` : ""}${r.cards_linked ? `, ${r.cards_linked} ID card${r.cards_linked === 1 ? "" : "s"} linked` : ""}.`)}
        />
      )}
      {/* Filters and the student table */}
      <div className="panel">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Roll number or name" />
          <FilterSelect label="Class" value={classroom} onChange={setClassroom} options={classes.options} allLabel="All classes" />
          {isHod && <FilterSelect label="Registered by" value={createdBy} onChange={setCreatedBy} options={staff.options} allLabel="Anyone" />}
          <FilterSelect label="Status" value={active} onChange={setActive} options={ACTIVE_OPTIONS} allLabel="Any status" />
        </div>
        <PagedTable
          query={list}
          columns={columns}
          emptyTitle="No students found"
          emptyHint={canWrite ? "Register students into a class to start taking attendance." : "Nothing matches these filters."}
          emptyAction={canWrite && <button className="btn" onClick={() => setModal({ type: "create" })}>Register student</button>}
        />
      </div>

      {/* Popup: register a new student. If the roll number exists (HTTP 409) the 'exists' popup opens instead, and the photo is uploaded after the student is created. */}
      {modal?.type === "create" && (
        <FormModal
          title="Register student"
          intro="If the roll number already exists in the class, the existing student is shown instead of creating a duplicate."
          fields={[
            { name: "roll_number", label: "Roll number", required: true },
            { name: "name", label: "Student name", required: true },
            { name: "classroom", label: "Class", type: "select", required: true, options: classes.options },
            { name: "photo", label: "Photo (optional)", type: "photo", full: true },
            { name: "card_code", label: "College ID card (optional)", type: "card", full: true, help: "Show the student's ID card to the camera now, or leave empty and use Register ID cards later." },
          ]}
          submitLabel="Register"
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            try {
              const { photo, ...body } = v;
              const { data: created } = await api.post("/students/", { ...body, classroom: Number(v.classroom) });
              if (photo instanceof Blob) {
                try {
                  await uploadPhoto(created.id, photo);
                } catch {
                  toast.error("The student was registered, but the photo could not be saved. Add it with Edit.");
                }
              }
              done("Student registered");
            } catch (e) {
              if (e.response?.status === 409) {
                setModal({ type: "exists", student: e.response.data.existing_student, message: e.response.data.detail });
                return;
              }
              throw e;
            }
          }}
        />
      )}
      {/* Popup: edit a student. Only HOD/Admin can change class and active status. */}
      {modal?.type === "edit" && (
        <FormModal
          title={`Edit ${modal.student.name}`}
          fields={[
            { name: "roll_number", label: "Roll number", required: true },
            { name: "name", label: "Student name", required: true },
            { name: "photo", label: "Photo", type: "photo", full: true, student: modal.student },
            { name: "card_code", label: "College ID card", type: "card", full: true, help: "Empty = no card registered. Clear it to unlink the card." },
            mayMove
              ? { name: "classroom", label: "Class", type: "select", required: true, options: classes.rows.filter((c) => !isAdmin || c.department === modal.student.department).map((c) => ({ value: c.id, label: c.label })), full: true, help: "Moving a student keeps past attendance with the old class's lectures. The roll number must be free in the new class." }
              : { name: "classroom_name", label: "Class", readOnly: true, help: "Only your HOD can move a student to another class.", full: true },
            ...(mayMove ? [{ name: "is_active", label: "Active", type: "checkbox", help: "Inactive students no longer appear on new attendance sheets." }] : []),
          ]}
          initial={modal.student}
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            const body = { roll_number: v.roll_number, name: v.name, card_code: v.card_code || "" };
            if (mayMove) { body.is_active = v.is_active; body.classroom = Number(v.classroom); }
            await api.patch(`/students/${modal.student.id}/`, body);
            if (v.photo instanceof Blob) await uploadPhoto(modal.student.id, v.photo);
            else if (v.photo?.remove) await api.delete(`/students/${modal.student.id}/photo/`);
            done("Student saved");
          }}
        />
      )}
      {/* Popup: confirm making a student inactive (the student is never deleted) */}
      {modal?.type === "deactivate" && (
        <ConfirmDialog
          title={`Deactivate ${modal.student.name}?`}
          message="The student no longer appears on new attendance sheets. Past attendance stays in the reports, and you can reactivate the student later with Edit."
          confirmLabel="Deactivate"
          danger
          onCancel={() => setModal(null)}
          onConfirm={async () => {
            await api.patch(`/students/${modal.student.id}/`, { is_active: false });
            done("Student made inactive");
          }}
        />
      )}
      {/* Popup: staff ask the HOD to remove a student */}
      {modal?.type === "removal" && (
        <FormModal
          title={`Request removal: ${modal.student.name}`}
          intro="Students are never deleted, because their attendance history must stay correct. Your HOD reviews this request; if approved, the student becomes inactive."
          fields={[{ name: "reason", label: "Reason", type: "textarea", required: true, help: "For example: registered by mistake, left the course (at least 5 characters)." }]}
          submitLabel="Send to HOD"
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.post("/student-removals/", { student: modal.student.id, reason: v.reason });
            setModal(null);
            toast.success("Request sent to your HOD");
          }}
        />
      )}
      {/* Popup: tells the user this student is already registered, with a button to show them in the list */}
      {modal?.type === "exists" && (
        <Modal
          title="Student already registered"
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setModal(null)}>Close</button>
              <button className="btn" onClick={() => { setSearch(modal.student.roll_number); setClassroom(String(modal.student.classroom)); setModal(null); }}>
                Show in list
              </button>
            </>
          }
        >
          <div className="modal-body">
            <div className="note warn">{modal.message}</div>
            <dl className="stack" style={{ margin: 0 }}>
              <div><dt className="muted small">Roll number</dt><dd style={{ margin: 0 }}>{modal.student.roll_number}</dd></div>
              <div><dt className="muted small">Name</dt><dd style={{ margin: 0 }}>{modal.student.name}</dd></div>
              <div><dt className="muted small">Class</dt><dd style={{ margin: 0 }}>{modal.student.classroom_name}</dd></div>
              <div><dt className="muted small">Registered by</dt><dd style={{ margin: 0 }}>{modal.student.created_by_name || "–"}</dd></div>
            </dl>
          </div>
        </Modal>
      )}
    </>
  );
}
