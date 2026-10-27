/*
 * PhotoField
 * What it is: the photo part of the student form: take a photo with the camera or choose a file, see a preview, and discard or remove it.
 * Props: value (null = unchanged, a Blob = new photo, { remove: true } = delete the current photo), onChange(newValue), student (existing student, to show the current photo).
 * Used in: FormModal (when a field has type "photo").
 */
import { useEffect, useRef, useState } from "react";
import StudentPhoto, { DummyPhoto } from "./StudentPhoto";

// Longest side of the saved picture, in pixels.
const MAX = 480;

/** Shrinks any picture to at most 480 px and returns a JPEG Blob (keeps uploads small and fast). */
async function toJpeg(source, width, height) {
  const scale = Math.min(1, MAX / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no image"))), "image/jpeg", 0.85));
}

/**
 * Photo input for the student forms. value: null (unchanged), a Blob (new photo) or { remove: true }.
 * `student` is the existing student (edit form) so the current photo can be shown.
 */
export default function PhotoField({ value, onChange, student }) {
  // preview = temporary address of the new photo for the <img>, camera = camera is open, error = message for the user.
  const [preview, setPreview] = useState("");
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState("");
  // videoRef = the live camera view, streamRef = the camera stream (to stop it later), fileRef = hidden file input.
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);

  // Make a preview address when a new photo (Blob) is chosen, and free it when it changes or the form closes.
  useEffect(() => {
    if (!(value instanceof Blob)) {
      setPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  // Open the front camera while `camera` is true; stop it again on cleanup. On failure show a message and close the camera.
  useEffect(() => {
    if (!camera) return undefined;
    let stopped = false;
    setError("");
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("The camera needs https or localhost. Use Choose file instead.");
        setCamera(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      } catch {
        setError("The camera could not be started. Use Choose file instead.");
        setCamera(false);
      }
    })();
    return () => {
      stopped = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [camera]);

  // Capture: take the current video frame, shrink it to a JPEG and hand it to the form.
  const snap = async () => {
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    onChange(await toJpeg(v, v.videoWidth, v.videoHeight));
    setCamera(false);
  };

  // File chosen: read it (respecting its rotation), shrink it to a JPEG and hand it to the form.
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      onChange(await toJpeg(bitmap, bitmap.width, bitmap.height));
    } catch {
      setError("This file could not be read as a picture. Use a JPEG or PNG photo.");
    }
  };

  // hasCurrent = the student already has a saved photo that is not marked for removal.
  const hasCurrent = student?.has_photo && !(value && value.remove);
  // Layout: preview (new photo, current photo or dummy), the buttons, then the camera view when open.
  return (
    <div className="photo-field">
      <div className="photo-row">
        {preview ? (
          <img className="avatar" style={{ width: 72, height: 72 }} src={preview} alt="New photo" />
        ) : hasCurrent ? (
          <StudentPhoto student={student} size={72} />
        ) : (
          <DummyPhoto size={72} />
        )}
        {/* Buttons: camera, choose file, and discard / remove (shown only when there is a photo) */}
        <div className="photo-actions">
          <button type="button" className="btn secondary sm" onClick={() => setCamera((c) => !c)} aria-expanded={camera}>{camera ? "Cancel camera" : "Take photo"}</button>
          <button type="button" className="btn secondary sm" onClick={() => fileRef.current?.click()}>Choose file</button>
          {(preview || hasCurrent) && (
            <button type="button" className="btn ghost sm" onClick={() => onChange(student?.has_photo && !preview ? { remove: true } : null)}>
              {preview ? "Discard new photo" : "Remove photo"}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} hidden />
        </div>
      </div>
      {camera && (
        <div className="photo-camera">
          <video ref={videoRef} className="scan-video" playsInline muted />
          <button type="button" className="btn sm" onClick={snap}>Capture</button>
        </div>
      )}
      {value && value.remove && <span className="help">The photo will be removed when you save.</span>}
      {error && <span className="form-error" role="alert">{error}</span>}
    </div>
  );
}
