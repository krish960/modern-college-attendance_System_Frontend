/*
 * RegisterCardsModal
 * What it is: a pop-up to link college ID cards to the students of one class, one student at a time.
 * Props: classes (list of {value, label} to choose from), initialClass (class chosen at the start), onClose, onChanged (called after any change so the page can refresh).
 * Used in: pages/StudentsPage.jsx.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/client";
import { parseError } from "../utils/errors";
import { byRoll } from "../utils/format";
import { Modal } from "./Modal";
import StudentPhoto from "./StudentPhoto";
import { beep, useCamera } from "./useCamera";

// Cleans a card code the same way the server stores it: no spaces, upper case.
const cardKey = (v) => String(v ?? "").replace(/\s+/g, "").toUpperCase();

/**
 * One-time registration of college ID cards for a class: the student whose turn it is is highlighted, the teacher shows
 * that student's card to the camera (or types / scans the code), and the card is linked to the student. Then the next
 * student without a card is selected. From then on attendance is taken by scanning the cards.
 */
export function RegisterCardsModal({ classes, initialClass, onClose, onChanged }) {
  // classroom = chosen class, students = its active students, loading = waiting for the server,
  // current = id of the student whose card we are waiting for.
  const [classroom, setClassroom] = useState(initialClass || "");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(null);
  // typed = text in the card box, message = result line shown to the user, scanning = camera is on.
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState(null);
  const [scanning, setScanning] = useState(false);
  // busy stops two scans being saved at the same time.
  // ref always holds the latest students/current, so the camera callback never uses old values.
  const busy = useRef(false);
  const ref = useRef({ students: [], current: null });
  ref.current = { students, current };

  // Load the active students of the class (sorted by roll number) and select the first one without a card.
  const load = useCallback(async () => {
    if (!classroom) return;
    setLoading(true);
    try {
      const { data } = await api.get("/students/", { params: { classroom, is_active: "true", page_size: 200 } });
      const list = [...data.results].sort(byRoll);
      setStudents(list);
      setCurrent((c) => (c && list.some((s) => s.id === c && !s.card_code) ? c : list.find((s) => !s.card_code)?.id ?? null));
    } catch (e) {
      setMessage({ kind: "bad", text: parseError(e).message });
    } finally {
      setLoading(false);
    }
  }, [classroom]);

  // Load again whenever the class changes.
  useEffect(() => {
    load();
  }, [load]);

  // Save one scanned or typed card code for the current student, then move to the next student without a card.
  const link = useCallback(async (code) => {
    const { current: id, students: list } = ref.current;
    const clean = cardKey(code);
    if (!id) {
      setMessage({ kind: "bad", text: "Choose the student first." });
      return;
    }
    if (!clean || busy.current) return;
    busy.current = true;
    const student = list.find((s) => s.id === id);
    try {
      await api.patch(`/students/${id}/`, { card_code: clean });
      beep(true);
      setMessage({ kind: "ok", text: `Card linked to ${student.name} (roll ${student.roll_number})` });
      const next = list.filter((s) => !s.card_code && s.id !== id)[0];
      setStudents((l) => l.map((s) => (s.id === id ? { ...s, card_code: clean } : s)));
      setCurrent(next ? next.id : null);
      onChanged?.();
    } catch (e) {
      beep(false);
      const parsed = parseError(e);
      setMessage({ kind: "bad", text: parsed.fields?.card_code || parsed.message });
    } finally {
      busy.current = false;
    }
  }, [onChanged]);

  // Open the camera only while scanning is on and a class is chosen. Each code it reads goes to link().
  const { videoRef, error: cameraError } = useCamera(scanning && Boolean(classroom), link);

  // Remove the card from a student (so the correct card can be scanned) and make that student the current one.
  const unlink = async (s) => {
    try {
      await api.patch(`/students/${s.id}/`, { card_code: "" });
      setStudents((l) => l.map((x) => (x.id === s.id ? { ...x, card_code: "" } : x)));
      setCurrent(s.id);
      setMessage({ kind: "dup", text: `Card removed from ${s.name}. Scan the correct card.` });
      onChanged?.();
    } catch (e) {
      setMessage({ kind: "bad", text: parseError(e).message });
    }
  };

  // Hidden file input used by the photo button (on phones it can open the camera).
  const photoInput = useRef(null);
  // Save a photo for the current student: shrink it to 480 px, make it a JPEG, upload it, then update the list.
  // (Same shrinking steps as PhotoField.)
  const addPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const target = ref.current.current;
    if (!file || !target) return;
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
      const form = new FormData();
      form.append("photo", blob, "photo.jpg");
      const { data } = await api.post(`/students/${target}/photo/`, form);
      setStudents((l) => l.map((x) => (x.id === target ? { ...x, has_photo: data.has_photo, photo_version: data.photo_version } : x)));
      setMessage({ kind: "ok", text: "Photo saved" });
      onChanged?.();
    } catch (err) {
      setMessage({ kind: "bad", text: parseError(err).message });
    }
  };

  // done = how many students already have a card, next = the student we are waiting for.
  const done = students.filter((s) => s.card_code).length;
  const next = students.find((s) => s.id === current);

  // Pop-up: class picker, progress line, camera / typing / photo tools, then the student list.
  return (
    <Modal title="Register ID cards" onClose={onClose} wide footer={<button className="btn" onClick={onClose}>Done</button>}>
      <div className="modal-body">
        <p className="muted">
          Do this once per class. Pick the class, show each student's college ID card to the camera, and the card is linked to that student.
          Later, attendance is taken just by scanning the cards.
        </p>
        {/* Class picker. Changing the class clears the message and stops the camera. */}
        <div className="field">
          <label htmlFor="cards-class">Class</label>
          <select id="cards-class" value={classroom} onChange={(e) => { setClassroom(e.target.value); setMessage(null); setScanning(false); }}>
            <option value="">Choose a class…</option>
            {classes.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {/* Everything below needs a class to be chosen. */}
        {classroom && (
          <>
            <div className="cards-progress">
              <b>{done}</b> of <b>{students.length}</b> cards registered
              {next ? <> · now scanning for <b>{next.name}</b> (roll {next.roll_number})</> : students.length ? <> · all done</> : null}
            </div>
            <div className="scan-body">
              <button type="button" className="btn secondary sm" onClick={() => setScanning((v) => !v)} disabled={!next}>
                {scanning ? "Stop camera" : "Start camera"}
              </button>
              {scanning && (cameraError ? <div className="note warn">{cameraError}</div> : <video ref={videoRef} className="scan-video" playsInline muted />)}
              <form onSubmit={(e) => { e.preventDefault(); link(typed); setTyped(""); }} className="scan-type">
                <label htmlFor="card-typed" className="sr-only">Card code</label>
                <input id="card-typed" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type or scan the card code, then Enter" autoComplete="off" disabled={!next} />
                <button className="btn secondary sm" disabled={!next}>Link card</button>
              </form>
              <div>
                <button type="button" className="btn secondary sm" disabled={!next} onClick={() => photoInput.current?.click()}>
                  Take / choose photo for this student
                </button>
                <input ref={photoInput} type="file" accept="image/*" capture="user" hidden onChange={addPhoto} />
              </div>
              {message && <div className={`scan-log`}><li className={message.kind} style={{ listStyle: "none" }} role="status">{message.text}</li></div>}
            </div>
            {loading ? <p className="muted">Loading…</p> : (
              <ul className="cards-list">
                {students.map((s) => (
                  <li key={s.id} className={s.id === current ? "now" : ""}>
                    <span className="roll">{s.roll_number}</span>
                    <span className="name with-avatar"><StudentPhoto student={s} size={28} /> {s.name}</span>
                    {s.card_code ? (
                      <>
                        <span className="badge ok">Card linked</span>
                        <button type="button" className="btn ghost sm" onClick={() => unlink(s)}>Remove</button>
                      </>
                    ) : (
                      <button type="button" className="btn ghost sm" onClick={() => setCurrent(s.id)} disabled={s.id === current}>{s.id === current ? "Waiting for card" : "Scan this one"}</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
