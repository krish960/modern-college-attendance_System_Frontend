/**
 * Shows a short piece of text in a table cell. When the text is long (more than `limit` characters or more
 * than 3 lines) only the beginning is shown, followed by a "More" button that opens a popup with the full text.
 * This keeps tables short even when someone writes a very long reason.
 * Props: text = the text, title = heading of the popup, limit = how many characters to show before "More", quote = wrap in quotes.
 */
import { useState } from "react";
import { Modal } from "./Modal";

export default function LongText({ text, title = "Full text", limit = 90, quote = false }) {
  const [open, setOpen] = useState(false);
  const value = String(text ?? "");
  const lines = value.split("\n");
  const tooLong = value.length > limit || lines.length > 3;
  // The part that stays visible: the first lines, cut at `limit` characters.
  const shown = tooLong ? `${lines.slice(0, 3).join("\n").slice(0, limit).trimEnd()}…` : value;
  const wrap = (t) => (quote ? `“${t}”` : t);
  return (
    <>
      <span className="long-text">{wrap(shown)}</span>
      {tooLong && (
        <>
          {" "}
          <button type="button" className="link-btn" onClick={() => setOpen(true)}>More</button>
        </>
      )}
      {open && (
        <Modal title={title} onClose={() => setOpen(false)} footer={<button type="button" className="btn" onClick={() => setOpen(false)}>Close</button>}>
          <div className="modal-body">
            {/* the whole text, with the line breaks the person typed */}
            <p className="long-text-full">{value}</p>
          </div>
        </Modal>
      )}
    </>
  );
}
