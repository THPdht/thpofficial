import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const costs = [
  {
    label: "The body",
    text: "Fat that won't move no matter how hard you train. Muscle that fades. A reflection that stopped looking like you.",
  },
  {
    label: "The mind",
    text: "Brain fog by noon. Motivation that needs to be forced. A confidence that quietly leaked out and never came back.",
  },
  {
    label: "The drive",
    text: "Flat libido. No edge. The hunger that used to push you replaced by the urge to just get through the day.",
  },
  {
    label: "The man",
    text: "You feel it in everything — work, relationships, the mirror. The version of you that was supposed to show up never did.",
  },
];

export function Problem() {
  return (
    <section id="problem" className="bg-cream py-24 md:py-32">
      <Container>
        <SectionHeading
          eyebrow="What it actually costs"
          title={
            <>
              Low testosterone doesn&apos;t just lower a number.
              <br />
              It lowers <span className="text-red">you.</span>
            </>
          }
          intro="Most men blame age, stress, or willpower. The truth is your hormones are running the show — and when they're broken, every part of your life pays the tax."
        />

        <div className="mt-16 grid gap-px overflow-hidden rounded-lg border border-ink/10 bg-ink/10 md:grid-cols-2">
          {costs.map((c) => (
            <div key={c.label} className="bg-cream p-8 md:p-10">
              <p className="eyebrow mb-3">{c.label}</p>
              <p className="text-lg leading-relaxed text-ink/80">{c.text}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
