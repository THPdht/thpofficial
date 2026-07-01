"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default function WelcomePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) { router.replace("/login"); return; }
    // If they've already been welcomed (or already have a protocol), skip straight to dashboard
    if (localStorage.getItem(`thp_welcomed_${u.email}`)) { router.replace("/dashboard"); return; }
    setUser({ email: u.email, name: u.name });
  }, [router]);

  const firstName = user?.name?.split(" ")[0] ?? "";

  const handleUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    setError("");

    const fd = new FormData();
    fd.append("pdf", file);
    fd.append("email", user.email);

    try {
      const res = await fetch("/api/parse-protocol-pdf", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      setDone(true);
      localStorage.setItem(`thp_welcomed_${user.email}`, "1");
      setTimeout(() => router.replace("/dashboard"), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setUploading(false);
    }
  };

  if (!user) return <div style={{ minHeight: "100dvh", background: "var(--color-ink)" }} />;

  if (done) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--color-ink)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "2rem" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "oklch(0.60 0.18 165 / 0.15)", border: "1px solid oklch(0.60 0.18 165 / 0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-8" stroke="var(--color-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <p style={{ color: "#fff", fontFamily: "var(--font-body), sans-serif", fontSize: "1rem", fontWeight: 500 }}>Protocol imported. Loading your dashboard...</p>
      </div>
    );
  }

  if (uploading) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--color-ink)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.5rem", padding: "2rem" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "50%", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "var(--color-red)", animation: "spin 1.2s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#fff", fontFamily: "var(--font-body), sans-serif", fontSize: "1rem", fontWeight: 500, marginBottom: "0.375rem" }}>Reading your protocol...</p>
          <p style={{ color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-body), sans-serif", fontSize: "0.82rem" }}>Claude is extracting your sections. This takes about 30 seconds.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--color-ink)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ width: "100%", maxWidth: "480px" }}>
        {/* Logo */}
        <div style={{ marginBottom: "2.5rem" }}>
          <img src="/images/thprebrandlogo2.png" alt="THP" style={{ height: "48px", objectFit: "contain" }} />
        </div>

        <p style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.7rem", letterSpacing: "0.2em", color: "var(--color-red)", textTransform: "uppercase", marginBottom: "0.75rem" }}>
          Welcome to the portal
        </p>
        <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "clamp(1.75rem, 4vw, 2.25rem)", fontWeight: 400, color: "#fff", textTransform: "uppercase", marginBottom: "1rem", lineHeight: 1.1 }}>
          {firstName ? `Welcome, ${firstName}.` : "Welcome."}
        </h1>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.9rem", fontFamily: "var(--font-body), sans-serif", lineHeight: 1.7, marginBottom: "2.5rem" }}>
          If THP has sent you a diagnosis PDF, upload it here and we&apos;ll pull everything into your dashboard automatically.
        </p>

        {/* Upload zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${file ? "var(--color-red)" : "rgba(255,255,255,0.15)"}`,
            borderRadius: "12px",
            padding: "2rem",
            textAlign: "center",
            cursor: "pointer",
            marginBottom: "1rem",
            background: file ? "rgba(200,16,46,0.05)" : "transparent",
            transition: "all 150ms",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = ""; }}
          />
          {file ? (
            <>
              <p style={{ color: "#fff", fontFamily: "var(--font-body), sans-serif", fontSize: "0.9rem", fontWeight: 500, marginBottom: "0.25rem" }}>{file.name}</p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-body), sans-serif", fontSize: "0.78rem" }}>{(file.size / 1024 / 1024).toFixed(1)} MB · tap to change</p>
            </>
          ) : (
            <>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 0.75rem" }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <p style={{ color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-body), sans-serif", fontSize: "0.875rem" }}>Tap to select your diagnosis PDF</p>
            </>
          )}
        </div>

        {error && (
          <p style={{ color: "#ef4444", fontSize: "0.8rem", fontFamily: "var(--font-body), sans-serif", marginBottom: "0.75rem" }}>{error}</p>
        )}

        <button
          onClick={handleUpload}
          disabled={!file}
          style={{ width: "100%", height: "48px", background: file ? "var(--color-red)" : "rgba(255,255,255,0.06)", border: "none", borderRadius: "8px", color: file ? "#fff" : "rgba(255,255,255,0.2)", fontSize: "0.875rem", fontWeight: 600, cursor: file ? "pointer" : "default", fontFamily: "var(--font-body), sans-serif", transition: "all 150ms" }}
        >
          Import diagnosis →
        </button>
      </div>
    </div>
  );
}
