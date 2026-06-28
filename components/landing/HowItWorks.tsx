import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const steps = [
  {
    no: "01",
    title: "Apply",
    text: "A short, honest application. We only take men we can actually move.",
  },
  {
    no: "02",
    title: "Get Approved",
    text: "We review your situation and confirm you're a fit. No mass enrollment.",
  },
  {
    no: "03",
    title: "Book Your Call",
    text: "We map your bloodwork, history, and goals on a 1-on-1 strategy call.",
  },
  {
    no: "04",
    title: "Get Your Protocol",
    text: "A custom nutrition, training, and hormonal protocol built for your body.",
  },
  {
    no: "05",
    title: "Transform",
    text: "You execute with check-ins and adjustments until the man is back for good.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="bg-cream py-24 md:py-32">
      <Container>
        <SectionHeading
          eyebrow="The Path"
          title={
            <>
              From application to <span className="text-red">transformation.</span>
            </>
          }
          intro="No guesswork, no endless funnel. Five clear steps from where you are now to the body and drive you were built for."
        />

        <ol className="mt-16 space-y-px overflow-hidden rounded-lg border border-ink/10 bg-ink/10">
          {steps.map((s) => (
            <li
              key={s.no}
              className="flex flex-col gap-2 bg-cream p-7 md:flex-row md:items-baseline md:gap-8 md:p-8"
            >
              <span className="font-display text-3xl text-red md:w-20">{s.no}</span>
              <div className="md:flex md:flex-1 md:items-baseline md:justify-between md:gap-8">
                <h3 className="font-display text-2xl text-ink md:w-64">{s.title}</h3>
                <p className="mt-1 max-w-xl leading-relaxed text-muted md:mt-0">
                  {s.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
