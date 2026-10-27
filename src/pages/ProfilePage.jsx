/*
 * Profile page. Opened by every signed-in user (Admin, HOD and Teacher).
 * Shows the account details and lets the user edit contact details or change
 * their own password. Uses /api/auth/me/ and /api/auth/change-password/.
 */

import { useState } from "react";
import api from "../api/client";
import { FormModal } from "../components/FormModal";
import { Modal } from "../components/Modal";
import { PasswordRules, passwordIsStrong } from "../components/PasswordRules";
import { PageHeader } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { parseError } from "../utils/errors";
import { ROLE_LABEL } from "../utils/format";

export default function ProfilePage() {
  // The signed-in user comes from the auth context. setUser refreshes it after an edit.
  const { user, setUser } = useAuth();
  const toast = useToast();
  // Which modal is open: null (none), 'details' or 'password'.
  const [modal, setModal] = useState(null);

  // Label and value pairs shown in the read-only details list.
  const rows = [
    ["Name", user.full_name || "–"],
    ["Username", user.username],
    ["Role", ROLE_LABEL[user.role]],
    ["Department", user.department_name || "All departments"],
    ["Email", user.email || "–"],
    ["Phone", user.phone || "–"],
  ];

  return (
    <>
      {/* Header with the two actions: edit contact details and change password. */}
      <PageHeader
        title="Your profile"
        actions={
          <>
            <button className="btn secondary" onClick={() => setModal("details")}>Edit contact details</button>
            <button className="btn" onClick={() => setModal("password")}>Change password</button>
          </>
        }
      />
      {/* Read-only card with the account details. */}
      <div className="panel panel-pad">
        <dl className="form-grid" style={{ margin: 0 }}>
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="muted small">{k}</dt>
              <dd style={{ margin: 0 }}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="muted small" style={{ marginTop: "0.8rem" }}>Your role and department can only be changed by an administrator.</p>

      {/* Edit contact details modal. Saves with PATCH /api/auth/me/ and updates the user in context. */}
      {modal === "details" && (
        <FormModal
          title="Edit contact details"
          fields={[
            { name: "first_name", label: "First name", required: true },
            { name: "last_name", label: "Last name", required: true },
            { name: "email", label: "Email", type: "email" },
            { name: "phone", label: "Phone", type: "tel", maxLength: 20, placeholder: "98765 43210" },
          ]}
          initial={user}
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            // Role and department are not sent. Only an Admin can change them.
            const { data } = await api.patch("/auth/me/", v);
            setUser(data);
            setModal(null);
            toast.success("Profile saved");
          }}
        />
      )}
      {/* Change password modal (defined below). */}
      {modal === "password" && <ChangePasswordModal onClose={() => setModal(null)} onDone={() => { setModal(null); toast.success("Password changed"); }} />}
    </>
  );
}

/** Current password first, then the new one twice. The new password is checked live against the rules. */
function ChangePasswordModal({ onClose, onDone }) {
  // Form values, show = reveal the passwords, error = general message, fieldErrors = per-field messages from the checks or the server.
  const [form, setForm] = useState({ old_password: "", new_password: "", confirm_password: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  // busy is true while the request runs. It locks the buttons and the modal.
  const [busy, setBusy] = useState(false);
  // Returns an onChange handler that updates one form field.
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    // Checked here first so the person gets the message at once, without waiting for the server.
    if (!form.old_password) return setFieldErrors({ old_password: "Enter your current password." });
    if (!passwordIsStrong(form.new_password)) return setFieldErrors({ new_password: "The new password does not meet all the rules below." });
    if (form.new_password !== form.confirm_password) return setFieldErrors({ confirm_password: "The two new passwords are not the same." });
    setBusy(true);
    try {
      // Server checks the current password and applies the same strength rules.
      await api.post("/auth/change-password/", form);
      onDone();
    } catch (err) {
      const parsed = parseError(err);
      setFieldErrors(parsed.fields || {});
      setError(parsed.message);
      setBusy(false);
    }
  };

  // Input type switches so the 'Show passwords' box can reveal the text.
  const type = show ? "text" : "password";
  // Small helper that draws one labelled password input with its error text.
  const field = (name, label, autoComplete) => (
    <div className={`field full ${fieldErrors[name] ? "invalid" : ""}`}>
      <label htmlFor={`pw-${name}`}>{label}</label>
      <input id={`pw-${name}`} type={type} value={form[name]} onChange={set(name)} autoComplete={autoComplete} aria-invalid={!!fieldErrors[name]} />
      {fieldErrors[name] && <p className="error" role="alert">{fieldErrors[name]}</p>}
    </div>
  );

  return (
    <Modal title="Change password" onClose={busy ? () => {} : onClose}>
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          {field("old_password", "Current password", "current-password")}
          {field("new_password", "New password", "new-password")}
          <PasswordRules value={form.new_password} />
          {field("confirm_password", "New password again", "new-password")}
          <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords</label>
          {error && !Object.keys(fieldErrors).length && <p className="form-error" role="alert">{error}</p>}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
        </div>
      </form>
    </Modal>
  );
}
