/*
 * SearchSelect
 * What it is: a dropdown you can type into, to filter a long list. Works like a normal <select> (value, onChange).
 * Props: id, value, onChange(textValue), options ([{value, label}]), placeholder, disabled, invalid, describedBy (accessibility), allLabel (text of the first "all / none" row).
 * Keys: Arrow Up / Down move, Enter picks, Escape closes.
 * Used in: FormModal and FilterSelect (ui.jsx) when a list is long (see SEARCH_FROM at the bottom).
 */
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A select you can type into: with many teachers or classes, type a few letters of the name instead of scrolling.
 * Same value/onChange as a <select> (value is the option's value as text). Arrow keys, Enter and Escape work.
 */
export default function SearchSelect({ id, value, onChange, options, placeholder = "Select…", disabled, invalid, describedBy, allLabel }) {
  // open = list is visible, text = what the user typed to filter, hot = index of the highlighted row.
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [hot, setHot] = useState(0);
  // box = whole component (to detect outside clicks), field = the input (to find where to place the list).
  const box = useRef(null);
  const field = useRef(null);
  const [place, setPlace] = useState(null); // where the list floats (fixed, so a modal's edge cannot cut it off)
  // selected = the option that matches the current value (its label is shown in the box).
  const selected = options.find((o) => String(o.value) === String(value));

  // shown = the first "all / none" row plus the options whose label contains every typed word.
  const shown = useMemo(() => {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = options.filter((o) => words.every((w) => String(o.label).toLowerCase().includes(w)));
    return [{ value: "", label: allLabel || placeholder, none: true }, ...hits];
  }, [options, text, allLabel, placeholder]);

  // Highlight the first match while typing, or the top row when the text is empty.
  // Highlight the first match while typing, or the top row when the text is empty.
  useEffect(() => setHot(text ? Math.min(1, shown.length - 1) : 0), [text, shown.length]);
  // While open: place the list under the box (or above it if there is little room) and keep it there on scroll or resize.
  useEffect(() => {
    if (!open) return undefined;
    const where = () => {
      const r = field.current.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - 10;
      const up = below < 160 && r.top > below; // little room underneath: open upwards
      const room = Math.max(120, Math.min(260, up ? r.top - 10 : below));
      setPlace({ left: r.left, width: r.width, maxHeight: room, ...(up ? { bottom: window.innerHeight - r.top + 2 } : { top: r.bottom + 2 }) });
    };
    where();
    const onScroll = (e) => { if (!box.current?.contains(e.target)) where(); };
    window.addEventListener("resize", where);
    window.addEventListener("scroll", onScroll, true);
    return () => { window.removeEventListener("resize", where); window.removeEventListener("scroll", onScroll, true); };
  }, [open]);
  // While open: close the list when the user clicks outside it.
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!box.current?.contains(e.target)) { setOpen(false); setText(""); } };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  // Choose an option: send its value up and close the list.
  const pick = (o) => {
    onChange(String(o.value));
    setOpen(false);
    setText("");
  };
  // Keyboard support: arrows move the highlight, Enter picks it, Escape closes the list.
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHot((h) => Math.min(h + 1, shown.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHot((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && open) { e.preventDefault(); if (shown[hot]) pick(shown[hot]); }
    else if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); setText(""); }
  };

  // An input plus a floating list. onMouseDown (not click) is used so the pick happens before the input loses focus.
  return (
    <div className="ss" ref={box}>
      <input
        ref={field} id={id} type="text" role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list"
        aria-invalid={invalid} aria-describedby={describedBy} disabled={disabled} autoComplete="off"
        value={open ? text : selected ? selected.label : ""}
        placeholder={open ? "Type to search…" : (allLabel || placeholder)}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onKeyDown={onKey}
      />
      {open && place && (
        <ul className="ss-list" id={`${id}-list`} role="listbox" style={place}>
          {shown.length === 1 && text && <li className="ss-empty">No match for "{text}"</li>}
          {shown.map((o, i) => (
            <li
              key={`${o.value}-${i}`} role="option" aria-selected={String(o.value) === String(value)}
              className={`${i === hot ? "hot" : ""} ${o.none ? "none" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setHot(i)}
              ref={(el) => { if (el && i === hot) el.scrollIntoView?.({ block: "nearest" }); }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// a plain <select> is fine for a short list; from this many options on, typing is faster than scrolling
export const SEARCH_FROM = 8;
