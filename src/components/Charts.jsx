/*
 * Charts.jsx
 * What it is: two simple charts drawn with plain SVG (no chart library).
 * Exports: TrendChart (attendance % per day as columns) and BarList (horizontal bars, one row per item).
 * Used in: pages/admin/AdminDashboard.jsx and pages/hod/HodDashboard.jsx.
 */
import { fmtPct } from "../utils/format";

// Turns "2026-10-27" into "27/10" for the axis labels.
const shortDay = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

/**
 * Daily attendance % as columns (one per day). `points` = [{ date, percentage, present, total }].
 * Days with no submitted lecture are drawn as an empty slot. Pure SVG, no chart library.
 */
export function TrendChart({ points, threshold = 75, title = "Attendance, last 14 days" }) {
  // Size of the drawing and its margins (L left, R right, T top, B bottom). plotW / plotH = size of the plot area.
  const W = 640, H = 220, L = 34, R = 8, T = 12, B = 28;
  const plotW = W - L - R, plotH = H - T - B;
  // slot = width given to one day, barW = width of one column (at most 26).
  const slot = plotW / points.length, barW = Math.min(26, slot * 0.62);
  // Converts a percentage (0 to 100) into a vertical position in the drawing (100 is at the top).
  const y = (pct) => T + plotH * (1 - pct / 100);
  // hasData = at least one day has a percentage.
  const hasData = points.some((p) => p.percentage !== null);
  // Chart: title, the SVG (or a message if there is no data), then the colour legend.
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      {!hasData ? (
        <p className="muted chart-empty">No attendance has been submitted in this period yet.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${points.filter((p) => p.percentage !== null).map((p) => `${shortDay(p.date)}: ${fmtPct(p.percentage)}`).join(", ")}`}>
          {/* Grid lines and the numbers on the left axis. */}
          {[0, 25, 50, 75, 100].map((g) => (
            <g key={g}>
              <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} className="grid" />
              <text x={L - 6} y={y(g) + 3.5} textAnchor="end" className="axis">{g}</text>
            </g>
          ))}
          {/* The threshold line (default 75%). */}
          <line x1={L} x2={W - R} y1={y(threshold)} y2={y(threshold)} className="threshold" />
          {/* One column per day. cx = centre of the day's slot. Days without data are left empty. */}
          {points.map((p, i) => {
            const cx = L + slot * i + slot / 2;
            return (
              <g key={p.date}>
                {p.percentage !== null && (
                  <rect x={cx - barW / 2} y={y(p.percentage)} width={barW} height={plotH * (p.percentage / 100)}
                    className={p.percentage < threshold ? "bar-low" : "bar-ok"} rx="2">
                    <title>{`${shortDay(p.date)}: ${fmtPct(p.percentage)} (${p.present} of ${p.total} marks present)`}</title>
                  </rect>
                )}
                {(i % 2 === 0 || points.length < 9) && <text x={cx} y={H - 9} textAnchor="middle" className="axis">{shortDay(p.date)}</text>}
              </g>
            );
          })}
        </svg>
      )}
      <div className="chart-legend"><span className="sw ok" /> {threshold}% or more <span className="sw low" /> below {threshold}% <span className="sw line" /> {threshold}% line</div>
    </figure>
  );
}

/** Horizontal bars, one row per item: [{ label, value (0-100 or null), note }]. */
// BarList: each row = label, a bar as wide as the percentage (capped at 100), and the value. Bars under the threshold get the "low" style.
export function BarList({ items, threshold = 75, title }) {
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      {items.length === 0 ? (
        <p className="muted chart-empty">Nothing to compare yet.</p>
      ) : (
        <ul className="barlist">
          {items.map((it) => (
            <li key={it.label}>
              <span className="bl-label" title={it.label}>{it.label}</span>
              <span className="bl-track" aria-hidden="true">
                {it.value !== null && <span className={it.value < threshold ? "low" : ""} style={{ width: `${Math.min(100, it.value)}%` }} />}
              </span>
              <span className="bl-value num">{it.value === null ? "–" : fmtPct(it.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
