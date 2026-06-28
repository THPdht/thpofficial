import Image from "next/image";

// Pinned hero: fixed to the viewport (z-0). The page content below has a
// 100vh spacer then scrolls up over it (see app/page.tsx), fully covering it.
// Just the background image + a single Start Now button.
export function Hero() {
  return (
    <section className="fixed inset-0 z-0 flex items-end justify-center overflow-hidden bg-ink text-center">
      <Image
        src="/images/thprealbackgroun.png"
        alt=""
        fill
        priority
        className="object-cover object-center"
      />

      <div className="relative z-10 pb-16">
        <a
          href="#your-look-inside"
          className="inline-flex items-center justify-center border-2 border-white bg-transparent px-12 py-4 font-mono text-sm font-bold uppercase tracking-[0.18em] text-white shadow-2xl transition-all duration-300 hover:bg-white hover:text-ink sm:text-base"
        >
          Start Now
        </a>
      </div>
    </section>
  );
}
