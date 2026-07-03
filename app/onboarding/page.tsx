"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentUser, signOut, register, login } from "@/lib/auth";

type FormData = {
  fullName: string;
  ageLocation: string;
  contactInfo: string;
  travelPattern: string;
  whatTryingToFix: string;
  howAskForWhatYouWant: string;
  avoidDisappointing: string;
  validationSource: string;
  energyState: string;
  selfPerception: string;
  avoidConflict: string;
  responseToCriticism: string;
  internalStateEnteringRoom: string;
  pastRelationshipPatterns: string;
  trainingRecovery: string;
  heightWeightBf: string;
  sleepDuration: string;
  relationshipStatus: string;
  relationshipToRisk: string;
  sexualConfidence: string;
  alcoholUse: string;
  currentMedications: string;
  relationshipToFood: string;
  baselineInternalState: string;
  onTrt: string;
  whatStaysSolidTraveling: string;
  caffeineIntake: string;
  nicotineSubstances: string;
  sleepQuality: string;
  trainingFrequency: string;
  morningErections: string;
  eyeContact: string;
  sexualDynamic: string;
  physiqueFeeling: string;
  trainingApproach: string;
  howDecompress: string;
  libido: string;
  travelFrequency: string;
  wakeUpRecovered: string;
  recentHormonePanel: string;
};

const EMPTY: FormData = {
  fullName: "", ageLocation: "", contactInfo: "", travelPattern: "",
  whatTryingToFix: "", howAskForWhatYouWant: "", avoidDisappointing: "",
  validationSource: "", energyState: "", selfPerception: "", avoidConflict: "",
  responseToCriticism: "", internalStateEnteringRoom: "", pastRelationshipPatterns: "",
  trainingRecovery: "", heightWeightBf: "", sleepDuration: "", relationshipStatus: "",
  relationshipToRisk: "", sexualConfidence: "", alcoholUse: "", currentMedications: "",
  relationshipToFood: "", baselineInternalState: "", onTrt: "", whatStaysSolidTraveling: "",
  caffeineIntake: "", nicotineSubstances: "", sleepQuality: "", trainingFrequency: "",
  morningErections: "", eyeContact: "", sexualDynamic: "", physiqueFeeling: "",
  trainingApproach: "", howDecompress: "", libido: "", travelFrequency: "",
  wakeUpRecovered: "", recentHormonePanel: "",
};

const bg = "var(--color-ink)";
const ink = "#ffffff";
const muted = "rgba(255,255,255,0.45)";
const border = "rgba(255,255,255,0.1)";
const primary = "var(--color-red)";
const soft = "var(--color-ink-soft)";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "1.75rem" }}>
      <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, color: ink, marginBottom: hint ? "0.25rem" : "0.5rem", fontFamily: "var(--font-body), sans-serif" }}>
        {label}<span style={{ color: primary, marginLeft: "3px" }}>*</span>
      </label>
      {hint && (
        <p style={{ fontSize: "0.78rem", color: muted, marginBottom: "0.5rem", fontFamily: "var(--font-body), sans-serif", lineHeight: 1.4 }}>
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.75rem 1rem", background: soft, border: `1px solid ${border}`,
  borderRadius: "8px", color: ink, fontSize: "0.9rem", fontFamily: "var(--font-body), sans-serif",
  outline: "none", boxSizing: "border-box",
};

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
      onFocus={e => (e.target.style.borderColor = primary)}
      onBlur={e => (e.target.style.borderColor = border)}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
      onFocus={e => (e.target.style.borderColor = primary)}
      onBlur={e => (e.target.style.borderColor = border)}
    />
  );
}

function RadioGroup({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {options.map(opt => (
        <label key={opt} style={{
          display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.75rem 1rem",
          background: value === opt ? `color-mix(in srgb, var(--color-red) 15%, transparent)` : soft,
          border: `1px solid ${value === opt ? primary : border}`, borderRadius: "8px",
          cursor: "pointer", transition: "all 120ms",
        }}>
          <div style={{
            width: "18px", height: "18px", borderRadius: "50%", border: `2px solid ${value === opt ? primary : border}`,
            flexShrink: 0, marginTop: "1px", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {value === opt && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: primary }} />}
          </div>
          <span style={{ fontSize: "0.88rem", color: ink, fontFamily: "var(--font-body), sans-serif", lineHeight: 1.4 }}>{opt}</span>
          <input type="radio" value={opt} checked={value === opt} onChange={() => onChange(opt)} style={{ display: "none" }} />
        </label>
      ))}
    </div>
  );
}

const SECTIONS = [
  "Identity & Situation",
  "Psychology & Patterns",
  "Body & Recovery",
  "Lifestyle & Habits",
  "Final Details",
];

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? "";
  const tokenParam = searchParams.get("token") ?? "";

  const [user, setUser] = useState<{ email: string; password: string; name: string } | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [section, setSection] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "saving" | "generating" | "done" | "error">("idle");
  const [submitError, setSubmitError] = useState("");
  const [authMode, setAuthMode] = useState<"check" | "register" | "login" | "nudge">("check");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [accessVerified, setAccessVerified] = useState<boolean | null>(null); // null = checking
  const accessChecked = useRef(false);

  useEffect(() => {
    const cached = getCurrentUser();
    if (!cached) { setAuthMode("register"); return; }
    // If payment proof is in the URL (session_id = Stripe checkout, token = invite),
    // let pending users through — they just paid and need to fill intake.
    const hasPaymentProof = typeof window !== "undefined" &&
      (new URLSearchParams(window.location.search).has("session_id") ||
       new URLSearchParams(window.location.search).has("token"));
    if (cached.status === "pending" && !hasPaymentProof) { router.replace("/onboarding/pending"); return; }
    if (cached.status === "active" || cached.status === "alumni") { router.replace("/dashboard"); return; }
    setUser({ email: cached.email, password: cached.password, name: cached.name });
    setAuthMode("nudge");
    if (cached.diagnosticData && Object.keys(cached.diagnosticData).length > 0) {
      setForm(prev => ({ ...prev, ...cached.diagnosticData }));
    }
  }, [router]);

  // Verify payment / invite access once user is confirmed
  useEffect(() => {
    if (!user || accessChecked.current) return;
    accessChecked.current = true;

    if (!sessionId && !tokenParam) {
      // No proof of payment — block
      router.replace("/");
      return;
    }

    const params = new URLSearchParams();
    if (sessionId) params.set("session_id", sessionId);
    if (tokenParam) params.set("token", tokenParam);

    fetch(`/api/verify-onboarding-access?${params}`)
      .then(r => r.json())
      .then(({ valid }) => {
        if (!valid) { router.replace("/"); return; }
        setAccessVerified(true);
      })
      .catch(() => router.replace("/"));
  }, [user, sessionId, tokenParam, router]);

  const set = (key: keyof FormData) => (v: string) => setForm(prev => ({ ...prev, [key]: v }));

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    if (authMode === "register") {
      const result = await register(authForm.name.trim(), authForm.email.trim(), authForm.password);
      if (!result.success) { setAuthError(result.error ?? "Registration failed."); return; }
      const loginResult = await login(authForm.email.trim(), authForm.password);
      if (!loginResult.success || !loginResult.user) { setAuthError("Login after register failed."); return; }
      setUser({ email: loginResult.user.email, password: authForm.password, name: loginResult.user.name });
      setAuthMode("check");
    } else {
      const result = await login(authForm.email.trim(), authForm.password);
      if (!result.success || !result.user) { setAuthError(result.error ?? "Login failed."); return; }
      setUser({ email: result.user.email, password: authForm.password, name: result.user.name });
      setAuthMode("check");
    }
  }

  function validateSection(): boolean {
    const e: Record<string, string> = {};
    const sectionFields: (keyof FormData)[][] = [
      ["fullName", "ageLocation", "contactInfo", "travelPattern", "whatTryingToFix", "howAskForWhatYouWant", "avoidDisappointing", "validationSource"],
      ["energyState", "selfPerception", "avoidConflict", "responseToCriticism", "internalStateEnteringRoom", "pastRelationshipPatterns"],
      ["trainingRecovery", "heightWeightBf", "sleepDuration", "relationshipStatus", "relationshipToRisk", "sexualConfidence"],
      ["alcoholUse", "currentMedications", "relationshipToFood", "baselineInternalState", "onTrt", "whatStaysSolidTraveling", "caffeineIntake", "nicotineSubstances", "sleepQuality", "trainingFrequency"],
      ["morningErections", "eyeContact", "sexualDynamic", "physiqueFeeling", "trainingApproach", "howDecompress", "libido", "travelFrequency", "wakeUpRecovered", "recentHormonePanel"],
    ];
    for (const key of sectionFields[section]) {
      if (!form[key]?.trim()) e[key] = "Required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validateSection()) return;
    setSection(s => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setSection(s => s - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    if (!validateSection()) return;
    if (!user) return;
    setSubmitting(true);
    setSubmitStatus("saving");
    setSubmitError("");

    try {
      const res = await fetch("/api/generate-onboarding-protocol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, formData: form, token: tokenParam || undefined }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save intake");
      }

      setSubmitStatus("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setSubmitError(msg);
      setSubmitStatus("error");
      setSubmitting(false);
    }
  }

  const err = (k: keyof FormData) => errors[k] ? (
    <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "0.25rem" }}>{errors[k]}</p>
  ) : null;

  // While verifying access
  if (user && accessVerified === null && (sessionId || tokenParam)) {
    return (
      <div style={{ minHeight: "100dvh", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: muted, fontFamily: "var(--font-body), sans-serif", fontSize: "0.9rem" }}>Verifying access...</p>
      </div>
    );
  }

  // Intake submitted — done screen
  if (submitStatus === "done") {
    return (
      <div style={{ minHeight: "100dvh", background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ width: "100%", maxWidth: "420px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.72rem", letterSpacing: "0.22em", color: "var(--color-gold)", textTransform: "uppercase", marginBottom: "2rem" }}>THP Client Portal</p>
          <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: `color-mix(in srgb, var(--color-red) 15%, transparent)`, border: `1px solid var(--color-red)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.75rem" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "1.75rem", fontWeight: 400, color: ink, marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            You&apos;re In.
          </h1>
          <p style={{ color: muted, fontSize: "0.9rem", fontFamily: "var(--font-body), sans-serif", lineHeight: 1.65, marginBottom: "2.5rem" }}>
            Your intake has been received. THP will review everything and reach out with next steps.
          </p>
          <button
            onClick={() => router.replace("/dashboard")}
            style={{ padding: "0.875rem 2rem", background: primary, color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body), sans-serif" }}
          >
            Go to my dashboard →
          </button>
        </div>
      </div>
    );
  }

  // Saving spinner (brief — just while POST is in flight)
  if (submitting) {
    return (
      <div style={{ minHeight: "100dvh", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          style={{ width: "36px", height: "36px", borderRadius: "50%", border: `3px solid ${border}`, borderTopColor: primary }}
        />
      </div>
    );
  }

  if (authMode === "nudge" && user) {
    return (
      <div style={{ minHeight: "100dvh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ width: "100%", maxWidth: "420px" }}>
          <p style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.72rem", letterSpacing: "0.22em", color: "var(--color-gold)", textTransform: "uppercase", marginBottom: "1.5rem" }}>THP Client Portal</p>
          <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "1.75rem", fontWeight: 400, color: ink, marginBottom: "0.5rem", textTransform: "uppercase" }}>
            Welcome back, {user.name.split(" ")[0]}.
          </h1>
          <p style={{ color: muted, fontSize: "0.9rem", marginBottom: "2rem", fontFamily: "var(--font-body), sans-serif", lineHeight: 1.6 }}>
            Your application is in. The faster you complete your intake profile, the sooner THP can review and reach out.
          </p>
          <button
            onClick={() => setAuthMode("check")}
            style={{ width: "100%", padding: "0.875rem", background: primary, color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body), sans-serif" }}
          >
            Complete My Intake →
          </button>
          <button
            onClick={() => { signOut(); router.replace("/"); }}
            style={{ display: "block", margin: "1rem auto 0", background: "none", border: "none", color: muted, fontSize: "0.8rem", cursor: "pointer", fontFamily: "var(--font-body), sans-serif" }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (authMode === "register" || authMode === "login") {
    return (
      <div style={{ minHeight: "100dvh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ width: "100%", maxWidth: "420px" }}>
          <p style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.72rem", letterSpacing: "0.22em", color: "var(--color-gold)", textTransform: "uppercase", marginBottom: "1.5rem" }}>THP Client Portal</p>
          <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "1.75rem", fontWeight: 400, color: ink, marginBottom: "0.5rem", textTransform: "uppercase" }}>
            {authMode === "register" ? "Create Account" : "Sign In"}
          </h1>
          <p style={{ color: muted, fontSize: "0.85rem", marginBottom: "2rem", fontFamily: "var(--font-body), sans-serif" }}>
            {authMode === "register" ? "Set up your account to complete your intake." : "Sign in to continue your intake."}
          </p>
          <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {authMode === "register" && (
              <input placeholder="Full name" value={authForm.name} onChange={e => setAuthForm(f => ({ ...f, name: e.target.value }))} required style={inputStyle} />
            )}
            <input placeholder="Email" type="email" value={authForm.email} onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))} required style={inputStyle} />
            <input placeholder="Password" type="password" value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))} required style={inputStyle} />
            {authError && <p style={{ color: "#ef4444", fontSize: "0.8rem" }}>{authError}</p>}
            <button type="submit" style={{ padding: "0.875rem", background: primary, color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body), sans-serif" }}>
              {authMode === "register" ? "Create Account" : "Sign In"}
            </button>
          </form>
          <button onClick={() => setAuthMode(authMode === "register" ? "login" : "register")}
            style={{ marginTop: "1rem", background: "none", border: "none", color: muted, fontSize: "0.82rem", cursor: "pointer", fontFamily: "var(--font-body), sans-serif" }}>
            {authMode === "register" ? "Already have an account? Sign in" : "New? Create an account"}
          </button>
        </div>
      </div>
    );
  }

  if (authMode === "check" && !user) {
    return <div style={{ minHeight: "100dvh", background: bg }} />;
  }

  const sectionTitles = SECTIONS;
  const progress = ((section) / SECTIONS.length) * 100;

  return (
    <div style={{ minHeight: "100dvh", background: bg, padding: "2rem 1.5rem 4rem" }}>
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.72rem", letterSpacing: "0.22em", color: "var(--color-gold)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
            THP Client Intake
          </p>
          <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "clamp(1.5rem,4vw,2rem)", fontWeight: 400, color: ink, textTransform: "uppercase", marginBottom: "1.25rem" }}>
            {sectionTitles[section]}
          </h1>
          {/* Progress bar */}
          <div style={{ height: "3px", background: border, borderRadius: "2px", overflow: "hidden" }}>
            <motion.div animate={{ width: `${progress + (100 / SECTIONS.length)}%` }} transition={{ duration: 0.4 }}
              style={{ height: "100%", background: primary, borderRadius: "2px" }} />
          </div>
          <p style={{ fontSize: "0.75rem", color: muted, marginTop: "0.5rem", fontFamily: "var(--font-body), sans-serif" }}>
            Section {section + 1} of {SECTIONS.length}
          </p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={section} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>

            {/* ── SECTION 0: Identity & Situation ── */}
            {section === 0 && (
              <>
                <Field label="Full Name"><TextInput value={form.fullName} onChange={set("fullName")} />{err("fullName")}</Field>
                <Field label="Age" hint="where you from"><TextInput value={form.ageLocation} onChange={set("ageLocation")} />{err("ageLocation")}</Field>
                <Field label="Email" hint={"instagram:\nPhone number:"}><TextArea value={form.contactInfo} onChange={set("contactInfo")} rows={3} />{err("contactInfo")}</Field>
                <Field label="Location & Travel Pattern" hint="How often do you travel? Where are you based when stationary"><TextInput value={form.travelPattern} onChange={set("travelPattern")} />{err("travelPattern")}</Field>
                <Field label="What You're Trying To Fix" hint="What's actually broken right now?"><TextInput value={form.whatTryingToFix} onChange={set("whatTryingToFix")} />{err("whatTryingToFix")}</Field>
                <Field label="How Do You Ask For What You Want" hint="When you want something from someone, how do you ask for it? Direct? Indirect? Do you ask at all?"><TextInput value={form.howAskForWhatYouWant} onChange={set("howAskForWhatYouWant")} />{err("howAskForWhatYouWant")}</Field>
                <Field label="Doing Things To Avoid Disappointing Others">
                  <RadioGroup value={form.avoidDisappointing} onChange={set("avoidDisappointing")} options={["Constantly - my default operating mode","Often - happens multiple times per week","Occasionally - specific people or situations","Rarely - I mostly do what I want"]} />{err("avoidDisappointing")}
                </Field>
                <Field label="Validation Source" hint="When you succeed at something, where does the validation come from?">
                  <RadioGroup value={form.validationSource} onChange={set("validationSource")} options={["Internal - I know I did well","External - I need others to acknowledge it","Mixed - internal confirmation but seek external proof"]} />{err("validationSource")}
                </Field>
              </>
            )}

            {/* ── SECTION 1: Psychology & Patterns ── */}
            {section === 1 && (
              <>
                <Field label="Current State of Energy" hint="Not a 1-10. Just describe it energy levels/crashes"><TextInput value={form.energyState} onChange={set("energyState")} />{err("energyState")}</Field>
                <Field label="How You See Yourself" hint="Not who you want to be but who you actually are right now in your own eyes. (identity)"><TextInput value={form.selfPerception} onChange={set("selfPerception")} />{err("selfPerception")}</Field>
                <Field label="Do you avoid conflict?">
                  <RadioGroup value={form.avoidConflict} onChange={set("avoidConflict")} options={["Yes - almost always","Depends on the situation","No .. I engage when necessary"]} />{err("avoidConflict")}
                </Field>
                <Field label="Response To Criticism" hint="How do you respond when someone criticizes you? Be specific. What happens internally? What do you do externally?"><TextInput value={form.responseToCriticism} onChange={set("responseToCriticism")} />{err("responseToCriticism")}</Field>
                <Field label="Internal State Walking Into A Room" hint="are you nervous, confident or not conscious of it.."><TextInput value={form.internalStateEnteringRoom} onChange={set("internalStateEnteringRoom")} />{err("internalStateEnteringRoom")}</Field>
                <Field label="Past Relationship Patterns" hint="i need to know how you operate, are you a leader?"><TextInput value={form.pastRelationshipPatterns} onChange={set("pastRelationshipPatterns")} />{err("pastRelationshipPatterns")}</Field>
              </>
            )}

            {/* ── SECTION 2: Body & Recovery ── */}
            {section === 2 && (
              <>
                <Field label="Training Recovery">
                  <RadioGroup value={form.trainingRecovery} onChange={set("trainingRecovery")} options={["Full recovery between sessions","Adequate","Chronically under-recovered / sore"]} />{err("trainingRecovery")}
                </Field>
                <Field label="Height / Weight / BF%" hint="be specific boss"><TextInput value={form.heightWeightBf} onChange={set("heightWeightBf")} />{err("heightWeightBf")}</Field>
                <Field label="Average Sleep Duration" hint="Quality of sleep/hours?"><TextInput value={form.sleepDuration} onChange={set("sleepDuration")} />{err("sleepDuration")}</Field>
                <Field label="Current Relationship Status" hint="Family? Kids? Need to know for psychological purposes"><TextInput value={form.relationshipStatus} onChange={set("relationshipStatus")} />{err("relationshipStatus")}</Field>
                <Field label="Relationship To Risk" hint="does risk scare you or make you excited?"><TextArea value={form.relationshipToRisk} onChange={set("relationshipToRisk")} />{err("relationshipToRisk")}</Field>
                <Field label="Sexual Confidence">
                  <RadioGroup value={form.sexualConfidence} onChange={set("sexualConfidence")} options={["Solid - no second-guessing","Functional but mental interference","Low - anxiety or avoidance present"]} />{err("sexualConfidence")}
                </Field>
              </>
            )}

            {/* ── SECTION 3: Lifestyle & Habits ── */}
            {section === 3 && (
              <>
                <Field label="Do you drink alcohol" hint="how often?"><TextInput value={form.alcoholUse} onChange={set("alcoholUse")} />{err("alcoholUse")}</Field>
                <Field label="Current Medications" hint="Any prescriptions ? Diabetic? etc."><TextInput value={form.currentMedications} onChange={set("currentMedications")} />{err("currentMedications")}</Field>
                <Field label="Relationship To Food" hint="always hungry? fast or slow metabolism? stress eating?"><TextInput value={form.relationshipToFood} onChange={set("relationshipToFood")} />{err("relationshipToFood")}</Field>
                <Field label="Baseline Internal State">
                  <RadioGroup value={form.baselineInternalState} onChange={set("baselineInternalState")} options={["Calm and grounded/ confident","Low-level anxiety/vigilance","High cortisol - wired and tired"]} />{err("baselineInternalState")}
                </Field>
                <Field label="On TRT" hint="trt? hrt? peptides? supplements"><TextInput value={form.onTrt} onChange={set("onTrt")} />{err("onTrt")}</Field>
                <Field label="What Stays Solid When Traveling" hint="lifestyle habits? physique? diet? sleep?"><TextArea value={form.whatStaysSolidTraveling} onChange={set("whatStaysSolidTraveling")} />{err("whatStaysSolidTraveling")}</Field>
                <Field label="Caffeine Intake"><TextInput value={form.caffeineIntake} onChange={set("caffeineIntake")} />{err("caffeineIntake")}</Field>
                <Field label="Nicotine Or Other Substances"><TextInput value={form.nicotineSubstances} onChange={set("nicotineSubstances")} />{err("nicotineSubstances")}</Field>
                <Field label="Sleep Quality">
                  <RadioGroup value={form.sleepQuality} onChange={set("sleepQuality")} options={["Deep and restorative","Light or fragmented","Poor - racing mind or physical restlessness"]} />{err("sleepQuality")}
                </Field>
                <Field label="Training Frequency"><TextInput value={form.trainingFrequency} onChange={set("trainingFrequency")} />{err("trainingFrequency")}</Field>
              </>
            )}

            {/* ── SECTION 4: Final Details ── */}
            {section === 4 && (
              <>
                <Field label="Morning Erections" hint="random erections? libido quality? morning wood erection quality? ( how long it lasts.. pause )"><TextArea value={form.morningErections} onChange={set("morningErections")} />{err("morningErections")}</Field>
                <Field label="Eye Contact">
                  <RadioGroup value={form.eyeContact} onChange={set("eyeContact")} options={["Strong and sustained","Comfortable but break first","Avoid or uncomfortable"]} />{err("eyeContact")}
                </Field>
                <Field label="Sexual Dynamic In Relationship" hint="partner instigates sex? leader in role of sexual intercourse?"><TextArea value={form.sexualDynamic} onChange={set("sexualDynamic")} />{err("sexualDynamic")}</Field>
                <Field label="How You Feel About Your Physique" hint="confident? not satisfied?"><TextInput value={form.physiqueFeeling} onChange={set("physiqueFeeling")} />{err("physiqueFeeling")}</Field>
                <Field label="Training Approach" hint="current split?"><TextInput value={form.trainingApproach} onChange={set("trainingApproach")} />{err("trainingApproach")}</Field>
                <Field label="How You Decompress"><TextInput value={form.howDecompress} onChange={set("howDecompress")} />{err("howDecompress")}</Field>
                <Field label="Libido" hint="mental libido ( sex drive )">
                  <RadioGroup value={form.libido} onChange={set("libido")} options={["High and consistent","Present but lower than it should be","Significantly suppressed"]} />{err("libido")}
                </Field>
                <Field label="Travel Frequency">
                  <RadioGroup value={form.travelFrequency} onChange={set("travelFrequency")} options={["Constant (weekly)","Regular (monthly)","Occasional (quarterly)"]} />{err("travelFrequency")}
                </Field>
                <Field label="Wake Up Recovered">
                  <RadioGroup value={form.wakeUpRecovered} onChange={set("wakeUpRecovered")} options={["Yes - ready to go","Sometimes","Rarely - always dragging"]} />{err("wakeUpRecovered")}
                </Field>
                <Field label="Recent Hormone Panel" hint="send me bloodwork boss">
                  <RadioGroup value={form.recentHormonePanel} onChange={set("recentHormonePanel")} options={["Yes - values below","No"]} />{err("recentHormonePanel")}
                </Field>
              </>
            )}

          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "2rem" }}>
          {section > 0 && (
            <button onClick={back} style={{ flex: 1, padding: "0.875rem", background: "transparent", border: `1px solid ${border}`, color: ink, borderRadius: "8px", fontSize: "0.9rem", cursor: "pointer", fontFamily: "var(--font-body), sans-serif" }}>
              Back
            </button>
          )}
          {section < SECTIONS.length - 1 ? (
            <button onClick={next} style={{ flex: 2, padding: "0.875rem", background: primary, color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body), sans-serif" }}>
              Continue
            </button>
          ) : (
            <>
              <button onClick={handleSubmit} disabled={submitting} style={{ flex: 2, padding: "0.875rem", background: primary, color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.9rem", fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, fontFamily: "var(--font-body), sans-serif" }}>
                Send It
              </button>
              {submitError && (
                <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.5rem", width: "100%", textAlign: "center", fontFamily: "var(--font-body), sans-serif" }}>
                  {submitError}
                </p>
              )}
            </>
          )}
        </div>

        <button onClick={() => { signOut(); router.replace("/login"); }}
          style={{ display: "block", margin: "1.5rem auto 0", background: "none", border: "none", color: muted, fontSize: "0.78rem", cursor: "pointer", fontFamily: "var(--font-body), sans-serif" }}>
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--color-ink)" }} />}>
      <OnboardingInner />
    </Suspense>
  );
}
