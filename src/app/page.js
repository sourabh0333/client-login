import Link from "next/link";
import LoginForm from "@/components/login-form";
import ParkPanel from "@/components/park/park-panel";
import styles from "./page.module.css";

export const metadata = {
  title: "Sign in",
  description: "Sign in to your client account.",
};

export default function LoginPage() {
  return (
    <div className={styles.shell}>
      <div className={styles.backdrop}>
        {/* The scene frames itself around this card so nothing important hides behind it. */}
        <ParkPanel avoid="#auth-card" />
      </div>

      <main id="auth-card" className={styles.card}>
        <Link href="/" className={styles.brand} aria-label="Client portal home">
          <span className={styles.mark} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3c4.5 2.3 7 5.8 7 10a7 7 0 0 1-14 0c0-4.2 2.5-7.7 7-10Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path d="M12 21V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          Client portal
        </Link>

        <div className={styles.content}>
          <h1 className={styles.heading}>Welcome back</h1>
          <p className={styles.lede}>Sign in to see your account, documents and messages.</p>
          <LoginForm />
        </div>

        <footer className={styles.footer}>
          <span>
            New here? <a href="#contact">Request access</a>
          </span>
          <nav aria-label="Help and legal">
            <a href="#help">Help</a>
            <a href="#privacy">Privacy</a>
          </nav>
        </footer>
      </main>
    </div>
  );
}
