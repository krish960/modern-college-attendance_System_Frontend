/*
 * Timetable page. Opened by the HOD only.
 * Manages the weekly schedule (slots) from /api/timetable/. Each slot links to a
 * teacher assignment, a weekday and a start and end time. The HOD can also
 * generate lectures from the slots for a date range.
 */

import { useState } from "react";
import api from "../../api/client";
import { PagedTable } from "../../components/DataTable";
import { FormModal } from "../../components/FormModal";
import { ConfirmDialog } from "../../components/Modal";
import { ActiveBadge, FilterSelect, PageHeader, SearchInput } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { useDebounce, useOptions, usePaginated } from "../../hooks/useData";
import { fmtTime, todayISO, WEEKDAYS } from "../../utils/format";

// Weekday choices for the filter and the form.
const WEEKDAY_OPTIONS = WEEKDAYS.map((d) => ({ value: d.value, label: d.label }));

export default function TimetablePage() {
  const toast = useToast();
  // Filters: weekday number and assignment id ('' = all).
  const [weekday, setWeekday] = useState("");
  const [assignment, setAssignment] = useState("");
  const [search, setSearch] = useState("");
  // Wait a moment after typing before calling the server, to avoid too many requests.
  const q = useDebounce(search);
  // Paged list from /api/timetable/ with 50 rows per page, so a whole week fits.
  const list = usePaginated("/timetable/", { search: q, weekday, assignment }, 50);
  // Choices for the 'Subject, class and teacher' select. Only active assignments are listed.
  const assignments = useOptions(
    "/assignments/",
    (a) => ({ value: a.id, label: `${a.subject_name} · ${a.classroom_name} · ${a.teacher_name}` }),
    { is_active: "true" }
  );
  // Which popup is open. null means none. 'type' says which one and the other key holds the row being worked on.
  const [modal, setModal] = useState(null);

  // Run after any successful save: close the popup, show a message, reload the table.
  const done = (message) => {
    setModal(null);
    toast.success(message);
    list.reload();
  };

  // Form fields for a slot. 'Active' is hidden when creating (see the create popup).
  const slotFields = [
    { name: "assignment", label: "Subject, class and teacher", type: "select", required: true, options: assignments.options, full: true },
    { name: "weekday", label: "Day", type: "select", required: true, options: WEEKDAY_OPTIONS },
    { name: "is_active", label: "Active", type: "checkbox" },
    { name: "start_time", label: "Starts", type: "time", required: true },
    { name: "end_time", label: "Ends", type: "time", required: true },
  ];

  // Table columns. Times are shown as hours and minutes.
  const columns = [
    { key: "weekday_name", header: "Day", render: (s) => <strong>{s.weekday_name}</strong> },
    { key: "time", header: "Time", className: "num nowrap", render: (s) => `${fmtTime(s.start_time)} – ${fmtTime(s.end_time)}` },
    { key: "subject_name", header: "Subject" },
    { key: "classroom_name", header: "Class" },
    { key: "teacher_name", header: "Teacher" },
    { key: "is_active", header: "Status", render: (s) => <ActiveBadge active={s.is_active} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (s) => (
        <div className="actions">
          <button className="btn ghost sm" onClick={() => setModal({ type: "edit", slot: s })}>Edit</button>
          <button className="btn ghost sm" onClick={() => setModal({ type: "delete", slot: s })}>Remove</button>
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Page title. Business rule: a lecture exists only if it was generated from a slot, so a day with no lecture is never shown as pending. */}
      <PageHeader
        title="Timetable"
        subtitle="The weekly schedule. Pending attendance in reports is based on lectures generated from these slots, so a day with no lecture is never shown as pending."
        actions={
          <>
            <button className="btn secondary" onClick={() => setModal({ type: "generate" })}>Generate lectures</button>
            <button className="btn" onClick={() => setModal({ type: "create" })}>New slot</button>
          </>
        }
      />
      <div className="panel">
        {/* Toolbar: search box and filters */}
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Subject, class or teacher" />
          <FilterSelect label="Day" value={weekday} onChange={setWeekday} options={WEEKDAY_OPTIONS} allLabel="Every day" />
          <FilterSelect label="Assignment" value={assignment} onChange={setAssignment} options={assignments.options} allLabel="All assignments" />
        </div>
        {/* Table with paging. Shows the empty message when nothing matches. */}
        <PagedTable
          query={list}
          columns={columns}
          emptyTitle="No timetable slots yet"
          emptyHint="Add the weekly slots for each teacher assignment, then generate lectures for the dates you need."
          emptyAction={<button className="btn" onClick={() => setModal({ type: "create" })}>New slot</button>}
        />
      </div>

      {/* Popup: add a slot (POST /api/timetable/). Ids and weekday are sent as numbers. */}
      {modal?.type === "create" && (
        <FormModal
          title="New timetable slot"
          fields={slotFields.filter((f) => f.name !== "is_active")}
          submitLabel="Add slot"
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.post("/timetable/", { ...v, assignment: Number(v.assignment), weekday: Number(v.weekday) });
            done("Slot added");
          }}
        />
      )}
      {/* Popup: edit a slot (PATCH /api/timetable/{id}/). Times are cut to HH:MM for the time inputs. */}
      {modal?.type === "edit" && (
        <FormModal
          title="Edit timetable slot"
          fields={slotFields}
          initial={{ ...modal.slot, start_time: fmtTime(modal.slot.start_time), end_time: fmtTime(modal.slot.end_time) }}
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.patch(`/timetable/${modal.slot.id}/`, { ...v, assignment: Number(v.assignment), weekday: Number(v.weekday) });
            done("Slot saved");
          }}
        />
      )}
      {/* Confirm popup: remove a slot. Lectures already generated stay. */}
      {modal?.type === "delete" && (
        <ConfirmDialog
          title="Remove this slot?"
          message={`${modal.slot.weekday_name} ${fmtTime(modal.slot.start_time)}, ${modal.slot.subject_name} for ${modal.slot.classroom_name}. Lectures already generated are kept.`}
          confirmLabel="Remove slot"
          danger
          onCancel={() => setModal(null)}
          onConfirm={async () => {
            await api.delete(`/timetable/${modal.slot.id}/`);
            done("Slot removed");
          }}
        />
      )}
      {/* Popup: create draft lectures for every active slot in a date range (POST /api/timetable/generate/). Running it again does not duplicate lectures. */}
      {modal?.type === "generate" && (
        <FormModal
          title="Generate lectures from the timetable"
          intro="Creates a draft lecture for every active slot in the date range. Safe to run again: existing lectures are not duplicated. Drafts that teachers have not submitted show as Pending."
          fields={[
            { name: "date_from", label: "From", type: "date", required: true },
            { name: "date_to", label: "To", type: "date", required: true },
          ]}
          initial={{ date_from: todayISO(), date_to: todayISO() }}
          submitLabel="Generate"
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            const { data } = await api.post("/timetable/generate/", v);
            done(data.created ? `${data.created} lecture(s) created` : "No new lectures: they already exist or no slots match");
          }}
        />
      )}
    </>
  );
}
