/*
 * Corrections page. Opened by the HOD and the Teacher.
 * Submitted attendance is locked. A teacher asks for a change with a request
 * (made from the lecture page). The HOD approves or rejects it here.
 * The teacher sees only their own requests. Data: /api/corrections/.
 */

import LongText from "../components/LongText";
import { useState } from "react";
import api from "../api/client";
import { PagedTable } from "../components/DataTable";
import { ConfirmDialog } from "../components/Modal";
import { FilterSelect, PageHeader, SearchInput, StatusBadge } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useDebounce, usePaginated } from "../hooks/useData";
import { fmtDate, fmtDateTime } from "../utils/format";

// Choices for the status filter.
const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

/** Teachers see the status of their own requests. The HOD reviews requests for the department. */
export default function CorrectionsPage() {
  const { user } = useAuth();
  const toast = useToast();
  // The HOD reviews requests. The Teacher only sees the status of their own.
  const isHod = user.role === "HOD";
  // Status filter. The HOD starts on Pending because those need a decision.
  const [status, setStatus] = useState(isHod ? "PENDING" : "");
  // Text typed in the search box.
  const [search, setSearch] = useState("");
  // Search text is delayed a little so the server is not called on every key press.
  const q = useDebounce(search);
  // Correction requests (GET /api/corrections/). The server returns only the teacher's own, or the HOD's department.
  const list = usePaginated("/corrections/", { status, search: q });
  // The request being approved or rejected: { type: 'approve' | 'reject', c } or null.
  const [modal, setModal] = useState(null);

  // Table columns. The HOD sees 'Requested by' and the action buttons. The Teacher sees the 'Sent' time instead.
  const columns = [
    { key: "lecture_date", header: "Lecture", render: (c) => <>{fmtDate(c.lecture_date)}<div className="muted small">{c.subject_name} · {c.classroom_name}</div></> },
    { key: "student", header: "Student", render: (c) => <><strong>{c.student_name}</strong><div className="muted small">Roll {c.roll_number}</div></> },
    // Shows the old mark and the requested mark.
    { key: "change", header: "Change", render: (c) => <><StatusBadge status={c.old_status} /> → <StatusBadge status={c.requested_status} /></> },
    { key: "reason", header: "Reason", render: (c) => <LongText text={c.reason} title="Reason for the correction" /> },
    ...(isHod ? [{ key: "requested_by_name", header: "Requested by", render: (c) => <>{c.requested_by_name}<div className="muted small">{fmtDateTime(c.created_at)}</div></> }] : [{ key: "created_at", header: "Sent", render: (c) => fmtDateTime(c.created_at) }]),
    {
      // Status, plus who reviewed it and the remarks once it is decided.
      key: "status",
      header: "Status",
      render: (c) => (
        <>
          <StatusBadge status={c.status} />
          {c.status !== "PENDING" && (
            <div className="muted small">
              {c.reviewed_by_name} · {fmtDateTime(c.reviewed_at)}
              {c.remarks && <div><LongText text={c.remarks} title="Remarks" quote /></div>}
            </div>
          )}
        </>
      ),
    },
    ...(isHod
      ? [
          {
            // Approve and Reject buttons, only for pending requests.
            key: "actions",
            header: "",
            align: "right",
            render: (c) =>
              c.status === "PENDING" && (
                <div className="actions">
                  <button className="btn sm" onClick={() => setModal({ type: "approve", c })}>Approve</button>
                  <button className="btn sm danger" onClick={() => setModal({ type: "reject", c })}>Reject</button>
                </div>
              ),
          },
        ]
      : []),
  ];

  // Approve or reject popup with a remarks box (POST /api/corrections/{id}/approve|reject/).
  // Business rule: when approved, the attendance mark changes and an audit log entry is written.
  const review = modal && (
    <ConfirmDialog
      title={`${modal.type === "approve" ? "Approve" : "Reject"} correction for ${modal.c.student_name}?`}
      message={
        modal.type === "approve"
          ? `The mark changes from ${modal.c.old_status.toLowerCase()} to ${modal.c.requested_status.toLowerCase()} and the change is written to the audit log.`
          : "The mark stays as it is. The teacher will see your remarks."
      }
      confirmLabel={modal.type === "approve" ? "Approve" : "Reject"}
      danger={modal.type === "reject"}
      remarksLabel="Remarks"
      onCancel={() => setModal(null)}
      onConfirm={async (remarks) => {
        await api.post(`/corrections/${modal.c.id}/${modal.type}/`, { remarks });
        setModal(null);
        toast.success(modal.type === "approve" ? "Correction approved" : "Correction rejected");
        list.reload();
      }}
    />
  );

  return (
    <>
      {/* Header. The text depends on the role. */}
      <PageHeader
        title={isHod ? "Correction requests" : "My correction requests"}
        subtitle={isHod ? "Teachers cannot change submitted attendance. Review their requests here." : "Ask your HOD to correct a submitted mark by opening the lecture and choosing Request correction."}
      />
      {/* Table card with search and status filter. */}
      <div className="panel">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Student, roll number or reason" />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Any status" />
        </div>
        <PagedTable
          query={list}
          columns={columns}
          emptyTitle={status === "PENDING" && isHod ? "No requests waiting" : "No correction requests"}
          emptyHint={isHod ? "Requests from your teachers appear here." : "You have not asked for any corrections."}
        />
      </div>
      {/* Review popup (only exists while a request is chosen). */}
      {review}
    </>
  );
}
