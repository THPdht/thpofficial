"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { register } from "@/lib/auth";
import emailjs from "@emailjs/browser";

const EMAILJS_SERVICE = "service_y2wv9j9";
const EMAILJS_TEMPLATE = "template_56py1rg";
const EMAILJS_PUBLIC_KEY = "lQYYoGLpJySvA3cMn";

const GOAL_OPTIONS = [
  "Lose body fat / get leaner",
  "Build muscle and strength/tone",
  "Increase energy and mental clarity",
  "Balance hormones",
  "Fix libido/sexual health/performance",
  "Regulate menstrual cycle",
  "Other",
];

const SYMPTOM_OPTIONS = [
  "Stubborn fat",
  "Soft physique",
  "Weak/low libido",
  "Low confidence",
  "Thyroid issues",
  "Irregular periods",
  "PMS/mood swings",
  "Other",
];

const PREVIOUS_ATTEMPTS = [
  "Diet protocols",
  "Training programs",
  "Supplements",
  "Birth control/HRT",
  "Other coaches",
  "Nothing yet",
];

const INVESTMENT_RANGES = [
  "Under $500",
  "$500–$1,000",
  "$1,000–$1,500",
  "$1500+ (psychological mentorship, 1 space left)",
];

type SymptomSeverity = { symptom: string; severity: number };

type FormState = {
  fullName: string;
  gender: string;
  currentStateGoals: string[];
  otherGoal: string;
  mostImportantGoal: string;
  currentWeight: string;
  height: string;
  age: string;
  bodyFatCurrent: string;
  bodyFatGoal: string;
  bodyFatDuration: string;
  symptomSeverities: SymptomSeverity[];
  otherSymptom: string;
  symptomDuration: string;
  bloodworkStatus: string;
  testosteroneLevel: string;
  lastLabsDate: string;
  previousAttempts: string[];
  supplementsUsed: string;
  whatTried: string;
  howLongStuck: string;
  whyStoppedWorking: string;
  whyStillLooking: string;
  hoursPerWeek: string;
  currentTrainingProgram: string;
  medicalConditions: string;
  stressSleepSituation: string;
  consequences: string;
  lifeSolved: string;
  howFoundUs: string;
  commitmentLevel: number;
  investmentRange: string;
  wasReferred: string;
  referredBy: string;
  email: string;
  phone: string;
  instagram: string;
  password: string;
  confirmPassword: string;
};

const EMPTY: FormState = {
  fullName: "", gender: "", currentStateGoals: [], otherGoal: "", mostImportantGoal: "",
  currentWeight: "", height: "", age: "", bodyFatCurrent: "", bodyFatGoal: "", bodyFatDuration: "",
  symptomSeverities: [], otherSymptom: "", symptomDuration: "", bloodworkStatus: "",
  testosteroneLevel: "", lastLabsDate: "", previousAttempts: [], supplementsUsed: "",
  whatTried: "", howLongStuck: "", whyStoppedWorking: "", whyStillLooking: "",
  hoursPerWeek: "", currentTrainingProgram: "", medicalConditions: "", stressSleepSituation: "",
  consequences: "", lifeSolved: "", howFoundUs: "", commitmentLevel: 7,
  investmentRange: "", wasReferred: "", referredBy: "", email: "", phone: "", instagram: "",
  password: "", confirmPassword: "",
};

const bg = "var(--color-ink)";
const ink = "#ffffff";
const muted = "rgba(255,255,255,0.45)";
const border = "rgba(255,255,255,0.1)";
const primary = "var(--color-red)";
const soft = "var(--color-ink-soft)";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.75rem 1rem", background: soft, border: `1px solid ${border}`,
  borderRadius: "8px", color: ink, fontSize: "0.9rem", fontFamily: "var(--font-body), sans-serif",
  outline: "none", boxSizing: "border-box",
};

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: "0.5rem" }}>
      <p style={{ fontSize: "0.9rem", fontWeight: 500, color: ink, fontFamily: "var(--font-body), sans-serif", marginBottom: hint ? "0.2rem" : 0 }}>{children}</p>
      {hint && <p style={{ fontSize: "0.78rem", color: muted, fontFamily: "var(--font-body), sans-serif", lineHeight: 1.4 }}>{hint}</p>}
    </div>
  );
}

function TInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={inputStyle}
      onFocus={e => (e.target.style.borderColor = primary)}
      onBlur={e => (e.target.style.borderColor = border)} />
  );
}

function TArea({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
      onFocus={e => (e.target.style.borderColor = primary)}
      onBlur={e => (e.target.style.borderColor = border)} />
  );
}

function CheckGroup({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (o: string) => onChange(selected.includes(o) ? selected.filter(x => x !== o) : [...selected, o]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {options.map(opt => (
        <label key={opt} style={{
          display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.7rem 1rem",
          background: selected.includes(opt) ? `color-mix(in srgb, var(--color-red) 15%, transparent)` : soft,
          border: `1px solid ${selected.includes(opt) ? primary : border}`, borderRadius: "8px", cursor: "pointer",
        }}>
          <div style={{
            width: "18px", height: "18px", borderRadius: "4px", border: `2px solid ${selected.includes(opt) ? primary : border}`,
            flexShrink: 0, background: selected.includes(opt) ? primary : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {selected.includes(opt) && <span style={{ color: "#fff", fontSize: "0.7rem", fontWeight: 700 }}>✓</span>}
          </div>
          <span style={{ fontSize: "0.88rem", color: ink, fontFamily: "var(--font-body), sans-serif" }}>{opt}</span>
          <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} style={{ display: "none" }} />
        </label>
      ))}
    </div>
  );
}

function RadioSingle({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {options.map(opt => (
        <label key={opt} style={{
          display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.7rem 1rem",
          background: value === opt ? `color-mix(in srgb, var(--color-red) 15%, transparent)` : soft,
          border: `1px solid ${value === opt ? primary : border}`, borderRadius: "8px", cursor: "pointer",
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

const STEP_TITLES = [
  "Who are you?",
  "Your goal",
  "Body metrics",
  "Symptoms",
  "Blood work",
  "What you've tried",
  "The real problem",
  "Your situation",
  "The vision",
  "Training",
  "Lifestyle",
  "Commitment",
  "Investment",
  "Contact",
  "Create your account",
];

export default function ApplyPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof FormState) => (v: unknown) => setForm(f => ({ ...f, [key]: v }));

  function toggleSymptom(symptom: string) {
    const existing = form.symptomSeverities.find(s => s.symptom === symptom);
    if (existing) {
      set("symptomSeverities")(form.symptomSeverities.filter(s => s.symptom !== symptom));
    } else {
      set("symptomSeverities")([...form.symptomSeverities, { symptom, severity: 3 }]);
    }
  }

  function setSymptomSeverity(symptom: string, severity: number) {
    set("symptomSeverities")(form.symptomSeverities.map(s => s.symptom === symptom ? { ...s, severity } : s));
  }

  function validate(): boolean {
    const e: string[] = [];
    const checks: [boolean, string][] = [
      [step === 0 && !form.fullName, "Name is required"],
      [step === 0 && !form.gender, "Please select gender"],
      [step === 1 && form.currentStateGoals.length === 0, "Select at least one goal"],
      [step === 1 && !form.mostImportantGoal, "Your most important goal is required"],
      [step === 2 && !form.currentWeight, "Current weight is required"],
      [step === 2 && !form.bodyFatCurrent, "Current body fat is required"],
      [step === 4 && !form.bloodworkStatus, "Please select a bloodwork status"],
      [step === 6 && !form.whatTried, "Required"],
      [step === 6 && !form.whyStillLooking, "Required"],
      [step === 7 && !form.stressSleepSituation, "Required"],
      [step === 8 && !form.consequences, "Required"],
      [step === 8 && !form.lifeSolved, "Required"],
      [step === 12 && !form.investmentRange, "Please select a range"],
      [step === 13 && !form.email, "Email is required"],
      [step === 13 && !form.phone, "Phone number is required"],
      [step === 14 && !form.password, "Password is required"],
      [step === 14 && form.password.length < 8, "Password must be at least 8 characters"],
      [step === 14 && form.password !== form.confirmPassword, "Passwords do not match"],
    ];
    for (const [condition, msg] of checks) {
      if (condition) e.push(msg);
    }
    setErrors(e);
    return e.length === 0;
  }

  function next() {
    if (!validate()) return;
    setErrors([]);
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setErrors([]);
    setStep(s => s - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);

    // Create user account
    const accountResult = await register(form.fullName.trim(), form.email.trim(), form.password);
    if (!accountResult.success) {
      setErrors([accountResult.error ?? "Could not create account. This email may already be registered."]);
      setSubmitting(false);
      return;
    }

    // Save application
    const { error } = await supabase.from("application_forms").insert({
      full_name: form.fullName,
      gender: form.gender,
      current_state_goals: form.currentStateGoals,
      other_goal: form.otherGoal,
      most_important_goal: form.mostImportantGoal,
      current_weight: form.currentWeight,
      height: form.height,
      age: form.age,
      body_fat_current: form.bodyFatCurrent,
      body_fat_goal: form.bodyFatGoal,
      body_fat_duration: form.bodyFatDuration,
      symptom_severities: form.symptomSeverities,
      other_symptom: form.otherSymptom,
      symptom_duration: form.symptomDuration,
      bloodwork_status: form.bloodworkStatus,
      testosterone_level: form.testosteroneLevel,
      last_labs_date: form.lastLabsDate,
      previous_attempts: form.previousAttempts,
      supplements_used: form.supplementsUsed,
      what_tried: form.whatTried,
      how_long_stuck: form.howLongStuck,
      why_stopped_working: form.whyStoppedWorking,
      why_still_looking: form.whyStillLooking,
      hours_per_week: form.hoursPerWeek,
      current_training_program: form.currentTrainingProgram,
      medical_conditions: form.medicalConditions,
      stress_sleep_situation: form.stressSleepSituation,
      consequences: form.consequences,
      life_solved: form.lifeSolved,
      how_found_us: form.howFoundUs,
      commitment_level: form.commitmentLevel,
      investment_range: form.investmentRange,
      was_referred: form.wasReferred,
      referred_by: form.referredBy,
      email: form.email,
      phone: form.phone,
      instagram: form.instagram,
    });

    // Update status to pending and tag as 1:1 applicant
    await supabase.from('users').update({
      status: 'pending',
      diagnostic_data: { clientType: '1on1', source: 'apply' },
    }).eq('email', form.email.trim().toLowerCase());

    if (!error) {
      try {
        await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
          from_name: form.fullName,
          from_email: form.email,
          phone: form.phone,
          goals: form.currentStateGoals.join(", "),
          most_important_goal: form.mostImportantGoal,
          investment_range: form.investmentRange,
          commitment_level: String(form.commitmentLevel),
        }, EMAILJS_PUBLIC_KEY);
      } catch (e) {
        console.error("[apply] EmailJS failed:", e);
      }
    }

    setSubmitting(false);
    window.location.href = "https://cal.com/ali-filali-uks4xi/30min";
  }

  const progress = ((step + 1) / STEP_TITLES.length) * 100;

  return (
    <div style={{ minHeight: "100dvh", background: bg, padding: "2rem 1.5rem 4rem" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.72rem", letterSpacing: "0.22em", color: "var(--color-gold)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
            Step {step + 1} of {STEP_TITLES.length}
          </p>
          <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "clamp(1.4rem,4vw,2rem)", fontWeight: 400, color: ink, textTransform: "uppercase", marginBottom: "1.25rem" }}>
            {STEP_TITLES[step]}
          </h1>
          <div style={{ height: "3px", background: border, borderRadius: "2px" }}>
            <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }}
              style={{ height: "100%", background: primary, borderRadius: "2px" }} />
          </div>
        </div>

        {errors.length > 0 && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1.5rem" }}>
            {errors.map((e, i) => <p key={i} style={{ color: "#ef4444", fontSize: "0.82rem", fontFamily: "var(--font-body), sans-serif" }}>{e}</p>)}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>

            {/* Step 0: Name + gender */}
            {step === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div><Label>Full name</Label><TInput value={form.fullName} onChange={set("fullName")} placeholder="Your full name" /></div>
                <div><Label>Gender</Label><RadioSingle options={["Male", "Female", "Other"]} value={form.gender} onChange={set("gender") as (v: string) => void} /></div>
                <div><Label>Age</Label><TInput value={form.age} onChange={set("age")} placeholder="e.g. 32" /></div>
              </div>
            )}

            {/* Step 1: Goals */}
            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div>
                  <Label>What are your goals?</Label>
                  <CheckGroup options={GOAL_OPTIONS} selected={form.currentStateGoals} onChange={set("currentStateGoals") as (v: string[]) => void} />
                  {form.currentStateGoals.includes("Other") && (
                    <div style={{ marginTop: "0.75rem" }}>
                      <TInput value={form.otherGoal} onChange={set("otherGoal")} placeholder="Describe your goal" />
                    </div>
                  )}
                </div>
                <div>
                  <Label hint="What's your single most important goal right now, and why does it matter to you personally?">Most important goal</Label>
                  <TArea value={form.mostImportantGoal} onChange={set("mostImportantGoal")} placeholder="Be specific." />
                </div>
              </div>
            )}

            {/* Step 2: Body metrics */}
            {step === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div><Label>Current weight</Label><TInput value={form.currentWeight} onChange={set("currentWeight")} placeholder="e.g. 185lbs / 84kg" /></div>
                <div><Label>Height</Label><TInput value={form.height} onChange={set("height")} placeholder="e.g. 5'11 / 180cm" /></div>
                <div><Label hint="Where do you want to get to?">Current body fat %</Label><TInput value={form.bodyFatCurrent} onChange={set("bodyFatCurrent")} placeholder="e.g. 22%" /></div>
                <div><Label hint="Required — what body fat % are you aiming for?">Target body fat %</Label><TInput value={form.bodyFatGoal} onChange={set("bodyFatGoal")} placeholder="e.g. 12%" /></div>
                <div><Label hint="How long have you been at your current body fat?">How long at current BF%</Label><TInput value={form.bodyFatDuration} onChange={set("bodyFatDuration")} placeholder="e.g. 2 years" /></div>
              </div>
            )}

            {/* Step 3: Symptoms */}
            {step === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div>
                  <Label hint="Select symptoms and rate their severity (1 = mild, 5 = debilitating)">Select your symptoms</Label>
                  {SYMPTOM_OPTIONS.map(s => {
                    const entry = form.symptomSeverities.find(x => x.symptom === s);
                    return (
                      <div key={s} style={{ marginBottom: "0.5rem" }}>
                        <label style={{
                          display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.7rem 1rem",
                          background: entry ? `color-mix(in srgb, var(--color-red) 15%, transparent)` : soft,
                          border: `1px solid ${entry ? primary : border}`, borderRadius: "8px", cursor: "pointer",
                        }}>
                          <div style={{
                            width: "18px", height: "18px", borderRadius: "4px", border: `2px solid ${entry ? primary : border}`,
                            flexShrink: 0, background: entry ? primary : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {entry && <span style={{ color: "#fff", fontSize: "0.7rem", fontWeight: 700 }}>✓</span>}
                          </div>
                          <span style={{ fontSize: "0.88rem", color: ink, fontFamily: "var(--font-body), sans-serif", flex: 1 }}>{s}</span>
                          <input type="checkbox" checked={!!entry} onChange={() => toggleSymptom(s)} style={{ display: "none" }} />
                        </label>
                        {entry && (
                          <div style={{ padding: "0.5rem 1rem 0.75rem", background: soft, borderRadius: "0 0 8px 8px", border: `1px solid ${border}`, borderTop: "none" }}>
                            <p style={{ fontSize: "0.75rem", color: muted, marginBottom: "0.25rem", fontFamily: "var(--font-body), sans-serif" }}>Severity: {entry.severity}/5</p>
                            <input type="range" min={1} max={5} value={entry.severity} onChange={e => setSymptomSeverity(s, Number(e.target.value))}
                              style={{ width: "100%", accentColor: primary }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {form.symptomSeverities.some(s => s.symptom === "Other") && (
                    <div style={{ marginTop: "0.75rem" }}>
                      <TInput value={form.otherSymptom} onChange={set("otherSymptom")} placeholder="Describe other symptom" />
                    </div>
                  )}
                </div>
                <div>
                  <Label hint="How long have you been experiencing these symptoms?">Symptom duration</Label>
                  <TInput value={form.symptomDuration} onChange={set("symptomDuration")} placeholder="e.g. 2 years" />
                </div>
              </div>
            )}

            {/* Step 4: Blood work */}
            {step === 4 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div>
                  <Label>Have you had blood work done recently?</Label>
                  <RadioSingle
                    options={["Yes labs available", "No but willing", "No not interested"]}
                    value={form.bloodworkStatus}
                    onChange={set("bloodworkStatus") as (v: string) => void}
                  />
                </div>
                {form.bloodworkStatus === "Yes labs available" && (
                  <>
                    <div><Label>Testosterone level (optional)</Label><TInput value={form.testosteroneLevel} onChange={set("testosteroneLevel")} placeholder="e.g. 450 ng/dL" /></div>
                    <div><Label>Last labs date</Label><TInput value={form.lastLabsDate} onChange={set("lastLabsDate")} placeholder="e.g. Jan 2025" /></div>
                  </>
                )}
              </div>
            )}

            {/* Step 5: Previous attempts */}
            {step === 5 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div>
                  <Label>What have you tried before?</Label>
                  <CheckGroup options={PREVIOUS_ATTEMPTS} selected={form.previousAttempts} onChange={set("previousAttempts") as (v: string[]) => void} />
                </div>
                {form.previousAttempts.includes("Supplements") && (
                  <div><Label>Which supplements?</Label><TInput value={form.supplementsUsed} onChange={set("supplementsUsed")} placeholder="List them" /></div>
                )}
              </div>
            )}

            {/* Step 6: What tried / why still looking */}
            {step === 6 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div>
                  <Label hint="What have you tried, how long did you stick to it, and why did it stop working?">Describe what you tried</Label>
                  <TArea value={form.whatTried} onChange={set("whatTried")} placeholder="Be honest and specific." rows={4} />
                </div>
                <div>
                  <Label>How long have you been stuck?</Label>
                  <TInput value={form.howLongStuck} onChange={set("howLongStuck")} placeholder="e.g. 3 years" />
                </div>
                <div>
                  <Label>Why did previous attempts stop working?</Label>
                  <TArea value={form.whyStoppedWorking} onChange={set("whyStoppedWorking")} placeholder="What went wrong?" rows={3} />
                </div>
                <div>
                  <Label hint="Why are you still looking for help?">Why still looking</Label>
                  <TArea value={form.whyStillLooking} onChange={set("whyStillLooking")} placeholder="What is driving you to keep trying?" rows={3} />
                </div>
              </div>
            )}

            {/* Step 7: Situation */}
            {step === 7 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div>
                  <Label hint="Describe your current stress and sleep situation honestly.">Stress and sleep</Label>
                  <TArea value={form.stressSleepSituation} onChange={set("stressSleepSituation")} placeholder="How stressed are you? How's your sleep?" rows={4} />
                </div>
                <div>
                  <Label>Medical conditions (if any)</Label>
                  <TInput value={form.medicalConditions} onChange={set("medicalConditions")} placeholder="Any diagnosed conditions, injuries, or limitations?" />
                </div>
              </div>
            )}

            {/* Step 8: Vision / consequences */}
            {step === 8 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div>
                  <Label hint="What happens if nothing changes in the next 12 months?">Consequences of doing nothing</Label>
                  <TArea value={form.consequences} onChange={set("consequences")} placeholder="Be real about what's at stake." rows={4} />
                </div>
                <div>
                  <Label hint="If this worked, what does your life look like?">Life if this is solved</Label>
                  <TArea value={form.lifeSolved} onChange={set("lifeSolved")} placeholder="Describe what changes." rows={4} />
                </div>
              </div>
            )}

            {/* Step 9: Training */}
            {step === 9 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div>
                  <Label>Hours per week for this</Label>
                  <TInput value={form.hoursPerWeek} onChange={set("hoursPerWeek")} placeholder="How many hours per week can you commit?" />
                </div>
                <div>
                  <Label>Current training program</Label>
                  <TArea value={form.currentTrainingProgram} onChange={set("currentTrainingProgram")} placeholder="What are you doing now? Days per week, style, etc." rows={3} />
                </div>
              </div>
            )}

            {/* Step 10: How found */}
            {step === 10 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div>
                  <Label>How did you find THP?</Label>
                  <TInput value={form.howFoundUs} onChange={set("howFoundUs")} placeholder="Instagram, referral, YouTube, etc." />
                </div>
                <div>
                  <Label>Were you referred by someone?</Label>
                  <RadioSingle options={["Yes", "No"]} value={form.wasReferred} onChange={set("wasReferred") as (v: string) => void} />
                </div>
                {form.wasReferred === "Yes" && (
                  <div><Label>Who referred you?</Label><TInput value={form.referredBy} onChange={set("referredBy")} placeholder="Name or handle" /></div>
                )}
              </div>
            )}

            {/* Step 11: Commitment */}
            {step === 11 && (
              <div>
                <Label hint="How committed are you to making this change right now? (1 = not really, 10 = nothing will stop me)">
                  Commitment level: {form.commitmentLevel}/10
                </Label>
                <input type="range" min={1} max={10} value={form.commitmentLevel}
                  onChange={e => set("commitmentLevel")(Number(e.target.value))}
                  style={{ width: "100%", accentColor: primary, marginTop: "0.5rem" }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.25rem" }}>
                  <span style={{ fontSize: "0.72rem", color: muted, fontFamily: "var(--font-body), sans-serif" }}>Not really</span>
                  <span style={{ fontSize: "0.72rem", color: muted, fontFamily: "var(--font-body), sans-serif" }}>Nothing will stop me</span>
                </div>
              </div>
            )}

            {/* Step 12: Investment */}
            {step === 12 && (
              <div>
                <Label hint="This helps us understand what you can access and sets realistic expectations.">Investment range</Label>
                <RadioSingle options={INVESTMENT_RANGES} value={form.investmentRange} onChange={set("investmentRange") as (v: string) => void} />
              </div>
            )}

            {/* Step 13: Contact */}
            {step === 13 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div><Label>Email</Label><TInput value={form.email} onChange={set("email")} placeholder="your@email.com" type="email" /></div>
                <div><Label>Phone</Label><TInput value={form.phone} onChange={set("phone")} placeholder="+1 555 000 0000" type="tel" /></div>
                <div><Label>Instagram (optional)</Label><TInput value={form.instagram} onChange={set("instagram")} placeholder="@handle" /></div>
              </div>
            )}

            {/* Step 14: Create account */}
            {step === 14 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <p style={{ color: muted, fontSize: "0.875rem", fontFamily: "var(--font-body), sans-serif", lineHeight: 1.6, marginBottom: "0.5rem" }}>
                  Almost done. Set a password to create your account — you'll use it to log in and track your progress once accepted.
                </p>
                <div><Label>Password</Label><TInput value={form.password} onChange={set("password")} placeholder="Min. 8 characters" type="password" /></div>
                <div><Label>Confirm password</Label><TInput value={form.confirmPassword} onChange={set("confirmPassword")} placeholder="Repeat your password" type="password" /></div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "2rem" }}>
          {step > 0 && (
            <button onClick={back} style={{ flex: 1, padding: "0.875rem", background: "transparent", border: `1px solid ${border}`, color: ink, borderRadius: "8px", fontSize: "0.9rem", cursor: "pointer", fontFamily: "var(--font-body), sans-serif" }}>
              Back
            </button>
          )}
          {step < STEP_TITLES.length - 1 ? (
            <button onClick={next} style={{ flex: 2, padding: "0.875rem", background: primary, color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body), sans-serif" }}>
              Continue
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting} style={{ flex: 2, padding: "0.875rem", background: primary, color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.9rem", fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, fontFamily: "var(--font-body), sans-serif" }}>
              {submitting ? "Submitting..." : "Submit Application"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
