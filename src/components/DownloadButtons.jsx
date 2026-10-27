/*
 * DownloadButtons.jsx
 * What it is: buttons that download data from the server as a file.
 * Exports: DownloadButtons (Excel and PDF buttons for one list) and DownloadEverything (admin button for a ZIP of all data).
 * DownloadButtons props: what (which list, e.g. students, staff, hods), params (filters sent to the server), label (word before Excel / PDF).
 * Used in: AccountsManager, AdminDashboard, LeavePage and StudentsPage.
 */
import { useState } from "react";
import { useToast } from "../context/ToastContext";
import { parseError } from "../utils/errors";
import { downloadExport } from "../utils/download";

/** Save a list to the computer: Excel (.xlsx file, opens Marathi names correctly) or PDF. `what` = students | staff | hods. */
export function DownloadButtons({ what, params = {}, label = "Download" }) {
  const toast = useToast();
  // busy = which download is running ("xlsx", "pdf", or "" for none). The buttons are disabled meanwhile.
  const [busy, setBusy] = useState("");
  // Download one file type. Empty filters are removed first. On failure show an error message (a failed file download comes as a Blob, so a general text is used).
  const go = async (kind) => {
    setBusy(kind);
    try {
      const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v != null));
      await downloadExport(`/downloads/${what}/`, clean, kind);
    } catch (e) {
      toast.error(e.response?.data instanceof Blob ? "Could not download. Try again." : parseError(e).message);
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      <button className="btn secondary" disabled={!!busy} onClick={() => go("xlsx")}>{busy === "xlsx" ? "Preparing…" : `${label} Excel`.trim()}</button>
      <button className="btn secondary" disabled={!!busy} onClick={() => go("pdf")}>{busy === "pdf" ? "Preparing…" : `${label} PDF`.trim()}</button>
    </>
  );
}

/** Admin only: every table of the college in one ZIP. */
// This button has no filters: it always asks for the ZIP of everything.
export function DownloadEverything() {
  const toast = useToast();
  // busy = the ZIP is being prepared.
  const [busy, setBusy] = useState(false);
  // Start the ZIP download and show an error message if it fails.
  const go = async () => {
    setBusy(true);
    try {
      await downloadExport("/downloads/all/", {}, "zip");
    } catch (e) {
      toast.error(e.response?.data instanceof Blob ? "Could not download. Try again." : parseError(e).message);
    } finally {
      setBusy(false);
    }
  };
  return <button className="btn" disabled={busy} onClick={go}>{busy ? "Preparing all data…" : "Download all data (ZIP)"}</button>;
}
