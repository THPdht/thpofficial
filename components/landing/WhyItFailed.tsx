// Rapport layer — asymmetric 2-column layout.
// Left: sticky headline. Right: vertical failure items with mono labels.
// Ambient red glow on the left bleeds into the background.
const failures = [
  { label: "01", text: "Generic supplements. No protocol behind them." },
  { label: "02", text: "Influencers who said eat more protein and called it a day." },
  { label: "03", text: "Doctors who told you your levels were 'normal' and sent you home." },
  { label: "04", text: "Programs built for everyone — meaning built for no one." },
];

export function WhyItFailed() {
  return (
    <section className="relative overflow-hidden py-20 md:py-28" style={{ background: "#0B0B0C" }}>

      {/* Ambient red glow — left edge */}
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 w-[700px] h-[600px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 0% 50%, rgba(200,16,46,0.09) 0%, transparent 65%)" }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">

          {/* Left: headline — sticky on desktop */}
          <div className="lg:sticky lg:top-32">
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-gold mb-5">
              Failure Audit
            </p>
            <h2
              className="font-body font-extrabold text-white tracking-tight leading-[0.88] mb-8"
              style={{ fontSize: "clamp(2.8rem, 5vw, 4.5rem)" }}
            >
              You&apos;ve tried<br />before.
            </h2>
            <p className="font-body text-base text-white/40 leading-relaxed max-w-xs mb-10">
              The reason nothing stuck wasn&apos;t discipline. It was biology being ignored.
            </p>
            <p className="font-body text-base text-white/70 leading-relaxed max-w-sm italic border-l border-red pl-5 py-1">
              THP starts where all of that failed — with your blood, your hormones, your baseline.
            </p>
          </div>

          {/* Right: failure items */}
          <div className="flex flex-col gap-px" style={{ background: "rgba(255,255,255,0.03)" }}>
            {failures.map((f) => (
              <div
                key={f.label}
                className="group flex items-start gap-5 p-6 transition-all duration-300 hover:bg-red/5 border-b border-white/[0.04] last:border-b-0"
              >
                <span className="font-mono text-[11px] text-red/50 tracking-[0.2em] mt-0.5 shrink-0 group-hover:text-red/80 transition-colors duration-300">
                  [{f.label}]
                </span>
                <p className="font-body text-sm text-white/45 leading-relaxed group-hover:text-white/75 transition-colors duration-300">
                  {f.text}
                </p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
