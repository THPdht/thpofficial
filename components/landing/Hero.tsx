import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { site } from "@/lib/site";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-ink text-cream">
      {/* Ambient red glow + subtle grain stand-in for the hero image. */}
      <div className="pointer-events-none absolute -right-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-red/20 blur-[120px]" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-[28rem] w-[28rem] rounded-full bg-red/10 blur-[120px]" />

      <Container className="relative flex min-h-[88vh] flex-col justify-center py-24">
        <p className="eyebrow mb-6">The Hormone Prophet</p>

        <h1 className="max-w-4xl font-display text-5xl leading-[1.02] md:text-7xl">
          You weren&apos;t built to feel
          <span className="text-red"> half alive.</span>
        </h1>

        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-cream/70">
          Low energy, soft body, no drive — that&apos;s not who you are, it&apos;s
          what neglect made you. THP rebuilds your hormones, your training, and
          your identity into one protocol engineered to bring the man back.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Button href={site.applyHref} variant="primary">
            Apply Now
          </Button>
          <Button href={site.bookingUrl} variant="light" external>
            Book a Call
          </Button>
        </div>

        <p className="mt-8 font-mono text-xs uppercase tracking-[0.18em] text-cream/40">
          Application only · Limited 1-on-1 spots
        </p>
      </Container>
    </section>
  );
}
