import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { WhatThpIs } from "@/components/landing/WhatThpIs";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Results } from "@/components/landing/Results";
import { FinalCta } from "@/components/landing/FinalCta";

export default function Home() {
  return (
    <>
      <Hero />
      <Problem />
      <WhatThpIs />
      <HowItWorks />
      <Results />
      <FinalCta />
    </>
  );
}
