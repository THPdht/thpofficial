"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentUser, signOut, rowToUser, cacheUser, getClientProtocols, getClientDiagnostics } from "@/lib/auth";
import type { ClientProtocol, ClientDiagnostic } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { StoredUser } from "@/lib/auth";
import type { Protocol } from "@/lib/protocols";
import ProtocolDocumentComponent from "@/components/portal/ProtocolDocument";
import DiagnosticDocumentComponent from "@/components/portal/DiagnosticDocument";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";

const CAL_LINK = "https://www.cal.eu/thp/call";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [showPwaBanner, setShowPwaBanner] = useState(false);
  const [suspended, setSuspended] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const u = getCurrentUser();
    if (!u) { router.replace("/login"); return; }
    if (u.status === "new") { router.replace("/onboarding"); return; }

    // Verify the account still exists and isn't suspended before rendering anything
    supabase.from('users').select('diagnostic_data').eq('email', u.email).maybeSingle().then(({ data }) => {
      if (!isMounted) return;
      if (!data || data.diagnostic_data?.suspended) {
        fetch('/api/log-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: u.email, reason: !data ? 'deleted_access_attempt' : 'suspended_access_attempt' }),
        }).catch(() => {});
        setSuspended(true);
        return;
      }
      // Only populate user state after confirming account is active
      setUser(u);

      // First-time imported client: if active but has never been welcomed,
      // redirect to /welcome so they can upload their existing protocol PDF
      if (u.status === 'active' && !localStorage.getItem(`thp_welcomed_${u.email}`)) {
        // Check if they already have a protocol in the DB
        import('@/lib/auth').then(({ getClientProtocols }) => {
          getClientProtocols(u.email).then(protocols => {
            if (!isMounted) return;
            if (protocols.length === 0) {
              // No protocol yet — show welcome/upload page
              router.replace('/welcome');
            } else {
              // Already has a protocol, mark welcomed and stay
              localStorage.setItem(`thp_welcomed_${u.email}`, '1');
            }
          }).catch(() => {});
        });
        return;
      }

      // Capture timezone on first login
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) {
          fetch('/api/activity-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: u.email, event: 'login' }),
          }).catch(() => {});
          // Also save timezone if not already stored
          if (!localStorage.getItem('thp_tz_saved')) {
            localStorage.setItem('thp_tz_saved', '1');
            void Promise.resolve(supabase.from('users').update({ timezone: tz }).eq('email', u.email));
          }
        }
      } catch { /* ignore */ }
    });

    // PWA install banner - show once on mobile when not already installed
    if (!localStorage.getItem('mn_pwa_shown')) {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isStandalone = (window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
      if (isMobile && !isStandalone) setShowPwaBanner(true);
    }

    // Register service worker and subscribe to push notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(async () => {
          // Request notification permission then subscribe to push
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const { subscribeToPush } = await import('@/lib/push');
            subscribeToPush(u.email, u.password).catch(() => { /* ignore if VAPID not configured */ });
          }
        })
        .catch(() => { /* ignore */ });
    }

    // Real-time: listen for any changes to THIS user's row in Supabase.
    // When THP changes accountStatus, protocolStatus, etc. from admin,
    // it propagates here instantly without requiring a page refresh.
    const userChannel = supabase
      .channel(`user_row:${u.email}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `email=eq.${u.email}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (payload: any) => {
        const updated = rowToUser(payload.new);
        if (updated.diagnosticData?.suspended) {
          fetch('/api/log-access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: updated.email, reason: 'suspended_realtime' }),
          }).catch(() => {});
          setSuspended(true);
          return;
        }
        setSuspended(false);
        cacheUser(updated);
        setUser(updated);
      })
      .subscribe();

    return () => { isMounted = false; supabase.removeChannel(userChannel); };
  }, [router]);

  // Deep-link scroll: ?tab= or ?section= URL param scrolls to section on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("tab") || params.get("section");
    if (!target) return;
    const map: Record<string, string> = {
      protocol: "protocol-section",
      diagnosis: "diagnosis-section",
      "blood-work": "blood-work-section",
      referrals: "referrals-section",
      payments: "payments-section",
    };
    const id = map[target] ?? target + "-section";
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 300);
  }, []);

  const handleSignOut = () => { signOut(); router.push("/"); };

  if (suspended) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/thprebrandlogo2.png" alt="THP" style={{ height: "36px", width: "auto", filter: "brightness(0) invert(1)", marginBottom: "2.5rem" }} />
          <p style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "1.75rem", fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: "0.75rem" }}>Your access has been removed</p>
          <p style={{ fontSize: "0.9375rem", color: "var(--muted)", fontWeight: 300, maxWidth: "34ch", lineHeight: 1.75, marginBottom: "2.5rem" }}>
            Message THP to get set up again
          </p>
          <a
            href="https://t.me/thpofficial"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", height: "44px", padding: "0 1.5rem", background: "var(--primary)", color: "#ffffff", border: "none", borderRadius: "999px", fontSize: "0.9rem", fontWeight: 500, textDecoration: "none", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "background 150ms" }}
          >
            Message THP
          </a>
          <p style={{ marginTop: "2rem", fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300 }}>
            <button onClick={() => { signOut(); router.push("/"); }} style={{ background: "none", border: "none", color: "var(--dim)", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Sign out</button>
          </p>
        </motion.div>
      </div>
    );
  }

  if (!user) return null;

  // Account status gates
  const accountStatus = user.diagnosticData?.accountStatus;
  if (accountStatus === 'hold') {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/thprebrandlogo2.png" alt="THP" style={{ height: "36px", width: "auto", filter: "brightness(0) invert(1)", marginBottom: "2.5rem" }} />
        <p style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "1.75rem", fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: "0.75rem" }}>Your account is on hold</p>
        <p style={{ fontSize: "0.9375rem", color: "var(--muted)", fontWeight: 300, maxWidth: "38ch", lineHeight: 1.7, marginBottom: "2rem" }}>
          THP has temporarily paused your access. Reach out to him directly to resolve this.
        </p>
        <button onClick={handleSignOut} style={{ background: "none", border: "none", color: "var(--dim)", fontSize: "0.875rem", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Sign out</button>
      </div>
    );
  }

  const isLimited = accountStatus === 'limited';

  // Show holding screen only if neither a static protocol nor a Notion protocol is assigned
  if (user.status === "pending") {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.12em", color: "var(--primary)", textTransform: "uppercase", marginBottom: "2.5rem" }}>THP</span>
        <p style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "1.75rem", fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: "0.75rem", textAlign: "center" }}>You&apos;re all set.</p>
        <p style={{ fontSize: "0.9375rem", color: "var(--muted)", fontWeight: 300, maxWidth: "38ch", textAlign: "center", lineHeight: 1.7, marginBottom: "2.5rem" }}>
          THP is reviewing your intake and will build your protocol soon. You&apos;ll be notified when it&apos;s ready.
        </p>
        <div style={{ padding: "1rem 1.5rem", background: "color-mix(in srgb, var(--color-red) 7%, transparent)", border: "1px solid color-mix(in srgb, var(--color-red) 18%, transparent)", borderRadius: "10px", maxWidth: "38ch", width: "100%", textAlign: "center", marginBottom: "2rem" }}>
          <p style={{ fontSize: "0.8rem", color: "var(--dim)", fontWeight: 300, lineHeight: 1.6, marginBottom: "0.35rem" }}>Your permanent portal is at</p>
          <a href="https://thpofficial.com/dashboard" style={{ fontSize: "0.9375rem", color: "var(--primary)", fontWeight: 500, textDecoration: "none", fontFamily: "var(--font-ui), system-ui, sans-serif", letterSpacing: "0.01em" }}>
            thpofficial.com/dashboard
          </a>
          <p style={{ fontSize: "0.78rem", color: "var(--dim)", fontWeight: 300, marginTop: "0.35rem", lineHeight: 1.5 }}>Bookmark it. That is where you will come back to.</p>
        </div>
        <button onClick={handleSignOut} style={{ background: "none", border: "none", color: "var(--dim)", fontSize: "0.875rem", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Sign out</button>
      </div>
    );
  }

  const firstName = user.name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayFormatted = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* Sticky nav */}
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 200,
        background: "oklch(0.07 0.008 165 / 0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "0 clamp(1.25rem, 4vw, 2.5rem)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "56px",
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/thprebrandlogo2.png" alt="THP" style={{ height: "28px", width: "auto", filter: "brightness(0) invert(1)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
          {user.streak > 0 && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.25rem 0.625rem",
              background: "var(--surface)",
              border: "1px solid oklch(0.60 0.18 165 / 0.35)",
              borderRadius: "100px",
            }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--primary)", flexShrink: 0 }} aria-hidden />
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink)", fontFamily: "var(--font-mono), monospace" }}>{user.streak}</span>
              <span style={{ fontSize: "0.7rem", color: "var(--dim)", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>day streak</span>
            </div>
          )}
          <a href={CAL_LINK} target="_blank" rel="noopener noreferrer"
            style={{ height: "32px", padding: "0 0.875rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "7px", color: "var(--muted)", fontSize: "0.75rem", fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.375rem", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "border-color 150ms, color 150ms", whiteSpace: "nowrap" }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--primary)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--primary)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--muted)"; }}>
            <CalIcon /> Book
          </a>
          <span style={{ fontSize: "0.875rem", color: "var(--muted)", fontWeight: 300, fontFamily: "var(--font-ui), system-ui, sans-serif" }}>{firstName}</span>
          <button
            onClick={handleSignOut}
            style={{ background: "none", border: "none", color: "var(--dim)", fontSize: "0.8125rem", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "color 150ms" }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "var(--dim)"}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Limited access banner */}
      {isLimited && (
        <div style={{ background: "oklch(0.65 0.14 65 / 0.1)", borderBottom: "1px solid oklch(0.65 0.14 65 / 0.25)", padding: "0.625rem clamp(1.25rem, 4vw, 2.5rem)", display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "oklch(0.82 0.10 62)", flexShrink: 0 }} />
          <p style={{ fontSize: "0.8125rem", color: "oklch(0.82 0.10 62)", fontWeight: 400, fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
            Your access is currently limited. Message THP to continue.
          </p>
        </div>
      )}

      {/* Single-scroll content */}
      <div style={{ flex: 1, padding: "2rem clamp(1.25rem, 4vw, 2.5rem)", maxWidth: "760px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "3rem" }}>

        {/* Tracker hero — only active/alumni non-limited */}
        {!isLimited && (user.status === "active" || user.status === "alumni") && (
          <TodayTab user={user} firstName={firstName} greeting={greeting} todayFormatted={todayFormatted} isAlumni={user.status === "alumni"} />
        )}

        {/* Protocol section */}
        <section id="protocol-section">
          <details open style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
            <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", background: "var(--surface)", cursor: "pointer", listStyle: "none", fontFamily: "var(--font-ui), system-ui, sans-serif", userSelect: "none" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink)" }}>
                Protocol
                {user.diagnosticData?.protocolStatus === "active" && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "0.1rem 0.45rem", borderRadius: "100px", background: "oklch(0.60 0.18 165 / 0.15)", border: "1px solid oklch(0.60 0.18 165 / 0.35)", fontSize: "0.6rem", fontWeight: 600, color: "var(--primary)", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono), monospace" }}>
                    <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "var(--primary)", animation: "pulse 2s ease infinite" }} aria-hidden />
                    live
                  </span>
                )}
              </span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={{ color: "var(--dim)", flexShrink: 0 }}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </summary>
            <div style={{ padding: "1.5rem 1.25rem", borderTop: "1px solid var(--border-subtle)" }}>
              <ProtocolTab user={user} protocol={protocol} notionPageId={user.notionPageId} />
            </div>
          </details>
        </section>

        {/* Diagnosis section */}
        <section id="diagnosis-section">
          <details open style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
            <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", background: "var(--surface)", cursor: "pointer", listStyle: "none", fontFamily: "var(--font-ui), system-ui, sans-serif", userSelect: "none" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink)" }}>Diagnosis</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={{ color: "var(--dim)", flexShrink: 0 }}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </summary>
            <div style={{ padding: "1.5rem 1.25rem", borderTop: "1px solid var(--border-subtle)" }}>
              <DiagnosisTab user={user} />
            </div>
          </details>
        </section>

        {/* Blood Work section — hidden for limited */}
        {!isLimited && (
          <section id="blood-work-section">
            <BloodWorkTab user={user} />
          </section>
        )}

        {/* Payments section — hidden for limited */}
        {!isLimited && (
          <section id="payments-section">
            <PaymentsSection user={user} />
          </section>
        )}

        {/* Referrals section — hidden for limited */}
        {!isLimited && (
          <section id="referrals-section">
            <ReferralsTab user={user} />
          </section>
        )}

      </div>

      {showPwaBanner && (
        <PwaBanner onDismiss={() => { localStorage.setItem('mn_pwa_shown', '1'); setShowPwaBanner(false); }} />
      )}
    </div>
  );
}

// ─── TODAY TAB — v2 TRACKER ────────────────────────────────────────────────

type SectionKey = "circadian" | "training" | "nutrition" | "vitals" | "psychological" | "business";

const SECTION_META: { key: SectionKey; emoji: string; label: string }[] = [
  { key: "circadian", emoji: "☀️", label: "Circadian" },
  { key: "training", emoji: "🏋️", label: "Training" },
  { key: "nutrition", emoji: "🥩", label: "Nutrition" },
  { key: "vitals", emoji: "⚡", label: "Vitals" },
  { key: "psychological", emoji: "🧠", label: "Psychological" },
  { key: "business", emoji: "💼", label: "Business" },
];

const FEEL_OPTIONS = ["Great", "Good", "Okay", "Poor", "Skipped"];
const INTENSITY_OPTIONS = ["Low", "Medium", "High"];
const FOCUS_OPTIONS = ["Deep work", "Admin", "Networking", "Strategy", "Sales", "Learning", "Content"];

function ScaleRow({ label, fieldKey, data, onChange }: { label: string; fieldKey: string; data: Record<string, unknown>; onChange: (k: string, v: unknown) => void }) {
  const val = data[fieldKey] as number | undefined;
  return (
    <div style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem" }}>
        <span style={{ fontSize: "0.875rem", color: "var(--muted)", fontWeight: 400 }}>{label}</span>
        {val !== undefined && <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontFamily: "var(--font-mono), monospace", fontWeight: 600 }}>{val}/10</span>}
      </div>
      <div style={{ display: "flex", gap: "0.25rem" }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button key={n} type="button" onClick={() => onChange(fieldKey, n)}
            style={{ flex: 1, height: "36px", borderRadius: "5px", border: `1px solid ${val === n ? "var(--primary)" : "var(--border)"}`, background: val === n ? "var(--primary)" : "var(--surface)", color: val === n ? "#fff" : "var(--dim)", fontSize: "0.75rem", fontWeight: val === n ? 600 : 400, cursor: "pointer", transition: "all 120ms", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function TextareaField({ label, fieldKey, placeholder, data, onChange }: { label: string; fieldKey: string; placeholder?: string; data: Record<string, unknown>; onChange: (k: string, v: unknown) => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "1rem" }}>
      <label style={{ display: "block", fontSize: "0.875rem", color: "var(--muted)", fontWeight: 400, marginBottom: "0.375rem" }}>{label}</label>
      <textarea value={(data[fieldKey] as string) || ""} placeholder={placeholder || ""}
        onChange={e => onChange(fieldKey, e.target.value)} rows={2}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: "100%", background: "var(--surface)", border: `1px solid ${focused ? "var(--primary)" : "var(--border)"}`, borderRadius: "7px", padding: "0.625rem 0.75rem", fontSize: "0.9rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", fontWeight: 300, outline: "none", resize: "vertical", lineHeight: 1.6, transition: "border-color 150ms", minHeight: "64px", boxSizing: "border-box" }} />
    </div>
  );
}

function InputField({ label, fieldKey, type, placeholder, unit, data, onChange }: { label: string; fieldKey: string; type?: string; placeholder?: string; unit?: string; data: Record<string, unknown>; onChange: (k: string, v: unknown) => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "1rem" }}>
      <label style={{ display: "block", fontSize: "0.875rem", color: "var(--muted)", fontWeight: 400, marginBottom: "0.375rem" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input type={type || "text"} value={(data[fieldKey] as string) || ""} placeholder={placeholder || ""}
          onChange={e => onChange(fieldKey, type === "number" ? e.target.value : e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ flex: 1, height: "40px", background: "var(--surface)", border: `1px solid ${focused ? "var(--primary)" : "var(--border)"}`, borderRadius: "7px", padding: "0 0.75rem", fontSize: "0.9rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", fontWeight: 300, outline: "none", transition: "border-color 150ms" }} />
        {unit && <span style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300, flexShrink: 0 }}>{unit}</span>}
      </div>
    </div>
  );
}

function YesNoField({ label, fieldKey, data, onChange }: { label: string; fieldKey: string; data: Record<string, unknown>; onChange: (k: string, v: unknown) => void }) {
  const val = data[fieldKey];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
      <span style={{ fontSize: "0.875rem", color: "var(--muted)", fontWeight: 400 }}>{label}</span>
      <div style={{ display: "flex", gap: "0.375rem" }}>
        {[{ v: true, l: "Yes" }, { v: false, l: "No" }].map(({ v, l }) => (
          <button key={l} type="button" onClick={() => onChange(fieldKey, v)}
            style={{ height: "34px", padding: "0 0.875rem", borderRadius: "6px", border: `1px solid ${val === v ? "var(--primary)" : "var(--border)"}`, background: val === v ? "var(--primary)" : "var(--surface)", color: val === v ? "#fff" : "var(--muted)", fontSize: "0.8125rem", fontWeight: val === v ? 500 : 400, cursor: "pointer", transition: "all 120ms", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectField({ label, fieldKey, options, data, onChange }: { label: string; fieldKey: string; options: string[]; data: Record<string, unknown>; onChange: (k: string, v: unknown) => void }) {
  const val = data[fieldKey] as string | undefined;
  return (
    <div style={{ marginBottom: "1rem" }}>
      <label style={{ display: "block", fontSize: "0.875rem", color: "var(--muted)", fontWeight: 400, marginBottom: "0.375rem" }}>{label}</label>
      <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
        {options.map(opt => (
          <button key={opt} type="button" onClick={() => onChange(fieldKey, opt)}
            style={{ height: "32px", padding: "0 0.875rem", borderRadius: "6px", border: `1px solid ${val === opt ? "var(--primary)" : "var(--border)"}`, background: val === opt ? "var(--primary)" : "var(--surface)", color: val === opt ? "#fff" : "var(--muted)", fontSize: "0.8125rem", fontWeight: val === opt ? 500 : 400, cursor: "pointer", transition: "all 120ms", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function TrackerSection({ emoji, label, open, onToggle, children }: { emoji: string; label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", marginBottom: "0.75rem" }}>
      <button type="button" onClick={onToggle}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", background: open ? "var(--surface)" : "var(--bg)", border: "none", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "background 150ms" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.625rem", fontSize: "0.9375rem", fontWeight: 500, color: "var(--ink)" }}>
          <span aria-hidden>{emoji}</span>{label}
        </span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms", color: "var(--dim)" }} aria-hidden>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={{ padding: "1.25rem", borderTop: "1px solid var(--border-subtle)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function TodayTab({ user, firstName, greeting, todayFormatted, isAlumni }: {
  user: StoredUser; firstName: string; greeting: string; todayFormatted: string; isAlumni?: boolean;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [sections, setSections] = useState<Record<SectionKey, Record<string, unknown>>>({
    circadian: {}, training: {}, nutrition: {}, vitals: {}, psychological: {}, business: {},
  });
  const [openSection, setOpenSection] = useState<SectionKey>("circadian");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [trackerCount, setTrackerCount] = useState<number | null>(null);

  useEffect(() => {
    // Check if already submitted today + get month count
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    fetch(`/api/tracker-questions?userEmail=${encodeURIComponent(user.email)}&date=${today}`)
      .then(r => r.json())
      .then(d => { if (d.alreadySubmitted) setSubmitted(true); })
      .catch(() => {});
    // Get tracker count for the month
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.from('daily_trackers').select('date', { count: 'exact', head: true })
        .eq('user_email', user.email).gte('date', start).then(({ count }) => setTrackerCount(count ?? 0));
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.email, today]);

  const setField = (section: SectionKey, key: string, value: unknown) => {
    setSections(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await fetch('/api/tracker-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: user.email,
        date: today,
        circadian: sections.circadian,
        training: sections.training,
        nutrition: sections.nutrition,
        vitals: sections.vitals,
        psychological: sections.psychological,
        business: sections.business,
      }),
    }).catch(() => {});
    setSubmitting(false);
    setSubmitted(true);
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CHECK_IN_DONE' });
    }
  };

  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  if (submitted) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontSize: "0.75rem", color: "var(--dim)", marginBottom: "0.375rem", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>{todayFormatted.toUpperCase()}</p>
          <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(1.875rem, 4vw, 2.75rem)", fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>Logged.</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1.25rem 1.5rem", background: "oklch(0.60 0.18 165 / 0.06)", border: "1px solid oklch(0.60 0.18 165 / 0.15)", borderRadius: "12px", marginBottom: "1.5rem" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "oklch(0.60 0.18 165 / 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M4 10l4 4 8-8" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <p style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--ink)", marginBottom: "0.2rem" }}>Today&apos;s tracker submitted</p>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300 }}>
              {trackerCount !== null ? `${trackerCount}/${daysInMonth} this month.` : ""} Come back tomorrow.
            </p>
          </div>
        </div>
        <button onClick={() => setSubmitted(false)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: "7px", padding: "0.625rem 1.125rem", fontSize: "0.8125rem", color: "var(--muted)", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
          Update today&apos;s entry
        </button>
      </motion.div>
    );
  }

  return (
    <AlumniGate active={!!isAlumni} label="Daily tracking is part of active mentorship.">
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
      <div style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "0.75rem", color: "var(--dim)", marginBottom: "0.375rem", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>{todayFormatted.toUpperCase()}</p>
        <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(1.5rem, 4vw, 2.25rem)", fontWeight: 400, color: "var(--muted)", letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: "0.375rem" }}>
          {greeting}, {firstName}.
        </h1>
        {trackerCount !== null && (
          <p style={{ fontSize: "0.8125rem", color: "var(--dim)", fontWeight: 300 }}>{trackerCount}/{daysInMonth} trackers this month</p>
        )}
      </div>

      {SECTION_META.map(({ key, emoji, label }) => (
        <TrackerSection key={key} emoji={emoji} label={label} open={openSection === key} onToggle={() => setOpenSection(openSection === key ? ("" as SectionKey) : key)}>
          {key === "circadian" && (
            <>
              <InputField label="Wake time" fieldKey="wake_time" type="time" data={sections.circadian} onChange={(k, v) => setField("circadian", k, v)} />
              <InputField label="Bed time (last night)" fieldKey="bed_time" type="time" data={sections.circadian} onChange={(k, v) => setField("circadian", k, v)} />
              <InputField label="Sleep hours" fieldKey="sleep_hours" type="number" placeholder="7.5" unit="hrs" data={sections.circadian} onChange={(k, v) => setField("circadian", k, v)} />
              <InputField label="Sunlight" fieldKey="sunlight_min" type="number" placeholder="20" unit="min" data={sections.circadian} onChange={(k, v) => setField("circadian", k, v)} />
              <InputField label="Steps" fieldKey="steps" type="number" placeholder="8000" data={sections.circadian} onChange={(k, v) => setField("circadian", k, v)} />
              <YesNoField label="Grounding (barefoot outdoors)" fieldKey="grounding" data={sections.circadian} onChange={(k, v) => setField("circadian", k, v)} />
            </>
          )}
          {key === "training" && (
            <>
              <TextareaField label="What did you do?" fieldKey="what_did" placeholder="E.g. Upper push — bench, OHP, dips" data={sections.training} onChange={(k, v) => setField("training", k, v)} />
              <SelectField label="Intensity" fieldKey="intensity" options={INTENSITY_OPTIONS} data={sections.training} onChange={(k, v) => setField("training", k, v)} />
              <YesNoField label="Explosive work included?" fieldKey="explosiveness" data={sections.training} onChange={(k, v) => setField("training", k, v)} />
            </>
          )}
          {key === "nutrition" && (
            <>
              <InputField label="Breakfast" fieldKey="breakfast" placeholder="E.g. Eggs, steak, fruit" data={sections.nutrition} onChange={(k, v) => setField("nutrition", k, v)} />
              <SelectField label="How did it make you feel?" fieldKey="breakfast_feel" options={FEEL_OPTIONS} data={sections.nutrition} onChange={(k, v) => setField("nutrition", k, v)} />
              <InputField label="Lunch" fieldKey="lunch" placeholder="E.g. Chicken, rice, salad" data={sections.nutrition} onChange={(k, v) => setField("nutrition", k, v)} />
              <SelectField label="How did it make you feel?" fieldKey="lunch_feel" options={FEEL_OPTIONS} data={sections.nutrition} onChange={(k, v) => setField("nutrition", k, v)} />
              <InputField label="Dinner" fieldKey="dinner" placeholder="E.g. Salmon, veg, olive oil" data={sections.nutrition} onChange={(k, v) => setField("nutrition", k, v)} />
              <SelectField label="How did it make you feel?" fieldKey="dinner_feel" options={FEEL_OPTIONS} data={sections.nutrition} onChange={(k, v) => setField("nutrition", k, v)} />
              <InputField label="Hydration" fieldKey="hydration_l" type="number" placeholder="2.5" unit="L" data={sections.nutrition} onChange={(k, v) => setField("nutrition", k, v)} />
              <YesNoField label="Electrolytes?" fieldKey="electrolytes" data={sections.nutrition} onChange={(k, v) => setField("nutrition", k, v)} />
              <YesNoField label="Raw foods today?" fieldKey="raw_foods" data={sections.nutrition} onChange={(k, v) => setField("nutrition", k, v)} />
              <TextareaField label="Supplements taken" fieldKey="supplements" placeholder="E.g. Vit D3, Zinc, Mag glycinate" data={sections.nutrition} onChange={(k, v) => setField("nutrition", k, v)} />
            </>
          )}
          {key === "vitals" && (
            <>
              <ScaleRow label="Energy" fieldKey="energy" data={sections.vitals} onChange={(k, v) => setField("vitals", k, v)} />
              <ScaleRow label="Mood" fieldKey="mood" data={sections.vitals} onChange={(k, v) => setField("vitals", k, v)} />
              <ScaleRow label="Focus" fieldKey="focus" data={sections.vitals} onChange={(k, v) => setField("vitals", k, v)} />
              <ScaleRow label="Libido" fieldKey="libido" data={sections.vitals} onChange={(k, v) => setField("vitals", k, v)} />
              <ScaleRow label="Drive / motivation" fieldKey="drive" data={sections.vitals} onChange={(k, v) => setField("vitals", k, v)} />
              <ScaleRow label="Sleep quality" fieldKey="sleep_quality" data={sections.vitals} onChange={(k, v) => setField("vitals", k, v)} />
              <TextareaField label="Anything unusual?" fieldKey="unusual" placeholder="Headaches, brain fog, unusual energy, etc." data={sections.vitals} onChange={(k, v) => setField("vitals", k, v)} />
            </>
          )}
          {key === "psychological" && (
            <>
              <TextareaField label="Identity audit" fieldKey="identity_audit" placeholder="Are you acting like the man you said you wanted to be?" data={sections.psychological} onChange={(k, v) => setField("psychological", k, v)} />
              <InputField label="Dominant emotion today" fieldKey="dominant_emotion" placeholder="E.g. Calm, restless, fired up" data={sections.psychological} onChange={(k, v) => setField("psychological", k, v)} />
              <TextareaField label="Fear exposure" fieldKey="fear_exposure" placeholder="What did you do that was hard or uncomfortable?" data={sections.psychological} onChange={(k, v) => setField("psychological", k, v)} />
              <TextareaField label="Testosterone behaviour" fieldKey="testosterone_behaviour" placeholder="Dominant, decisive, assertive moment today?" data={sections.psychological} onChange={(k, v) => setField("psychological", k, v)} />
            </>
          )}
          {key === "business" && (
            <>
              <SelectField label="Primary focus today" fieldKey="primary_focus" options={FOCUS_OPTIONS} data={sections.business} onChange={(k, v) => setField("business", k, v)} />
              <TextareaField label="Main win" fieldKey="main_win" placeholder="One thing you accomplished or moved forward" data={sections.business} onChange={(k, v) => setField("business", k, v)} />
              <TextareaField label="Main obstacle" fieldKey="obstacle" placeholder="What blocked you or slowed you down?" data={sections.business} onChange={(k, v) => setField("business", k, v)} />
              <TextareaField label="Tomorrow&apos;s priority" fieldKey="tomorrow_priority" placeholder="The one thing that matters most tomorrow" data={sections.business} onChange={(k, v) => setField("business", k, v)} />
            </>
          )}
        </TrackerSection>
      ))}

      <div style={{ paddingTop: "1.5rem", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
        <button onClick={handleSubmit} disabled={submitting}
          style={{ height: "50px", padding: "0 2rem", background: submitting ? "var(--primary-dim)" : "var(--primary)", color: "#ffffff", border: "none", borderRadius: "100px", fontSize: "0.9375rem", fontWeight: 500, fontFamily: "var(--font-ui), system-ui, sans-serif", cursor: submitting ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: "0.5rem", transition: "background 200ms ease" }}>
          {submitting ? <><Spinner />Submitting…</> : "Submit tracker"}
        </button>
        <p style={{ fontSize: "0.8125rem", color: "var(--dim)", fontWeight: 300 }}>THP reviews every entry.</p>
      </div>
    </AlumniGate>
  );
}

// ─── PROTOCOL TAB ──────────────────────────────────────────────────────────

type NotionBlock =
  | { type: "heading"; text: string; level: 2 | 3 }
  | { type: "paragraph"; text: string }
  | { type: "divider" }
  | { type: "todo"; text: string; checked: boolean };

function NotionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.25" />
      <path d="M4 4h6M4 7h6M4 10h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function NotionRenderer({ blocks }: { blocks: NotionBlock[] }) {
  const todoStart = blocks.findIndex(b => b.type === "heading" && b.text.trim().toUpperCase() === "TO DO");
  const mainBlocks = todoStart >= 0 ? blocks.slice(0, todoStart) : blocks;
  const todoBlocks = todoStart >= 0 ? blocks.slice(todoStart + 1) : [];

  return (
    <div>
      <div style={{ maxWidth: "68ch", marginBottom: "2.5rem" }}>
        {mainBlocks.map((block, i) => {
          if (block.type === "divider") {
            return <div key={i} style={{ borderTop: "1px solid var(--border-subtle)", margin: "2.5rem 0" }} />;
          }
          if (block.type === "heading") {
            const prevIsHeading = i > 0 && mainBlocks[i - 1]?.type === "heading";
            return (
              <p key={i} style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: block.level === 2 ? "0.75rem" : "0.7rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: block.level === 2 ? "oklch(0.84 0.12 65)" : "var(--primary)",
                marginBottom: "1.125rem",
                marginTop: prevIsHeading ? "0.625rem" : "0",
              }}>{block.text}</p>
            );
          }
          if (block.type === "paragraph") {
            return (
              <p key={i} style={{ fontSize: "0.9375rem", color: "var(--ink)", fontWeight: 300, lineHeight: 1.85, marginBottom: "1.25rem", textWrap: "pretty" as "pretty", opacity: 0.85 }}>
                {block.text}
              </p>
            );
          }
          return null;
        })}
      </div>

      {todoBlocks.length > 0 && (
        <div style={{ marginTop: "2.5rem", padding: "1.5rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "12px", marginBottom: "2.5rem" }}>
          <p style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "oklch(0.84 0.12 65)", marginBottom: "1.25rem" }}>TO DO</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {todoBlocks.filter(b => b.type === "todo").map((block, i) => {
              if (block.type !== "todo") return null;
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <div style={{ width: "17px", height: "17px", borderRadius: "4px", border: `1.5px solid ${block.checked ? "var(--primary)" : "var(--border)"}`, background: block.checked ? "var(--primary)" : "none", flexShrink: 0, marginTop: "1px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {block.checked && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <p style={{ fontSize: "0.9rem", color: block.checked ? "var(--dim)" : "var(--muted)", fontWeight: 300, lineHeight: 1.6, textDecoration: block.checked ? "line-through" : "none" }}>{block.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DIAGNOSIS TAB ──────────────────────────────────────────────────────────

function DiagnosisTab({ user }: { user: StoredUser }) {
  const [stages, setStages] = useState<ClientDiagnostic[]>([]);
  const [activeStage, setActiveStage] = useState<ClientDiagnostic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getClientDiagnostics(user.email).then(diags => {
      setStages(diags);
      if (diags.length > 0) setActiveStage(diags[diags.length - 1]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user.email]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {[1, 2, 3].map(i => <div key={i} style={{ height: "80px", background: "var(--surface)", borderRadius: "8px", opacity: 0.4 }} />)}
      </div>
    );
  }

  if (stages.length === 0 || !activeStage) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: "2rem" }}>
        <p style={{ fontSize: "0.9375rem", color: "var(--dim)", fontWeight: 300, textAlign: "center", lineHeight: 1.6 }}>
          Your diagnosis is being prepared. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <div>
      {stages.length > 1 && (
        <div style={{ display: "flex", gap: "0.375rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {stages.map(s => (
            <button key={s.id} onClick={() => setActiveStage(s)} style={{
              height: "28px", padding: "0 0.875rem", borderRadius: "99px", border: "1px solid",
              borderColor: activeStage?.id === s.id ? "var(--primary)" : "var(--border-subtle)",
              background: activeStage?.id === s.id ? "oklch(0.60 0.18 165 / 0.12)" : "none",
              color: activeStage?.id === s.id ? "var(--primary)" : "var(--dim)",
              fontSize: "0.75rem", fontWeight: activeStage?.id === s.id ? 500 : 400,
              cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "all 150ms",
            }}>Stage {s.stage}</button>
          ))}
        </div>
      )}
      {activeStage.content?.sections && (
        <DiagnosticDocumentComponent
          title={activeStage.title}
          stage={activeStage.stage}
          sections={activeStage.content.sections}
          createdAt={activeStage.createdAt}
          clientName={user.name}
        />
      )}
    </div>
  );
}

// ─── PROTOCOL TAB ────────────────────────────────────────────────────────────

function ProtocolTab({ user, protocol, notionPageId }: { user: StoredUser; protocol: Protocol | null; notionPageId?: string }) {
  const [stages, setStages] = useState<ClientProtocol[]>([]);
  const [activeStage, setActiveStage] = useState<ClientProtocol | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getClientProtocols(user.email).then(protocols => {
      if (protocols.length > 0) {
        setStages(protocols);
        setActiveStage(protocols[protocols.length - 1]);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user.email]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {[1, 2, 3].map(i => <div key={i} style={{ height: "80px", background: "var(--surface)", borderRadius: "8px", opacity: 0.4 }} />)}
      </div>
    );
  }

  if (stages.length === 0) {
    const protocolStatus = user.diagnosticData?.protocolStatus;
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: "2rem" }}>
        <p style={{ fontSize: "0.9375rem", color: "var(--dim)", fontWeight: 300, textAlign: "center", lineHeight: 1.6 }}>
          {protocolStatus === "building" ? "Your protocol is being built." : protocolStatus === "updating" ? "Your protocol is being updated." : "Your protocol is being prepared. Check back soon."}
        </p>
      </div>
    );
  }

  return (
    <div>
      {stages.length > 1 && (
        <div style={{ display: "flex", gap: "0.375rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {stages.map(s => (
            <button key={s.id} onClick={() => setActiveStage(s)} style={{
              height: "28px", padding: "0 0.875rem", borderRadius: "99px", border: "1px solid",
              borderColor: activeStage?.id === s.id ? "var(--primary)" : "var(--border-subtle)",
              background: activeStage?.id === s.id ? "oklch(0.60 0.18 165 / 0.12)" : "none",
              color: activeStage?.id === s.id ? "var(--primary)" : "var(--dim)",
              fontSize: "0.75rem", fontWeight: activeStage?.id === s.id ? 500 : 400,
              cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "all 150ms",
            }}>Stage {s.stage}</button>
          ))}
        </div>
      )}
      {activeStage?.content?.sections && (
        <ProtocolDocumentComponent
          title={activeStage.title}
          stage={activeStage.stage}
          sections={activeStage.content.sections}
          todos={activeStage.content.todos ?? []}
          createdAt={activeStage.createdAt}
          clientName={user.name}
        />
      )}
    </div>
  );
}

function TodoList({ items }: { items: string[] }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setChecked(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <ol style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      {items.map((item, i) => {
        const done = checked.has(i);
        return (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
            <button
              onClick={() => toggle(i)}
              aria-pressed={done}
              style={{
                width: "20px",
                height: "20px",
                flexShrink: 0,
                marginTop: "0.15rem",
                border: "1px solid var(--primary)",
                borderRadius: "4px",
                background: done ? "var(--primary)" : "transparent",
                cursor: "pointer",
                transition: "background 150ms ease, transform 150ms ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.92)"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"}
            >
              {done && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M2 6l3 3 5-5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <span style={{
              fontFamily: "var(--font-ui), system-ui, sans-serif",
              fontSize: "0.9375rem",
              color: done ? "var(--dim)" : "var(--ink)",
              textDecoration: done ? "line-through" : "none",
              opacity: done ? 0.4 : 1,
              transition: "color 150ms, opacity 150ms",
              lineHeight: 1.6,
            }}>
              <span style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: "0.75rem",
                color: "var(--primary)",
                marginRight: "0.5rem",
              }}>{String(i + 1).padStart(2, "0")}</span>
              {item}
            </span>
          </li>
        );
      })}
    </ol>
  );
}


// ─── PAYMENTS SECTION ─────────────────────────────────────────────────────

function PaymentsSection({ user }: { user: StoredUser }) {
  const [payData, setPayData] = useState<{ deposit_paid: number | null; total_owed: number | null } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from('users').select('deposit_paid, total_owed').eq('email', user.email).maybeSingle()
      .then(({ data }) => {
        setPayData(data as { deposit_paid: number | null; total_owed: number | null } | null);
        setLoaded(true);
      }, () => setLoaded(true));
  }, [user.email]);

  const deposit = payData?.deposit_paid ?? null;
  const total = payData?.total_owed ?? null;
  const balanceDue = deposit != null && total != null && total > deposit ? total - deposit : null;
  const allSettled = deposit != null && total != null && total > 0 && deposit >= total;
  const hasSubscription = !!(user.diagnosticData?.stripeCustomerId);

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "0.7rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--dim)",
    fontWeight: 600,
    marginBottom: "0.75rem",
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.5rem 0",
    borderBottom: "1px solid var(--border-subtle)",
  };

  return (
    <div>
      <p style={labelStyle}>Payments</p>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "1rem 1.25rem" }}>
        {!loaded ? (
          <p style={{ fontSize: "0.8125rem", color: "var(--dim)", fontWeight: 300 }}>Loading…</p>
        ) : (
          <div>
            <div style={rowStyle}>
              <span style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Deposit paid</span>
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--ink)", fontFamily: "var(--font-mono), monospace" }}>{deposit != null ? `$${deposit}` : "—"}</span>
            </div>
            <div style={{ ...rowStyle, borderBottom: balanceDue != null || allSettled ? "1px solid var(--border-subtle)" : "none" }}>
              <span style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Balance due</span>
              {balanceDue != null ? (
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "oklch(0.75 0.16 25)", fontFamily: "var(--font-mono), monospace" }}>${balanceDue}</span>
              ) : allSettled ? (
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "oklch(0.65 0.15 145)" }}>All settled ✓</span>
              ) : (
                <span style={{ fontSize: "0.875rem", fontWeight: 400, color: "var(--dim)" }}>—</span>
              )}
            </div>
            <div style={{ ...rowStyle, borderBottom: "none" }}>
              <span style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Subscription</span>
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: hasSubscription ? "oklch(0.65 0.15 145)" : "var(--dim)" }}>{hasSubscription ? "Active" : "—"}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BLOOD WORK TAB ───────────────────────────────────────────────────────

interface BloodMarker {
  value: number | null;
  unit: string;
  reference_range?: string | null;
  flag?: "high" | "low" | "normal" | null;
}

interface BloodWorkEntry {
  id: string;
  uploaded_at: string;
  test_date: string | null;
  markers: Record<string, BloodMarker> | null;
  extraction_notes: string | null;
  image_url: string;
}

const MARKER_DEFAULTS: Record<string, { label: string; unit: string }> = {
  total_t:       { label: "Total T",       unit: "ng/dL" },
  free_t:        { label: "Free T",        unit: "pg/mL" },
  shbg:          { label: "SHBG",          unit: "nmol/L" },
  estradiol:     { label: "Estradiol",     unit: "pg/mL" },
  lh:            { label: "LH",            unit: "mIU/mL" },
  fsh:           { label: "FSH",           unit: "mIU/mL" },
  cortisol:      { label: "Cortisol",      unit: "μg/dL" },
  hematocrit:    { label: "Hematocrit",    unit: "%" },
  hemoglobin:    { label: "Hemoglobin",    unit: "g/dL" },
  rbc:           { label: "RBC",           unit: "M/μL" },
  psa:           { label: "PSA",           unit: "ng/mL" },
  dhea_s:        { label: "DHEA-S",        unit: "μg/dL" },
  igf1:          { label: "IGF-1",         unit: "ng/mL" },
  tsh:           { label: "TSH",           unit: "mIU/L" },
  t3_free:       { label: "Free T3",       unit: "pg/mL" },
  t4_free:       { label: "Free T4",       unit: "ng/dL" },
  vitamin_d:     { label: "Vitamin D",     unit: "ng/mL" },
  ferritin:      { label: "Ferritin",      unit: "ng/mL" },
  cholesterol:   { label: "Cholesterol",   unit: "mg/dL" },
  hdl:           { label: "HDL",           unit: "mg/dL" },
  ldl:           { label: "LDL",           unit: "mg/dL" },
  triglycerides: { label: "Triglycerides", unit: "mg/dL" },
  glucose:       { label: "Glucose",       unit: "mg/dL" },
  hba1c:         { label: "HbA1c",         unit: "%" },
  creatinine:    { label: "Creatinine",    unit: "mg/dL" },
  alt:           { label: "ALT",           unit: "U/L" },
  ast:           { label: "AST",           unit: "U/L" },
};

function parseRefRange(s?: string | null): [number, number] | null {
  const m = s?.match(/([\d.]+)[–\-]([\d.]+)/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
}

function BloodWorkTab({ user }: { user: StoredUser }) {
  const [entries, setEntries] = useState<BloodWorkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [expandedMarker, setExpandedMarker] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState("total_t");
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    supabase.from('blood_work').select('*').eq('user_email', user.email)
      .order('uploaded_at', { ascending: false })
      .then(({ data }) => { setEntries((data as BloodWorkEntry[]) ?? []); setLoading(false); });
  }, [user.email]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('userEmail', user.email);
    const res = await fetch('/api/blood-work-upload', { method: 'POST', body: form }).then(r => r.json()).catch(() => null);
    if (res?.uploadId) {
      setAnalysing(true);
      // Poll for markers to appear (Edge Function runs async)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const { data } = await supabase.from('blood_work').select('*').eq('id', res.uploadId).maybeSingle();
        if (data?.markers || attempts > 20) {
          clearInterval(poll);
          setAnalysing(false);
          setEntries(prev => [data as BloodWorkEntry, ...prev.filter(e => e.id !== res.uploadId)]);
        }
      }, 3000);
    }
    setUploading(false);
    if (e.target) e.target.value = '';
  };

  if (loading) return <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>{[1,2,3].map(i => <div key={i} style={{ height: "80px", background: "var(--surface)", borderRadius: "8px", opacity: 0.4 }} />)}</div>;

  const latest = entries[0];
  const previous = entries[1];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "2rem" }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: "0.25rem" }}>Blood Work</h2>
          <p style={{ fontSize: "0.8125rem", color: "var(--dim)", fontWeight: 300 }}>Upload your lab results. THP sees everything.</p>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={uploading || analysing}
          style={{ height: "40px", padding: "0 1.25rem", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 500, cursor: (uploading || analysing) ? "not-allowed" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", display: "inline-flex", alignItems: "center", gap: "0.375rem", opacity: (uploading || analysing) ? 0.7 : 1 }}>
          {uploading ? <><Spinner /> Uploading…</> : analysing ? <><Spinner /> Analysing…</> : "Upload results"}
        </button>
        <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={handleUpload} />
      </div>

      {analysing && (
        <div style={{ padding: "1rem 1.25rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Spinner />
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", fontWeight: 300 }}>Extracting markers from your results…</p>
        </div>
      )}

      {/* Prominent trends chart with marker dropdown */}
      <div style={{ marginBottom: "2rem", padding: "1.25rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.625rem" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", color: "var(--dim)", textTransform: "uppercase", fontFamily: "var(--font-mono), monospace" }}>Trends</p>
          <select value={selectedMarker} onChange={e => setSelectedMarker(e.target.value)}
            style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--muted)", fontSize: "0.8125rem", padding: "0.375rem 0.625rem", fontFamily: "var(--font-mono), monospace", cursor: "pointer" }}>
            {Object.entries(MARKER_DEFAULTS).map(([key, def]) => (
              <option key={key} value={key}>{def.label} ({def.unit})</option>
            ))}
          </select>
        </div>
        {(() => {
          const chartData = [...entries]
            .reverse()
            .map(e => ({
              date: e.test_date ?? new Date(e.uploaded_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
              val: e.markers?.[selectedMarker]?.value ?? null,
            }))
            .filter((p): p is { date: string; val: number } => p.val !== null);
          const def = MARKER_DEFAULTS[selectedMarker];
          const latestEntry = entries[0];
          const refRange = parseRefRange(latestEntry?.markers?.[selectedMarker]?.reference_range);
          if (chartData.length === 0) {
            return (
              <div style={{ height: "220px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.875rem", borderRadius: "8px", border: "1px dashed var(--border-subtle)" }}>
                <p style={{ fontSize: "0.875rem", color: "var(--dim)", fontWeight: 300, textAlign: "center" }}>No blood work uploaded yet.</p>
                <button onClick={() => fileRef.current?.click()}
                  style={{ padding: "0.5rem 1.25rem", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                  Upload results
                </button>
              </div>
            );
          }
          return (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                  {refRange && <ReferenceArea y1={refRange[0]} y2={refRange[1]} fill="oklch(0.35 0.08 145)" fillOpacity={0.15} />}
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--dim)", fontFamily: "var(--font-mono), monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--dim)", fontFamily: "var(--font-mono), monospace" }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "0.8125rem", fontFamily: "var(--font-mono), monospace", color: "#fff" }} labelStyle={{ color: "var(--dim)", marginBottom: "0.25rem" }} formatter={(value) => [`${value} ${def.unit}`, def.label]} />
                  <Line type="monotone" dataKey="val" stroke="#c8102e" strokeWidth={2} dot={{ fill: "#c8102e", r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              {refRange && (
                <p style={{ fontSize: "0.7rem", color: "var(--dim)", marginTop: "0.75rem", fontFamily: "var(--font-mono), monospace" }}>
                  Reference range: {refRange[0]}–{refRange[1]} {def.unit}
                </p>
              )}
            </>
          );
        })()}
      </div>


      {entries.length > 1 && (
        <details style={{ marginBottom: "1.5rem" }}>
          <summary style={{ fontSize: "0.8125rem", color: "var(--muted)", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", fontWeight: 400, marginBottom: "0.75rem" }}>Previous uploads ({entries.length - 1})</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.75rem" }}>
            {entries.slice(1).map(e => (
              <div key={e.id} style={{ padding: "0.75rem 1rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.875rem", color: "var(--muted)", fontWeight: 300 }}>{e.test_date ?? new Date(e.uploaded_at).toLocaleDateString("en-GB")}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300 }}>{e.markers ? Object.keys(e.markers).length + " markers" : "Processing…"}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300, lineHeight: 1.6, marginTop: "1rem" }}>
        For reference only. This is not medical advice.
      </p>
    </div>
  );
}

// ─── REFERRALS TAB ────────────────────────────────────────────────────────

interface ReferralEntry {
  id: string;
  referred_name: string;
  referred_email: string;
  status: "pending" | "paid";
  submitted_at: string;
}

function ReferralsTab({ user }: { user: StoredUser }) {
  const [referrals, setReferrals] = useState<ReferralEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const load = () => {
    setLoading(true);
    fetch(`/api/referrals?email=${encodeURIComponent(user.email)}`)
      .then(r => r.json()).then(d => setReferrals(d.referrals ?? [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, [user.email]);

  const paidCount = referrals.filter(r => r.status === "paid").length;

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) { setError("Name and email are required."); return; }
    setSubmitting(true); setError("");
    const res = await fetch('/api/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referrerEmail: user.email, referredName: name.trim(), referredEmail: email.trim() }),
    }).then(r => r.json()).catch(() => ({ error: "Request failed" }));
    if (res.error) { setError(res.error); setSubmitting(false); return; }
    setSuccess(true); setName(""); setEmail(""); setSubmitting(false);
    load();
  };

  return (
    <div>
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: "0.25rem" }}>Referrals</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--dim)", fontWeight: 300 }}>3 paying referrals = a free month with THP.</p>
      </div>

      {/* Progress bar */}
      <div style={{ padding: "1.25rem 1.5rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ink)" }}>Paying referrals</span>
          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--primary)", fontFamily: "var(--font-mono), monospace" }}>{paidCount} / 3</span>
        </div>
        <div style={{ height: "6px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(paidCount / 3, 1) * 100}%`, background: "var(--primary)", borderRadius: "3px", transition: "width 500ms ease" }} />
        </div>
        {paidCount >= 3 && (
          <p style={{ fontSize: "0.8125rem", color: "var(--primary)", fontWeight: 500, marginTop: "0.75rem" }}>You&apos;ve earned a free month — THP will apply it to your next cycle.</p>
        )}
      </div>

      {/* Submit form */}
      <div style={{ padding: "1.5rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", marginBottom: "2rem" }}>
        <p style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--ink)", marginBottom: "1.25rem" }}>Refer someone</p>
        {success && (
          <div style={{ padding: "0.75rem 1rem", background: "oklch(0.60 0.18 165 / 0.08)", border: "1px solid oklch(0.60 0.18 165 / 0.2)", borderRadius: "8px", marginBottom: "1rem" }}>
            <p style={{ fontSize: "0.875rem", color: "var(--primary)", fontWeight: 400 }}>Referral submitted. You&apos;ll get credit when they sign up and pay.</p>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 400, marginBottom: "0.375rem" }}>Their name</label>
            <input value={name} onChange={e => { setName(e.target.value); setSuccess(false); }} placeholder="First Last"
              style={{ width: "100%", height: "42px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "7px", padding: "0 0.75rem", fontSize: "0.9rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", fontWeight: 300, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 400, marginBottom: "0.375rem" }}>Their email</label>
            <input value={email} onChange={e => { setEmail(e.target.value); setSuccess(false); }} placeholder="email@example.com" type="email"
              style={{ width: "100%", height: "42px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "7px", padding: "0 0.75rem", fontSize: "0.9rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", fontWeight: 300, outline: "none", boxSizing: "border-box" }} />
          </div>
          {error && <p style={{ fontSize: "0.8125rem", color: "oklch(0.70 0.15 25)" }}>{error}</p>}
          <button onClick={handleSubmit} disabled={submitting}
            style={{ height: "42px", background: submitting ? "var(--primary-dim)" : "var(--primary)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.9rem", fontWeight: 500, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            {submitting ? <><Spinner /> Submitting…</> : "Submit referral"}
          </button>
        </div>
      </div>

      {/* Referral list */}
      {!loading && referrals.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {referrals.map(r => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "9px" }}>
              <div>
                <p style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--ink)", marginBottom: "0.125rem" }}>{r.referred_name}</p>
                <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300 }}>{new Date(r.submitted_at).toLocaleDateString("en-GB")}</p>
              </div>
              <span style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", padding: "0.25rem 0.625rem", borderRadius: "99px", background: r.status === "paid" ? "oklch(0.60 0.18 165 / 0.12)" : "var(--surface)", border: `1px solid ${r.status === "paid" ? "oklch(0.60 0.18 165 / 0.3)" : "var(--border)"}`, color: r.status === "paid" ? "var(--primary)" : "var(--dim)", fontFamily: "var(--font-mono), monospace" }}>
                {r.status === "paid" ? "Paying" : "Pending"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PWA INSTALL BANNER ───────────────────────────────────────────────────

function PwaTutorialModal({ onClose }: { onClose: () => void }) {
  const isIos = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const steps = isIos
    ? [
        { n: "01", text: "Open this page in Safari (not Chrome or other browsers)." },
        { n: "02", text: "Tap the share icon at the bottom of Safari. It looks like a box with an arrow pointing up." },
        { n: "03", text: "Scroll down and tap \"Add to Home Screen\"." },
        { n: "04", text: "Tap \"Add\" in the top right. The app appears on your home screen." },
      ]
    : [
        { n: "01", text: "Open this page in Chrome on your Android device." },
        { n: "02", text: "Tap the three-dot menu in the top right corner." },
        { n: "03", text: "Tap \"Add to Home Screen\" or \"Install app\" if Chrome shows a banner." },
        { n: "04", text: "Tap \"Add\". The app will appear on your home screen like a native app." },
      ];

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 500, background: "oklch(0.06 0 0 / 0.8)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "1rem" }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "20px", padding: "2rem 1.75rem 1.75rem", width: "100%", maxWidth: "480px" }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", color: "var(--primary)", textTransform: "uppercase", marginBottom: "0.875rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
          {isIos ? "iOS" : "Android"}
        </p>
        <h2 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "1.375rem", fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: "1.5rem" }}>
          Add to your home screen
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.75rem" }}>
          {steps.map(step => (
            <div key={step.n} style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--primary)", fontFamily: "var(--font-ui), system-ui, sans-serif", minWidth: "1.5rem", paddingTop: "2px" }}>{step.n}</span>
              <p style={{ fontSize: "0.9rem", color: "var(--muted)", fontWeight: 300, lineHeight: 1.65 }}>{step.text}</p>
            </div>
          ))}
        </div>
        <button onClick={onClose}
          style={{ width: "100%", height: "46px", background: "var(--primary)", color: "#ffffff", border: "none", borderRadius: "10px", fontSize: "0.9375rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
          Got it
        </button>
      </motion.div>
    </div>
  );
}

function PwaBanner({ onDismiss }: { onDismiss: () => void }) {
  const [showModal, setShowModal] = useState(false);
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 1.5 }}
        style={{ position: "fixed", bottom: "1.25rem", left: "1.5rem", right: "1.5rem", margin: "0 auto", zIndex: 250, width: "auto", maxWidth: "420px", background: "oklch(0.11 0 0 / 0.95)", border: "1px solid var(--border)", borderRadius: "14px", padding: "0.875rem 1.125rem", display: "flex", alignItems: "center", gap: "0.875rem", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ink)", marginBottom: "0.125rem" }}>Add to home screen</p>
          <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300 }}>Access your dashboard like a native app.</p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ height: "34px", padding: "0 0.875rem", background: "var(--primary)", color: "#ffffff", border: "none", borderRadius: "7px", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", flexShrink: 0 }}>
          How
        </button>
        <button onClick={onDismiss}
          style={{ background: "none", border: "none", color: "var(--dim)", fontSize: "1rem", cursor: "pointer", padding: "0.25rem", lineHeight: 1, flexShrink: 0 }} aria-label="Dismiss">
          ×
        </button>
      </motion.div>
      <AnimatePresence>
        {showModal && <PwaTutorialModal onClose={() => { setShowModal(false); onDismiss(); }} />}
      </AnimatePresence>
    </>
  );
}

// ─── ALUMNI GATE ──────────────────────────────────────────────────────────

function AlumniModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 400, background: "oklch(0.06 0 0 / 0.75)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "18px", padding: "2rem 2rem 1.75rem", maxWidth: "440px", width: "100%" }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--primary)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1.25rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Alumni access</p>
        <h2 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(1.375rem, 3vw, 1.75rem)", fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.02em", lineHeight: 1.15, marginBottom: "1rem" }}>
          Your mentorship period has ended.
        </h2>
        <p style={{ fontSize: "0.9375rem", color: "var(--muted)", fontWeight: 300, lineHeight: 1.75, marginBottom: "1.75rem", maxWidth: "46ch" }}>
          Your protocol and history stay on file. Active features require continued mentorship. If you&apos;re ready to pick up where you left off, reach out.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <a
            href="https://t.me/thpofficial"
            target="_blank" rel="noopener noreferrer"
            style={{ height: "44px", padding: "0 1.375rem", background: "var(--primary)", color: "#ffffff", borderRadius: "8px", textDecoration: "none", fontSize: "0.9rem", fontWeight: 500, display: "inline-flex", alignItems: "center", transition: "background 150ms" }}
            onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = "var(--primary-hover)"}
            onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = "var(--primary)"}>
            Message THP
          </a>
          <button onClick={onClose}
            style={{ height: "44px", padding: "0 1.25rem", background: "none", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--muted)", fontSize: "0.9rem", fontWeight: 400, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "border-color 150ms, color 150ms" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}>
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AlumniGate({ active, children, label }: { active: boolean; children: React.ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  if (!active) return <>{children}</>;
  return (
    <>
      <div style={{ position: "relative", borderRadius: "12px" }}>
        <div style={{ filter: "blur(4px)", pointerEvents: "none", userSelect: "none", opacity: 0.7 }} aria-hidden>
          {children}
        </div>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: "12px" }}>
          <div style={{ padding: "1.25rem 1.5rem", background: "oklch(0.09 0 0 / 0.9)", border: "1px solid var(--border)", borderRadius: "12px", maxWidth: "280px", textAlign: "center", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
            <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ink)", marginBottom: "0.375rem" }}>{label}</p>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300, lineHeight: 1.55, marginBottom: "1rem" }}>Continue working with THP to regain access.</p>
            <button onClick={() => setOpen(true)}
              style={{ height: "36px", padding: "0 1.125rem", background: "var(--primary)", color: "#ffffff", border: "none", borderRadius: "7px", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "background 150ms" }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "var(--primary-hover)"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "var(--primary)"}>
              Get back in
            </button>
          </div>
        </div>
      </div>
      {open && <AlumniModal onClose={() => setOpen(false)} />}
    </>
  );
}

// ─── SHARED ───────────────────────────────────────────────────────────────

function CalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}


function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }} aria-hidden>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
