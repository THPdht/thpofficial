import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { site } from "@/lib/site";

// Pinned hero: fixed to the viewport (z-0). The page content below has a
// 100vh spacer then scrolls up over it (see app/page.tsx), fully covering it.
export function Hero() {
  return (
    <section className="fixed inset-0 z-0 flex items-end justify-center overflow-hidden bg-ink text-center text-white">
      <Image
        src="/images/thprealbackgroun.png"
        alt=""
        fill
        priority
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/30" />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-16 pt-28">
        <p className="eyebrow mb-5">The Hormone Prophet</p>
        <h1 className="display text-4xl leading-[1.02] text-white sm:text-6xl md:text-7xl">
          You weren&apos;t built to feel
          <span className="text-red"> half alive</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl font-mono text-xs uppercase tracking-[0.14em] text-white/70 sm:text-sm">
          Rebuild your hormones, physique, and energy from the ground up — a
          biological transformation system built on bloodwork and human chemistry.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button href={site.applyHref} variant="primary">Apply Now</Button>
          <Button href={site.bookingUrl} variant="outlineLight" external>Book a Call</Button>
          <a
            href="#your-look-inside"
            className="font-mono text-xs uppercase tracking-[0.18em] text-white/60 underline-offset-4 hover:text-white hover:underline"
          >
            Get Started ↓
          </a>
        </div>
      </div>
    </section>
  );
}
