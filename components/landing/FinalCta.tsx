import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { site } from "@/lib/site";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-red py-24 text-white md:py-32">
      <div className="pointer-events-none absolute -right-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-white/10 blur-[120px]" />
      <Container className="relative text-center">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/70">
          The man you were built to be is waiting
        </p>
        <h2 className="mx-auto mt-6 max-w-3xl font-display text-4xl leading-[1.05] md:text-6xl">
          Stop managing the decline. Reverse it.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-white/80">
          Apply now or book a call. Either way, the next move is yours — and
          it&apos;s the one that changes everything.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            href={site.applyHref}
            variant="primary"
            className="bg-white text-red hover:bg-cream hover:text-red"
          >
            Apply Now
          </Button>
          <Button href={site.bookingUrl} variant="light" external>
            Book a Call
          </Button>
        </div>
      </Container>
    </section>
  );
}
