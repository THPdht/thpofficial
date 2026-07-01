"use client";

import { useState } from "react";
import Image from "next/image";

export type ProtocolSection = { heading: string; text: string };

interface ProtocolDocumentProps {
  title: string;
  stage: number;
  sections: ProtocolSection[];
  todos: string[];
  createdAt: string;
  clientName?: string;
}

export default function ProtocolDocument({ title, stage, sections, todos, createdAt, clientName }: ProtocolDocumentProps) {
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
            PROTOCOL · STAGE {stage}
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

      {/* TO DO */}
      {todos.length > 0 && (
        <div style={{ marginTop: "2.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)" }}>
          <p style={{
            fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.14em",
            color: "var(--primary)", textTransform: "uppercase",
            fontFamily: "var(--font-mono), monospace",
            marginBottom: "1.25rem",
          }}>
            TO DO
          </p>
          <TodoList items={todos} />
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
  );
}
