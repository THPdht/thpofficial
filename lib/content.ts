// Landing page content — copy kept out of JSX. Adapted to THP voice from the
// hormoneprophet reference site.

export type Transformation = {
  image: string;
  title: string;
  caption: string;
};

// 6 before/after style proof cards (Transformations section).
export const transformations: Transformation[] = [
  { image: "/images/11.png", title: "Hormone Optimization", caption: "Complete transformation" },
  { image: "/images/17.png", title: "Strength & Discipline", caption: "Mind-body connection" },
  { image: "/images/16.png", title: "Lean Physique", caption: "Shredded & focused" },
  { image: "/images/20.png", title: "Skin Optimization", caption: "Clear skin, no breakouts" },
  { image: "/images/22.png", title: "Bloating Gone", caption: "Lean, no gut inflammation" },
  { image: "/images/21.png", title: "DHT Maxing", caption: "Maxing out DHT effectively" },
];

export type Feature = {
  image: string;
  title: string;
  body: string;
};

// "Your Look Inside" grid. Feature-1 image swapped off the skool image.
export const features: Feature[] = [
  {
    image: "/images/thpjackedreal.png",
    title: "Personalized\nProtocols",
    body: "Custom-tailored strategies designed for your unique goals. No guesswork. Just results.",
  },
  {
    image: "/images/thpboxing.png",
    title: "Daily\nAccountability",
    body: "Direct 1-on-1 expert guidance with daily check-ins to keep you on track. Stay focused.",
  },
  {
    image: "/images/thpjacked2.png",
    title: "Hormone\nOptimization",
    body: "Scientifically-backed methods to maximize testosterone and balance hormones naturally.",
  },
  {
    image: "/images/thptestresults.png",
    title: "Proven\nResults",
    body: "Tested protocols delivering real transformations. Backed by hundreds of success stories.",
  },
  {
    image: "/images/thpfood.png",
    title: "Nutrition\nMastery",
    body: "Complete dietary strategies for optimal health and peak physical performance.",
  },
  {
    image: "/images/thplifestyle.png",
    title: "Lifestyle\nTransformation",
    body: "Build lasting habits creating sustainable change in every area of your life.",
  },
];

export type Faq = { q: string; a: string };

// FAQ — adapted from the reference; the "The Order / community" item is dropped.
export const faqs: Faq[] = [
  {
    q: "Is THP right for me?",
    a: "If you want to rebuild your hormones, physique, and energy from the ground up — yes. THP isn't a fitness course. It's a biological transformation system built on bloodwork, metabolism, and human chemistry. You'll fix what every surface-level program ignores: low testosterone, poor digestion, unstable energy, acne, stress, mood, and sleep. You'll walk different, look different, and feel like a completely new person.",
  },
  {
    q: "When will I start to see results?",
    a: "Within the first few weeks your sleep deepens, energy steadies, and digestion clears. By weeks 4–8 your skin tightens, inflammation drops, testosterone and dopamine rise, and your physique hardens. From there everything compounds — focus, libido, performance, and confidence. At the end of the day it's up to you and how bad you want this transformation.",
  },
  {
    q: "How does THP coaching work?",
    a: "Every transformation begins with bloodwork or a full metabolic panel (no access to either? we build off symptoms and tangible facts). From there I map your hormonal weak points — testosterone, estrogen, thyroid, cortisol, insulin, DHT — and rebuild the system around them. You get daily check-ins, three calls per week, and personalized trackers for digestion, libido, sleep, and performance. Each week we adjust your protocols in real time based on biofeedback and results. Precision medicine without the pharmaceuticals — a complete biological recalibration.",
  },
  {
    q: "What makes THP different from other coaches or programs?",
    a: "I'm no influencer. I'm a man who was passionate enough about hormones to start preaching this message and changed lives along the way. Every method is grounded in blood analysis, neurotransmitter balance, circadian rhythm, and gut-hormone interaction — rather than handing you a course and saying have a nice day. You get full guidance every step of the way.",
  },
];
