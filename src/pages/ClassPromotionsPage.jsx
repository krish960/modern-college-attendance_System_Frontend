/**
 * Class promotions: moving a whole class to the next year (for example MSc I to MSc II).
 * The order is always: teacher or HOD asks, the HOD approves, then the admin approves. Only the admin's approval moves the students.
 * Teachers see their own requests, the HOD sees his department, the admin sees every department.
 * Data: /api/class-promotions/ (list), and approve / reject / cancel actions on one request.
 */
import { useState } from "react";
import api from "../api/client";
import { PagedTable } from "../components/DataTable";
import { ConfirmDialog } from "../components/Modal";
import { FilterSelect, PageHeader, StatusBadge } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { usePaginated } from "../hooks/useData";
import { fmtDateTime } from "../utils/format";

const STATUS_OPTIONS = [
  { value: "WAITING_HOD", label: "Waiting for HOD" },
  { value: "WAITING_ADMIN", label: "Waiting for admin" },
  { value: "DONE", label: "Promoted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function ClassPromotionsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user.role === "ADMIN";
  const isHod = user.role === "HOD";
  // Each person starts on the requests that wait for HIM.
  const [status, setStatus] = useState(isAdmin ? "WAITING_ADMIN" : isHod ? "WAITING_HOD" : "");
  const list = usePaginated("/class-promotions/", { status });
  const [modal, setModal] = useState(null); // { type: "approve" | "reject" | "cancel", r }

  // Is it this person's turn on this request? (HOD first, then admin.)
  const myTurn = (r) => (isAdmin && r.status === "WAITING_ADMIN") || (isHod && r.status === "WAITING_HOD");
  const canCancel = (r) => r.requested_by === user.id && (r.status === "WAITING_HOD" || r.status === "WAITING_ADMIN");

  const columns = [
    { key: "classes", header: "Class", render: (r) => <><strong>{r.from_name}</strong><div className="muted small">moves to {r.to_name}</div></> },
    ...(isAdmin ? [{ key: "department_name", header: "Department" }] : []),
    { key: "students", header: "Students", className: "num", render: (r) => <>{r.student_count}{r.leave_behind.length ? <div className="muted small">{r.leave_behind.length} stay behind</div> : null}</> },
    { key: "requested_by_name", header: "Asked by", render: (r) => <>{r.requested_by_name}<div className="muted small">{fmtDateTime(r.created_at)}</div></> },
    {
      key: "status",
      header: "Progress",
      render: (r) => (
        <>
          <StatusBadge status={r.status} />
          {/* who decided each step, with the remarks they wrote */}
          {r.hod_name && <div className="muted small">HOD {r.hod_name}{r.hod_remarks ? `: “${r.hod_remarks}”` : ""}</div>}
          {r.admin_name && <div className="muted small">Admin {r.admin_name}{r.admin_remarks ? `: “${r.admin_remarks}”` : ""}</div>}
          {r.status === "DONE" && r.clash_count > 0 && <div className="muted small">{r.clash_count} not moved: roll number already used in the new class</div>}
        </>
      ),
    },
    {
      key: "actions", header: "", align: "right",
      render: (r) => (
        <div className="actions">
          {myTurn(r) && <button className="btn sm" onClick={() => setModal({ type: "approve", r })}>Approve</button>}
          {myTurn(r) && <button className="btn sm danger" onClick={() => setModal({ type: "reject", r })}>Reject</button>}
          {canCancel(r) && <button className="btn ghost sm" onClick={() => setModal({ type: "cancel", r })}>Cancel request</button>}
        </div>
      ),
    },
  ];

  const text = {
    approve: isAdmin
      ? "The students are moved to the new class right now. Roll numbers and ID cards stay the same, and past attendance stays with the old class."
      : "The request goes to the college admin. The students move only after the admin approves.",
    reject: "Nobody is moved. The person who asked will see your remarks.",
    cancel: "The request is withdrawn and nobody is moved.",
  };

  return (
    <>
      <PageHeader
        title={user.role === "STAFF" ? "My promotion requests" : "Class promotions"}
        subtitle={isAdmin
          ? "Requests the HOD has already approved. Your approval moves the students."
          : isHod
            ? "Teachers' requests wait for you first, then the admin. To promote a class yourself, open Students and choose Promote class."
            : "To move a class you teach to the next year, open Students and choose Promote class. The HOD and then the admin approve."}
      />
      <div className="panel">
        <div className="toolbar">
          <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Any status" />
        </div>
        <PagedTable
          query={list}
          columns={columns}
          emptyTitle="No promotion requests"
          emptyHint="Nothing matches this filter."
        />
      </div>
      {modal && (
        <ConfirmDialog
          title={`${modal.type === "approve" ? "Approve" : modal.type === "reject" ? "Reject" : "Cancel"} moving ${modal.r.from_name}?`}
          message={text[modal.type]}
          confirmLabel={modal.type === "approve" ? "Approve" : modal.type === "reject" ? "Reject" : "Cancel request"}
          danger={modal.type !== "approve"}
          remarksLabel={modal.type === "cancel" ? undefined : "Remarks"}
          onCancel={() => setModal(null)}
          onConfirm={async (remarks) => {
            await api.post(`/class-promotions/${modal.r.id}/${modal.type}/`, modal.type === "cancel" ? {} : { remarks });
            setModal(null);
            toast.success(modal.type === "approve" ? (isAdmin ? "Class promoted" : "Sent to the admin") : modal.type === "reject" ? "Request rejected" : "Request cancelled");
            list.reload();
          }}
        />
      )}
    </>
  );
}
