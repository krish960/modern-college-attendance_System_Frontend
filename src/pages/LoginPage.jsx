/*
 * Login page. Opened by anyone who is not signed in.
 * One form with a role toggle (Admin, HOD or Teacher). The server rejects
 * an account whose real role does not match the toggle.
 * On success the user goes to their own dashboard.
 */

import { COLLEGE_ADDRESS, COLLEGE_NAME } from "../config";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { parseError } from "../utils/errors";
import { ROLE_HOME } from "../utils/format";

// The three roles. 'role' is the value sent to the server. 'hint' is the help text under the title.
const ROLES = {
  admin: { role: "ADMIN", id: "admin", name: "College Admin", short: "Admin", hint: "For the college administrator: departments and HODs." },
  hod: { role: "HOD", id: "hod", name: "Head of Department", short: "HOD", hint: "For heads of department: staff, classes, timetable, reports and corrections." },
  staff: { role: "STAFF", id: "staff", name: "Teacher", short: "Teacher", hint: "For teachers: take attendance and request corrections." },
};

/** One sign-in page with a role toggle. The server also refuses an account whose role does not match the toggle. */
export default function LoginPage() {
  // Selected role. Remembered in localStorage so the next visit starts on the same role.
  // The try/catch is needed because storage can be blocked by the browser.
  const [roleKey, setRoleKey] = useState(() => {
    try {
      const saved = localStorage.getItem("attendance.login.role");
      return ROLES[saved] ? saved : "staff";
    } catch {
      return "staff";
    }
  });
  const config = ROLES[roleKey];
  // Auth context: the current user and the login function.
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Form fields. error = message to show. busy = true while the request runs.
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Already signed in: go straight to the dashboard of that role.
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  // Handle the form submit: check fields, remember the role, call login, then redirect.
  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      localStorage.setItem("attendance.login.role", roleKey);
    } catch {
      /* remembering the last role is only a convenience */
    }
    try {
      const signedIn = await login(username.trim(), password, config.role);
      // Land on the dashboard of the role (or on the deep link they were sent here from).
      // 'from' is the page the user tried to open before being sent to login.
      const from = location.state?.from?.pathname;
      navigate(from && from !== "/" && !from.startsWith("/login") ? from : ROLE_HOME[signedIn.role], { replace: true });
    } catch (err) {
      // Turn server errors into friendly text: 400/401 wrong login, 429 rate limited.
      const status = err.response?.status;
      setError(
        status === 401 || status === 400
          ? err.response.data?.detail || "Wrong username or password."
          : status === 429
            ? "Too many attempts. Wait a minute and try again."
            : parseError(err).message
      );
      setBusy(false);
    }
  };

  return (
    <div className="login">
      {/* Login card */}
      <section className="login-form">
        <form className="login-card" onSubmit={submit} noValidate>
          <div className="login-brand">
            <span className="brand-mark" aria-hidden="true">M</span>
            <span>{COLLEGE_NAME}</span>
          </div>
          <div className="login-tag">{COLLEGE_ADDRESS} · Subject-wise attendance</div>
          <div>
            <h2>Sign in</h2>
            <p className="muted">{config.hint}</p>
          </div>
          {/* Role toggle buttons (Admin / HOD / Teacher) */}
          <div className="role-toggle" role="radiogroup" aria-label="Sign in as">
            {Object.values(ROLES).map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={roleKey === r.id}
                className={roleKey === r.id ? "on" : ""}
                onClick={() => { setRoleKey(r.id); setError(""); try { localStorage.setItem("attendance.login.role", r.id); } catch { /* convenience only */ } }}
              >
                {r.short}
              </button>
            ))}
          </div>
          {/* Error message area */}
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="field">
            <label htmlFor="username">Username</label>
            <input id="username" type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <p className="login-note">Students do not sign in. Teachers take attendance by scanning college ID cards.</p>
        </form>
      </section>
    </div>
  );
}
