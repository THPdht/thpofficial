"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export type ProtocolSection = { heading: string; text: string };

// Hormonal format section names for grouping
const FOUNDATION_BEFORE = "Nutrition";
const IMPLEMENTATION_BEFORE = "Weekly Challenge";

const HORMONAL_SECTIONS = new Set([
  "What Is Actually Happening In Your Body", "The Objective",
  "Nutrition", "Training", "Sleep", "Mitochondrial Optimization",
  "Supplements", "Bloodwork", "Your Daily System",
  "Weekly Challenge", "Closing",
  // Ongoing variants
  "Month In Review", "What Your Data Is Telling Us",
  "Nutrition Adjustments", "Training Progression", "Sleep Adjustments",
  "Supplement Stack Update", "Weekly Challenges",
]);

function isHormonalFormat(sections: ProtocolSection[]): boolean {
  return sections.some(s => HORMONAL_SECTIONS.has(s.heading));
}

function isBehavioralFormat(sections: ProtocolSection[]): boolean {
  return sections.some(s => s.heading.toUpperCase() === "FOUNDATION PHASE" || s.heading.toUpperCase() === "ROOT PROBLEM");
}

// Render behavioral section text with ALL-CAPS lines as styled subheadings
function BehavioralText({ text }: { text: string }) {
  const paras = text.split(/\n\n+/).filter(p => p.trim());
  return (
    <>
      {paras.map((para, j) => {
        const trimmed = para.trim();
        // Detect ALL-CAPS subheading lines (3+ words, all uppercase, no lowercase letters)
        const lines = trimmed.split(/\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length === 1 && /^[A-Z][A-Z\s\d\-:&']{4,}$/.test(trimmed) && !/[a-z]/.test(trimmed)) {
          return (
            <p key={j} style={{
              fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.14em",
              color: "var(--primary)", textTransform: "uppercase",
              fontFamily: "var(--font-mono), monospace",
              marginBottom: "0.625rem", marginTop: j > 0 ? "1.25rem" : 0,
            }}>
              {trimmed}
            </p>
          );
        }
        return (
          <p key={j} style={{
            fontSize: "0.9375rem", color: "var(--muted)", fontWeight: 300,
            lineHeight: 1.8, fontFamily: "var(--font-ui), system-ui, sans-serif",
            marginBottom: j < paras.length - 1 ? "1rem" : 0,
          }}>
            {trimmed}
          </p>
        );
      })}
    </>
  );
}

// Phase divider label
function PhaseDivider({ label }: { label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.875rem",
      margin: "0.5rem 0 1.5rem",
    }}>
      <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
      <p style={{
        fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.18em",
        color: "var(--dim)", textTransform: "uppercase",
        fontFamily: "var(--font-mono), monospace", whiteSpace: "nowrap",
      }}>
        {label}
      </p>
      <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
    </div>
  );
}

interface ProtocolDocumentProps {
  title: string;
  stage: number;
  sections: ProtocolSection[];
  todos: string[];
  createdAt: string;
  clientName?: string;
  source?: 'generated' | 'imported' | 'custom';
  protocolId?: string;
  userEmail?: string;
}

export default function ProtocolDocument({
  title, stage, sections, todos, createdAt, clientName,
  source = 'generated', protocolId, userEmail,
}: ProtocolDocumentProps) {
  const dateStr = new Date(createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const isImported = source === 'imported';
  const hormonal = isHormonalFormat(sections);
  const behavioral = isBehavioralFormat(sections);

  // Determine import index from title e.g. "Imported Protocol 2"
  const importNumMatch = title.match(/Imported Protocol (\d+)/i);
  const importNum = importNumMatch ? importNumMatch[1] : '1';

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
            color: isImported ? "oklch(0.65 0.15 260)" : "var(--primary)",
            textTransform: "uppercase",
            fontFamily: "var(--font-mono), monospace", marginBottom: "0.25rem",
          }}>
            {isImported
              ? `IMPORTED · ${importNum}`
              : source === 'custom'
                ? 'PROTOCOL'
                : `PROTOCOL · STAGE ${stage}`}
          </p>
          {/* A one-off protocol is about a subject, so the subject is the heading. */}
          {source === 'custom' && (
            <p style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "1.25rem", fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.01em", margin: "0.25rem 0 0.375rem" }}>
              {title}
            </p>
          )}
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
        {sections.map((section, i) => {
          const heading = section.heading;

          // Inject phase dividers for hormonal format
          const showFoundationDivider = hormonal && heading === FOUNDATION_BEFORE;
          const showImplementationDivider = hormonal && heading === IMPLEMENTATION_BEFORE;

          return (
            <div key={i}>
              {showFoundationDivider && <PhaseDivider label="— FOUNDATION PHASE —" />}
              {showImplementationDivider && <PhaseDivider label="— IMPLEMENTATION PHASE —" />}

              <p style={{
                fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.14em",
                color: "var(--primary)", textTransform: "uppercase",
                fontFamily: "var(--font-mono), monospace",
                marginBottom: "0.875rem",
              }}>
                {heading}
              </p>

              {behavioral ? (
                <BehavioralText text={section.text} />
              ) : (
                section.text.split(/\n\n+/).filter(p => p.trim()).map((para, j) => (
                  <p key={j} style={{
                    fontSize: "0.9375rem", color: "var(--muted)", fontWeight: 300,
                    lineHeight: 1.8, fontFamily: "var(--font-ui), system-ui, sans-serif",
                    marginBottom: j < section.text.split(/\n\n+/).filter(p => p.trim()).length - 1 ? "1rem" : 0,
                  }}>
                    {para.trim()}
                  </p>
                ))
              )}

              {i < sections.length - 1 && (
                <div style={{ marginTop: "2rem", borderBottom: "1px solid var(--border-subtle)" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* TO DO */}
      {todos.length > 0 && (
        <div style={{ marginTop: "2.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <p style={{
              fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.14em",
              color: "var(--primary)", textTransform: "uppercase",
              fontFamily: "var(--font-mono), monospace",
            }}>
              TO DO
            </p>
          </div>
          <TodoList
            items={todos}
            protocolId={protocolId}
            userEmail={userEmail}
          />
        </div>
      )}

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

interface TodoListProps {
  items: string[];
  protocolId?: string;
  userEmail?: string;
}

function TodoList({ items, protocolId, userEmail }: TodoListProps) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    if (!protocolId || !userEmail) { setLoaded(true); return; }
    fetch(`/api/protocol-todos?email=${encodeURIComponent(userEmail)}&protocol_id=${protocolId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.checked)) setChecked(new Set(data.checked as number[]));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [protocolId, userEmail]);

  const toggle = (i: number) => {
    const isNowChecked = !checked.has(i);
    setChecked(prev => {
      const next = new Set(prev);
      isNowChecked ? next.add(i) : next.delete(i);
      return next;
    });
    if (protocolId && userEmail) {
      fetch('/api/protocol-todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, protocol_id: protocolId, item_idx: i, checked: isNowChecked }),
      }).catch(() => {});
    }
  };

  const doneCount = checked.size;
  const total = items.length;

  return (
    <>
      {loaded && total > 0 && (
        <p style={{
          fontSize: "0.7rem", color: "var(--dim)", fontFamily: "var(--font-mono), monospace",
          marginBottom: "1rem",
        }}>
          {doneCount} / {total} complete
        </p>
      )}
      <ol style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {items.map((item, i) => {
          const done = checked.has(i);
          return (
            <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
              <button
                onClick={() => toggle(i)}
                aria-pressed={done}
                style={{
                  width: "20px", height: "20px", flexShrink: 0, marginTop: "0.15rem",
                  border: "1px solid var(--primary)", borderRadius: "4px",
                  background: done ? "var(--primary)" : "transparent",
                  cursor: "pointer", transition: "background 150ms ease, transform 150ms ease",
                  display: "flex", alignItems: "center", justifyContent: "center",
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
    </>
  );
}
