import { Hero } from "@/components/landing/Hero";
import { WhyItFailed } from "@/components/landing/WhyItFailed";
import { CinematicProof } from "@/components/landing/CinematicProof";
import { Qualifying } from "@/components/landing/Qualifying";
import { DataGrid } from "@/components/landing/DataGrid";
import { Booking } from "@/components/landing/Booking";
import { Coaching } from "@/components/landing/Coaching";

// HIDDEN pending THP approval — do not delete yet:
// import { Transformations } from "@/components/landing/Transformations";
// import { Features } from "@/components/landing/Features";

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
        {/* Pain → Rapport → Proof → Solution → CTA */}
        <WhyItFailed />
        <CinematicProof />
        <Qualifying />
        <DataGrid />
        <Coaching />
        <Booking />
      </div>
    </>
  );
}
