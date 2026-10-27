/*
 * useAction: runs a button action (save, delete, approve) with a 'busy' flag and a toast.
 */
import { useCallback, useState } from "react";
import { useToast } from "../context/ToastContext";
import { parseError } from "../utils/errors";

/**
 * Run an async action with a busy flag and toast messages.
 *   const { run, busy } = useAction();
 *   run(() => api.post(...), "Saved").then(ok => ...)
 * Resolves to true on success, false on failure (the error is shown as a toast).
 */
export function useAction() {
  const toast = useToast();
  // busy is true while the action runs. Use it to disable the button.
  const [busy, setBusy] = useState(false);

  // run(fn, successMessage) calls fn, then shows the success toast. On failure it shows an
  // error toast using the message that parseError pulls out of the server answer.
  const run = useCallback(
    async (fn, successMessage) => {
      setBusy(true);
      try {
        await fn();
        if (successMessage) toast.success(successMessage);
        return true;
      } catch (e) {
        toast.error(parseError(e).message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [toast]
  );

  return { run, busy };
}
