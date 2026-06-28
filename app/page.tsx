import { Hero } from "@/components/landing/Hero";
import { Transformations } from "@/components/landing/Transformations";
import { Features } from "@/components/landing/Features";
import { Booking } from "@/components/landing/Booking";
import { Coaching } from "@/components/landing/Coaching";
import { Faq } from "@/components/landing/Faq";

export default function Home() {
  return (
    <>
      <Hero />
      <Transformations />
      <Features />
      <Coaching />
      <Booking />
      <Faq />
    </>
  );
}
