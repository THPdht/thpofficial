"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, signOut } from "@/lib/auth";
import type { StoredUser } from "@/lib/auth";

const CAL_LINK = "https://cal.com/ali-filali-uks4xi/30min";
const STRIPE_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? "";

export default function PendingPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) { router.replace("/login"); return; }
    if (u.status === "active" || u.status === "alumni") { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  const handleSignOut = () => { signOut(); router.push("/"); };

  if (!user) return null;

  const firstName = user.name?.split(" ")[0] ?? "";

  return (
    <div style={{ minHeight: "100dvh", background: "var(--color-ink)", display: "flex", flexDirection: "column" }}>
      {/* Subtle glow */}
      <div aria-hidden style={{ position: "fixed", top: "-10%", right: "0", width: "50%", height: "60%", background: "radial-gradient(ellipse, rgba(200,16,46,0.06) 0%, transparent 60%)", pointerEvents: "none" }} />

      <header style={{ padding: "1.25rem clamp(1.5rem, 4vw, 3rem)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/thprebrandlogo2.png" alt="THP" style={{ height: "36px", width: "auto", filter: "brightness(0) invert(1)" }} />
        <button onClick={handleSignOut} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: "0.8125rem", cursor: "pointer", fontFamily: "var(--font-body), sans-serif" }}>
          Sign out
        </button>
      </header>

      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem clamp(1.5rem, 5vw, 4rem)" }}>
        <div style={{ width: "100%", maxWidth: "520px" }}>
          {/* Tag */}
          <p style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.7rem", letterSpacing: "0.2em", color: "var(--color-red)", textTransform: "uppercase", marginBottom: "1rem" }}>
            Application received
          </p>

          {/* Headline */}
          <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 400, color: "#fff", textTransform: "uppercase", lineHeight: 1.05, marginBottom: "1.25rem" }}>
            {firstName ? `${firstName}, you're` : "You're"}<br />one step away.
          </h1>

          {/* CTA body */}
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-body), sans-serif", lineHeight: 1.75, marginBottom: "2rem", maxWidth: "46ch" }}>
            If you are ready to get one on one right away with THP, make your payment below and he will send you the intake form for the deep diagnostic before we start working together.
          </p>

          {/* Primary CTA */}
          {STRIPE_LINK ? (
            <a
              href={STRIPE_LINK}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "100%", height: "54px", background: "var(--color-red)",
                color: "#fff", borderRadius: "8px", fontSize: "1rem", fontWeight: 700,
                textDecoration: "none", fontFamily: "var(--font-body), sans-serif",
                letterSpacing: "0.02em", marginBottom: "0.875rem",
              }}
            >
              Make payment now →
            </a>
          ) : (
            <a
              href="https://t.me/THPprotocol"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "100%", height: "54px", background: "var(--color-red)",
                color: "#fff", borderRadius: "8px", fontSize: "1rem", fontWeight: 700,
                textDecoration: "none", fontFamily: "var(--font-body), sans-serif",
                letterSpacing: "0.02em", marginBottom: "0.875rem",
              }}
            >
              Message THP directly →
            </a>
          )}

          {/* Secondary: book a call */}
          <a
            href={CAL_LINK}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "100%", height: "48px", background: "transparent",
              border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)",
              borderRadius: "8px", fontSize: "0.9rem", fontWeight: 500,
              textDecoration: "none", fontFamily: "var(--font-body), sans-serif",
            }}
          >
            Or book a discovery call first
          </a>
        </div>
      </main>
    </div>
  );
}
