/*
  StudentRemovalsPage - requests to remove (deactivate) a student.
  Opened by: Staff (sees only their own requests) and HOD (sees the department's requests and decides).
  The student is never deleted: approving only makes the student inactive.
  API endpoints used: GET /student-removals/, POST /student-removals/:id/approve/ and /reject/.
  (Staff create requests from the Students page.)
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
import { fmtDateTime } from "../utils/format";

// Choices for the Status filter.
const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

/** Teachers see their own removal requests; the HOD approves (student becomes inactive) or rejects them. */
export default function StudentRemovalsPage() {
  // Logged-in user, toast helper, and a flag for the HOD role.
  const { user } = useAuth();
  const toast = useToast();
  const isHod = user.role === "HOD";
  // Filters: status (the HOD starts on Pending) and search text.
  const [status, setStatus] = useState(isHod ? "PENDING" : "");
  const [search, setSearch] = useState("");
  // Wait a moment after typing (debounce), then load the requests from the API.
  const q = useDebounce(search);
  const list = usePaginated("/student-removals/", { status, search: q });
  // Which confirm popup is open (approve or reject) and its request; null = none.
  const [modal, setModal] = useState(null);

  // Table column definitions.
  const columns = [
    // Student name with roll number and class
    { key: "student", header: "Student", render: (r) => <><strong>{r.student_name}</strong><div className="muted small">Roll {r.roll_number} · {r.classroom_name}</div></> },
    // Reason written by the teacher (long text is shortened by LongText)
    { key: "reason", header: "Reason", render: (r) => <LongText text={r.reason} title="Reason for removal" /> },
    // HOD sees who asked and when; staff only see when they sent it
    ...(isHod
      ? [{ key: "requested_by_name", header: "Requested by", render: (r) => <>{r.requested_by_name}<div className="muted small">{fmtDateTime(r.created_at)}</div></> }]
      : [{ key: "created_at", header: "Sent", render: (r) => fmtDateTime(r.created_at) }]),
    {
      // Status badge; once decided it also shows who decided, when, and the remarks
      key: "status",
      header: "Status",
      render: (r) => (
        <>
          <StatusBadge status={r.status} />
          {r.status !== "PENDING" && (
            <div className="muted small">
              {r.reviewed_by_name} · {fmtDateTime(r.reviewed_at)}
              {r.remarks && <div><LongText text={r.remarks} title="Remarks" quote /></div>}
            </div>
          )}
        </>
      ),
    },
    // Approve / Reject buttons: HOD only, and only for pending requests
    ...(isHod
      ? [{
          key: "actions", header: "", align: "right",
          render: (r) => r.status === "PENDING" && (
            <div className="actions">
              <button className="btn sm" onClick={() => setModal({ type: "approve", r })}>Approve</button>
              <button className="btn sm danger" onClick={() => setModal({ type: "reject", r })}>Reject</button>
            </div>
          ),
        }]
      : []),
  ];

  // Page layout
  return (
    <>
      <PageHeader
        title={isHod ? "Student removal requests" : "My removal requests"}
        subtitle={isHod
          ? "Teachers cannot delete students. When they ask to remove one, you decide here. Approving makes the student inactive; the attendance history is kept."
          : "To remove a student, open Students and choose Request removal. Your HOD decides."}
      />
      {/* Search, status filter and the requests table */}
      <div className="panel">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Student, roll number or reason" />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Any status" />
        </div>
        <PagedTable
          query={list}
          columns={columns}
          emptyTitle={status === "PENDING" && isHod ? "No requests waiting" : "No removal requests"}
          emptyHint={isHod ? "Requests from your teachers appear here." : "You have not asked to remove any student."}
        />
      </div>
      {/* Confirm popup for approve / reject; the remarks are sent to the server and the teacher can see them */}
      {modal && (
        <ConfirmDialog
          title={`${modal.type === "approve" ? "Approve" : "Reject"} removal of ${modal.r.student_name}?`}
          message={modal.type === "approve"
            ? "The student becomes inactive and no longer appears on new attendance sheets. Past attendance stays in the reports. You can reactivate the student later from Students."
            : "The student stays on the register. The teacher will see your remarks."}
          confirmLabel={modal.type === "approve" ? "Approve" : "Reject"}
          danger={modal.type === "reject"}
          remarksLabel="Remarks"
          onCancel={() => setModal(null)}
          onConfirm={async (remarks) => {
            await api.post(`/student-removals/${modal.r.id}/${modal.type}/`, { remarks });
            setModal(null);
            toast.success(modal.type === "approve" ? "Student made inactive" : "Request rejected");
            list.reload();
          }}
        />
      )}
    </>
  );
}
