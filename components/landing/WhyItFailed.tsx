// Rapport layer — asymmetric 2-column layout.
// Left: sticky headline + body. Right: vertical failure items with mono labels.
// Ambient red glow on the left bleeds into the background.
const failures = [
  { label: "01", text: "Random supplements you took for a few months, then quietly stopped." },
  { label: "02", text: "Guys online telling you to 'just eat more protein' while nothing changed." },
  { label: "03", text: "A doctor who looked at one number, said 'you're fine,' and sent you home still exhausted." },
  { label: "04", text: "A plan built for a 22-year-old, not for your body." },
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
            <p className="font-body text-base text-white/55 leading-relaxed max-w-sm mb-5">
              You&apos;ve forced yourself through mornings you didn&apos;t want to get up for. Pushed through the gym running on 4 hours of sleep. Told the people close to you &quot;I&apos;m just tired&quot; so many times it doesn&apos;t mean anything anymore, even to you.
            </p>
            <p className="font-body text-base text-white/40 leading-relaxed max-w-sm mb-10">
              None of it worked. Not because you&apos;re weak. Because you were trying to fix a hormone problem with effort. That never works.
            </p>
            <p className="font-body text-base text-white/70 leading-relaxed max-w-sm italic border-l border-red pl-5 py-1">
              THP starts with your bloodwork — the thing that actually explains why nothing has worked.
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
