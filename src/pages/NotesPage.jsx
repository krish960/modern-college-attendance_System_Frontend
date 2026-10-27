/*
 * Notes page. Opened by the Teacher only.
 * A teacher shares notes and files with one class. Students do not sign in.
 * They open one private link that stops working at a time the teacher chooses.
 * Data: /api/notes/ and /api/notes/share/.
 */

import { useEffect, useRef, useState } from "react";
import api from "../api/client";
import { PagedTable } from "../components/DataTable";
import { ConfirmDialog } from "../components/Modal";
import { FilterSelect, PageHeader } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useAction } from "../hooks/useAction";
import { useFetch, useOptions, usePaginated } from "../hooks/useData";
import { fmtDateTime } from "../utils/format";
import { parseError } from "../utils/errors";

// Choices for how long the student link stays open. Values are minutes. 'custom' lets the teacher pick an exact date and time.
const DURATIONS = [
  { value: "30", label: "30 minutes" }, { value: "60", label: "1 hour" }, { value: "180", label: "3 hours" },
  { value: "360", label: "6 hours" }, { value: "1440", label: "1 day" }, { value: "4320", label: "3 days" },
  { value: "10080", label: "7 days" }, { value: "custom", label: "Pick a date and time…" },
];

/** "2 h 05 min 09 s left", counting down; when it reaches zero the parent is told so the box can switch to "closed". */
function Countdown({ endsAt, onDone }) {
  const [now, setNow] = useState(Date.now());
  const end = new Date(endsAt).getTime();
  useEffect(() => {
    // Tick once a second so the countdown updates. The timer is cleared when the component goes away.
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((end - now) / 1000));
  useEffect(() => { if (left === 0) onDone?.(); }, [left]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = Math.floor(left / 86400), h = Math.floor((left % 86400) / 3600), m = Math.floor((left % 3600) / 60), sec = left % 60;
  return <b className="countdown">{d ? `${d} d ` : ""}{d || h ? `${h} h ` : ""}{m} min {String(sec).padStart(2, "0")} s left</b>;
}

// Turns a file size in bytes into B, KB or MB text. Also used by other pages.
export const fmtSize = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`);

// "2026-10-21T14:30" in the browser's own time zone, `minutes` from now (the limits of the date box)
// Date and time text like "2026-10-21T14:30" in the browser's own time zone, `minutes` from now. Used as the min and max of the date box.
const localInput = (minutes) => new Date(Date.now() + minutes * 60000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
// Short text for a number of minutes: '45 min', '6 hours' or '3 days'.
const humanMinutes = (m) => (m < 120 ? `${m} min` : m < 2880 ? `${Math.round(m / 60)} hours` : `${Math.round(m / 1440)} days`);

// Teacher only. Shares notes and files with a class and manages the one link students open without signing in.
export default function NotesPage() {
  const { user } = useAuth();
  const toast = useToast();
  // run() wraps a request with a toast and sets busy while it runs.
  const { run, busy } = useAction();
  // Active classes for the picker (GET /api/classes/). The server only returns the teacher's own classes.
  const classes = useOptions("/classes/", (c) => ({ value: c.id, label: c.label }), { is_active: "true" });
  // Chosen class id as text. Empty means no class chosen yet.
  const [classroom, setClassroom] = useState("");
  // Student link status for the class: token, expiry, enabled (GET /api/notes/share/). Only runs once a class is chosen.
  const share = useFetch("/notes/share/", { classroom }, Boolean(classroom));
  // The teacher's subjects in this class, for the optional subject picker (GET /api/assignments/).
  const subjects = useFetch("/assignments/", { classroom, is_active: "true", page_size: 100 }, Boolean(classroom));
  // Notes already shared with this class (GET /api/notes/).
  const list = usePaginated("/notes/", { classroom });
  // Note form values: title, message text and optional subject.
  const [form, setForm] = useState({ title: "", body: "", subject: "" });
  // The file picked for upload, or null.
  const [file, setFile] = useState(null);
  // Error message shown above the note form.
  const [error, setError] = useState("");
  // The note waiting for the 'Remove' confirmation, or null.
  const [removing, setRemoving] = useState(null);
  // True while the note is being uploaded.
  const [sending, setSending] = useState(false);
  // Chosen link duration. Default is 360 minutes (6 hours).
  const [duration, setDuration] = useState("360");
  // Exact end time, used only when duration is 'custom'.
  const [until, setUntil] = useState("");
  // Problem with the chosen time, shown under the time box.
  const [timeError, setTimeError] = useState("");
  // Reference to the file input so it can be cleared after a successful upload.
  const fileInput = useRef(null);

  useEffect(() => {
    // A teacher with only one class does not need to choose. Pick it automatically.
    if (!classroom && classes.options.length === 1) setClassroom(String(classes.options[0].value));
  }, [classes.options, classroom]);

  // Full link the students open. The token comes from the server.
  const link = share.data?.token ? `${window.location.origin}/s/${share.data.token}` : "";
  // Unique subjects from the assignments list. One subject can appear for many assignments, so a Map removes the repeats.
  const subjectOptions = [...new Map((subjects.data?.results || []).map((a) => [a.subject, { value: a.subject, label: a.subject_name }])).values()];

  // minutes the link should stay open: a ready choice, or from now to the date and time the teacher picked
  const minutesChosen = () => {
    if (duration !== "custom") return Number(duration);
    const t = until ? new Date(until).getTime() : NaN;
    return Number.isNaN(t) ? 0 : Math.ceil((t - Date.now()) / 60000);
  };

  // Sends enable, new_link or disable to POST /api/notes/share/. For enable and new_link the time is checked first.
  // Business rule: a link must stay open at least 5 minutes and at most 30 days (43200 minutes).
  const shareAction = async (action, message) => {
    const body = { classroom: Number(classroom), action };
    if (action !== "disable") {
      const minutes = minutesChosen();
      let problem = "";
      if (duration === "custom" && !until) problem = "Pick the date and the time when the link should stop working.";
      else if (minutes < 5) problem = "Choose a time at least 5 minutes from now.";
      else if (minutes > 43200) problem = "A link can stay open for 30 days at most. Choose an earlier date.";
      if (problem) {
        setTimeError(problem); // shown right under the time box, where the teacher is looking
        return;
      }
      body.minutes = minutes;
    }
    setTimeError("");
    await run(async () => {
      await api.post("/notes/share/", body);
      share.reload();
    }, message);
  };

  // The 'Link stays open for' control. It is used in two places: when the link is on and when it is off.
  const timePicker = (
    <div className="share-time">
      <label htmlFor="share-for">Link stays open for</label>
      <select id="share-for" value={duration} onChange={(e) => { setDuration(e.target.value); setTimeError(""); }}>
        {DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
      </select>
      {duration === "custom" && <input type="datetime-local" aria-label="Open until" value={until} min={localInput(5)} max={localInput(43200)} onChange={(e) => { setUntil(e.target.value); setTimeError(""); }} />}
      {duration === "custom" && until && minutesChosen() >= 5 && minutesChosen() <= 43200 && <span className="muted small">{`${humanMinutes(minutesChosen())} from now`}</span>}
      {timeError && <div className="form-error" role="alert">{timeError}</div>}
    </div>
  );

  // Copies the student link to the clipboard. Clipboard can be blocked, so a fallback message is shown.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy. Select the link and copy it by hand.");
    }
  };

  // Uploads the note. Needs a title and either a file or some text. Uses FormData because it can carry a file.
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) return setError("Give the note a title.");
    if (!file && !form.body.trim()) return setError("Choose a file or write the note text.");
    const data = new FormData();
    data.append("classroom", classroom);
    data.append("title", form.title.trim());
    if (form.body.trim()) data.append("body", form.body.trim());
    if (form.subject) data.append("subject", form.subject);
    if (file) data.append("upload", file);
    setSending(true);
    try {
      await api.post("/notes/", data);
      toast.success("Shared with the class");
      setForm({ title: "", body: "", subject: "" });
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      list.reload();
    } catch (err) {
      const { message, fields } = parseError(err);
      setError(Object.values(fields).join(" ") || message); // show the real reason, for example "This file type is not allowed"
    } finally {
      setSending(false);
    }
  };

  // Table columns. The Remove button shows only for notes this teacher uploaded.
  const columns = [
    { key: "title", header: "Note", render: (n) => <><strong>{n.title}</strong>{n.subject_name && <div className="muted small">{n.subject_name}</div>}{n.body && <div className="muted small" style={{ whiteSpace: "pre-wrap" }}>{n.body.length > 140 ? `${n.body.slice(0, 140)}…` : n.body}</div>}</> },
    { key: "file_name", header: "File", render: (n) => (n.file_name ? <>{n.file_name}<div className="muted small">{fmtSize(n.file_size)}</div></> : <span className="muted">Text only</span>) },
    { key: "uploaded_by_name", header: "Shared by", render: (n) => <>{n.uploaded_by_name}<div className="muted small">{fmtDateTime(n.created_at)}</div></> },
    {
      key: "actions", header: "", align: "right",
      render: (n) => (n.uploaded_by === user.id) && (
        <button className="btn secondary sm" onClick={() => setRemoving(n)}>Remove</button>
      ),
    },
  ];

  return (
    <>
      {/* Page title and the class picker. */}
      <PageHeader title="Notes for students" subtitle="Share notes and PDFs with a class. Students open one link, no sign-in, and see only this class's notes." />
      <div className="panel panel-pad" style={{ marginBottom: "1rem" }}>
        <div className="toolbar" style={{ padding: 0 }}>
          <FilterSelect label="Class" value={classroom} onChange={setClassroom} options={classes.options} allLabel="Choose a class" />
        </div>
      </div>

      {/* Nothing else is shown until a class is chosen. */}
      {!classroom ? (
        <div className="panel"><div className="empty"><h3>Choose a class</h3><p>Pick the class you want to share notes with.</p></div></div>
      ) : (
        <>
          {/* Student link box: shows the link and countdown when it is on, or the option to turn it on. */}
          <div className="panel panel-pad share-box" style={{ marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.05rem" }}>Student link</h2>
            {share.loading && !share.data ? <p className="muted">Loading…</p> : share.data?.enabled ? (
              <>
                <p className="share-until">Open until <b>{fmtDateTime(share.data.expires_at)}</b> · <Countdown endsAt={share.data.expires_at} onDone={share.reload} /></p>
                <p className="muted small">Send this link to the class (WhatsApp group, notice board). Students can read and download these notes only until that time; after it the link and the files stop working.</p>
                <div className="share-row">
                  <input readOnly value={link} aria-label="Student link" onFocus={(e) => e.target.select()} />
                  <button className="btn" onClick={copy}>Copy link</button>
                </div>
                <div className="share-change">
                  {timePicker}
                  <div className="actions">
                    <button className="btn secondary sm" disabled={busy} onClick={() => shareAction("enable", "Time changed. The link stays the same.")}>Change the time</button>
                    <button className="btn secondary sm" disabled={busy} onClick={() => shareAction("new_link", "New link made. The old one no longer works.")}>Make a new link</button>
                    <button className="btn secondary sm" disabled={busy} onClick={() => shareAction("disable", "Link turned off")}>Turn off link now</button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="muted small">
                  {share.data?.expired ? "The time for the last link is over, so students can no longer open the notes." : share.data ? "The link is turned off. Students cannot open the notes." : "No link yet."}{" "}
                  Choose for how long students may open the notes. Turning it on makes a new link.
                </p>
                {timePicker}
                <button className="btn" disabled={busy} style={{ marginTop: "0.6rem" }} onClick={() => shareAction("enable", "Link is on")}>Turn on student link</button>
              </>
            )}
          </div>

          {/* Form to share a new note or file with the class. */}
          <form className="panel panel-pad" onSubmit={submit} noValidate style={{ marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.05rem", marginBottom: "0.6rem" }}>Share a note</h2>
            {error && <div className="form-error" role="alert">{error}</div>}
            <div className="form-grid">
              <div className="field"><label htmlFor="n-title">Title</label><input id="n-title" value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Unit 2: Normalisation" /></div>
              <div className="field">
                <label htmlFor="n-subject">Subject (optional)</label>
                <select id="n-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                  <option value="">Not tied to a subject</option>
                  {subjectOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="field full"><label htmlFor="n-body">Message (optional)</label><textarea id="n-body" value={form.body} maxLength={5000} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="What the students should do with this file" /></div>
              <div className="field full">
                <label htmlFor="n-file">File (optional)</label>
                <input id="n-file" ref={fileInput} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <span className="help">PDF, Word, PowerPoint, Excel, text or an image, up to 10 MB.</span>
              </div>
            </div>
            <button className="btn" disabled={sending} style={{ marginTop: "0.8rem" }}>{sending ? "Sharing…" : "Share with class"}</button>
          </form>

          <div className="panel">
            {/* Notes already shared. */}
            <PagedTable query={list} columns={columns} emptyTitle="Nothing shared yet" emptyHint="Notes you share appear here and on the student link." />
          </div>
        </>
      )}

      {/* Confirm popup for removing a note (DELETE /api/notes/{id}/). The file is deleted too. */}
      {removing && (
        <ConfirmDialog
          title="Remove this note?"
          message={`"${removing.title}" will disappear from the student link and the file is deleted.`}
          confirmLabel="Remove"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            await api.delete(`/notes/${removing.id}/`);
            setRemoving(null);
            toast.success("Note removed");
            list.reload();
          }}
        />
      )}
    </>
  );
}
