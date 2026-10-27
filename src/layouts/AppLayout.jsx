/*
  AppLayout - the frame around every logged-in page.
  Used by: all roles (Admin, HOD, Staff). The page itself is drawn inside <Outlet />.
  Contains: sidebar menu (different for each role), top bar with notification bell and user name, and the sign out confirmation.
  API endpoint used: GET /notifications/unread-count/ (checked every 60 seconds).
*/
import { COLLEGE_ADDRESS, COLLEGE_NAME } from "../config";
import { useEffect, useState } from "react";
import ErrorBoundary from "../components/ErrorBoundary";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ConfirmDialog } from "../components/Modal";
import { ROLE_HOME, ROLE_LABEL } from "../utils/format";

// Sidebar menu for each role. An item with 'to' is a link; an item with 'group' is a heading.
const NAV = {
  ADMIN: [
    { to: "/admin", label: "Dashboard", end: true },
    { group: "College" },
    { to: "/admin/departments", label: "Departments" },
    { to: "/admin/hods", label: "Heads of department" },
    { to: "/staff-members", label: "Staff" },
    { to: "/staff-attendance", label: "Staff attendance" },
    { to: "/leave", label: "Leave requests" },
    { to: "/students", label: "Students" },
    { to: "/removals", label: "Removal requests" },
    { to: "/promotions", label: "Class promotions" },
    { group: "Attendance" },
    { to: "/reports", label: "Daily report" },
    { to: "/student-records", label: "Student records" },
    { to: "/history", label: "Lecture history" },
    { to: "/summary", label: "Student summary" },
    { to: "/monthly", label: "Monthly sheet" },
    { group: "System" },
    { to: "/audit-logs", label: "Audit log" },
  ],
  HOD: [
    { to: "/hod", label: "Dashboard", end: true },
    { group: "Department setup" },
    { to: "/staff-members", label: "Staff" },
    { to: "/staff-attendance", label: "Staff attendance" },
    { to: "/leave", label: "Leave requests" },
    { to: "/hod/subjects", label: "Subjects" },
    { to: "/hod/classes", label: "Classes" },
    { to: "/hod/assignments", label: "Teacher assignments" },
    { to: "/hod/timetable", label: "Timetable" },
    { to: "/students", label: "Students" },
    { to: "/promotions", label: "Class promotions" },
    { group: "Attendance" },
    { to: "/reports", label: "Daily report" },
    { to: "/student-records", label: "Student records" },
    { to: "/history", label: "Lecture history" },
    { to: "/summary", label: "Student summary" },
    { to: "/monthly", label: "Monthly sheet" },
    { to: "/corrections", label: "Correction requests" },
    { group: "System" },
    { to: "/audit-logs", label: "Audit log" },
  ],
  STAFF: [
    { to: "/staff", label: "Dashboard", end: true },
    { group: "Attendance" },
    { to: "/attendance", label: "Take attendance" },
    { to: "/my-attendance", label: "My attendance" },
    { to: "/notes", label: "Notes for students" },
    { to: "/leave", label: "My leave" },
    { to: "/history", label: "Lecture history" },
    { to: "/summary", label: "Student summary" },
    { to: "/monthly", label: "Monthly sheet" },
    { to: "/corrections", label: "My correction requests" },
    { group: "Students" },
    { to: "/students", label: "Students" },
    { to: "/subject-students", label: "Who takes a subject" },
    { to: "/removals", label: "My removal requests" },
    { to: "/promotions", label: "My promotion requests" },
  ],
};

// The layout component.
export default function AppLayout() {
  // Logged-in user, navigation helpers, and state: menu open on mobile, unread notification count, sign out popup.
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Close the mobile menu whenever the page changes.
  useEffect(() => setOpen(false), [location.pathname]);

  // Poll the unread-notification count; the bell badge is the only live element.
  useEffect(() => {
    let stop = false;
    const load = () =>
      api
        .get("/notifications/unread-count/")
        .then(({ data }) => !stop && setUnread(data.count))
        .catch(() => {});
    load();
    const id = setInterval(load, 60000);
    // Page layout: sidebar, top bar and content area.
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [location.pathname]);

  // First letters of the first two words of the name, shown in the round avatar.
  const initials = (user.full_name || user.username).split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="app">
      {/* Sidebar with the college name and the menu for this role */}
      <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Main navigation">
        <Link to={ROLE_HOME[user.role]} className="brand">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span className="brand-name">
            {COLLEGE_NAME}
            <small>{COLLEGE_ADDRESS}</small>
            <small>{ROLE_LABEL[user.role]}</small>
          </span>
        </Link>
        <nav className="nav">
          {NAV[user.role].map((item, i) =>
            item.group ? (
              <div className="nav-group" key={`g${i}`}>{item.group}</div>
            ) : (
              <NavLink key={item.to} to={item.to} end={item.end}>
                {item.label}
              </NavLink>
            )
          )}
        </nav>
      </aside>
      {/* Dark cover behind the open menu on small screens; clicking it closes the menu */}
      <div className={`scrim ${open ? "open" : ""}`} onClick={() => setOpen(false)} />

      {/* Top bar and the page content */}
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
          <span className="dept">{user.department_name || "College"}</span>
          <span className="spacer" />
          <button className="icon-btn bell" onClick={() => navigate("/notifications")} aria-label={`Notifications, ${unread} unread`}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9z" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>
            {unread > 0 && <span className="dot">{unread > 99 ? "99+" : unread}</span>}
          </button>
          <div className="user-chip">
            <div className="who">
              <div>{user.full_name || user.username}</div>
              <small>{ROLE_LABEL[user.role]}</small>
            </div>
            <Link to="/profile" className="avatar" aria-label="Your profile" style={{ textDecoration: "none" }}>
              {initials}
            </Link>
            <button className="btn sm secondary" onClick={() => setConfirmLogout(true)}>Sign out</button>
          </div>
        </header>
        {/* The current page is drawn here */}
        <main className="content">
          {/* key resets the boundary when the person opens another page */}
          <ErrorBoundary key={location.pathname}><Outlet /></ErrorBoundary>
        </main>
      </div>

      {/* Sign out confirmation popup */}
      {confirmLogout && (
        <ConfirmDialog
          title="Sign out"
          message="You will need to sign in again to continue."
          confirmLabel="Sign out"
          onCancel={() => setConfirmLogout(false)}
          onConfirm={async () => {
            await logout();
            navigate("/login", { replace: true });
          }}
        />
      )}
    </div>
  );
}
