import Link from "next/link";
import ParkPanel from "@/components/park/park-panel";
import styles from "./page.module.css";

export const metadata = {
  title: "Client Portal Demo",
  description: "An interactive client portal concept preview. No credentials are collected.",
};

export default function DemoPage() {
  return (
    <div className={styles.shell}>
      {/* 30% demo context, 70% explorable park. */}
      <div className={styles.stage}>
        <ParkPanel />
      </div>

      <main id="demo-card" className={styles.card}>
        <Link href="/" className={styles.brand} aria-label="Client portal demo home">
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
          Client portal demo
        </Link>

        <div className={styles.content}>
          <p className={styles.eyebrow}>Interactive demo</p>
          <h1 className={styles.heading}>A calmer way to explore your client portal.</h1>
          <p className={styles.lede}>
            This concept preview pairs a simple portal layout with an explorable park scene for a more welcoming client experience.
          </p>

          <section className={styles.details} aria-labelledby="demo-features">
            <h2 id="demo-features">Designed for review</h2>
            <ul>
              <li>A focused, approachable portal layout</li>
              <li>An interactive 3D environment</li>
              <li>Accessible motion and keyboard controls</li>
            </ul>
          </section>

          <p className={styles.notice}>
            <strong>Demo only.</strong> This preview does not collect or store credentials, and no account access is available here.
          </p>
        </div>

        <footer className={styles.footer}>
          <span>A concept preview for client review.</span>
          <span>No personal data is collected.</span>
        </footer>
      </main>
    </div>
  );
}
