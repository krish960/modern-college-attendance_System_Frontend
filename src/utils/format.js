/*
 * format.js
 * What it is: small helper functions and constants for dates, times, percentages, roles and sorting.
 * Used in: about 30 files across components and pages.
 */
// Today's date as "YYYY-MM-DD" (the format used by the server and date inputs).
export const todayISO = () => {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};

// "2026-10-27" becomes a readable date such as "27 Oct 2026". Empty value gives empty text.
export const fmtDate = (value) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

// A full date and time such as "27 Oct 2026, 10:30 am".
export const fmtDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

// Keeps only hours and minutes ("10:30:00" becomes "10:30").
export const fmtTime = (value) => (value ? String(value).slice(0, 5) : "");

// Adds a % sign; shows a dash when there is no value.
export const fmtPct = (value) => (value === null || value === undefined ? "–" : `${value}%`);

// Weekday choices. 0 = Monday ... 6 = Sunday.
export const WEEKDAYS = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

// ROLE_LABEL = the name shown for each role. ROLE_HOME = the first page path for each role.
export const ROLE_LABEL = { ADMIN: "College Admin", HOD: "Head of Department", STAFF: "Teacher" };
export const ROLE_HOME = { ADMIN: "/admin", HOD: "/hod", STAFF: "/staff" };

// Academic year such as "2026-27". The year is taken to start in June (month index 5 or later).
export function currentAcademicYear() {
  const now = new Date();
  const start = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** Sort comparator that puts roll numbers in natural order: 2 before 10. */
export const byRoll = (a, b) => String(a.roll_number).localeCompare(String(b.roll_number), undefined, { numeric: true });
