"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { getCurrentUser, signOut } from "@/lib/auth";
import type { StoredUser } from "@/lib/auth";


export default function PendingPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  useEffect(() => {
    const u = getCurrentUser();
    if (!u) { router.replace("/login"); return; }
    if (u.status === "new") { router.replace("/onboarding"); return; }
    if (u.status === "active" || u.status === "alumni") { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  const handleSignOut = () => { signOut(); router.push("/"); };

  if (!user) return null;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      {/* Subtle glow */}
      <div aria-hidden style={{ position: "absolute", top: "-10%", right: "0", width: "50%", height: "60%", background: "radial-gradient(ellipse, color-mix(in srgb, var(--color-red) 5%, transparent) 0%, transparent 60%)", pointerEvents: "none" }} />

      <header style={{ padding: "1.25rem clamp(1.5rem, 4vw, 3rem)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.12em", color: "var(--primary)", textTransform: "uppercase" }}>THP</span>
        <button onClick={handleSignOut} style={{ background: "none", border: "none", color: "var(--dim)", fontSize: "0.8125rem", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Sign out</button>
      </header>

      <main style={{ flex: 1, padding: "3rem clamp(1.5rem, 5vw, 4rem)", maxWidth: "680px", width: "100%", margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
          {/* Status badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.375rem 0.875rem", background: "color-mix(in srgb, var(--color-red) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--color-red) 20%, transparent)", borderRadius: "100px", marginBottom: "2rem" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent)", animation: "pulse 2s ease infinite" }} />
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
            <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--primary)", letterSpacing: "0.04em" }}>Profile received</span>
          </div>

          <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(1.75rem, 4vw, 2.75rem)", fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: "0.875rem", textWrap: "balance" }}>
            THP is reviewing<br />your profile now.
          </h1>
          <p style={{ fontSize: "1rem", color: "var(--muted)", fontWeight: 300, lineHeight: 1.7, marginBottom: "2.5rem", maxWidth: "52ch", textWrap: "pretty" }}>
            Based on what you have shared, your protocol is being built. You will have access to your custom daily tracker as soon as it is live.
          </p>

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Dashboard preview */}
            <div style={{ padding: "1rem 1.25rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ink)", marginBottom: "0.2rem" }}>Curious what your dashboard will look like?</p>
                <p style={{ fontSize: "0.8125rem", color: "var(--dim)", fontWeight: 300 }}>See a preview while you wait.</p>
              </div>
              <a href="/dashboard" style={{ flexShrink: 0, height: "36px", padding: "0 1rem", background: "none", border: "1px solid var(--border)", borderRadius: "7px", color: "var(--muted)", fontSize: "0.8125rem", fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", transition: "border-color 150ms, color 150ms" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}>
                Preview →
              </a>
            </div>

            <div style={{ padding: "1rem 1.25rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "10px" }}>
              <p style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300, lineHeight: 1.6 }}>
                Once your protocol is ready, you&apos;ll have full access to message THP directly through the portal.
              </p>
            </div>

          </div>
        </motion.div>
      </main>
    </div>
  );
}

