/*
 * Modal.jsx
 * What it is: the pop-up window used all over the app.
 * Exports: Modal (the window itself) and ConfirmDialog (a ready-made "Are you sure?" pop-up).
 * Modal props: title, onClose, children (content), footer (optional button row), wide (bigger window).
 * Used in: FormModal, ImportStudentsModal, RegisterCardsModal, PromoteClassModal, AccountsManager and many pages.
 */
import { useEffect, useRef, useState } from "react";
import { parseError } from "../utils/errors";

/** The pop-up window with a dark background, a title bar and a close (×) button. Escape or a click on the dark area also closes it. */
export function Modal({ title, onClose, children, footer, wide = false }) {
  // ref = the window itself, so it can take the keyboard focus when it opens.
  const ref = useRef(null);

  // On open: remember the previously focused element and focus the window; close on Escape.
  // On close: remove the key listener and give the focus back.
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  // Dark overlay (click on it to close) containing the window with title, content and optional footer.
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Confirmation for sensitive actions.
 * Pass `remarksLabel` to also collect a mandatory note (used when approving / rejecting corrections).
 * `onConfirm(remarks)` may be async; a thrown error is shown inside the dialog.
 */
export function ConfirmDialog({ title, message, confirmLabel = "Confirm", danger = false, remarksLabel, onConfirm, onCancel }) {
  // remarks = the note typed by the user, busy = request running, error = message to show.
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Confirm: if a note is required it must not be empty. Then call onConfirm; if it fails, show the error inside the dialog.
  const submit = async () => {
    if (remarksLabel && !remarks.trim()) {
      setError(`${remarksLabel} is required.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onConfirm(remarks.trim());
    } catch (e) {
      setError(parseError(e).message);
      setBusy(false);
    }
  };

  // A Modal with Cancel / Confirm buttons. While busy it cannot be closed.
  return (
    <Modal
      title={title}
      onClose={busy ? () => {} : onCancel}
      footer={
        <>
          <button className="btn secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className={`btn ${danger ? "danger" : ""}`} onClick={submit} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="modal-body">
        {message && <p>{message}</p>}
        {remarksLabel && (
          <div className={`field ${error ? "invalid" : ""}`}>
            <label htmlFor="confirm-remarks">
              {remarksLabel} <span className="req">*</span>
            </label>
            <textarea id="confirm-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        )}
        {error && <div className="form-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}
