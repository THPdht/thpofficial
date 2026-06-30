"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { login } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const registered = params.get("registered") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    const result = await login(email, password);
    if (!result.success) {
      setError(result.error || "Sign in failed.");
      setLoading(false);
      return;
    }
    const user = result.user!;
    if (user.status === "new") router.push("/onboarding");
    else if (user.status === "pending") router.push("/onboarding/pending");
    else router.push("/dashboard");
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "oklch(0.09 0.008 165 / 0.85)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "2.5rem",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <Link href="/" style={{ display: "block", marginBottom: "2rem" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/thprebrandlogo2.png" alt="THP" style={{ height: "40px", width: "auto", filter: "brightness(0) invert(1)" }} />
        </Link>

        <AnimatePresence>
          {registered && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                marginBottom: "1.5rem",
                padding: "0.875rem 1rem",
                background: "oklch(0.60 0.18 165 / 0.08)",
                border: "1px solid oklch(0.60 0.18 165 / 0.25)",
                borderRadius: "8px",
                fontSize: "0.875rem",
                color: "var(--ink)",
                fontWeight: 300,
                fontFamily: "var(--font-ui), system-ui, sans-serif",
              }}
            >
              Account created. Sign in to continue.
            </motion.div>
          )}
        </AnimatePresence>

        <h1
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: "2rem",
            fontWeight: 400,
            color: "var(--ink)",
            letterSpacing: "-0.02em",
            marginBottom: "0.5rem",
          }}
        >
          Welcome back.
        </h1>
        <p style={{
          fontSize: "0.875rem",
          color: "var(--muted)",
          fontWeight: 300,
          marginBottom: "2rem",
          fontFamily: "var(--font-ui), system-ui, sans-serif",
        }}>
          New here?{" "}
          <Link href="/apply" style={{ color: "var(--primary)", textDecoration: "none" }}>
            Create an account
          </Link>
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <Field label="Email" type="email" value={email} onChange={setEmail}
              placeholder="you@example.com" autoComplete="email" disabled={loading} />
            <Field label="Password" type="password" value={password} onChange={setPassword}
              placeholder="Your password" autoComplete="current-password" disabled={loading} />
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  marginTop: "0.875rem",
                  fontSize: "0.8125rem",
                  color: "var(--danger)",
                  fontFamily: "var(--font-ui), system-ui, sans-serif",
                }}
                role="alert"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "1.5rem",
              width: "100%",
              height: "48px",
              background: loading ? "var(--primary-dim)" : "var(--primary)",
              color: "#ffffff",
              border: "none",
              borderRadius: "100px",
              fontSize: "0.9375rem",
              fontWeight: 500,
              fontFamily: "var(--font-ui), system-ui, sans-serif",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              transition: "background 200ms ease",
            }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "var(--primary-hover)"; }}
            onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "var(--primary)"; }}
          >
            {loading ? <><Spinner />Signing in...</> : "Sign in"}
          </button>
        </form>

        <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.75rem", color: "var(--dim)", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
          THP?{" "}
          <Link href="/admin" style={{ color: "var(--muted)", textDecoration: "underline" }}>
            Admin access
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder, autoComplete, disabled }: {
  label: string; type: string; value: string; onChange: (v: string) => void;
  placeholder: string; autoComplete?: string; disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{
        display: "block",
        fontSize: "0.8125rem",
        fontWeight: 500,
        color: "var(--muted)",
        marginBottom: "0.375rem",
        fontFamily: "var(--font-ui), system-ui, sans-serif",
        letterSpacing: "0.02em",
      }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          height: "44px",
          background: "var(--surface)",
          border: `1px solid ${focused ? "var(--primary)" : "var(--border)"}`,
          borderRadius: "8px",
          padding: "0 0.875rem",
          fontSize: "0.9375rem",
          color: "var(--ink)",
          fontFamily: "var(--font-ui), system-ui, sans-serif",
          fontWeight: 300,
          outline: "none",
          transition: "border-color 150ms ease, box-shadow 150ms ease",
          opacity: disabled ? 0.5 : 1,
          boxShadow: focused ? "0 0 0 3px oklch(0.60 0.18 165 / 0.12)" : "none",
        }}
      />
    </div>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }} aria-hidden>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
