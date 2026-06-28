import Image from "next/image";
import { features } from "@/lib/content";

export function Features() {
  return (
    <section id="your-look-inside" className="relative overflow-hidden py-20 md:py-28">
      {/* Section background image + dark wash. */}
      <Image
        src="/images/thprebrandbackground.png"
        alt=""
        fill
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-ink/85" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-8">
        <div className="mb-12 text-center">
          <h2 className="display text-3xl text-white sm:text-4xl md:text-5xl lg:text-6xl">
            Your Look Inside
          </h2>
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-white/60 sm:text-sm">
            All-around hormone and health benefits in one place
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.title}
              className="brackets group relative overflow-hidden bg-ink-soft"
            >
              <span className="bracket-b" />
              <div className="relative h-64 overflow-hidden sm:h-72">
                <Image
                  src={f.image}
                  alt={f.title.replace("\n", " ")}
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-soft via-ink-soft/40 to-transparent" />
              </div>
              <div className="flex min-h-[190px] flex-col justify-center bg-cream px-6 py-8">
                <h3 className="display whitespace-pre-line text-2xl text-ink sm:text-3xl">
                  {f.title}
                </h3>
                <p className="mt-3 font-mono text-xs font-medium uppercase leading-relaxed tracking-[0.08em] text-ink/70 sm:text-sm">
                  {f.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
