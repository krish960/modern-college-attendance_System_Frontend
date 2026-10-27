/*
 * StudentPhoto
 * What it is: shows a student's photo, or a grey dummy picture when there is none.
 * Exports: StudentPhoto (default; props student, size, className) and DummyPhoto (the grey silhouette; props size, className).
 * The photo is fetched from the server with the signed-in user's token and kept in a memory cache, so it is downloaded only once per version.
 * Used in: RegisterCardsModal, ScanPanel, PhotoField, LecturePage and StudentsPage.
 */
import { useEffect, useState } from "react";
import api from "../api/client";

// cache keeps finished photo addresses; pending keeps downloads still running (so the same photo is not requested twice).
const cache = new Map(); // "id:version" -> object URL (or "" when there is no photo)
const pending = new Map();

// Get the photo address for a student and photo version: from the cache, from a running download, or start a new download.
// If the download fails the result is "" (the dummy picture is shown).
function load(id, version) {
  const key = `${id}:${version}`;
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (!pending.has(key)) {
    pending.set(
      key,
      api
        .get(`/students/${id}/photo/`, { responseType: "blob" })
        .then((r) => {
          const url = URL.createObjectURL(r.data);
          cache.set(key, url);
          return url;
        })
        .catch(() => "")
        .finally(() => pending.delete(key))
    );
  }
  return pending.get(key);
}

/** The dummy picture shown when a student has no photo yet: a plain head-and-shoulders silhouette in a square frame. */
export function DummyPhoto({ size = 40, className = "" }) {
  return (
    <span className={`avatar dummy ${className}`} style={{ width: size, height: size }} role="img" aria-label="No photo yet">
      <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true">
        <rect width="40" height="40" fill="#dfe5e1" />
        <circle cx="20" cy="15" r="7" fill="#9fb0aa" />
        <path d="M5 40c0-9 6.5-14 15-14s15 5 15 14z" fill="#9fb0aa" />
      </svg>
    </span>
  );
}

/** A student's photo (fetched with the signed-in user's token, so it is never public) or their initials. */
export default function StudentPhoto({ student, size = 40, className = "" }) {
  // photo_version changes when the photo is replaced, so a new photo is fetched.
  const { id, name, has_photo: hasPhoto, photo_version: version = 0 } = student || {};
  // src = address of the photo to show. It starts from the cache if the photo is already there.
  const [src, setSrc] = useState(() => (hasPhoto ? cache.get(`${id}:${version}`) || "" : ""));
  // Load the photo when the student or photo version changes. `live` stops an old answer from replacing a newer one.
  useEffect(() => {
    let live = true;
    if (!hasPhoto) {
      setSrc("");
      return undefined;
    }
    load(id, version).then((url) => live && setSrc(url));
    return () => {
      live = false;
    };
  }, [id, hasPhoto, version]);
  // Show the photo if we have it, otherwise the dummy picture.
  return src ? (
    <img className={`avatar ${className}`} style={{ width: size, height: size }} src={src} alt={`Photo of ${name}`} />
  ) : (
    <DummyPhoto size={size} className={className} />
  );
}
