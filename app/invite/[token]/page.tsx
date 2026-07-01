"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/invite/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Something went wrong. This link may have expired.");
        return;
      }
      setDone(true);
      // Redirect to login after brief pause
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100dvh", background: "var(--bg)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "2rem",
    }}>
      <div style={{ width: "100%", maxWidth: "380px" }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "2.5rem" }}>
          <Image src="/images/thprebrandlogo2.png" alt="THP" width={64} height={64} style={{ objectFit: "contain" }} />
        </div>

        {done ? (
          <div style={{ textAlign: "center" }}>
            <p style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "1.5rem", fontWeight: 400,
              color: "var(--ink)", letterSpacing: "-0.02em",
              marginBottom: "0.75rem",
            }}>
              You&apos;re set.
            </p>
            <p style={{ fontSize: "0.9rem", color: "var(--muted)", fontWeight: 300 }}>
              Taking you to sign in…
            </p>
          </div>
        ) : (
          <>
            <p style={{
              fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.14em",
              color: "var(--primary)", textTransform: "uppercase",
              fontFamily: "var(--font-mono), monospace",
              textAlign: "center", marginBottom: "1rem",
            }}>
              THP · SET YOUR PASSWORD
            </p>
            <p style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "1.625rem", fontWeight: 400,
              color: "var(--ink)", letterSpacing: "-0.02em",
              textAlign: "center", marginBottom: "0.625rem",
            }}>
              Activate your portal.
            </p>
            <p style={{
              fontSize: "0.875rem", color: "var(--muted)", fontWeight: 300,
              textAlign: "center", lineHeight: 1.6, marginBottom: "2rem",
            }}>
              Choose a password to access your THP dashboard.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{
                  fontSize: "0.75rem", color: "var(--dim)", fontWeight: 400,
                  fontFamily: "var(--font-ui), system-ui, sans-serif",
                }}>
                  New password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  style={{
                    height: "44px", background: "var(--surface)",
                    border: "1px solid var(--border)", borderRadius: "8px",
                    padding: "0 1rem", fontSize: "0.9375rem",
                    color: "var(--ink)", outline: "none",
                    fontFamily: "var(--font-ui), system-ui, sans-serif",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{
                  fontSize: "0.75rem", color: "var(--dim)", fontWeight: 400,
                  fontFamily: "var(--font-ui), system-ui, sans-serif",
                }}>
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Same password again"
                  required
                  style={{
                    height: "44px", background: "var(--surface)",
                    border: "1px solid var(--border)", borderRadius: "8px",
                    padding: "0 1rem", fontSize: "0.9375rem",
                    color: "var(--ink)", outline: "none",
                    fontFamily: "var(--font-ui), system-ui, sans-serif",
                  }}
                />
              </div>

              {error && (
                <p style={{ fontSize: "0.8125rem", color: "var(--danger)", fontWeight: 300 }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  height: "44px", background: loading ? "var(--surface-2)" : "var(--primary)",
                  border: "none", borderRadius: "8px",
                  color: loading ? "var(--dim)" : "#ffffff",
                  fontSize: "0.9375rem", fontWeight: 500,
                  cursor: loading ? "default" : "pointer",
                  fontFamily: "var(--font-ui), system-ui, sans-serif",
                  transition: "background 150ms",
                  marginTop: "0.25rem",
                }}
              >
                {loading ? "Setting password…" : "Set password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
