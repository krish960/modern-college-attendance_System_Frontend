/*
 * Notifications page. Opened by every signed-in user (Admin, HOD and Teacher).
 * Lists the user's own notifications, for example new assignments, leave
 * decisions and correction results. Data: /api/notifications/.
 */

import { useState } from "react";
import api from "../api/client";
import { PagedTable } from "../components/DataTable";
import { PageHeader, SearchInput } from "../components/ui";
import { useAction } from "../hooks/useAction";
import { useDebounce, usePaginated } from "../hooks/useData";
import { fmtDateTime } from "../utils/format";

export default function NotificationsPage() {
  // Text typed in the search box.
  const [search, setSearch] = useState("");
  // Search text is delayed a little so the server is not called on every key press.
  const q = useDebounce(search);
  // The signed-in user's own notifications, newest first (GET /api/notifications/). Each user only gets their own.
  const list = usePaginated("/notifications/", { search: q });
  // run() wraps a request with a toast and sets busy while it runs.
  const { run, busy } = useAction();

  // Marks one notification as read (POST /api/notifications/{id}/read/). Does nothing if it is already read.
  const markRead = (n) => n.is_read || run(async () => { await api.post(`/notifications/${n.id}/read/`); list.reload(); });

  // Table columns. Unread items get a 'New' badge and a 'Mark as read' button.
  const columns = [
    {
      key: "title",
      header: "Notification",
      render: (n) => (
        <>
          <strong>{n.title}</strong> {!n.is_read && <span className="badge info">New</span>}
          <div className="muted">{n.message}</div>
        </>
      ),
    },
    { key: "created_at", header: "When", render: (n) => fmtDateTime(n.created_at) },
    { key: "actions", header: "", align: "right", render: (n) => !n.is_read && <button className="btn ghost sm" onClick={() => markRead(n)} disabled={busy}>Mark as read</button> },
  ];

  return (
    <>
      {/* Header with 'Mark all as read' (POST /api/notifications/read-all/). It is disabled when nothing is unread. */}
      <PageHeader
        title="Notifications"
        actions={
          <button className="btn secondary" disabled={busy || !list.rows.some((n) => !n.is_read)} onClick={() => run(async () => { await api.post("/notifications/read-all/"); list.reload(); }, "All marked as read")}>
            Mark all as read
          </button>
        }
      />
      {/* Table card with a search box. */}
      <div className="panel">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search notifications" />
        </div>
        <PagedTable query={list} columns={columns} emptyTitle="You're all caught up" emptyHint="New assignments and correction updates will show up here." />
      </div>
    </>
  );
}
