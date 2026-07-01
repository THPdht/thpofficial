"use client";

import Image from "next/image";

export type DiagnosticSection = { heading: string; text: string };

interface DiagnosticDocumentProps {
  title: string;
  stage: number;
  sections: DiagnosticSection[];
  createdAt: string;
  clientName?: string;
}

export default function DiagnosticDocument({ title, stage, sections, createdAt, clientName }: DiagnosticDocumentProps) {
  const dateStr = new Date(createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "2rem", paddingBottom: "1.25rem",
        borderBottom: "1px solid var(--border)",
      }}>
        <div>
          <p style={{
            fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.14em",
            color: "var(--primary)", textTransform: "uppercase",
            fontFamily: "var(--font-mono), monospace", marginBottom: "0.25rem",
          }}>
            DIAGNOSIS · STAGE {stage}
          </p>
          {clientName && (
            <p style={{ fontSize: "0.8125rem", color: "var(--dim)", fontWeight: 300, marginBottom: "0.125rem" }}>
              {clientName}
            </p>
          )}
          <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300 }}>{dateStr}</p>
        </div>
        <Image src="/images/thprebrandlogo2.png" alt="THP" width={48} height={48} style={{ opacity: 0.85, objectFit: "contain" }} />
      </div>

      {/* Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        {sections.map((section, i) => (
          <div key={i}>
            <p style={{
              fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.14em",
              color: "var(--primary)", textTransform: "uppercase",
              fontFamily: "var(--font-mono), monospace",
              marginBottom: "0.875rem",
            }}>
              {section.heading}
            </p>
            {section.text.split(/\n\n+/).filter(p => p.trim()).map((para, j) => (
              <p key={j} style={{
                fontSize: "0.9375rem",
                color: "var(--muted)",
                fontWeight: 300,
                lineHeight: 1.8,
                fontFamily: "var(--font-ui), system-ui, sans-serif",
                marginBottom: j < section.text.split(/\n\n+/).filter(p => p.trim()).length - 1 ? "1rem" : 0,
              }}>
                {para.trim()}
              </p>
            ))}
            {i < sections.length - 1 && (
              <div style={{ marginTop: "2rem", borderBottom: "1px solid var(--border-subtle)" }} />
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: "2.5rem", paddingTop: "1.25rem",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, fontFamily: "var(--font-mono), monospace" }}>
          {title}
        </p>
        <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, fontFamily: "var(--font-mono), monospace" }}>
          thpofficial.com
        </p>
      </div>
    </div>
  );
}
