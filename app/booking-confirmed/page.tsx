"use client";

import Link from "next/link";

export default function BookingConfirmedPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--color-ink)", display: "flex", flexDirection: "column" }}>
      <div aria-hidden style={{ position: "fixed", top: "-10%", right: "0", width: "50%", height: "60%", background: "radial-gradient(ellipse, rgba(200,16,46,0.06) 0%, transparent 60%)", pointerEvents: "none" }} />

      <header style={{ padding: "1.25rem clamp(1.5rem, 4vw, 3rem)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/thprebrandlogo2.png" alt="THP" style={{ height: "36px", width: "auto", filter: "brightness(0) invert(1)" }} />
      </header>

      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem clamp(1.5rem, 5vw, 4rem)" }}>
        <div style={{ width: "100%", maxWidth: "520px" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(200,16,46,0.12)", border: "1px solid rgba(200,16,46,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "2rem" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c8102e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>

          <p style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.7rem", letterSpacing: "0.2em", color: "var(--color-red)", textTransform: "uppercase", marginBottom: "1rem" }}>
            Call booked
          </p>

          <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 400, color: "#fff", textTransform: "uppercase", lineHeight: 1.05, marginBottom: "1.25rem" }}>
            You&apos;re on<br />the calendar.
          </h1>

          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-body), sans-serif", lineHeight: 1.75, marginBottom: "0.75rem", maxWidth: "46ch" }}>
            THP has been notified. He will review your application before the call and come prepared.
          </p>

          <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-body), sans-serif", lineHeight: 1.6, marginBottom: "2.5rem", maxWidth: "46ch" }}>
            Check your email for the calendar invite. If you have not applied yet, do that now so THP has your full picture before you speak.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Link href="/apply"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "54px", background: "var(--color-red)", color: "#fff", borderRadius: "8px", fontSize: "1rem", fontWeight: 700, textDecoration: "none", fontFamily: "var(--font-body), sans-serif", letterSpacing: "0.02em" }}>
              Complete your application →
            </Link>
            <Link href="/"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "44px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.4)", borderRadius: "8px", fontSize: "0.875rem", textDecoration: "none", fontFamily: "var(--font-body), sans-serif" }}>
              Back to home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
