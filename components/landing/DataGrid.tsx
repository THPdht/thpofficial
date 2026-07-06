// Protocol architecture dashboard.
// Reads like a biotech system readout: dot-grid background, [01] labels,
// ambient red glow, hover scan-line activations, metric separators.
const pillars = [
  {
    number: "01",
    name: "Wake Up Wanting To Get Out Of Bed",
    subtitle: "Not forcing yourself. Wanting to.",
    body: "The energy that greets you in the morning isn't something that just comes back on its own. This is what men tell us changes first — and it changes everything that follows.",
  },
  {
    number: "02",
    name: "Want Sex Again — And Actually Have The Drive For It",
    subtitle: "Not going through the motions. Wanting it.",
    body: "Not managed. Not boosted temporarily. The drive that used to be natural, coming back because the biology behind it has been addressed at the root.",
  },
  {
    number: "03",
    name: "Feel Like Yourself Again, For The First Time In Years",
    subtitle: "Not medicated. Not managed. You, back.",
    body: "The version of you before the fog settled in. Men who go through this tell us they forgot what it felt like to actually want their life — until they had it again.",
  },
];

export function DataGrid() {
  return (
    <section id="protocol" className="relative overflow-hidden py-20 md:py-28" style={{ background: "#080809" }}>

      {/* Dot-grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Ambient red glow — right */}
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 100% 50%, rgba(200,16,46,0.07) 0%, transparent 65%)" }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-8">

        {/* Header row with protocol version label */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-10 mb-0 border-b border-white/[0.06]">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-gold mb-4">
              Inside the Protocol
            </p>
            <h2
              className="font-body font-extrabold text-white tracking-tight leading-tight max-w-xl"
              style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
            >
              Everything the other<br />approaches were missing.
            </h2>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/15 shrink-0">
            v3.0 / Protocol Architecture
          </p>
        </div>

        {/* 3-pillar grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/[0.05]">
          {pillars.map((pillar, i) => (
            <div
              key={pillar.number}
              className="group relative p-8 md:p-10 transition-colors duration-300 hover:bg-white/[0.02]"
            >
              {/* Top scan-line — activates on hover */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              {/* Number + status dot */}
              <div className="flex items-center justify-between mb-7">
                <span className="font-mono text-xs text-red/60 tracking-[0.22em] group-hover:text-red/90 transition-colors duration-300">
                  [{pillar.number}]
                </span>
                <span
                  className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
                  style={{ background: "rgba(200,16,46,0.3)" }}
                />
              </div>

              <h3 className="font-body font-bold text-xl sm:text-2xl text-white leading-tight mb-2">
                {pillar.name}
              </h3>

              <p className="font-mono text-[11px] uppercase tracking-[0.18em] mb-7" style={{ color: "rgba(200,16,46,0.65)" }}>
                ↳ {pillar.subtitle}
              </p>

              {/* Thin separator */}
              <div className="w-8 h-px mb-7" style={{ background: "rgba(255,255,255,0.08)" }} />

              <p className="font-body text-sm leading-relaxed text-white/40 group-hover:text-white/65 transition-colors duration-300">
                {pillar.body}
              </p>

              {/* Bottom module label */}
              <div className="mt-10 flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
                <span className="font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.12)" }}>
                  Module {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
              </div>
            </div>
          ))}
        </div>


      </div>
    </section>
  );
}
