/*
 * Staff page. Opened by the HOD and the Admin.
 * A thin wrapper around the shared AccountsManager component for teacher
 * accounts (/api/staff/). The HOD sees own department. The Admin sees all.
 */

import AccountsManager from "../components/AccountsManager";
import { useAuth } from "../context/AuthContext";

export default function StaffMembersPage() {
  const { user } = useAuth();
  // HOD manages their own teachers. Admin only views and edits them.
  const isHod = user.role === "HOD";
  return (
    // Shared account list from /api/staff/. canCreate: only an HOD can register teachers. departmentFilter: the Admin sees all departments, so a filter is shown.
    <AccountsManager
      endpoint="/staff/"
      title="Staff"
      subtitle={isHod ? "Teachers in your department. Assign them to subjects and classes under Teacher assignments." : "Teachers across all departments. You can edit details, reset passwords and activate or deactivate. Teachers are registered by their HOD."}
      noun="staff member"
      canManage
      canCreate={isHod}
      departmentFilter={!isHod}
    />
  );
}
