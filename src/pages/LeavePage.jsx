/*
 * Leave page. Opened by every role.
 * Teacher: sends leave requests and can cancel open ones.
 * HOD: approves or rejects the department's requests. Approved days become
 * 'On leave' in staff attendance.
 * Admin: reads and downloads all leave, but cannot decide.
 * Data: /api/leave-requests/.
 */

import LongText from "../components/LongText";
import { useState } from "react";
import api from "../api/client";
import { PagedTable } from "../components/DataTable";
import { FormModal } from "../components/FormModal";
import { ConfirmDialog } from "../components/Modal";
import { DownloadButtons } from "../components/DownloadButtons";
import { FilterSelect, PageHeader, SearchInput, StatusBadge } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useDebounce, usePaginated } from "../hooks/useData";
import { fmtDate, fmtDateTime, todayISO } from "../utils/format";

// Choices for the status filter. OPEN means pending plus in process, the ones still waiting for a decision.
const STATUS_OPTIONS = [
  { value: "OPEN", label: "Not decided yet (pending + in process)" },
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "In process" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

// Types of leave. 'value' is sent to the server. Exported so other pages (for example staff attendance) can reuse them.
export const LEAVE_TYPES = [
  { value: "CASUAL", label: "CL – Casual leave" },
  { value: "SICK", label: "ML – Medical leave" },
  { value: "EARNED", label: "Earned / privilege leave" },
  { value: "DUTY", label: "DL – Duty leave (exam, training, college work)" },
  { value: "STUDY", label: "Study / research leave" },
  { value: "MATERNITY", label: "Maternity / paternity leave" },
  { value: "UNPAID", label: "WPL – Leave without pay" },
  { value: "OTHER", label: "Other" },
];

/** Teachers ask for leave with a reason; the HOD approves or rejects. Approved days become "On leave" in staff attendance. */
export default function LeavePage() {
  const { user } = useAuth();
  const toast = useToast();
  // HOD decides on requests. Teacher makes requests. Admin only reads.
  const isHod = user.role === "HOD";
  const isAdmin = user.role === "ADMIN";
  const seesTeachers = user.role !== "STAFF"; // HOD and admin see whose leave it is
  // Leave type filter.
  const [leaveType, setLeaveType] = useState("");
  // Status filter. The HOD starts on 'not decided yet' so waiting requests show first.
  const [status, setStatus] = useState(isHod ? "OPEN" : "");
  // Text typed in the search box.
  const [search, setSearch] = useState("");
  // Search text is delayed a little so the server is not called on every key press.
  const q = useDebounce(search);
  // Leave requests (GET /api/leave-requests/). The server returns only the teacher's own, or the department's, or all for the Admin.
  const list = usePaginated("/leave-requests/", { status, search: q, leave_type: leaveType });
  // Open popup: { type: 'new' | 'processing' | 'pending' | 'approve' | 'reject' | 'cancel', r } or null.
  const [modal, setModal] = useState(null);

  // Table columns. Teacher name column is hidden for a Teacher because every row is their own.
  const columns = [
    ...(seesTeachers ? [{ key: "teacher_name", header: "Teacher", render: (r) => <><strong>{r.teacher_name}</strong><div className="muted small">{r.employee_id}{isAdmin && r.department_name ? ` · ${r.department_name}` : ""}</div></> }] : []),
    { key: "leave_type_label", header: "Type", render: (r) => <span className="badge info">{r.leave_type_label}</span> },
    {
      // Date range and the number of working days. Business rule: Sundays are not counted.
      key: "dates",
      header: "Leave",
      render: (r) => (
        <>
          <strong>{r.from_date === r.to_date ? fmtDate(r.from_date) : `${fmtDate(r.from_date)} to ${fmtDate(r.to_date)}`}</strong>
          <div className="muted small">{r.days} working day{r.days === 1 ? "" : "s"} (Sundays not counted)</div>
        </>
      ),
    },
    { key: "reason", header: "Reason", render: (r) => <LongText text={r.reason} title="Reason for leave" /> },
    { key: "created_at", header: "Sent", render: (r) => fmtDateTime(r.created_at) },
    {
      // Status, plus who decided and the remarks once the request is not pending.
      key: "status",
      header: "Status",
      render: (r) => (
        <>
          <StatusBadge status={r.status} />
          {(r.status === "APPROVED" || r.status === "REJECTED" || r.status === "PROCESSING" || r.remarks) && (
            <div className="muted small">
              {r.reviewed_at && <>{r.reviewed_by_name} · {fmtDateTime(r.reviewed_at)}</>}
              {r.remarks && <div><LongText text={r.remarks} title="Remarks" quote /></div>}
            </div>
          )}
        </>
      ),
    },
    {
      // HOD: In process, Approve, Reject. Teacher: Cancel own request. Admin: no buttons. Only open requests have buttons.
      key: "actions",
      header: "",
      align: "right",
      render: (r) =>
        (r.status === "PENDING" || r.status === "PROCESSING") && !isAdmin && (
          <div className="actions">
            {isHod ? (
              <>
                {r.status === "PENDING"
                  ? <button className="btn secondary sm" onClick={() => setModal({ type: "processing", r })}>In process</button>
                  : <button className="btn secondary sm" onClick={() => setModal({ type: "pending", r })}>Back to pending</button>}
                <button className="btn sm" onClick={() => setModal({ type: "approve", r })}>Approve</button>
                <button className="btn sm danger" onClick={() => setModal({ type: "reject", r })}>Reject</button>
              </>
            ) : (
              <button className="btn secondary sm" onClick={() => setModal({ type: "cancel", r })}>Cancel request</button>
            )}
          </div>
        ),
    },
  ];

  return (
    <>
      {/* Header with the download button (Excel) and, for a Teacher, the 'Request leave' button. */}
      <PageHeader
        title={seesTeachers ? "Leave requests" : "My leave"}
        subtitle={isAdmin ? "Every teacher's leave, with its type. Only the HOD of the department approves or rejects; you can read and download it." : isHod
          ? "A teacher asks for leave with a reason. When you approve, those days show as On leave in Staff attendance (Sundays are skipped; a day the teacher actually came is not changed)."
          : "Ask your HOD for leave with a reason. Once the HOD approves, the days are marked On leave automatically."}
        actions={(
          <>
            <DownloadButtons what="leave" params={{ status, leave_type: leaveType }} />
            {user.role === "STAFF" && <button className="btn" onClick={() => setModal({ type: "new" })}>Request leave</button>}
          </>
        )}
      />
      {/* Table card with search and filters. */}
      <div className="panel">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={seesTeachers ? "Teacher or reason" : "Reason"} />
          <FilterSelect label="Type of leave" value={leaveType} onChange={setLeaveType} options={LEAVE_TYPES} allLabel="Any type" />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Any status" />
        </div>
        <PagedTable
          query={list}
          columns={columns}
          emptyTitle={status === "OPEN" && isHod ? "No requests waiting" : "No leave requests"}
          emptyHint={isHod ? "Leave requests from your teachers appear here." : "Use Request leave when you need a day off."}
        />
      </div>

      {/* Teacher: new leave request (POST /api/leave-requests/). Medical leave (ML) is not offered to provisional staff. */}
      {modal?.type === "new" && (
        <FormModal
          title="Request leave"
          intro="Your HOD will approve or reject it and you will get a notification. For one day, choose the same date twice."
          fields={[
            { name: "leave_type", label: "Type of leave", type: "select", required: true, options: user.employment === "PROVISIONAL" ? LEAVE_TYPES.filter((t) => t.value !== "SICK") : LEAVE_TYPES, full: true, help: user.employment === "PROVISIONAL" ? "Medical leave (ML) is for permanent staff only." : undefined },
            { name: "from_date", label: "First day", type: "date", required: true },
            { name: "to_date", label: "Last day", type: "date", required: true },
            { name: "reason", label: "Reason", type: "textarea", required: true, full: true, help: "At least 5 characters." },
          ]}
          initial={{ leave_type: "CASUAL", from_date: todayISO(), to_date: todayISO() }}
          submitLabel="Send request"
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.post("/leave-requests/", v);
            setModal(null);
            toast.success("Leave request sent to your HOD");
            list.reload();
          }}
        />
      )}
      {/* HOD: mark a request as In process, or put it back to Pending, with an optional note. */}
      {(modal?.type === "processing" || modal?.type === "pending") && (
        <FormModal
          title={modal.type === "processing" ? `Mark ${modal.r.teacher_name}'s leave as In process` : `Put ${modal.r.teacher_name}'s leave back to Pending`}
          intro={modal.type === "processing" ? "The teacher is told you are looking into it (for example, finding a substitute). Nothing is marked in attendance yet. Approve or reject it when you decide." : "The request waits again for a decision."}
          fields={[{ name: "remarks", label: "Note for the teacher (optional)", type: "textarea", full: true }]}
          submitLabel={modal.type === "processing" ? "Mark In process" : "Back to pending"}
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.post(`/leave-requests/${modal.r.id}/${modal.type}/`, { remarks: v.remarks || "" });
            setModal(null);
            toast.success(modal.type === "processing" ? "Marked In process" : "Back to pending");
            list.reload();
          }}
        />
      )}
      {/* Confirm popup for approve, reject and cancel. Approving marks the working days as On leave in staff attendance. */}
      {modal && modal.type !== "new" && modal.type !== "processing" && modal.type !== "pending" && (
        <ConfirmDialog
          title={modal.type === "cancel" ? "Cancel this leave request?" : `${modal.type === "approve" ? "Approve" : "Reject"} leave for ${modal.r.teacher_name}?`}
          message={modal.type === "approve" ? `${modal.r.days} working day(s) will be marked On leave.` : modal.type === "reject" ? "No day is marked. The teacher sees your remarks." : "The request is withdrawn."}
          confirmLabel={modal.type === "cancel" ? "Cancel request" : modal.type === "approve" ? "Approve" : "Reject"}
          danger={modal.type !== "approve"}
          remarksLabel={modal.type === "cancel" ? undefined : "Remarks"}
          onCancel={() => setModal(null)}
          onConfirm={async (remarks) => {
            await api.post(`/leave-requests/${modal.r.id}/${modal.type}/`, modal.type === "cancel" ? {} : { remarks });
            setModal(null);
            toast.success(modal.type === "approve" ? "Leave approved" : modal.type === "reject" ? "Leave rejected" : "Request cancelled");
            list.reload();
          }}
        />
      )}
    </>
  );
}
