"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentUser, signOut, recordCheckIn, hasCheckedInToday, getMessages, addMessage, uploadMessageAttachment, rowToUser, cacheUser, updatePresence, isAdminActive, getClientProtocols } from "@/lib/auth";
import type { Message, AttachmentType, ClientProtocol, TrackerQuestion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { StoredUser } from "@/lib/auth";
import type { Protocol, TrackerField } from "@/lib/protocols";

const WHATSAPP_NUMBER = "447453172081";
const CAL_LINK = "https://www.cal.eu/thp/call";

type Tab = "today" | "protocol" | "book" | "thp";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("today");
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
      if (!u.diagnosticData?.notionPageId) {
        setActiveTab("protocol");
      }
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

    // On-open reminder: fire if past 8am and they haven't checked in today
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && !hasCheckedInToday(u)) {
      const todayStr = new Date().toISOString().split('T')[0];
      const notifKey = `mn_reminder_${todayStr}`;
      const hour = new Date().getHours();
      if ((hour >= 8) && !localStorage.getItem(notifKey)) {
        try {
          new Notification('NK Portal', { body: "Log your tracker and complete today's challenge.", icon: '/thp.jpg', tag: 'daily-reminder' });
          localStorage.setItem(notifKey, '1');
        } catch { /* blocked */ }
      }
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
        // protocol is fetched from Supabase in ProtocolTab; nothing to set here
        if (updated.diagnosticData?.accountStatus === 'limited') setActiveTab('thp');
      })
      .subscribe();

    return () => { isMounted = false; supabase.removeChannel(userChannel); };
  }, [router]);

  const handleSignOut = () => { signOut(); router.push("/"); };

  const onCheckInComplete = async () => {
    if (!user) return;
    await recordCheckIn(user.email, user.streak);
    const updated = getCurrentUser();
    if (updated) setUser(updated);
    // Tell the SW the check-in is done so it stops reminding today
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CHECK_IN_DONE' });
    }
  };

  if (suspended) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.12em", color: "var(--primary)", textTransform: "uppercase", marginBottom: "2.5rem", fontFamily: "var(--font-mono), monospace" }}>NK</p>
          <p style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "1.75rem", fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: "0.75rem" }}>Your access has been removed</p>
          <p style={{ fontSize: "0.9375rem", color: "var(--muted)", fontWeight: 300, maxWidth: "34ch", lineHeight: 1.75, marginBottom: "2.5rem" }}>
            Message THP to get set up again
          </p>
          <a
            href={`https://wa.me/447453172081`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", height: "44px", padding: "0 1.5rem", background: "var(--primary)", color: "#ffffff", border: "none", borderRadius: "999px", fontSize: "0.9rem", fontWeight: 500, textDecoration: "none", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "background 150ms" }}
          >
            Message on WhatsApp
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
        <span style={{ fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.12em", color: "var(--primary)", textTransform: "uppercase", marginBottom: "2.5rem" }}>NK</span>
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
  const alreadyCheckedIn = hasCheckedInToday(user);
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
        <span style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0.12em",
          color: "var(--primary)",
          textTransform: "uppercase",
          fontFamily: "var(--font-mono), monospace",
        }}>NK</span>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
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
              <span style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--primary)",
                flexShrink: 0,
              }} aria-hidden />
              <span style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--ink)",
                fontFamily: "var(--font-mono), monospace",
              }}>{user.streak}</span>
              <span style={{
                fontSize: "0.7rem",
                color: "var(--dim)",
                fontFamily: "var(--font-ui), system-ui, sans-serif",
              }}>day streak</span>
            </div>
          )}
          <span style={{
            fontSize: "0.875rem",
            color: "var(--muted)",
            fontWeight: 300,
            fontFamily: "var(--font-ui), system-ui, sans-serif",
          }}>{firstName}</span>
          <button
            onClick={handleSignOut}
            style={{
              background: "none",
              border: "none",
              color: "var(--dim)",
              fontSize: "0.8125rem",
              cursor: "pointer",
              fontFamily: "var(--font-ui), system-ui, sans-serif",
              transition: "color 150ms",
            }}
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

      {/* Tab bar */}
      <div style={{
        borderBottom: "1px solid var(--border-subtle)",
        padding: "0 clamp(1.25rem, 4vw, 2.5rem)",
        display: "flex",
        gap: "0.125rem",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch" as "touch",
        scrollbarWidth: "none" as "none",
      }}>
        {(["today", "protocol", "book", "thp"] as Tab[])
          .filter(tab => tab !== "today" || user.status === "active" || user.status === "alumni")
          .filter(tab => !isLimited || tab === "thp")
          .map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                position: "relative",
                padding: "0.875rem 1rem",
                background: "none",
                border: "none",
                fontSize: "0.75rem",
                fontWeight: activeTab === tab ? 500 : 400,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: activeTab === tab ? "var(--ink)" : "var(--dim)",
                cursor: "pointer",
                fontFamily: "var(--font-ui), system-ui, sans-serif",
                whiteSpace: "nowrap",
                transition: "color 150ms ease",
                flexShrink: 0,
              }}
            >
              {tab === "today" ? "Today" : tab === "protocol" ? (
                <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  Protocol
                  {user.diagnosticData?.protocolStatus === "active" && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "0.25rem",
                      padding: "0.1rem 0.45rem", borderRadius: "100px",
                      background: "oklch(0.60 0.18 165 / 0.15)",
                      border: "1px solid oklch(0.60 0.18 165 / 0.35)",
                      fontSize: "0.6rem", fontWeight: 600, color: "var(--primary)",
                      letterSpacing: "0.08em", textTransform: "uppercase",
                      fontFamily: "var(--font-mono), monospace",
                    }}>
                      <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "var(--primary)", animation: "pulse 2s ease infinite" }} aria-hidden />
                      live
                    </span>
                  )}
                </span>
              ) : tab === "book" ? "Book a call" : "THP"}
              {activeTab === tab && (
                <motion.div
                  layoutId="tab-indicator"
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "2px",
                    background: "var(--primary)",
                    borderRadius: "1px 1px 0 0",
                  }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              {tab === "today" && !alreadyCheckedIn && (
                <span style={{
                  position: "absolute",
                  top: "0.625rem",
                  right: "0.5rem",
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: "var(--primary)",
                }} aria-label="Check-in pending" />
              )}
            </button>
          ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "2rem clamp(1.25rem, 4vw, 2.5rem)", maxWidth: "760px", width: "100%", margin: "0 auto" }}>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            {activeTab === "today" && !isLimited && (user.status === "active" || user.status === "alumni") && <TodayTab user={user} protocol={protocol} firstName={firstName} greeting={greeting} alreadyCheckedIn={alreadyCheckedIn} todayFormatted={todayFormatted} onComplete={onCheckInComplete} isAlumni={user.status === "alumni"} />}
            {activeTab === "protocol" && !isLimited && <ProtocolTab user={user} protocol={protocol} notionPageId={user.notionPageId} />}
            {activeTab === "book" && !isLimited && <BookTab isAlumni={user.status === "alumni"} />}
            {(activeTab === "thp" || isLimited) && <NikodmTab user={user} isAlumni={user.status === "alumni"} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {showPwaBanner && (
        <PwaBanner onDismiss={() => { localStorage.setItem('mn_pwa_shown', '1'); setShowPwaBanner(false); }} />
      )}
    </div>
  );
}

// ─── TODAY TAB ─────────────────────────────────────────────────────────────

function TodayTab({ user, protocol, firstName, greeting, alreadyCheckedIn, todayFormatted, onComplete, isAlumni }: {
  user: StoredUser; protocol: Protocol | null; firstName: string;
  greeting: string; alreadyCheckedIn: boolean; todayFormatted: string;
  onComplete: () => void; isAlumni?: boolean;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [submitted, setSubmitted] = useState(alreadyCheckedIn);
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [aiQuestions, setAiQuestions] = useState<TrackerQuestion[] | null>(null);
  const [aiStage, setAiStage] = useState(1);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const pulseRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLoadingQuestions(true);
    fetch(`/api/tracker-questions?userEmail=${encodeURIComponent(user.email)}&date=${today}`)
      .then(r => r.json())
      .then(d => {
        setAiQuestions(d.questions?.length > 0 ? d.questions : null);
        setAiStage(d.stage ?? 1);
      })
      .catch(() => setAiQuestions(null))
      .finally(() => setLoadingQuestions(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.email]);

  const setValue = (id: string, value: string | number | boolean) =>
    setValues(prev => ({ ...prev, [id]: value }));

  const handleSubmit = async () => {
    setSubmitting(true);
    if (pulseRef.current) {
      pulseRef.current.style.animation = "none";
      void pulseRef.current.offsetHeight;
      pulseRef.current.style.animation = "nk-pulse 0.6s ease-out forwards";
    }

    if (aiQuestions) {
      await fetch('/api/tracker-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: user.email, date: today, stage: aiStage, responses: values, dailyQuestions: aiQuestions }),
      }).catch(() => {});
    }

    await new Promise(r => setTimeout(r, 500));
    setSubmitted(true);
    setSubmitting(false);
    onComplete();
  };

  // Decide which questions to show: AI first, then hardcoded protocol fields, then plain button
  const fieldsToShow: (TrackerQuestion | TrackerField)[] | null = aiQuestions ?? protocol?.trackerFields ?? null;

  if (submitted) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <div style={{ marginBottom: "2.5rem" }}>
          <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--dim)", marginBottom: "0.375rem" }}>{todayFormatted}</p>
          <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(1.875rem, 4vw, 2.75rem)", fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: "0.625rem" }}>
            Logged.
          </h1>
          <p style={{ fontSize: "1rem", color: "var(--muted)", fontWeight: 300 }}>
            Streak: <strong style={{ color: "var(--ink)", fontWeight: 600 }}>{(user.streak || 0) + 1} day{user.streak + 1 !== 1 ? "s" : ""}</strong>
            {user.streak + 1 >= 7 ? " 🔥" : user.streak + 1 >= 3 ? " ⚡" : ""}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2.5rem", padding: "1.25rem 1.5rem", background: "oklch(0.60 0.18 165 / 0.06)", border: "1px solid oklch(0.60 0.18 165 / 0.15)", borderRadius: "12px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "oklch(0.60 0.18 165 / 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M4 10l4 4 8-8" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <p style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--ink)", marginBottom: "0.2rem" }}>Today&apos;s entry submitted</p>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300 }}>Come back tomorrow. THP reviews everything.</p>
          </div>
        </div>
        <button onClick={() => setSubmitted(false)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: "7px", padding: "0.625rem 1.125rem", fontSize: "0.8125rem", color: "var(--muted)", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "border-color 150ms, color 150ms" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--primary)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>
          Update today&apos;s entry
        </button>
      </motion.div>
    );
  }

  return (
    <>
      <style>{`@keyframes nk-pulse { 0% { transform: scale(1); opacity: 0.35; } 100% { transform: scale(2.5); opacity: 0; } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
      <div>
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--dim)", marginBottom: "0.5rem", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {todayFormatted.toUpperCase()}
          </p>
          <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(1.875rem, 4vw, 2.75rem)", fontWeight: 400, color: "var(--muted)", letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: "0.5rem" }}>
            {greeting}, {firstName}.
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
            {aiQuestions && (
              <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--primary)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Stage {aiStage}
              </span>
            )}
            {protocol && !aiQuestions && (
              <span style={{ fontSize: "0.875rem", color: "var(--dim)", fontWeight: 300, fontFamily: "var(--font-ui), system-ui, sans-serif" }}>{protocol.name}</span>
            )}
            {user.streak > 0 && (
              <span style={{ fontSize: "0.875rem", color: "var(--dim)", fontWeight: 300, fontFamily: "var(--font-ui), system-ui, sans-serif", paddingLeft: "0.5rem", borderLeft: "1px solid var(--border-subtle)" }}>
                {user.streak} day streak
              </span>
            )}
          </div>
        </div>

        <AlumniGate active={!!isAlumni} label="Daily tracking is part of active mentorship.">
          <div style={{ marginBottom: "1.75rem", padding: "0.875rem 1.125rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--primary)", flexShrink: 0, marginTop: "0.3rem", animation: "pulse 2s ease infinite" }} aria-hidden />
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ink)", marginBottom: "0.2rem" }}>Daily check-in waiting</p>
              <p style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300 }}>Take 3 minutes. Be honest. THP reviews every entry.</p>
            </div>
          </div>

          {/* Loading skeleton */}
          {loadingQuestions && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
              {[90, 70, 85, 60].map((w, i) => (
                <div key={i} style={{ height: "80px", background: "var(--surface)", borderRadius: "8px", opacity: 0.4, borderLeft: "3px solid var(--border)" }} />
              ))}
            </div>
          )}

          {/* Questions */}
          {!loadingQuestions && fieldsToShow && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", marginBottom: "2rem" }}>
              {fieldsToShow.map(field => (
                field.type === "upload"
                  ? null
                  : <TrackerFieldCmp key={field.id} field={field as TrackerField} value={values[field.id]} onChange={v => setValue(field.id, v)} />
              ))}
            </div>
          )}

          {/* No questions yet — plain check-in */}
          {!loadingQuestions && !fieldsToShow && (
            <div style={{ marginBottom: "2rem", padding: "1.25rem 1.5rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
              <p style={{ fontSize: "0.9375rem", fontWeight: 400, color: "var(--muted)", lineHeight: 1.6 }}>
                Your tracker is being prepared. Log your check-in now to keep your streak going.
              </p>
            </div>
          )}

          <div style={{ paddingTop: "1.5rem", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <div ref={pulseRef} style={{ position: "absolute", inset: 0, borderRadius: "100px", background: "var(--primary)", pointerEvents: "none", opacity: 0 }} />
              <button onClick={handleSubmit} disabled={submitting || loadingQuestions}
                style={{ position: "relative", height: "50px", padding: "0 2rem", background: (submitting || loadingQuestions) ? "var(--primary-dim)" : "var(--primary)", color: "#ffffff", border: "none", borderRadius: "100px", fontSize: "0.9375rem", fontWeight: 500, fontFamily: "var(--font-ui), system-ui, sans-serif", cursor: (submitting || loadingQuestions) ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: "0.5rem", transition: "background 200ms ease" }}
                onMouseEnter={e => { if (!submitting && !loadingQuestions) (e.currentTarget as HTMLButtonElement).style.background = "var(--primary-hover)"; }}
                onMouseLeave={e => { if (!submitting && !loadingQuestions) (e.currentTarget as HTMLButtonElement).style.background = "var(--primary)"; }}
              >
                {submitting ? <><Spinner />Logging…</> : "Log today's entry"}
              </button>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--dim)", fontWeight: 300 }}>THP reviews every submission.</p>
          </div>
        </AlumniGate>
      </div>
    </>
  );
}

function TrackerFieldCmp({ field, value, onChange }: {
  field: TrackerField; value: string | number | boolean | undefined;
  onChange: (v: string | number | boolean) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{
      background: "var(--surface)",
      borderLeft: "3px solid var(--primary)",
      borderRadius: "8px",
      padding: "1rem 1.25rem",
    }}>
      <label style={{ display: "block", marginBottom: field.hint ? "0.25rem" : "0.625rem" }}>
        <span style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--ink)" }}>
          {field.label}
          {field.optional && <span style={{ fontSize: "0.8rem", fontWeight: 300, color: "var(--dim)", marginLeft: "0.5rem" }}>optional</span>}
        </span>
      </label>
      {field.hint && <p style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300, marginBottom: "0.625rem", lineHeight: 1.5 }}>{field.hint}</p>}

      {field.type === "boolean" && (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {([{ v: true, label: "Yes" }, { v: false, label: "No" }] as {v: boolean, label: string}[]).map(({ v, label }) => (
            <button key={label} type="button" onClick={() => onChange(v)}
              style={{ height: "42px", padding: "0 1.5rem", borderRadius: "7px", border: `1px solid ${value === v ? "var(--primary)" : "var(--border)"}`, background: value === v ? "var(--primary)" : "var(--surface)", color: value === v ? "#ffffff" : "var(--muted)", fontSize: "0.9rem", fontWeight: value === v ? 500 : 400, fontFamily: "var(--font-ui), system-ui, sans-serif", cursor: "pointer", transition: "all 150ms ease" }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {field.type === "rating" && (
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
            <button key={n} type="button" onClick={() => onChange(n)} aria-pressed={value === n}
              style={{ width: "40px", height: "40px", borderRadius: "7px", border: `1px solid ${value === n ? "var(--primary)" : "var(--border)"}`, background: value === n ? "var(--primary)" : "var(--surface)", color: value === n ? "#ffffff" : "var(--muted)", fontSize: "0.875rem", fontWeight: value === n ? 600 : 400, fontFamily: "var(--font-ui), system-ui, sans-serif", cursor: "pointer", transition: "all 150ms ease", flexShrink: 0 }}>
              {n}
            </button>
          ))}
        </div>
      )}

      {field.type === "number" && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="number" value={value as string || ""} placeholder={field.placeholder || "0"}
            onChange={e => onChange(parseFloat(e.target.value) || 0)}
            onFocus={e => (e.target.style.borderColor = "var(--primary)")}
            onBlur={e => (e.target.style.borderColor = "var(--border)")}
            style={{ width: "120px", height: "44px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "7px", padding: "0 0.875rem", fontSize: "1rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", fontWeight: 300, outline: "none", transition: "border-color 150ms" }} />
          {field.unit && <span style={{ fontSize: "0.875rem", color: "var(--muted)", fontWeight: 300 }}>{field.unit}</span>}
        </div>
      )}

      {field.type === "text" && (
        <input type="text" value={value as string || ""} placeholder={field.placeholder || ""}
          onChange={e => onChange(e.target.value)}
          onFocus={e => { setFocused(true); e.target.style.borderColor = "var(--primary)"; }}
          onBlur={e => { setFocused(false); e.target.style.borderColor = "var(--border)"; }}
          style={{ width: "100%", height: "44px", background: "var(--surface)", border: `1px solid ${focused ? "var(--primary)" : "var(--border)"}`, borderRadius: "7px", padding: "0 0.875rem", fontSize: "0.9375rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", fontWeight: 300, outline: "none", transition: "border-color 150ms" }} />
      )}

      {field.type === "textarea" && (
        <textarea value={value as string || ""} placeholder={field.placeholder || ""}
          onChange={e => onChange(e.target.value)} rows={3}
          onFocus={e => { setFocused(true); e.target.style.borderColor = "var(--primary)"; }}
          onBlur={e => { setFocused(false); e.target.style.borderColor = "var(--border)"; }}
          style={{ width: "100%", background: "var(--surface)", border: `1px solid ${focused ? "var(--primary)" : "var(--border)"}`, borderRadius: "8px", padding: "0.75rem 0.875rem", fontSize: "0.9375rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", fontWeight: 300, outline: "none", resize: "vertical", lineHeight: 1.6, transition: "border-color 150ms", minHeight: "88px" }} />
      )}
    </div>
  );
}

function MediaUploadField({ field, files, previews, fileRef, onAddFiles, onRemove }: {
  field: TrackerField; files: File[]; previews: string[];
  fileRef: React.RefObject<HTMLInputElement | null>;
  onAddFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div>
      <label style={{ display: "block", marginBottom: field.hint ? "0.25rem" : "0.625rem" }}>
        <span style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--ink)" }}>
          {field.label}
          {field.optional && <span style={{ fontSize: "0.8rem", fontWeight: 300, color: "var(--dim)", marginLeft: "0.5rem" }}>optional</span>}
        </span>
      </label>
      {field.hint && <p style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300, marginBottom: "0.75rem", lineHeight: 1.55 }}>{field.hint}</p>}

      <div style={{ marginBottom: "0.875rem", padding: "0.625rem 0.875rem", background: "oklch(0.60 0.18 165 / 0.05)", border: "1px solid oklch(0.60 0.18 165 / 0.12)", borderRadius: "7px", display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.9rem", flexShrink: 0 }} aria-hidden>📸</span>
        <p style={{ fontSize: "0.8125rem", color: "var(--primary)", fontWeight: 400, lineHeight: 1.5 }}>
          THP sees every upload. This is how he tracks real progress over time, not just what you report.
        </p>
      </div>

      {previews.length > 0 && (
        <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          {previews.map((src, i) => (
            <div key={i} style={{ position: "relative" }}>
              {files[i]?.type.startsWith("video") ? (
                <div style={{ width: "96px", height: "96px", borderRadius: "8px", background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.375rem" }}>
                  <span style={{ fontSize: "1.5rem" }} aria-hidden>🎥</span>
                  <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Video</span>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={`Upload ${i + 1}`} style={{ width: "96px", height: "96px", objectFit: "cover", borderRadius: "8px", border: "1px solid var(--border)", display: "block" }} />
              )}
              <button onClick={() => onRemove(i)} aria-label="Remove"
                style={{ position: "absolute", top: "-6px", right: "-6px", width: "20px", height: "20px", borderRadius: "50%", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--muted)", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={() => fileRef.current?.click()}
        style={{ display: "flex", alignItems: "center", gap: "0.75rem", width: "100%", padding: "0.875rem 1.125rem", border: "1px dashed var(--border)", borderRadius: "9px", background: "var(--surface)", cursor: "pointer", transition: "border-color 150ms, background 150ms", textAlign: "left" }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary)"; (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.60 0.18 165 / 0.04)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--surface)"; }}>
        <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: "var(--muted)" }} aria-hidden>
            <path d="M9 12V4m0 0L6 7m3-3 3 3M16 13v1.5A1.5 1.5 0 0 1 14.5 16h-11A1.5 1.5 0 0 1 2 14.5V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--muted)", marginBottom: "0.125rem" }}>
            {files.length ? `${files.length} file${files.length > 1 ? "s" : ""} added · add more` : "Upload photos or videos"}
          </p>
          <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300 }}>Photos and short clips · up to 5 files</p>
        </div>
      </button>
    </div>
  );
}

// ─── BASIC CHECK-IN (no tracker template assigned yet) ─────────────────────

function BasicCheckIn({ firstName, greeting, alreadyCheckedIn, todayFormatted, onComplete }: {
  firstName: string; greeting: string; alreadyCheckedIn: boolean; todayFormatted: string; onComplete: () => void;
}) {
  const [done, setDone] = useState(false);
  const handleCheckIn = async () => { setDone(true); onComplete(); };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
      <p style={{ fontSize: "0.8125rem", color: "var(--dim)", fontWeight: 300, marginBottom: "0.375rem" }}>{todayFormatted}</p>
      <h2 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(1.5rem, 4vw, 2.25rem)", fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.02em", lineHeight: 1.15, marginBottom: "2rem" }}>
        {greeting}, {firstName}.
      </h2>
      {alreadyCheckedIn || done ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1.25rem 1.5rem", background: "oklch(0.45 0.15 145 / 0.08)", border: "1px solid oklch(0.45 0.15 145 / 0.2)", borderRadius: "12px" }}>
          <span style={{ fontSize: "1.25rem" }}>✓</span>
          <div>
            <p style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--ink)" }}>Checked in for today.</p>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300 }}>Your protocol is live. THP will be in touch.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ padding: "1.25rem 1.5rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
            <p style={{ fontSize: "0.9375rem", fontWeight: 400, color: "var(--muted)", lineHeight: 1.6 }}>Your protocol is live. Follow it today and check in to keep your streak going.</p>
          </div>
          <button onClick={handleCheckIn}
            style={{ height: "52px", background: "var(--primary)", color: "#ffffff", border: "none", borderRadius: "10px", fontSize: "0.9375rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
            Mark today as done
          </button>
        </div>
      )}
    </motion.div>
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

function ProtocolTab({ user, protocol, notionPageId }: { user: StoredUser; protocol: Protocol | null; notionPageId?: string }) {
  const [stages, setStages] = useState<ClientProtocol[]>([]);
  const [activeStage, setActiveStage] = useState<ClientProtocol | null>(null);
  const [blocks, setBlocks] = useState<NotionBlock[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getClientProtocols(user.email).then(protocols => {
      if (protocols.length > 0) {
        setStages(protocols);
        setActiveStage(protocols[protocols.length - 1]);
      } else if (notionPageId) {
        const legacy: ClientProtocol = {
          id: 'legacy',
          userEmail: user.email,
          stage: 1,
          notionPageId,
          title: 'Protocol',
          createdAt: user.joinedAt,
        };
        setStages([legacy]);
        setActiveStage(legacy);
      }
    }).catch(() => {
      if (notionPageId) {
        const legacy: ClientProtocol = { id: 'legacy', userEmail: user.email, stage: 1, notionPageId, title: 'Protocol', createdAt: user.joinedAt };
        setStages([legacy]);
        setActiveStage(legacy);
      }
    });
  }, [user.email, notionPageId]);

  useEffect(() => {
    if (!activeStage) return;
    setLoading(true);
    setBlocks([]);
    fetch(`/api/notion-protocol?pageId=${activeStage.notionPageId}`)
      .then(r => r.json())
      .then(data => { if (data.blocks) setBlocks(data.blocks); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeStage?.notionPageId]);

  if (!protocol && !notionPageId && stages.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: "2rem" }}>
        <p style={{ fontSize: "0.9375rem", color: "var(--dim)", fontWeight: 300, textAlign: "center", lineHeight: 1.6 }}>
          Your protocol is being prepared. Check back soon.
        </p>
      </div>
    );
  }

  const protocolStatus = user.diagnosticData?.protocolStatus;
  if (notionPageId && (protocolStatus === "building" || protocolStatus === "updating") && stages.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: "2rem" }}>
        <p style={{ fontSize: "0.9375rem", color: "var(--dim)", fontWeight: 300, textAlign: "center", lineHeight: 1.6 }}>
          {protocolStatus === "building" ? "Your protocol is being built." : "Your protocol is being updated."}
        </p>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "1.5rem 1.25rem" }}>
      {stages.length > 1 && (
        <div style={{ display: "flex", gap: "0.375rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          {stages.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveStage(s)}
              style={{
                height: "28px", padding: "0 0.875rem", borderRadius: "99px",
                border: "1px solid",
                borderColor: activeStage?.id === s.id ? "var(--primary)" : "var(--border-subtle)",
                background: activeStage?.id === s.id ? "oklch(0.60 0.18 165 / 0.12)" : "none",
                color: activeStage?.id === s.id ? "var(--primary)" : "var(--dim)",
                fontSize: "0.75rem", fontWeight: activeStage?.id === s.id ? 500 : 400,
                cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif",
                transition: "all 150ms",
              }}>
              Stage {s.stage}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: "60px", background: "var(--surface)", borderRadius: "8px", opacity: 0.5 }} />
          ))}
        </div>
      )}

      {!loading && blocks.length > 0 && (
        <NotionRenderer blocks={blocks} />
      )}

      {activeStage?.notionPageId && (
        <a
          href={`https://www.notion.so/${activeStage.notionPageId.replace(/-/g, "")}`}
          target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", marginTop: "1.5rem", fontSize: "0.8rem", color: "var(--dim)", textDecoration: "none", fontWeight: 300 }}>
          <NotionIcon /> Open in Notion
        </a>
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

// ─── BOOK TAB ─────────────────────────────────────────────────────────────

function BookTab({ isAlumni }: { isAlumni?: boolean }) {
  return (
    <div>
      <div style={{ marginBottom: "2.5rem" }}>
        <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: "0.625rem" }}>Book a call.</h1>
        <p style={{ fontSize: "1rem", color: "var(--muted)", fontWeight: 300, lineHeight: 1.65, maxWidth: "52ch" }}>Progress reviews, strategy sessions, working through a block. Pick a time and we'll go from there.</p>
      </div>

      <AlumniGate active={!!isAlumni} label="Live calls are part of active mentorship.">
        <div style={{ padding: "1.5rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", marginBottom: "1.5rem" }}>
          <p style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--ink)", marginBottom: "0.375rem" }}>Schedule a session</p>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", fontWeight: 300, lineHeight: 1.6, marginBottom: "1.25rem" }}>
            Pick a time directly from the calendar. THP blocks time for every active client.
          </p>
          <a href={CAL_LINK} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", height: "44px", padding: "0 1.25rem", background: "var(--primary)", color: "#ffffff", borderRadius: "8px", textDecoration: "none", fontSize: "0.9rem", fontWeight: 500, transition: "background 150ms" }}
            onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = "var(--primary-hover)"}
            onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = "var(--primary)"}>
            <CalIcon /> Book a time
          </a>
        </div>
      </AlumniGate>

      <div style={{ padding: "1.25rem 1.375rem", background: "oklch(0.55 0.18 30 / 0.07)", border: "1px solid oklch(0.55 0.18 30 / 0.2)", borderRadius: "12px", marginBottom: "1.5rem", display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "oklch(0.55 0.18 30 / 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7.25 5.25a.75.75 0 0 1 1.5 0V8.5a.75.75 0 0 1-1.5 0V5.25Zm.75 6a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" fill="oklch(0.75 0.15 30)" />
          </svg>
        </div>
        <div>
          <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "oklch(0.78 0.12 30)", marginBottom: "0.375rem" }}>Emergency calls</p>
          <p style={{ fontSize: "0.8125rem", color: "oklch(0.65 0.08 30)", fontWeight: 300, lineHeight: 1.6 }}>
            Only use these if you are in a serious situation that needs immediate attention or help. If I&apos;m available I will respond. If I am not, I will send you a voice message or text message.
          </p>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("THP, I need urgent help. This is an emergency call request.")}`}
            target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", marginTop: "0.875rem", height: "34px", padding: "0 0.875rem", background: "oklch(0.55 0.18 30 / 0.12)", border: "1px solid oklch(0.55 0.18 30 / 0.25)", borderRadius: "7px", color: "oklch(0.75 0.15 30)", textDecoration: "none", fontSize: "0.8125rem", fontWeight: 500, transition: "background 150ms" }}
            onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = "oklch(0.55 0.18 30 / 0.2)"}
            onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = "oklch(0.55 0.18 30 / 0.12)"}>
            <WhatsAppIcon /> Emergency WhatsApp
          </a>
        </div>
      </div>

      <div style={{ padding: "1rem 1.25rem", background: "var(--surface)", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300, lineHeight: 1.6 }}>
          <strong style={{ fontWeight: 500, color: "var(--ink)" }}>Lifetime access.</strong>{" "}
          You can book at any time, during your mentorship or after. This never expires.
        </p>
      </div>
    </div>
  );
}

// ─── VOICE NOTE PLAYER ───────────────────────────────────────────────────

const WAVEFORM_BARS = [0.4, 0.7, 0.5, 1.0, 0.6, 0.8, 0.3, 0.9, 0.5, 0.7, 0.4, 0.6, 0.8, 0.5, 0.9, 0.4, 0.7, 0.3, 0.6, 0.8];

function VoiceNotePlayer({ url, isAdmin, transcript }: { url: string; isAdmin: boolean; transcript?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); } else { a.play(); }
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onPlay = () => { setPlaying(true); tickRef.current = setInterval(() => setElapsed(a.currentTime), 100); };
    const onPause = () => { setPlaying(false); if (tickRef.current) clearInterval(tickRef.current); };
    const onEnded = () => { setPlaying(false); setElapsed(0); if (tickRef.current) clearInterval(tickRef.current); };
    const onMeta = () => setDuration(isFinite(a.duration) ? a.duration : 0);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("loadedmetadata", onMeta);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("loadedmetadata", onMeta);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const progress = duration > 0 ? elapsed / duration : 0;
  const accentColor = isAdmin ? "var(--color-red)" : "oklch(0.70 0.20 220)";
  const bgColor = isAdmin ? "oklch(0.60 0.18 165 / 0.12)" : "oklch(0.15 0.02 220 / 0.5)";

  return (
    <div style={{ marginTop: "0.375rem" }}>
      <audio ref={audioRef} src={url} preload="metadata" style={{ display: "none" }} />
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.5rem 0.75rem", background: bgColor, borderRadius: "10px", minWidth: "180px", maxWidth: "240px" }}>
        <button onClick={togglePlay} style={{ width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0, background: accentColor, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity 150ms" }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = "0.8"}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = "1"}>
          {playing
            ? <svg width="10" height="10" viewBox="0 0 10 10" fill="#ffffff" aria-hidden><rect x="1" y="1" width="3" height="8" rx="1"/><rect x="6" y="1" width="3" height="8" rx="1"/></svg>
            : <svg width="10" height="10" viewBox="0 0 10 10" fill="#ffffff" aria-hidden style={{ marginLeft: "1px" }}><polygon points="2,1 9,5 2,9"/></svg>}
        </button>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "22px" }}>
            {WAVEFORM_BARS.map((h, i) => (
              <div key={i} style={{ width: "2.5px", borderRadius: "2px", flexShrink: 0, height: `${h * 100}%`, background: i / WAVEFORM_BARS.length <= progress ? accentColor : (isAdmin ? "oklch(0.60 0.18 165 / 0.35)" : "oklch(0.97 0.005 220 / 0.25)"), transition: "background 80ms" }} />
            ))}
          </div>
          <span style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono), monospace", color: isAdmin ? "var(--dim)" : "oklch(0.97 0.005 220 / 0.55)", fontWeight: 300 }}>
            {playing || elapsed > 0 ? fmt(elapsed) : duration > 0 ? fmt(duration) : "0:00"}
          </span>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isAdmin ? "var(--dim)" : "oklch(0.97 0.005 220 / 0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        </svg>
      </div>
      {transcript && (
        <p style={{ marginTop: "0.375rem", fontSize: "0.8rem", color: isAdmin ? "var(--muted)" : "oklch(0.97 0.005 220 / 0.7)", fontWeight: 300, lineHeight: 1.5, fontStyle: "italic", maxWidth: "240px" }}>
          &ldquo;{transcript}&rdquo;
        </p>
      )}
    </div>
  );
}

// ─── ATTACHMENT RENDERER ─────────────────────────────────────────────────

function AttachmentRender({ url, type, name, isAdmin, transcript }: { url: string; type: AttachmentType; name?: string; isAdmin: boolean; transcript?: string }) {
  if (type === "audio") return <VoiceNotePlayer url={url} isAdmin={isAdmin} transcript={transcript} />;
  if (type === "image") return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name || "Image"} style={{ maxWidth: "100%", borderRadius: "8px", marginTop: "0.375rem", cursor: "pointer", display: "block" }} onClick={() => window.open(url, "_blank")} />
  );
  if (type === "video") return <video controls src={url} style={{ maxWidth: "100%", borderRadius: "8px", marginTop: "0.375rem", display: "block" }} />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", marginTop: "0.375rem", fontSize: "0.8125rem", color: isAdmin ? "var(--primary)" : "#ffffff", textDecoration: "underline" }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
      {name || "Download file"}
    </a>
  );
}

function renderTextWithLinks(text: string, isAdmin: boolean) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: isAdmin ? "var(--primary)" : "#ffffff", textDecoration: "underline", wordBreak: "break-all" }}>{part}</a>
      : part
  );
}

// ─── NIKODEM TAB ──────────────────────────────────────────────────────────

function NikodmTab({ user, isAlumni }: { user: StoredUser; isAlumni?: boolean }) {
  const userEmail = user.email;
  const [messages, setMessages] = useState<Message[]>([]);
  const [compose, setCompose] = useState("");
  const [focused, setFocused] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [adminActive, setAdminActive] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingType, setPendingType] = useState<AttachmentType | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const msgEndRef = useRef<HTMLDivElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(28).fill(0.05));

  const refreshMessages = () => {
    getMessages(userEmail).then(msgs => {
      setMessages(msgs);
      setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    });
  };

  useEffect(() => {
    refreshMessages();

    // Check admin status immediately then poll every 90s so offline is detected even without a DB event
    isAdminActive().then(setAdminActive).catch(() => {});
    const presencePoll = setInterval(() => isAdminActive().then(setAdminActive).catch(() => {}), 90000);

    // Client presence heartbeat
    updatePresence(userEmail).catch(() => {});
    const heartbeatInterval = setInterval(() => updatePresence(userEmail).catch(() => {}), 60000);

    // Message stream — manual replies from admin
    const channel = supabase
      .channel(`messages:${userEmail}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages', filter: `user_email=eq.${userEmail}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (payload: any) => {
        const row = payload.new;
        if (row?.from_type === 'admin') {
          refreshMessages();
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try { new Notification('New message from THP', { body: (row.text ?? '').slice(0, 100), icon: '/thp.jpg' }); } catch { /* blocked */ }
          }
        }
      }).subscribe();

    // Admin presence: update indicator immediately on each admin heartbeat
    const presenceChannel = supabase
      .channel('admin-presence-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'presence', filter: 'id=eq.admin' }, () => {
        isAdminActive().then(setAdminActive).catch(() => {});
      })
      .subscribe();

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(presencePoll);
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  const startRecording = async () => {
    try {
      setVoiceTranscript("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      mr.onstop = () => {
        setAudioBlob(new Blob(chunks, { type: mr.mimeType || "audio/webm" }));
        setPendingType("audio");
        stream.getTracks().forEach(t => t.stop());
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        audioCtxRef.current?.close();
        audioCtxRef.current = null;
        analyserRef.current = null;
        setWaveformBars(Array(28).fill(0.05));
      };
      mr.start();
      mediaRecorderRef.current = mr;
      try {
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);
        analyserRef.current = analyser;
        const draw = () => {
          const data = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(data);
          setWaveformBars(Array.from({ length: 28 }, (_, i) => Math.max(0.05, data[Math.floor(i * data.length / 28)] / 255)));
          animFrameRef.current = requestAnimationFrame(draw);
        };
        animFrameRef.current = requestAnimationFrame(draw);
      } catch { /* AudioContext unavailable */ }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rec: any = new SR();
        rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
        let finalText = "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onresult = (e: any) => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " ";
            else interim = e.results[i][0].transcript;
          }
          setVoiceTranscript((finalText + interim).trim());
        };
        rec.start();
        speechRecRef.current = rec;
      }
      setRecording(true);
    } catch { /* mic denied */ }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    speechRecRef.current?.stop();
    const rawTranscript = voiceTranscript;
    speechRecRef.current = null;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setRecording(false);
    if (rawTranscript?.trim()) {
      fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rawTranscript }) })
        .then(r => r.json()).then(d => { if (d.transcript) setVoiceTranscript(d.transcript); }).catch(() => {});
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type: AttachmentType = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file";
    setPendingFile(file);
    setPendingType(type);
    e.target.value = "";
  };

  const clearPending = () => { setPendingFile(null); setPendingType(null); setAudioBlob(null); setVoiceTranscript(""); };

  const canSend = compose.trim() || pendingFile || audioBlob;

  const handleSend = async () => {
    if (!canSend || uploading) return;
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch { /* unsupported */ }
    }
    setUploading(true);
    setSendError(null);
    let attachment: { url: string; type: AttachmentType; name?: string } | undefined;
    const capturedTranscript = voiceTranscript;
    if (audioBlob) {
      const url = await uploadMessageAttachment(audioBlob, "voice.webm", userEmail);
      if (url) { attachment = { url, type: "audio", name: "Voice note" }; }
      else { setAudioBlob(null); setUploading(false); setSendError("Upload failed. Please try again."); return; }
      setAudioBlob(null); setVoiceTranscript("");
    } else if (pendingFile) {
      const url = await uploadMessageAttachment(pendingFile, pendingFile.name, userEmail);
      if (url) { attachment = { url, type: pendingType!, name: pendingFile.name }; }
      else { setPendingFile(null); setPendingType(null); setUploading(false); setSendError("Upload failed. Please try again."); return; }
      setPendingFile(null); setPendingType(null);
    }
    const text = attachment?.type === "audio" ? capturedTranscript : compose.trim();
    if (!text && !attachment) { setUploading(false); return; }
    setCompose("");
    setUploading(false);
    await addMessage(userEmail, text, "client", attachment);
    refreshMessages();
  };

  return (
    <div>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: "0.625rem" }}>Direct access.</h1>
        <p style={{ fontSize: "1rem", color: "var(--muted)", fontWeight: 300, lineHeight: 1.65, maxWidth: "52ch" }}>Use this when you&apos;re stuck, have a win to share, or need a quick answer.</p>
      </div>

      {/* Mentor card */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem 1.25rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", marginBottom: "1.5rem" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "50%", overflow: "hidden", border: "2px solid oklch(0.60 0.18 165 / 0.3)", flexShrink: 0, background: "oklch(0.60 0.18 165 / 0.1)" }}>
          <img src="/thp.jpg" alt="THP" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--ink)", marginBottom: "0.2rem" }}>THP</p>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300 }}>
            {adminActive ? "Your mentor · Active now" : "Your mentor · Away right now, messages are reviewed and followed up personally"}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: adminActive ? "oklch(0.7 0.15 145)" : "var(--muted)", animation: adminActive ? "pulse 2.5s ease infinite" : "none", opacity: adminActive ? 1 : 0.5 }} aria-hidden />
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 300 }}>{adminActive ? "Active" : "Away"}</span>
        </div>
      </div>

      {/* Message thread */}
      {messages.length > 0 && (
        <div style={{ marginBottom: "1.25rem", padding: "1rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "12px", maxHeight: "320px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {messages.map((msg, i) => {
            const isAdmin = msg.from === "admin";
            const showDate = i === 0 || new Date(messages[i - 1].ts).toDateString() !== new Date(msg.ts).toDateString();
            return (
              <div key={msg.id}>
                {showDate && (
                  <p style={{ textAlign: "center", fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, margin: "0.375rem 0" }}>
                    {new Date(msg.ts).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                )}
                <div style={{ display: "flex", justifyContent: isAdmin ? "flex-start" : "flex-end" }}>
                  <div style={{ maxWidth: "78%", padding: "0.5rem 0.75rem", borderRadius: isAdmin ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: isAdmin ? "oklch(0.60 0.18 165 / 0.15)" : "var(--surface)", border: isAdmin ? "1px solid oklch(0.60 0.18 165 / 0.35)" : "1px solid var(--border)" }}>
                    {isAdmin && <p style={{ fontSize: "0.7rem", color: "var(--primary)", fontWeight: 500, marginBottom: "0.2rem" }}>THP</p>}
                    {msg.text && msg.attachmentType !== "audio" && <p style={{ fontSize: "0.875rem", color: "var(--ink)", fontWeight: 300, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{renderTextWithLinks(msg.text, isAdmin)}</p>}
                    {msg.attachmentUrl && msg.attachmentType && <AttachmentRender url={msg.attachmentUrl} type={msg.attachmentType} name={msg.attachmentName} isAdmin={isAdmin} transcript={msg.attachmentType === "audio" ? msg.text : undefined} />}
                    <p style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono), monospace", color: "var(--dim)", fontWeight: 300, marginTop: "0.2rem", textAlign: "right" }}>
                      {new Date(msg.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={msgEndRef} />
        </div>
      )}

      {/* Compose */}
      <AlumniGate active={!!isAlumni} label="Direct access ends with your mentorship.">
        <div style={{ marginBottom: "2rem" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--muted)", marginBottom: "0.5rem" }}>Send a message</label>
          {sendError && (
            <div style={{ padding: "0.375rem 0.75rem", background: "oklch(0.25 0.08 25 / 0.8)", border: "1px solid oklch(0.55 0.18 25 / 0.5)", borderRadius: "7px", marginBottom: "0.5rem", fontSize: "0.8rem", color: "oklch(0.85 0.12 25)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {sendError}
              <button onClick={() => setSendError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: "1rem", lineHeight: 1 }}>×</button>
            </div>
          )}
          {(pendingFile || audioBlob) && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.625rem 0.875rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", marginBottom: "0.5rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                  {audioBlob ? (recording ? "Recording..." : "Voice note ready") : pendingFile?.name}
                </span>
                {audioBlob && voiceTranscript && (
                  <span style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{voiceTranscript}</span>
                )}
              </div>
              <button onClick={clearPending} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--dim)", cursor: "pointer", fontSize: "1rem", lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", padding: "0.5rem 0.5rem 0.5rem 0.875rem", background: "var(--surface)", borderRadius: "24px", border: `1px solid ${focused ? "var(--primary)" : "var(--border)"}`, transition: "border-color 150ms" }}>
            <input ref={fileInputRef} type="file" accept="image/*,video/*,application/pdf,.doc,.docx,.txt" onChange={handleFileChange} style={{ display: "none" }} aria-hidden />
            <button onClick={() => fileInputRef.current?.click()} title="Attach file"
              style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "var(--dim)", cursor: "pointer", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            {recording ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "2px", height: "40px", padding: "0 0.25rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#ef4444", fontWeight: 500, fontFamily: "var(--font-ui), system-ui, sans-serif", marginRight: "0.5rem", flexShrink: 0 }}>rec</span>
                {waveformBars.map((h, i) => (
                  <div key={i} style={{ flex: 1, borderRadius: "2px", background: "#ef4444", height: `${Math.round(h * 32)}px`, minHeight: "3px", transition: "height 60ms ease" }} />
                ))}
              </div>
            ) : (
              <textarea value={compose} onChange={e => setCompose(e.target.value)} placeholder="Hi THP, I wanted to ask about..." rows={1}
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend(); }}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", fontSize: "0.9375rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", fontWeight: 300, lineHeight: 1.6, minHeight: "32px", maxHeight: "160px", overflowY: "auto", padding: "0.25rem 0", alignSelf: "center" }} />
            )}
            <button onClick={recording ? stopRecording : startRecording} title={recording ? "Stop recording" : "Record voice note"}
              style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", background: recording ? "#ef4444" : "none", border: "none", borderRadius: "50%", color: recording ? "white" : "var(--dim)", cursor: "pointer", transition: "all 150ms", flexShrink: 0 }}>
              {recording
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>}
            </button>
            {(canSend && !uploading) && (
              <button onClick={handleSend}
                style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--primary)", border: "none", color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 200ms ease" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            )}
            {uploading && (
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Spinner />
              </div>
            )}
          </div>
        </div>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300, lineHeight: 1.65 }}>
          I check this regularly and will be in touch soon. Ask anything: questions, blocks, wins, check-ins.
        </p>
      </AlumniGate>
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
            href={`https://wa.me/447453172081?text=${encodeURIComponent("Hi THP, I want to continue mentorship.")}`}
            target="_blank" rel="noopener noreferrer"
            style={{ height: "44px", padding: "0 1.375rem", background: "var(--primary)", color: "#ffffff", borderRadius: "8px", textDecoration: "none", fontSize: "0.9rem", fontWeight: 500, display: "inline-flex", alignItems: "center", transition: "background 150ms" }}
            onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = "var(--primary-hover)"}
            onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = "var(--primary)"}>
            Speak to THP
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

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
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
