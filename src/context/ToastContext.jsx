/*
 * Toasts: the small success / error messages that appear in a corner and fade away.
 * Any component can call: const toast = useToast(); toast.success('Saved'); toast.error('Failed');
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);
// Each toast gets its own id so it can be dismissed on its own.
let nextId = 1;

// Holds the list of toasts on screen and draws them. Wrap the app with this (see main.jsx).
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  // Add a toast and remove it automatically. Errors stay longer (7 s) than successes (4 s).
  const push = useCallback(
    (kind, message) => {
      const id = nextId++;
      setToasts((list) => [...list, { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
    },
    [dismiss]
  );

  // The small API that useToast() gives to components.
  const api = useMemo(
    () => ({ success: (m) => push("success", m), error: (m) => push("error", m) }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span>{t.message}</span>
            <button className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Dismiss message">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Shortcut used by components.
export const useToast = () => useContext(ToastContext);
