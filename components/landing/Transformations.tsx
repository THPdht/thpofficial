import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { site } from "@/lib/site";
import { transformations } from "@/lib/content";

export function Transformations() {
  return (
    <section id="transformations" className="bg-ink py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <h2 className="display mx-auto max-w-4xl text-center text-3xl text-white sm:text-4xl md:text-5xl lg:text-6xl">
          Are you ready for a natural transformation?
        </h2>

        <div className="mt-14 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
          {transformations.map((t) => (
            <figure
              key={t.title}
              className="brackets group relative aspect-[3/4] overflow-hidden bg-ink-soft"
            >
              <span className="bracket-b" />
              <Image
                src={t.image}
                alt={t.title}
                fill
                sizes="(max-width: 768px) 50vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
              <figcaption className="absolute inset-x-0 bottom-0 z-10 p-4 text-left sm:p-5">
                <h3 className="display text-sm text-white sm:text-lg">{t.title}</h3>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-gold sm:text-xs">
                  {t.caption}
                </p>
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
