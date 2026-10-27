/*
 * ScanPanel
 * What it is: a panel where a teacher scans student ID cards (camera, USB / Bluetooth barcode scanner or typing) to mark them Present.
 * Props: students (list of the class), marks (current marks by student id), onPresent(studentId) (marks one student; may return "unchanged"),
 * title, help (texts), noun ("student" or another word such as staff, which changes the messages).
 * Used in: pages/LecturePage.jsx and pages/StaffAttendancePage.jsx.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/client";
import StudentPhoto from "./StudentPhoto";
import { beep, primeAudio, useCamera } from "./useCamera";

// Makes a code comparable: no spaces, upper case, and leading zeros removed from all-digit codes ("007" matches "7").
const canon = (v) => {
  const s = String(v ?? "").replace(/\s+/g, "").toUpperCase();
  return /^\d+$/.test(s) ? s.replace(/^0+(?=\d)/, "") : s;
};

/**
 * Ways an unregistered code can name a roll number / staff ID: the whole text or a roll= / id= value.
 * (No guessing from the last piece of the text: "EMP-002" must never become roll 2.)
 */
function candidates(text) {
  const raw = String(text || "").trim();
  const out = [raw];
  const param = raw.match(/[?&;,\s](?:roll|roll_number|rollno|id)=([^&;,\s]+)/i);
  if (param) { try { out.push(decodeURIComponent(param[1])); } catch { out.push(param[1]); } };
  return out.map(canon).filter(Boolean);
}


/** A card code as the server stores it: no spaces, upper case. */
const cardKey = (v) => String(v ?? "").replace(/\s+/g, "").toUpperCase();

/**
 * Teacher-side ID-card scanning. The teacher's own phone/laptop camera (or a USB/Bluetooth barcode scanner, or typing)
 * reads the code on a student's college ID card; the matching student of THIS class is marked Present in the register.
 * Nothing is sent to the server here; the teacher still saves or submits the register as usual.
 */
export default function ScanPanel({ students, marks, onPresent, title = "Scan ID cards", help = "Hold a student's college ID card in front of your camera. Only students of this class can be marked, and only you can scan.", noun = "student" }) {
  // open = scanning is on, typed = text in the box (a barcode scanner "types" here), cameraOn = use the camera.
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [cameraOn, setCameraOn] = useState(true); // off = only a USB / Bluetooth barcode scanner or typing
  // typedRef = the text box (to give it focus), log = the last scan results shown on screen.
  const typedRef = useRef(null);
  const [log, setLog] = useState([]);
  // stateRef keeps the newest students / marks / onPresent for the camera callback, which would otherwise see old values.
  const stateRef = useRef({ students, marks, onPresent });
  stateRef.current = { students, marks, onPresent };

  // Handles one scanned or typed code: find the student, check them, mark Present and add a line to the log.
  const handle = useCallback(async (text) => {
    const { students: list, marks: current, onPresent: mark } = stateRef.current;
    // 1) a card registered to a student; 2) otherwise the roll number written in / around the code.
    const raw = cardKey(text);
    let student = list.find((s) => s.card_code && s.card_code === raw) || null;
    // 3) a card that is not on this screen: say whose card it is instead of guessing
    let other = null;
    if (!student) {
      try { other = (await api.post("/scan/identify/", { code: raw })).data; } catch { other = null; }
      if (!other?.staff && !other?.student) {
        for (const c of candidates(text)) {
          student = list.find((s) => canon(s.roll_number) === c);
          if (student) break;
        }
      }
    }
    // Decide the message: not found, inactive, already present, or marked present now.
    // `entry` = { kind: ok | dup | bad, student, text }. Only the ok case calls onPresent.
    let entry;
    if (!student) {
      const forStudents = noun === "student";
      const shown = String(text).slice(0, 40);
      if (forStudents && other?.student) entry = { kind: "bad", text: `This card belongs to a student of another class: ${shown}` };
      else if (forStudents && other?.staff) entry = { kind: "bad", text: `This is a staff ID card, not a student's: ${shown}` };
      else if (!forStudents && other?.staff) entry = { kind: "bad", text: `This card belongs to a teacher of another department: ${shown}` };
      else if (!forStudents && other?.student) entry = { kind: "bad", text: `This is a student's ID card, not a teacher's: ${shown}` };
      else entry = { kind: "bad", text: `Not found for this ${forStudents ? "class" : "list"}: ${shown}` };
    } else if (!student.is_active) {
      entry = { kind: "bad", student, text: `${student.name} (${student.roll_number}) is inactive` };
    } else if (current[student.id] === "PRESENT") {
      entry = { kind: "dup", student, text: `${student.name} (${student.roll_number}) was already present` };
    } else {
      beep(true); // the teacher hears it at once; a refusal from the server is announced below
      try {
        const outcome = await mark(student.id);
        entry = outcome === "unchanged"
          ? { kind: "dup", student, text: `${student.name} (${student.roll_number}) was already present` }
          : { kind: "ok", student, text: `${student.name} (${student.roll_number}) marked present` };
      } catch (err) {
        entry = { kind: "bad", student, text: `${student.name}: ${err?.response?.data?.detail || "could not be marked"}` };
      }
    }
    // Keep only the 6 newest log lines. A low beep tells the teacher that something was wrong.
    if (entry.kind !== "ok") beep(false);
    setLog((l) => [{ ...entry, id: Date.now() + Math.random() }, ...l].slice(0, 6));
  }, [noun]);

  // Camera runs only while scanning is open and the camera option is on. Every code it reads goes to handle().
  const { videoRef, error: cameraError, caps, torchOn, toggleTorch, zoom, changeZoom } = useCamera(open && cameraOn, handle);

  // Pressing Enter in the box (a barcode scanner does this) handles the typed text as a scanned code.
  const submitTyped = (e) => {
    e.preventDefault();
    if (typed.trim()) handle(typed.trim());
    setTyped("");
    if (!cameraOn) typedRef.current?.focus(); // ready for the next card at once
  };

  // A USB / Bluetooth barcode scanner "types" the code and presses Enter, so the box must always be ready:
  // it is focused when scanning starts and takes the focus back when the teacher taps on empty space.
  useEffect(() => {
    if (open && !cameraOn) typedRef.current?.focus(); // not with the camera on: it would pop the phone keyboard open
  }, [open, cameraOn]);
  // If the box loses focus because the teacher tapped empty space, give it back (scanner mode only).
  const keepFocus = (e) => {
    const next = e.relatedTarget;
    if (open && !cameraOn && !next) setTimeout(() => typedRef.current?.focus(), 0);
  };

  // Panel layout: header with Start / Stop button, then (when open) camera, torch / zoom, the typing box and the result log.
  return (
    <section className="scan-panel" aria-label={title}>
      {/* Title, help text and the Start / Stop button */}
      <div className="scan-head">
        <div>
          <b>{title}</b>
          <div className="muted small">{help}</div>
        </div>
        <button type="button" className="btn secondary sm" onClick={() => { primeAudio(); setOpen((o) => !o); }} aria-expanded={open}>
          {open ? "Stop scanning" : "Start scanning"}
        </button>
      </div>
      {open && (
        <div className="scan-body">
          <label className="scan-cam-toggle">
            <input type="checkbox" checked={cameraOn} onChange={(e) => setCameraOn(e.target.checked)} /> Use the camera
            <span className="muted small"> (switch off if you use a USB or Bluetooth barcode scanner)</span>
          </label>
          {cameraOn && (cameraError ? <div className="note warn">{cameraError}</div> : <video ref={videoRef} className="scan-video" playsInline muted />)}
          {!cameraOn && <div className="note">Barcode scanner mode: click in the box below once, then scan the cards. Each card is marked as it is scanned.</div>}
          {(caps.torch || caps.zoom) && (
            <div className="scan-tools">
              {caps.torch && <button type="button" className="btn secondary sm" onClick={toggleTorch} aria-pressed={torchOn}>{torchOn ? "Light off" : "Light on"}</button>}
              {caps.zoom && (
                <label>Zoom
                  <input type="range" min={caps.zoom.min} max={caps.zoom.max} step={caps.zoom.step} value={zoom} onChange={(e) => changeZoom(Number(e.target.value))} />
                </label>
              )}
            </div>
          )}
          <form onSubmit={submitTyped} className="scan-type">
            <label htmlFor="scan-typed" className="sr-only">Staff ID, roll number or scanner input</label>
            <input id="scan-typed" ref={typedRef} onBlur={keepFocus} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={noun === "student" ? "Scan with the barcode scanner, or type the roll number + Enter" : "Scan with the barcode scanner, or type the Staff ID + Enter"} autoComplete="off" />
            <button className="btn secondary sm">Mark present</button>
          </form>
          <ul className="scan-log" aria-live="polite">
            {log.map((l) => (
              <li key={l.id} className={l.kind}>{l.student && <StudentPhoto student={l.student} size={l.id === log[0].id ? 80 : 32} />}<span>{l.text}</span></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
