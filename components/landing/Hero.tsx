'use client'
import Image from "next/image";
import { ArrowRight } from "lucide-react";

const panels = [
  { src: "/images/thpjackedreal.png", alt: "Physical transformation", label: "Physical"  },
  { src: "/images/thpboxing.png",     alt: "Raw strength",             label: "Strength"  },
  { src: "/images/thpjacked2.png",    alt: "Optimised physique",       label: "Optimised" },
];

export function Hero() {
  return (
    <section className="fixed inset-0 z-0 overflow-hidden bg-ink">

      {/* ────────────────────────────────────────────────
          DESKTOP IMAGE LAYER (hidden on mobile)
      ──────────────────────────────────────────────── */}
      <div className="absolute inset-0 hidden lg:block">

        {/* Left-to-right gradient: opaque left, transparent right */}
        <div
          aria-hidden
          className="absolute inset-0 z-[1]"
          style={{ background: "linear-gradient(to right, #0a0a0a 0%, #0a0a0a 36%, rgba(10,10,10,0.82) 50%, rgba(10,10,10,0.28) 68%, transparent 100%)" }}
        />

        {/* Bottom fade */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 z-[2] h-44"
          style={{ background: "linear-gradient(to top, #0a0a0a, transparent)" }}
        />

        {/* Ambient red — lower left */}
        <div
          aria-hidden
          className="absolute bottom-0 left-0 z-[1] h-[60vh] w-[50vw] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 0% 100%, rgba(200,16,46,0.13) 0%, transparent 60%)" }}
        />

        {/* 3 full-height portrait panels — right 62% */}
        <div className="absolute inset-y-0 right-0 flex" style={{ width: "62%", gap: "3px" }}>
          {panels.map((p, i) => (
            <div
              key={p.src}
              className="relative overflow-hidden flex-1"
              style={{ marginTop: ["72px", "0px", "120px"][i] }}
            >
              <Image
                src={p.src}
                alt={p.alt}
                fill
                priority={i === 0}
                sizes="22vw"
                className="object-cover object-top grayscale contrast-[1.1] brightness-75 transition-all duration-700 hover:grayscale-0 hover:brightness-90"
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,10,10,0.7) 0%, transparent 40%)" }} />
              <div className="absolute top-0 inset-x-0 h-px" style={{ background: "rgba(200,16,46,0.55)" }} />
              <p className="absolute bottom-3 left-3 font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.45)" }}>
                {p.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ────────────────────────────────────────────────
          MOBILE IMAGE LAYER (hidden on desktop)
          Full-bleed single image + 2 portrait cards bottom-right
      ──────────────────────────────────────────────── */}
      <div className="absolute inset-0 lg:hidden">

        {/* Full-bleed background */}
        <Image
          src="/images/thpboxing.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-top"
        />

        {/* Gradient overlays for text readability */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.65) 55%, rgba(10,10,10,0.3) 100%)" }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-[55%]"
          style={{ background: "linear-gradient(to top, #0a0a0a 0%, #0a0a0a 20%, rgba(10,10,10,0.8) 50%, transparent 100%)" }}
        />

        {/* 2 portrait cards — bottom right, peeking in as editorial accents */}
        <div className="absolute bottom-[108px] right-4 flex items-end gap-2 z-[2]">
          <div
            className="relative overflow-hidden border border-white/10"
            style={{ width: "80px", height: "120px", marginBottom: "20px" }}
          >
            <Image
              src="/images/thpjackedreal.png"
              alt="Physical"
              fill
              sizes="80px"
              className="object-cover object-top grayscale contrast-110 brightness-75"
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,10,10,0.8) 0%, transparent 50%)" }} />
            <div className="absolute top-0 inset-x-0 h-px" style={{ background: "rgba(200,16,46,0.6)" }} />
            <p className="absolute bottom-2 left-1.5 font-mono text-[7px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.5)" }}>Physical</p>
          </div>
          <div
            className="relative overflow-hidden border border-white/10"
            style={{ width: "80px", height: "150px" }}
          >
            <Image
              src="/images/thpjacked2.png"
              alt="Optimised"
              fill
              sizes="80px"
              className="object-cover object-top grayscale contrast-110 brightness-75"
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,10,10,0.8) 0%, transparent 50%)" }} />
            <div className="absolute top-0 inset-x-0 h-px" style={{ background: "rgba(200,16,46,0.6)" }} />
            <p className="absolute bottom-2 left-1.5 font-mono text-[7px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.5)" }}>Optimised</p>
          </div>
        </div>

      </div>

      {/* ────────────────────────────────────────────────
          TEXT LAYER — above everything (z-[3])
      ──────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-[3] flex items-start">
        {/* Width constrained on desktop so text doesn't go over images */}
        <div className="w-full lg:w-[50%] px-6 pt-24 pb-12 sm:px-8 md:pt-28 md:pb-16 lg:px-12 lg:pb-20">

          <p className="font-mono uppercase tracking-[0.32em] mb-4" style={{ fontSize: "10px", color: "#c9a24b" }}>
            Testosterone Protocol
          </p>

          <h1
            className="font-body font-extrabold text-white leading-[0.9] tracking-tight mb-5"
            style={{ fontSize: "clamp(1.6rem, 4.5vw, 3.25rem)" }}
          >
            YOU ALREADY KNOW<br />
            YOUR LIFE ISN&apos;T<br />
            WHAT IT USED<br />
            TO BE.
          </h1>

          <p className="font-body mb-8 leading-relaxed" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)", color: "rgba(255,255,255,0.55)", maxWidth: "38ch" }}>
            Tired all day even after coffee. A gut that won&apos;t go away no matter what you do. Barely any drive left in the bedroom, and you keep telling yourself it&apos;s just a phase. That&apos;s not a phase. That&apos;s low testosterone. And you already know it.
          </p>

          <a
            href="/apply"
            className="inline-flex items-center gap-2.5 font-mono text-xs font-bold uppercase tracking-[0.2em] text-white group"
            style={{
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(8px)",
              padding: "11px 24px",
              transition: "border-color 0.3s, background 0.3s",
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = "#c8102e";
              el.style.background = "rgba(200,16,46,0.1)";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = "rgba(255,255,255,0.18)";
              el.style.background = "rgba(255,255,255,0.04)";
            }}
          >
            <span style={{ color: "#c8102e", fontSize: "9px" }}>▶</span>
            Apply Now
            <ArrowRight className="size-3 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-300" />
          </a>

        </div>
      </div>

    </section>
  );
}
