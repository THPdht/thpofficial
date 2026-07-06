"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { site } from "@/lib/site";
import { faqs } from "@/lib/content";

const PORTAL_ROUTES = ["/admin", "/dashboard", "/login", "/register", "/onboarding"];

const legalLinks = [
  { label: "Privacy",            href: "/privacy"    },
  { label: "Terms",              href: "/terms"       },
  { label: "Medical Disclaimer", href: "/disclaimer" },
  { label: "Refunds",            href: "/refunds"    },
];

export function Footer() {
  const pathname = usePathname();
  const [open, setOpen] = useState<number | null>(null);

  const isPortal = PORTAL_ROUTES.some(r => pathname === r || pathname.startsWith(r + "/"));
  if (isPortal) return null;

  return (
    <footer id="faq" className="relative z-10 bg-ink">

      {/* ── FAQ section ── */}
      <div className="border-t border-white/10 py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-12 lg:gap-20">

            {/* Left: label + heading */}
            <div className="lg:pt-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] mb-4" style={{ color: "#c9a24b" }}>
                Answers
              </p>
              <h2 className="font-body font-extrabold text-white tracking-tight leading-tight"
                style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)" }}>
                Frequently<br />Asked
              </h2>
            </div>

            {/* Right: accordion */}
            <div className="divide-y divide-white/8 border-y border-white/8">
              {faqs.map((f, i) => {
                const isOpen = open === i;
                return (
                  <div key={f.q}>
                    <button
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex w-full items-center justify-between gap-4 py-5 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="font-body font-semibold text-sm sm:text-base text-white leading-snug">
                        {f.q}
                      </span>
                      <span
                        className="shrink-0 font-mono text-xl transition-colors duration-200"
                        style={{ color: isOpen ? "#c8102e" : "rgba(255,255,255,0.4)" }}
                      >
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>
                    {isOpen && (
                      <p className="-mt-1 pb-5 font-mono text-xs sm:text-sm leading-relaxed text-white/55">
                        {f.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </div>

      {/* ── Legal bar ── */}
      <div className="border-t border-white/8 py-5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 md:flex-row md:px-8">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/30">
            © {new Date().getFullYear()} {site.domain}
          </span>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {legalLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/30 hover:text-white transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

    </footer>
  );
}
