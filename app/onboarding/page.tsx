"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentUser, signOut, register, login } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

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
  telegramUsername: string;
  instagramHandle: string;
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
  telegramUsername: "", instagramHandle: "",
};

const bg = "var(--color-ink)";
const ink = "#ffffff";
const muted = "rgba(255,255,255,0.45)";
const border = "rgba(255,255,255,0.1)";
const primary = "var(--color-red)";
const soft = "var(--color-ink-soft)";

function Field({ label, hint, optional, children }: { label: string; hint?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "1.75rem" }}>
      <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, color: ink, marginBottom: hint ? "0.25rem" : "0.5rem", fontFamily: "var(--font-body), sans-serif" }}>
        {label}{!optional && <span style={{ color: primary, marginLeft: "3px" }}>*</span>}
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
  const [inlineAuthMode, setInlineAuthMode] = useState<"register" | "login">("register");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const cached = getCurrentUser();
    if (cached) {
      setUser({ email: cached.email, password: cached.password, name: cached.name });
      // Prefill with whatever we have — at minimum the name
      const prefill: Partial<FormData> = { fullName: cached.name || "" };
      if (cached.diagnosticData && Object.keys(cached.diagnosticData).length > 0) {
        Object.assign(prefill, cached.diagnosticData);
      }
      setForm(prev => ({ ...prev, ...prefill }));
      // Also pull telegram + instagram from DB records
      supabase.from('users').select('telegram_username').eq('email', cached.email).maybeSingle()
        .then(({ data }) => {
          if (data?.telegram_username) setForm(prev => ({ ...prev, telegramUsername: prev.telegramUsername || data.telegram_username || "" }));
        });
      supabase.from('application_forms').select('instagram').eq('email', cached.email).maybeSingle()
        .then(({ data }) => {
          if ((data as { instagram?: string } | null)?.instagram) setForm(prev => ({ ...prev, instagramHandle: prev.instagramHandle || (data as { instagram: string }).instagram.replace(/^@/, '') }));
        });
    }
    // If not logged in, show form immediately (account created at end)
  }, []);

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
    if (section >= sectionFields.length) return true;
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

  async function handleSubmitWithAuth() {
    setAuthError("");
    const name = authForm.name.trim();
    const email = authForm.email.trim();
    const password = authForm.password;
    if (inlineAuthMode === "register") {
      if (!name || !email || !password) { setAuthError("Please fill all fields."); return; }
      if (password.length < 8) { setAuthError("Password must be at least 8 characters."); return; }
    } else {
      if (!email || !password) { setAuthError("Please enter your email and password."); return; }
    }
    setSubmitting(true);
    setSubmitStatus("saving");
    setSubmitError("");
    try {
      let finalUser: { email: string; password: string; name: string };
      if (inlineAuthMode === "register") {
        const regResult = await register(name, email, password);
        if (!regResult.success) { setAuthError(regResult.error ?? "Registration failed."); setSubmitting(false); setSubmitStatus("idle"); return; }
        const loginResult = await login(email, password);
        if (!loginResult.success || !loginResult.user) { setAuthError("Login after register failed."); setSubmitting(false); setSubmitStatus("idle"); return; }
        finalUser = { email, password, name: loginResult.user.name };
      } else {
        const loginResult = await login(email, password);
        if (!loginResult.success || !loginResult.user) { setAuthError(loginResult.error ?? "Login failed."); setSubmitting(false); setSubmitStatus("idle"); return; }
        finalUser = { email, password, name: loginResult.user.name };
      }
      setUser(finalUser);
      // Now submit the intake
      const res = await fetch("/api/generate-onboarding-protocol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: finalUser.email, formData: form, token: tokenParam || undefined }),
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

  // Intake submitted — done screen
  if (submitStatus === "done") {
    return (
      <div style={{ minHeight: "100dvh", background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ width: "100%", maxWidth: "460px" }}>
          <p style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.72rem", letterSpacing: "0.22em", color: "var(--color-gold)", textTransform: "uppercase", marginBottom: "2.5rem", textAlign: "center" }}>THP Client Portal</p>

          <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "clamp(1.6rem,5vw,2.1rem)", fontWeight: 400, color: ink, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "1.25rem", lineHeight: 1.2 }}>
            I&apos;ve got you from here.
          </h1>
          <p style={{ color: muted, fontSize: "0.9rem", fontFamily: "var(--font-body), sans-serif", lineHeight: 1.7, marginBottom: "2.5rem" }}>
            Your intake is in. I&apos;ve got everything I need to start building your diagnosis. I&apos;ll be in touch when it&apos;s ready. In the meantime, get the app on your phone — that&apos;s how I&apos;ll reach you with updates, your protocol, and everything else going forward.
          </p>

          {/* PWA install instructions */}
          <div style={{ background: "var(--surface)", border: `1px solid ${border}`, borderRadius: "12px", padding: "1.5rem", marginBottom: "2rem" }}>
            <p style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.68rem", letterSpacing: "0.18em", color: primary, textTransform: "uppercase", marginBottom: "1.1rem" }}>Add THP to your home screen</p>

            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.72rem", letterSpacing: "0.1em", color: "var(--color-gold)", textTransform: "uppercase", marginBottom: "0.6rem" }}>On iPhone (Safari)</p>
              <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                {["Open thpofficial.com in Safari", "Tap the Share button at the bottom of the screen", "Scroll down and tap \"Add to Home Screen\"", "Tap Add — done"].map((step, i) => (
                  <li key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.7rem", color: primary, minWidth: "1.2rem", paddingTop: "0.05rem" }}>{i + 1}.</span>
                    <span style={{ color: muted, fontSize: "0.85rem", fontFamily: "var(--font-body), sans-serif", lineHeight: 1.5 }}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <p style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.72rem", letterSpacing: "0.1em", color: "var(--color-gold)", textTransform: "uppercase", marginBottom: "0.6rem" }}>On Android (Chrome)</p>
              <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                {["Open thpofficial.com in Chrome", "Tap the three-dot menu in the top right", "Tap \"Add to Home screen\"", "Tap Add — done"].map((step, i) => (
                  <li key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.7rem", color: primary, minWidth: "1.2rem", paddingTop: "0.05rem" }}>{i + 1}.</span>
                    <span style={{ color: muted, fontSize: "0.85rem", fontFamily: "var(--font-body), sans-serif", lineHeight: 1.5 }}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <button
            onClick={() => router.replace("/dashboard")}
            style={{ width: "100%", padding: "0.9rem 2rem", background: primary, color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body), sans-serif" }}
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

  const totalSections = user ? SECTIONS.length : SECTIONS.length + 1;
  const progress = (section / totalSections) * 100;

  return (
    <div style={{ minHeight: "100dvh", background: bg, padding: "2rem 1.5rem 4rem" }}>
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.72rem", letterSpacing: "0.22em", color: "var(--color-gold)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
            THP Client Intake
          </p>
          <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "clamp(1.5rem,4vw,2rem)", fontWeight: 400, color: ink, textTransform: "uppercase", marginBottom: "1.25rem" }}>
            {section < SECTIONS.length ? SECTIONS[section] : "Your Account"}
          </h1>
          {/* Progress bar */}
          <div style={{ height: "3px", background: border, borderRadius: "2px", overflow: "hidden" }}>
            <motion.div animate={{ width: `${progress + (100 / totalSections)}%` }} transition={{ duration: 0.4 }}
              style={{ height: "100%", background: primary, borderRadius: "2px" }} />
          </div>
          <p style={{ fontSize: "0.75rem", color: muted, marginTop: "0.5rem", fontFamily: "var(--font-body), sans-serif" }}>
            Section {section + 1} of {totalSections}
          </p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={section} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>

            {/* ── SECTION 0: Identity & Situation ── */}
            {section === 0 && (
              <>
                <Field label="Full Name"><TextInput value={form.fullName} onChange={set("fullName")} />{err("fullName")}</Field>
                <Field label="Age" hint="where you from"><TextInput value={form.ageLocation} onChange={set("ageLocation")} />{err("ageLocation")}</Field>
                <Field label="Phone number" hint="Include country code e.g. +1 555 000 0000"><TextInput value={form.contactInfo} onChange={set("contactInfo")} />{err("contactInfo")}</Field>
                <Field label="Telegram username" hint="Optional — THP will use this to message you" optional><TextInput value={form.telegramUsername} onChange={set("telegramUsername")} placeholder="@username" /></Field>
                <Field label="Instagram handle" hint="Optional" optional><TextInput value={form.instagramHandle} onChange={set("instagramHandle")} placeholder="@handle" /></Field>
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

            {/* ── SECTION 5: Your Account (non-logged-in users only) ── */}
            {section === 5 && !user && (
              <>
                <p style={{ fontSize: "0.9rem", color: muted, fontFamily: "var(--font-body), sans-serif", lineHeight: 1.6, marginBottom: "2rem" }}>
                  Almost done. Create your account to save your intake and access your dashboard after THP activates you.
                </p>
                <div style={{ display: "flex", gap: "0.5rem", background: soft, borderRadius: "8px", padding: "3px", marginBottom: "1.5rem" }}>
                  {(["register", "login"] as const).map(m => (
                    <button key={m} onClick={() => setInlineAuthMode(m)} type="button"
                      style={{ flex: 1, height: "36px", borderRadius: "6px", border: "none", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-body), sans-serif", transition: "all 150ms",
                        background: inlineAuthMode === m ? primary : "transparent",
                        color: inlineAuthMode === m ? "#fff" : muted }}>
                      {m === "register" ? "Create Account" : "Sign In"}
                    </button>
                  ))}
                </div>
                {inlineAuthMode === "register" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <input placeholder="Full name" value={authForm.name} onChange={e => setAuthForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
                    <input placeholder="Email" type="email" value={authForm.email} onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
                    <input placeholder="Password (min 8 chars)" type="password" value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} />
                  </div>
                )}
                {inlineAuthMode === "login" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <input placeholder="Email" type="email" value={authForm.email} onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
                    <input placeholder="Password" type="password" value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} />
                  </div>
                )}
                {authError && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.75rem" }}>{authError}</p>}
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
          {/* On section 4 (Final Details): if logged in → submit; if not → go to account section */}
          {section < SECTIONS.length - 1 ? (
            <button onClick={next} style={{ flex: 2, padding: "0.875rem", background: primary, color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body), sans-serif" }}>
              Continue
            </button>
          ) : section === SECTIONS.length - 1 && !user ? (
            // Final form section, not logged in → go to account creation
            <button onClick={() => { if (validateSection()) { setSection(SECTIONS.length); window.scrollTo({ top: 0, behavior: "smooth" }); } }} style={{ flex: 2, padding: "0.875rem", background: primary, color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body), sans-serif" }}>
              Continue
            </button>
          ) : section === SECTIONS.length && !user ? (
            // Account creation section → submit after auth
            <>
              <button onClick={handleSubmitWithAuth} disabled={submitting} style={{ flex: 2, padding: "0.875rem", background: primary, color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.9rem", fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, fontFamily: "var(--font-body), sans-serif" }}>
                {submitting ? "Submitting..." : "Send It"}
              </button>
              {submitError && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.5rem", width: "100%", textAlign: "center", fontFamily: "var(--font-body), sans-serif" }}>{submitError}</p>}
            </>
          ) : (
            // Final section, already logged in → submit directly
            <>
              <button onClick={handleSubmit} disabled={submitting} style={{ flex: 2, padding: "0.875rem", background: primary, color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.9rem", fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, fontFamily: "var(--font-body), sans-serif" }}>
                {submitting ? "Submitting..." : "Send It"}
              </button>
              {submitError && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.5rem", width: "100%", textAlign: "center", fontFamily: "var(--font-body), sans-serif" }}>{submitError}</p>}
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
