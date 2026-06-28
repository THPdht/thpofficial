import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { site } from "@/lib/site";

export function Coaching() {
  // Checkout link if set (Stripe Payment Link), else send them to apply.
  const ctaHref = site.checkoutUrl || site.applyHref;
  const ctaExternal = Boolean(site.checkoutUrl);

  return (
    <section className="relative overflow-hidden bg-ink-soft py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="mb-12 text-center">
          <h2 className="display mx-auto max-w-4xl text-4xl text-white sm:text-5xl md:text-6xl">
            Enough guessing. It&apos;s time to{" "}
            <span className="text-red">optimize.</span>
          </h2>
        </div>

        <div className="grid items-center gap-10 overflow-hidden rounded-lg border border-white/10 bg-ink lg:grid-cols-2">
          <div className="brackets relative aspect-square w-full lg:aspect-auto lg:h-full lg:min-h-[480px]">
            <span className="bracket-b" />
            <Image
              src="/images/1-1thp.png"
              alt="1-on-1 coaching with The Hormone Prophet"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>

          <div className="px-6 py-10 md:px-10">
            <p className="eyebrow mb-4">1-on-1 Coaching</p>
            <h3 className="display text-3xl text-white sm:text-4xl lg:text-5xl">
              The last all-in-one coaching program that actually works.
            </h3>
            <p className="mt-5 font-mono text-sm leading-relaxed text-white/70">
              Bloodwork-driven protocols, daily check-ins, three calls a week, and
              real-time adjustments. A complete biological recalibration — no
              templates, no guesswork, built entirely around you.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button href={ctaHref} variant="primary" external={ctaExternal}>
                Apply Now
              </Button>
              <Button href={site.bookingUrl} variant="outlineLight" external>
                Book a Call
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
