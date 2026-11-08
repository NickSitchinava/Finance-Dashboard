function passwordStrength(password: string) {
  return password ? Math.min(4, [
    password.length >= 8,
    password.length >= 12,
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /\d/.test(password) && /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length) : 0;
}

export function PasswordStrength({ password, className = "", guidance = false }: { password: string; className?: string; guidance?: boolean }) {
  if (!password) return null;
  const strength = passwordStrength(password);
  const tone = strength <= 1 ? "weak" : strength === 2 ? "fair" : strength === 3 ? "good" : "strong";
  return <div className={`settings-strength settings-strength--${tone} ${className}`} aria-live="polite">
    <div className="settings-strength__bars" aria-hidden="true">
      {[1, 2, 3, 4].map((n) => <i key={n} className={Math.max(1, strength) >= n ? "is-filled" : ""} />)}
    </div>
    <span>{["Weak", "Weak", "Fair", "Good", "Strong"][strength]} password</span>
    {guidance && <small>Longer passwords with a mix of characters are harder to guess.</small>}
  </div>;
}
