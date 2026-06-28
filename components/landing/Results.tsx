import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

// Placeholder social proof. Real before/after photos + quotes drop in later.
const results = [
  {
    name: "Client A",
    stat: "+320 ng/dL",
    detail: "Total testosterone in 16 weeks",
    quote: "I got my edge back. Training, work, marriage — all of it.",
  },
  {
    name: "Client B",
    stat: "-18 lbs fat",
    detail: "While adding visible muscle",
    quote: "First time in years the mirror matches how I want to feel.",
  },
  {
    name: "Client C",
    stat: "Sleep restored",
    detail: "From 5 broken hours to 8 solid",
    quote: "The fog lifted. I wake up actually wanting the day.",
  },
];

export function Results() {
  return (
    <section id="results" className="bg-ink py-24 text-cream md:py-32">
      <Container>
        <SectionHeading
          dark
          eyebrow="Proof"
          title={
            <>
              Men who stopped waiting and <span className="text-red">changed.</span>
            </>
          }
          intro="Real protocols, real bloodwork, real bodies. Names withheld — results aren't."
        />

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {results.map((r) => (
            <figure
              key={r.name}
              className="flex flex-col justify-between rounded-lg border border-cream/10 bg-ink-soft p-8"
            >
              {/* Before/after photo placeholder. */}
              <div className="mb-6 flex aspect-[4/3] items-center justify-center rounded-md border border-dashed border-cream/15 bg-cream/[0.03]">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-cream/30">
                  Before / After
                </span>
              </div>
              <div>
                <p className="font-display text-3xl text-red">{r.stat}</p>
                <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-cream/50">
                  {r.detail}
                </p>
                <blockquote className="mt-5 text-cream/80">
                  &ldquo;{r.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-cream/40">
                  {r.name}
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}
