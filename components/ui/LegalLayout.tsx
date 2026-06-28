import Link from "next/link";
import { site } from "@/lib/site";

export type LegalSection = { heading: string; body: string[] };

export function LegalLayout({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <section className="bg-ink py-28 md:py-36">
      <div className="mx-auto max-w-3xl px-6">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-[0.18em] text-white/50 hover:text-white"
        >
          ← Back home
        </Link>

        <h1 className="display mt-8 text-4xl text-white sm:text-5xl">{title}</h1>
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-white/40">
          Last updated: {updated}
        </p>

        <div className="mt-12 space-y-10">
          {sections.map((s) => (
            <div key={s.heading}>
              <h2 className="font-mono text-sm font-bold uppercase tracking-[0.14em] text-red">
                {s.heading}
              </h2>
              {s.body.map((p, i) => (
                <p key={i} className="mt-3 text-sm leading-relaxed text-white/70">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>

        <p className="mt-16 font-mono text-xs leading-relaxed text-white/40">
          Questions? Contact us at {site.email}.
        </p>
      </div>
    </section>
  );
}
