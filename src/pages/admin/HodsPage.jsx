/*
 * HODs page. Opened by the Admin only.
 * A thin wrapper around the shared AccountsManager component. It lists
 * and manages HOD accounts using /api/hods/.
 */

import AccountsManager from "../../components/AccountsManager";

export default function HodsPage() {
  return (
    // Business rule: one active HOD per department. withDepartment and
    // departmentFilter show and filter by department. canManage lets the
    // Admin add, edit and deactivate accounts.
    <AccountsManager
      endpoint="/hods/"
      title="Heads of department"
      subtitle="Each department has one active HOD. Deactivate the current HOD before registering a replacement."
      noun="HOD"
      canManage
      withDepartment
      departmentFilter
    />
  );
}
