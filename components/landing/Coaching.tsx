import Image from "next/image";
import { site } from "@/lib/site";
import { SmokeBg } from "@/components/ui/SmokeBg";

export function Coaching() {
  const ctaHref = site.checkoutUrl || site.applyHref;
  const ctaExternal = Boolean(site.checkoutUrl);

  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <SmokeBg opacity={85} />
      <div className="relative z-10 mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 text-center">
          <h2 className="display mx-auto max-w-3xl text-3xl text-white sm:text-4xl md:text-5xl">
            Enough surviving. It&apos;s time to{" "}
            <span className="text-red">perform.</span>
          </h2>
        </div>

        <div className="grid items-stretch gap-px overflow-hidden border border-white/10 bg-white/10 lg:grid-cols-2">
          {/* Left: full THP logo, contained so nothing is cropped. */}
          <div className="brackets relative flex items-center justify-center bg-ink p-10 md:p-14">
            <span className="bracket-b" />
            <div className="relative h-48 w-full sm:h-60 lg:h-72">
              <Image
                src="/images/1-1thp.png"
                alt="1-on-1 with The Hormone Prophet"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-contain"
              />
            </div>
          </div>

          {/* Right: copy replicated word-for-word + price + Apply Now. */}
          <div className="bg-ink px-7 py-10 md:px-10 md:py-12">
            <h3 className="display text-3xl leading-[1.05] text-white sm:text-4xl">
              1:1 With THP
            </h3>
            <p className="mt-5 font-mono text-sm font-bold uppercase leading-relaxed tracking-[0.06em] text-white">
              The last time you settle for feeling like this.
            </p>
            <p className="mt-4 font-mono text-xs uppercase leading-relaxed tracking-[0.06em] text-white/60">
              No pills. No fake hacks. Just raw, structured transformation through
              backed studies and ancestral truth, built to make you feel powerful
              again.
            </p>

            <p className="mt-8 flex items-baseline gap-2 flex-wrap">
              <span className="font-body font-extrabold text-white tracking-tight" style={{ fontSize: "clamp(2.5rem, 10vw, 4rem)" }}>$2,000</span>
              <span className="font-mono text-base text-white/50">/month</span>
            </p>

            <a
              href={ctaHref}
              {...(ctaExternal
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="mt-8 flex w-full items-center justify-center gap-3 bg-white px-6 py-4 font-mono text-sm font-bold uppercase tracking-[0.16em] text-ink transition-colors duration-300 hover:bg-cream"
            >
              Apply Now <span className="text-red">&raquo;</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
