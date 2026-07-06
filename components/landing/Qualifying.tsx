import { site } from "@/lib/site";

export function Qualifying() {
  return (
    <section className="relative py-20 md:py-28" style={{ background: "#080809" }}>

      {/* Subtle ambient glow */}
      <div
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[400px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(200,16,46,0.04) 0%, transparent 65%)" }}
      />

      <div className="relative z-10 mx-auto max-w-2xl px-6 md:px-8 text-center">

        <h2
          className="font-body font-extrabold text-white tracking-tight leading-tight mb-8"
          style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
        >
          Be honest with yourself<br />for a second.
        </h2>

        <p className="font-body text-base text-white/55 leading-relaxed mb-4">
          On a scale of 1 to 10, how much is this actually affecting your life right now?
        </p>

        <p className="font-body text-base leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
          If it&apos;s a 6 or below, this probably isn&apos;t for you.
        </p>

        <p className="font-body text-base text-white/70 leading-relaxed mb-12">
          If it&apos;s an 8, 9, or 10 — you already know why you&apos;re still reading.
        </p>

        <a
          href={site.applyHref}
          className="inline-flex items-center justify-center gap-2 bg-red px-10 py-4 font-mono text-xs font-bold uppercase tracking-[0.22em] text-white transition-all duration-300 hover:bg-red-dark"
          style={{ boxShadow: "0 0 28px rgba(200,16,46,0.4)" }}
        >
          Apply Now →
        </a>

      </div>
    </section>
  );
}
