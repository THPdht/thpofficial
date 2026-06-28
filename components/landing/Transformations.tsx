import Image from "next/image";
import { site } from "@/lib/site";
import { transformations } from "@/lib/content";
import { SmokeBg } from "@/components/ui/SmokeBg";

export function Transformations() {
  return (
    <section id="transformations" className="relative overflow-hidden py-20 md:py-28">
      <SmokeBg opacity={88} />
      <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-8">
        <div className="text-center">
          <h2 className="display mx-auto max-w-4xl text-3xl text-white sm:text-4xl md:text-5xl">
            Are you ready for a natural transformation?
          </h2>
          <p className="mt-5 font-mono text-sm font-bold uppercase tracking-[0.22em] text-white/60">
            THP saved my hormones
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {transformations.map((t) => (
            <figure key={t.title} className="overflow-hidden bg-ink-soft">
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={t.image}
                  alt={t.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover object-top"
                />
              </div>
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

        {/* How Ready Are You — red-bordered box, replicated word for word. */}
        <div className="mx-auto mt-16 max-w-4xl border-2 border-red bg-ink/60 p-8 text-center md:p-12">
          <p className="mx-auto max-w-2xl font-mono text-xs uppercase leading-relaxed tracking-[0.14em] text-white/55 sm:text-sm">
            You see this works. It&apos;s real. Those people were ready for change.
            But the question remains
          </p>
          <h3 className="display mt-6 text-3xl text-white sm:text-4xl md:text-5xl">
            How ready are you?
          </h3>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <a
              href={site.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center border-2 border-white px-6 py-4 font-mono text-sm font-bold uppercase tracking-[0.16em] text-white transition-all duration-300 hover:bg-white hover:text-ink"
            >
              Just Getting Started
            </a>
            <a
              href={site.applyHref}
              className="flex w-full items-center justify-center bg-red px-6 py-4 font-mono text-sm font-bold uppercase tracking-[0.16em] text-white shadow-[0_0_30px_rgba(200,16,46,0.6)] transition-all duration-300 hover:bg-red-dark"
            >
              I&apos;m All In
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
