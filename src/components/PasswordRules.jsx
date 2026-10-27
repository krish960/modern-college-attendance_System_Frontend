/**
 * Live checklist of the password rules, mirrored from backend/accounts/passwords.py.
 * The server is the real judge; this only shows the person what is still missing while they type.
 */
export const PASSWORD_RULES = [
  ["At least 10 characters", (p) => p.length >= 10],
  ["One capital letter (A-Z)", (p) => /[A-Z]/.test(p)],
  ["One small letter (a-z)", (p) => /[a-z]/.test(p)],
  ["One digit (0-9)", (p) => /[0-9]/.test(p)],
  ["One symbol such as ! @ # $ %", (p) => /[^A-Za-z0-9]/.test(p)],
];

export const passwordIsStrong = (p) => PASSWORD_RULES.every(([, ok]) => ok(p));

export function PasswordRules({ value }) {
  const passed = PASSWORD_RULES.filter(([, ok]) => ok(value)).length;
  const level = passed <= 2 ? "weak" : passed < 5 ? "fair" : "strong";
  return (
    <div className="pw-rules">
      {/* the bar fills as more rules are met */}
      <div className={`pw-meter ${level}`} aria-hidden="true"><span style={{ width: `${(passed / PASSWORD_RULES.length) * 100}%` }} /></div>
      <ul aria-label="Password rules">
        {PASSWORD_RULES.map(([text, ok]) => (
          <li key={text} className={ok(value) ? "ok" : ""}>
            <span aria-hidden="true">{ok(value) ? "✓" : "○"}</span> {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
