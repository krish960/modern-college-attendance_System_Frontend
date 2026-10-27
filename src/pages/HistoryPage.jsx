/*
 * Lecture history page. Opened by the Admin, the HOD and the Teacher.
 * Shows every lecture with its present and absent counts.
 * Data: GET /api/lectures/. The server limits the list: a Teacher sees only their own
 * lectures and an HOD sees only their own department.
 * Clicking a row opens the lecture (LecturePage).
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PagedTable } from "../components/DataTable";
import { FilterSelect, PageHeader, Pct, SearchInput, StatusBadge } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useDebounce, useOptions, usePaginated } from "../hooks/useData";
import { fmtDate, fmtTime } from "../utils/format";

// Choices for the Status filter. DRAFT means attendance not yet submitted.
const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft / pending" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "CANCELLED", label: "Cancelled" },
];

/** Lecture history with attendance counts: everyone sees only what the backend scopes to them. */
export default function HistoryPage() {
  // The signed-in user. The Teacher filter and column are hidden from Teachers.
  const { user } = useAuth();
  const navigate = useNavigate();
  // Filter values. Empty text means "no filter".
  const [f, setF] = useState({ date_from: "", date_to: "", subject: "", classroom: "", teacher: "", status: "" });
  // Returns a handler that updates one filter value.
  const set = (key) => (value) => setF((old) => ({ ...old, [key]: value }));
  // Search text. The delayed copy (q) is what is sent to the server.
  const [search, setSearch] = useState("");
  const q = useDebounce(search);
  // Loads one page of lectures. Filters are sent as query parameters.
  const list = usePaginated("/lectures/", { ...f, search: q });
  // Dropdown choices for the filters.
  const subjects = useOptions("/subjects/", (s) => ({ value: s.id, label: s.name }), undefined);
  const classes = useOptions("/classes/", (c) => ({ value: c.id, label: c.label }), undefined);
  // Teachers cannot choose other teachers, so the staff list is not loaded for them (last argument).
  const staff = useOptions("/staff/", (u) => ({ value: u.id, label: u.full_name }), undefined, user.role !== "STAFF");

  // Table columns. Present and absent counts only count once the lecture is submitted.
  const columns = [
    { key: "lecture_date", header: "Date", className: "nowrap", render: (l) => fmtDate(l.lecture_date) },
    { key: "time", header: "Time", className: "num nowrap", render: (l) => `${fmtTime(l.start_time)}–${fmtTime(l.end_time)}` },
    { key: "subject_name", header: "Subject", render: (l) => <strong>{l.subject_name}</strong> },
    { key: "classroom_name", header: "Class", className: "nowrap" },
    // Teachers already know the lecture is theirs, so the Teacher column is for Admin and HOD only.
    ...(user.role !== "STAFF" ? [{ key: "teacher_name", header: "Teacher" }] : []),
    { key: "present_count", header: "Present", align: "right", className: "num", render: (l) => (l.status === "SUBMITTED" ? l.present_count : "–") },
    { key: "absent_count", header: "Absent", align: "right", className: "num", render: (l) => (l.status === "SUBMITTED" ? l.absent_count : "–") },
    // Percentage = present / marked, rounded to one decimal place. Blank until submitted.
    {
      key: "pct",
      header: "Attendance",
      render: (l) => <Pct value={l.status === "SUBMITTED" && l.marked_count ? Math.round((l.present_count * 1000) / l.marked_count) / 10 : null} />,
    },
    { key: "status", header: "Status", render: (l) => <StatusBadge status={l.status} /> },
  ];

  return (
    <>
      {/* Page title. */}
      <PageHeader title="Lecture history" subtitle="Every lecture and its attendance. Open one to see each student's mark." />
      {/* Table card: filters first, then the table. */}
      <div className="panel">
        {/* Toolbar with search, date range and filters. */}
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={user.role === "STAFF" ? "Subject or class" : "Subject, class or teacher"} />
          <div className="field">
            <label htmlFor="h-from">From</label>
            <input id="h-from" type="date" value={f.date_from} onChange={(e) => set("date_from")(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="h-to">To</label>
            <input id="h-to" type="date" value={f.date_to} onChange={(e) => set("date_to")(e.target.value)} />
          </div>
          <FilterSelect label="Subject" value={f.subject} onChange={set("subject")} options={subjects.options} allLabel="All subjects" />
          <FilterSelect label="Class" value={f.classroom} onChange={set("classroom")} options={classes.options} allLabel="All classes" />
          {user.role !== "STAFF" && <FilterSelect label="Teacher" value={f.teacher} onChange={set("teacher")} options={staff.options} allLabel="All teachers" />}
          <FilterSelect label="Status" value={f.status} onChange={set("status")} options={STATUS_OPTIONS} allLabel="Any status" />
        </div>
        {/* Paged lecture table. Clicking a row opens the lecture. */}
        <PagedTable
          query={list}
          columns={columns}
          onRowClick={(l) => navigate(`/lectures/${l.id}`)}
          emptyTitle="No lectures found"
          emptyHint="Try a wider date range or clear the filters."
        />
      </div>
    </>
  );
}
