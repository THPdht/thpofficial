import Image from "next/image";
import { site } from "@/lib/site";

// Asymmetric layout: one large left panel + two stacked right panels.
// Grayscale at rest → full colour on hover (premium editorial reveal).
const proofSlots = [
  {
    image: "/images/thpboxing.png",
    label: "Raw Strength",
    caption: "The body your biology was built for.",
    large: true,
  },
  {
    image: "/images/thpfood.png",
    label: "Raw Nutrition",
    caption: "Fuel that works with your hormones, not against them.",
    large: false,
  },
  {
    image: "/images/thptestresults.png",
    label: "Clinical Baseline",
    caption: "Every intervention starts with your bloodwork.",
    large: false,
  },
];

export function CinematicProof() {
  const [large, ...small] = proofSlots;

  return (
    <section id="proof" className="relative overflow-hidden py-20 md:py-28" style={{ background: "#0e0e0f" }}>

      {/* Ambient glow — center */}
      <div
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[500px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(200,16,46,0.05) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-8">

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-gold mb-4">
              Proof of Work
            </p>
            <h2
              className="font-body font-extrabold text-white tracking-tight leading-[0.9]"
              style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
            >
              These men were done<br />accepting less.
            </h2>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/15 shrink-0 md:pb-1">
            Results vary by individual baseline
          </p>
        </div>

        {/* Asymmetric image grid: large left + 2 stacked right */}
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-px" style={{ background: "rgba(255,255,255,0.05)" }}>

          {/* Large left panel */}
          <div className="group relative overflow-hidden" style={{ minHeight: "480px" }}>
            <Image
              src={large.image}
              alt={large.label}
              fill
              sizes="(max-width: 768px) 100vw, 56vw"
              className="object-cover grayscale contrast-110 brightness-80 transition-all duration-700 group-hover:grayscale-0 group-hover:brightness-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-px bg-red/40" />
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-red/80 mb-1">{large.label}</p>
              <p className="font-body text-sm text-white/55">{large.caption}</p>
            </div>
          </div>

          {/* Right: 2 stacked panels */}
          <div className="flex flex-col gap-px" style={{ background: "rgba(255,255,255,0.05)" }}>
            {small.map((slot) => (
              <div key={slot.label} className="group relative overflow-hidden flex-1" style={{ minHeight: "237px" }}>
                <Image
                  src={slot.image}
                  alt={slot.label}
                  fill
                  sizes="(max-width: 768px) 100vw, 44vw"
                  className="object-cover grayscale contrast-110 brightness-75 transition-all duration-700 group-hover:grayscale-0 group-hover:brightness-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />
                <div className="absolute top-0 left-0 right-0 h-px bg-red/30" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-red/70 mb-0.5">{slot.label}</p>
                  <p className="font-body text-xs text-white/45">{slot.caption}</p>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* CTA bar */}
        <div
          className="mt-px p-8 md:p-10 flex flex-col sm:flex-row items-center justify-between gap-6"
          style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/35 text-center sm:text-left">
            The only question is how long you wait.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={site.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center border border-white/25 px-7 py-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-white transition-all duration-300 hover:border-white/60 hover:bg-white/5"
            >
              Book a Call
            </a>
            <a
              href={site.applyHref}
              className="flex items-center justify-center bg-red px-7 py-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-white transition-all duration-300 hover:bg-red-dark"
              style={{ boxShadow: "0 0 24px rgba(200,16,46,0.35)" }}
            >
              Apply Now
            </a>
          </div>
        </div>

      </div>
    </section>
  );
}
