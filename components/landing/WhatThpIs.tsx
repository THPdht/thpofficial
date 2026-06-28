import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const pillars = [
  {
    no: "01",
    title: "Pro-Metabolic Nutrition",
    text: "Food that raises your metabolic rate instead of suppressing it. We fuel hormone production, not deprivation.",
  },
  {
    no: "02",
    title: "HIT Training",
    text: "High-intensity, low-frequency strength work that signals growth and testosterone — without burning you into the ground.",
  },
  {
    no: "03",
    title: "The HPG Axis",
    text: "We work the actual chain of command — hypothalamus, pituitary, gonads — so your body produces what it's supposed to.",
  },
  {
    no: "04",
    title: "Circadian Health",
    text: "Light, sleep, and rhythm dialed in. Hormones are timed events; we restore the clock that runs them.",
  },
  {
    no: "05",
    title: "Identity Architecture",
    text: "The protocol only holds if the man does. We rebuild the standards, habits, and self-image that keep it permanent.",
  },
];

export function WhatThpIs() {
  return (
    <section id="method" className="bg-ink py-24 text-cream md:py-32">
      <Container>
        <SectionHeading
          dark
          eyebrow="The Method"
          title={
            <>
              Not a supplement. Not a diet.
              <br />A <span className="text-red">system</span> for the whole man.
            </>
          }
          intro="THP is five disciplines engineered to work as one. Pull any single lever and you get noise. Pull all five in sequence and the body has no choice but to change."
        />

        <div className="mt-16 grid gap-px overflow-hidden rounded-lg bg-cream/10 md:grid-cols-2 lg:grid-cols-3">
          {pillars.map((p) => (
            <div key={p.no} className="bg-ink p-8 md:p-10">
              <p className="font-mono text-sm text-red">{p.no}</p>
              <h3 className="mt-4 font-display text-2xl text-cream">{p.title}</h3>
              <p className="mt-3 leading-relaxed text-cream/60">{p.text}</p>
            </div>
          ))}
          {/* Closing cell echoes the CTA inside the grid. */}
          <div className="flex flex-col justify-center bg-red p-8 md:p-10">
            <p className="font-display text-2xl leading-snug text-white">
              One protocol. Built around you.
            </p>
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-white/80">
              Engineered from your bloodwork, not a template.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
