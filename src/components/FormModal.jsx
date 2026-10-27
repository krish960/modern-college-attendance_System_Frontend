/*
 * FormModal
 * What it is: a pop-up form that builds itself from a list of fields (so one component serves every create / edit form).
 * Props: title, fields (see the list below the header), initial (starting values), submitLabel (button text), onSubmit(values), onClose,
 * wide (bigger pop-up), intro (short text shown above the fields).
 * It also contains CardCodeInput (ID card code with camera scan) and FormField (picks the right input for each field type).
 * Used in: AccountsManager and many pages (Profile, Lecture, Leave, Students, Take Attendance, Timetable, Assignments, Subjects, Classes, Departments).
 */
import SearchSelect, { SEARCH_FROM } from "./SearchSelect";
import { useState } from "react";
import { Modal } from "./Modal";
import { parseError } from "../utils/errors";
import PhotoField from "./PhotoField";
import { beep, useCamera } from "./useCamera";

/**
 * A modal form driven by a field list.
 *
 * fields: [{ name, label, type, required, options, help, full, readOnly, placeholder, min, max }]
 *   type: text (default) | tel (phone: only digits + - ( ) and spaces can be typed) | email | password | number | date | time | select | textarea | checkbox
 *   options (select): [{ value, label }]
 * onSubmit(values) must return a promise; errors from the API are shown on the matching field.
 */
export function FormModal({ title, fields, initial = {}, submitLabel = "Save", onSubmit, onClose, wide = false, intro }) {
  // values = what the user has typed. Each field starts from `initial`, or from an empty value (false for checkbox, null for photo).
  const [values, setValues] = useState(() => {
    const start = {};
    fields.forEach((f) => {
      start[f.name] = f.type === "photo" ? null : initial[f.name] ?? (f.type === "checkbox" ? false : "");
    });
    return start;
  });
  // errors = a message for each field, formError = one message for the whole form, busy = true while saving.
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  // Change one field and clear the old error of that field.
  const set = (name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  };

  // Runs on Save: first check the required fields here, then call onSubmit.
  // If the server sends errors, show them on the matching fields.
  const submit = async (event) => {
    event.preventDefault();
    const problems = {};
    fields.forEach((f) => {
      const v = values[f.name];
      if (f.required && !f.readOnly && (v === "" || v === null || v === undefined)) problems[f.name] = "This field is required.";
    });
    if (Object.keys(problems).length) {
      setErrors(problems);
      setFormError("Fill in the required fields.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await onSubmit(values);
    } catch (e) {
      const parsed = parseError(e);
      setErrors(parsed.fields);
      setFormError(parsed.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={busy ? () => {} : onClose} wide={wide}>
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          {intro && <p className="muted">{intro}</p>}
          {formError && <div className="form-error" role="alert">{formError}</div>}
          <div className="form-grid">
            {fields.map((f) => (
              <FormField key={f.name} field={f} value={values[f.name]} error={errors[f.name]} onChange={(v) => set(f.name, v)} />
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** A text box for an ID-card code with a camera button, so the card can be shown to the camera while filling the form. */
// scanning = the camera is open. When the camera reads a code: beep, remove spaces, make it upper case, put it in the box and close the camera.
function CardCodeInput({ common, value, onChange }) {
  const [scanning, setScanning] = useState(false);
  const { videoRef, error } = useCamera(scanning, (text) => {
    beep(true);
    onChange(String(text).replace(/\s+/g, "").toUpperCase());
    setScanning(false);
  });
  return (
    <div className="card-input">
      <div className="scan-type">
        <input
          {...common}
          value={value}
          placeholder="Scan or type the card code"
          autoComplete="off"
          // a hardware barcode scanner ends with Enter; that must fill the box, not submit the form
          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="btn secondary sm" onClick={() => setScanning((v) => !v)} aria-expanded={scanning}>
          {scanning ? "Stop camera" : "Scan card"}
        </button>
      </div>
      {scanning && (error ? <div className="note warn">{error}</div> : <video ref={videoRef} className="scan-video" playsInline muted />)}
      {value && !scanning && <span className="help">Card code: <b>{value}</b></span>}
    </div>
  );
}

// FormField shows one field: its label, the right input control, the help text and the error text.
function FormField({ field, value, error, onChange }) {
  // id joins the label to the input. `common` holds the attributes shared by most inputs (disabled, error info for screen readers).
  const id = `f-${field.name}`;
  const type = field.type || "text";
  const common = { id, disabled: field.readOnly, "aria-invalid": Boolean(error), "aria-describedby": error ? `${id}-err` : undefined };

  // Pick the input by field type. A select with many options becomes a searchable select.
  // A checkbox is different: it returns its own layout straight away.
  let control;
  if (type === "select" && (field.options || []).length > SEARCH_FROM) {
    control = (
      <SearchSelect id={id} value={value} onChange={onChange} options={field.options} placeholder={field.placeholder || "Select…"}
        disabled={field.readOnly} invalid={Boolean(error)} describedBy={error ? `${id}-err` : undefined} />
    );
  } else if (type === "select") {
    control = (
      <select {...common} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{field.placeholder || "Select…"}</option>
        {(field.options || []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (type === "photo") {
    control = <PhotoField value={value} onChange={onChange} student={field.student} />;
  } else if (type === "card") {
    control = <CardCodeInput common={common} value={value} onChange={onChange} />;
  } else if (type === "textarea") {
    control = <textarea {...common} value={value} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
  } else if (type === "checkbox") {
    return (
      <div className={`field ${field.full ? "full" : ""}`}>
        <label className="check" htmlFor={id}>
          <input {...common} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          {field.label}
        </label>
        {field.help && <span className="help">{field.help}</span>}
      </div>
    );
  } else {
    control = (
      <input
        {...common}
        type={type}
        value={value}
        placeholder={field.placeholder}
        min={field.min}
        max={field.max}
        autoComplete={type === "password" ? "new-password" : "off"}
        // tel shows the number keypad on phones; maxLength stops very long text (the server checks the real rules)
        inputMode={type === "tel" ? "tel" : undefined}
        maxLength={field.maxLength}
        onChange={(e) => onChange(type === "tel" ? e.target.value.replace(/[^0-9+()\-\s]/g, "") : e.target.value)}
      />
    );
  }

  // The normal layout for every type except checkbox: label, control, then help or error text.
  return (
    <div className={`field ${error ? "invalid" : ""} ${field.full || type === "textarea" ? "full" : ""}`}>
      <label htmlFor={id}>
        {field.label} {field.required && <span className="req" aria-hidden="true">*</span>}
      </label>
      {control}
      {field.help && !error && <span className="help">{field.help}</span>}
      {error && (
        <span className="error" id={`${id}-err`}>
          {error}
        </span>
      )}
    </div>
  );
}
