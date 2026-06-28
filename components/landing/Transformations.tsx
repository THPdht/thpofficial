import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { site } from "@/lib/site";
import { transformations } from "@/lib/content";

export function Transformations() {
  return (
    <section id="transformations" className="bg-ink py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="text-center">
          <h2 className="display mx-auto max-w-4xl text-3xl text-white sm:text-4xl md:text-5xl lg:text-6xl">
            Are you ready for a natural transformation?
          </h2>
          <p className="mt-5 font-mono text-sm font-bold uppercase tracking-[0.22em] text-white/60">
            THP saved my hormones
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {transformations.map((t) => (
            <figure key={t.title} className="overflow-hidden bg-ink-soft">
              {/* Landscape before/after image, fully contained (16:9 source). */}
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={t.image}
                  alt={t.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover object-top"
                />
              </div>
              {/* Dark panel: orange DNA icon + title + orange caption. */}
              <figcaption className="flex items-center gap-4 px-5 py-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange text-2xl">
                  🧬
                </span>
                <div>
                  <h3 className="display text-lg leading-tight text-white sm:text-xl">
                    {t.title}
                  </h3>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-orange">
                    {t.caption}
                  </p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>

        {/* How Ready Are You CTA */}
        <div className="mt-16 text-center">
          <h3 className="display text-2xl text-white sm:text-3xl md:text-4xl">
            How ready are you?
          </h3>
          <div className="mt-7 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button href={site.bookingUrl} variant="outlineLight" external>
              Just Getting Started
            </Button>
            <Button href={site.applyHref} variant="primary">
              I&apos;m All In
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
