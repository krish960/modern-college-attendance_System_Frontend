/*
 * The route map of the whole app. Every URL is listed here once.
 * Three things decide what a person can open:
 * 1. RequireAuth: you must be signed in, otherwise you go to /login.
 * 2. RequireRole: your role (ADMIN, HOD or STAFF) must be in the list.
 * 3. AppLayout: the sidebar and top bar wrapped around every signed-in page.
 * The backend checks the same rules again on every API call, so this only hides pages.
 */
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import { RequireAuth, RequireRole, RoleHome } from "./routes/ProtectedRoute";

import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import NotificationsPage from "./pages/NotificationsPage";
import AuditLogPage from "./pages/AuditLogPage";
import StudentRecordsPage from "./pages/StudentRecordsPage";
import StudentsPage from "./pages/StudentsPage";
import SubjectStudentsPage from "./pages/SubjectStudentsPage";
import StaffMembersPage from "./pages/StaffMembersPage";
import LecturePage from "./pages/LecturePage";
import HistoryPage from "./pages/HistoryPage";
import DailyReportPage from "./pages/DailyReportPage";
import StudentSummaryPage from "./pages/StudentSummaryPage";
import CorrectionsPage from "./pages/CorrectionsPage";
import MonthlySheetPage from "./pages/MonthlySheetPage";
import StudentRemovalsPage from "./pages/StudentRemovalsPage";
import NotesPage from "./pages/NotesPage";
import ClassPromotionsPage from "./pages/ClassPromotionsPage";
import LeavePage from "./pages/LeavePage";
import StaffAttendancePage from "./pages/StaffAttendancePage";
import MyAttendancePage from "./pages/staff/MyAttendancePage";

import AdminDashboard from "./pages/admin/AdminDashboard";
import DepartmentsPage from "./pages/admin/DepartmentsPage";
import HodsPage from "./pages/admin/HodsPage";
import OnLeavePage from "./pages/admin/OnLeavePage";

import HodDashboard from "./pages/hod/HodDashboard";
import SubjectsPage from "./pages/hod/SubjectsPage";
import ClassesPage from "./pages/hod/ClassesPage";
import AssignmentsPage from "./pages/hod/AssignmentsPage";
import TimetablePage from "./pages/hod/TimetablePage";

import StaffDashboard from "./pages/staff/StaffDashboard";
import TakeAttendancePage from "./pages/staff/TakeAttendancePage";

// Role lists used by RequireRole below. A name like ADMIN_HOD means 'admin or HOD'.
const ADMIN = ["ADMIN"];
const HOD = ["HOD"];
const STAFF = ["STAFF"];
const ADMIN_HOD = ["ADMIN", "HOD"];
const HOD_STAFF = ["HOD", "STAFF"];
const EVERYONE = ["ADMIN", "HOD", "STAFF"];

export default function App() {
  return (
    <Routes>
      {/* the only public page */}
      <Route path="/login" element={<LoginPage />} />
      {/* everything below needs a signed-in user */}
      <Route element={<RequireAuth />}>
        {/* / just redirects each role to its own dashboard */}
        <Route path="/" element={<RoleHome />} />
        {/* pages inside this group get the sidebar and top bar */}
        <Route element={<AppLayout />}>
          {/* pages every signed-in user can open */}
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/summary" element={<StudentSummaryPage />} />
          <Route path="/monthly" element={<MonthlySheetPage />} />
          <Route path="/lectures/:id" element={<LecturePage />} />

          {/* ADMIN only: college-wide setup */}
          <Route element={<RequireRole roles={ADMIN} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/departments" element={<DepartmentsPage />} />
            <Route path="/admin/hods" element={<HodsPage />} />
            <Route path="/admin/on-leave" element={<OnLeavePage />} />
          </Route>

          {/* HOD only: department setup (subjects, classes, timetable) */}
          <Route element={<RequireRole roles={HOD} />}>
            <Route path="/hod" element={<HodDashboard />} />
            <Route path="/hod/subjects" element={<SubjectsPage />} />
            <Route path="/hod/classes" element={<ClassesPage />} />
            <Route path="/hod/assignments" element={<AssignmentsPage />} />
            <Route path="/hod/timetable" element={<TimetablePage />} />
          </Route>

          {/* STAFF (teachers) only: taking attendance and notes */}
          <Route element={<RequireRole roles={STAFF} />}>
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/subject-students" element={<SubjectStudentsPage />} />
            <Route path="/staff" element={<StaffDashboard />} />
            <Route path="/attendance" element={<TakeAttendancePage />} />
            <Route path="/my-attendance" element={<MyAttendancePage />} />
          </Route>

          {/* ADMIN and HOD: managing staff and reading reports */}
          <Route element={<RequireRole roles={ADMIN_HOD} />}>
            <Route path="/staff-members" element={<StaffMembersPage />} />
            <Route path="/staff-attendance" element={<StaffAttendancePage />} />
            <Route path="/reports" element={<DailyReportPage />} />
            <Route path="/audit-logs" element={<AuditLogPage />} />
            <Route path="/student-records" element={<StudentRecordsPage />} />
          </Route>

          {/* all three roles (the page itself shows role-specific content) */}
          <Route element={<RequireRole roles={EVERYONE} />}>
            <Route path="/leave" element={<LeavePage />} />
            <Route path="/promotions" element={<ClassPromotionsPage />} />
          </Route>

          {/* HOD and STAFF: requests that the HOD or teacher raises or reviews */}
          <Route element={<RequireRole roles={HOD_STAFF} />}>
            <Route path="/corrections" element={<CorrectionsPage />} />
            <Route path="/removals" element={<StudentRemovalsPage />} />
          </Route>
        </Route>
      </Route>
      {/* any unknown URL goes back to / */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
