import { Hero } from "@/components/landing/Hero";
import { Transformations } from "@/components/landing/Transformations";
import { Features } from "@/components/landing/Features";
import { Booking } from "@/components/landing/Booking";
import { Coaching } from "@/components/landing/Coaching";
import { Faq } from "@/components/landing/Faq";

export default function Home() {
  return (
    <>
      {/* Pinned hero stays fixed in the background. */}
      <Hero />

      {/* Spacer reveals the hero for the first viewport. */}
      <div className="h-screen" aria-hidden />

      {/* Everything below scrolls up over the hero, fully covering it.
          relative + z-10 + solid bg = the curtain that hides the hero. */}
      <div className="relative z-10 bg-ink shadow-[0_-40px_80px_rgba(0,0,0,0.6)]">
        <Transformations />
        <Features />
        <Coaching />
        <Booking />
        <Faq />
      </div>
    </>
  );
}
