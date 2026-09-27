"use client";

import { useId, useState } from "react";
import styles from "./login-form.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = "Enter your email address.";
  else if (!EMAIL_RE.test(email.trim())) errors.email = "Enter an email address like name@company.com.";
  if (!password) errors.password = "Enter your password.";
  else if (password.length < 8) errors.password = "Passwords are at least 8 characters.";
  return errors;
}

const Icon = {
  mail: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4.5" y="10" width="15" height="10" rx="2.5" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeOff: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.6A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.7M6.6 6.7C3.9 8.4 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.1-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  ),
  passkey: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 19.5c.6-3.3 3-5.5 6-5.5 1.3 0 2.5.4 3.4 1.1" />
      <circle cx="17.5" cy="13.5" r="2.5" />
      <path d="M17.5 16v4.5l1.3-1-1.3-1" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5v.01" />
    </svg>
  ),
};

// Provider marks, drawn to each brand's published colours.
const GoogleMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.brandMark}>
    <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" />
    <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z" />
    <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.7 9.4 5.9 12 5.9Z" />
  </svg>
);

const MicrosoftMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.brandMark}>
    <path fill="#F25022" d="M3 3h8.5v8.5H3z" />
    <path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" />
    <path fill="#00A4EF" d="M3 12.5h8.5V21H3z" />
    <path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" />
  </svg>
);

export default function LoginForm() {
  const id = useId();
  const [values, setValues] = useState({ email: "", password: "", remember: true });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [status, setStatus] = useState({ state: "idle", message: "" });

  const update = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    const next = { ...values, [field]: value };
    setValues(next);
    if (touched[field]) setErrors(validate(next));
  };

  const blur = (field) => () => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors(validate(values));
  };

  const trackCaps = (e) => setCapsLock(Boolean(e.getModifierState?.("CapsLock")));

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    setTouched({ email: true, password: true });
    if (Object.keys(found).length) {
      document.getElementById(`${id}-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setStatus({ state: "loading", message: "" });
    // Connect your authentication service here.
    await new Promise((r) => setTimeout(r, 1200));
    setStatus({ state: "done", message: "Signed in. Connect your authentication service to continue." });
  };

  // Passkey and single sign-on need your identity provider; these hand off to it.
  const handoff = (method) => () =>
    setStatus({ state: "info", message: `${method} sign-in needs to be connected to your identity provider.` });

  const fieldError = (field) => touched[field] && errors[field];
  const loading = status.state === "loading";
  const done = status.state === "done";

  return (
    <div className={styles.wrap}>
      <div className={styles.alt}>
        <button type="button" className={styles.passkey} onClick={handoff("Passkey")}>
          <span className={styles.icon}>{Icon.passkey}</span>
          Sign in with a passkey
        </button>
        <div className={styles.sso}>
          <button type="button" className={styles.provider} onClick={handoff("Google")}>
            <GoogleMark />
            Google
          </button>
          <button type="button" className={styles.provider} onClick={handoff("Microsoft")}>
            <MicrosoftMark />
            Microsoft
          </button>
        </div>
      </div>

      <div className={styles.divider} role="separator">
        <span>or use your email</span>
      </div>

      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.field}>
          <label htmlFor={`${id}-email`}>Email</label>
          <div className={styles.control}>
            <span className={styles.lead}>{Icon.mail}</span>
            <input
              id={`${id}-email`}
              type="email"
              name="email"
              autoComplete="username webauthn"
              inputMode="email"
              placeholder="name@company.com"
              value={values.email}
              onChange={update("email")}
              onBlur={blur("email")}
              aria-invalid={Boolean(fieldError("email"))}
              aria-describedby={fieldError("email") ? `${id}-email-error` : undefined}
            />
          </div>
          {fieldError("email") && (
            <p id={`${id}-email-error`} className={styles.error}>
              {Icon.alert}
              {errors.email}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor={`${id}-password`}>Password</label>
            <a href="#forgot" className={styles.link}>
              Forgot password?
            </a>
          </div>
          <div className={styles.control}>
            <span className={styles.lead}>{Icon.lock}</span>
            <input
              id={`${id}-password`}
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={values.password}
              onChange={update("password")}
              onBlur={(e) => {
                blur("password")(e);
                setCapsLock(false);
              }}
              onKeyUp={trackCaps}
              onKeyDown={trackCaps}
              aria-invalid={Boolean(fieldError("password"))}
              aria-describedby={
                [fieldError("password") && `${id}-password-error`, capsLock && `${id}-caps`].filter(Boolean).join(" ") || undefined
              }
            />
            <button
              type="button"
              className={styles.reveal}
              onClick={() => setShowPassword((s) => !s)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? Icon.eyeOff : Icon.eye}
            </button>
          </div>
          {capsLock && (
            <p id={`${id}-caps`} className={styles.hint}>
              Caps Lock is on.
            </p>
          )}
          {fieldError("password") && (
            <p id={`${id}-password-error`} className={styles.error}>
              {Icon.alert}
              {errors.password}
            </p>
          )}
        </div>

        <label className={styles.check}>
          <input type="checkbox" checked={values.remember} onChange={update("remember")} />
          <span className={styles.box} aria-hidden="true">
            {Icon.check}
          </span>
          <span>Keep me signed in on this device</span>
        </label>

        <button type="submit" className={styles.submit} disabled={loading} aria-busy={loading} data-state={status.state}>
          {loading ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Signing in…
            </>
          ) : done ? (
            <>
              <span className={styles.icon}>{Icon.check}</span>
              Signed in
            </>
          ) : (
            <>
              Sign in
              <span className={styles.icon}>{Icon.arrow}</span>
            </>
          )}
        </button>

        <p className={styles.status} role="status" aria-live="polite" data-state={status.state}>
          {status.message}
        </p>
      </form>
    </div>
  );
}
