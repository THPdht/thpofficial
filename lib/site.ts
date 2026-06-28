// Single source of brand strings + links used across the landing page.

export const site = {
  name: "THP",
  fullName: "The Hormone Prophet",
  domain: "thpofficial.com",
  bookingUrl: "https://cal.com/ali-filaliuks4xi/30min",
  applyHref: "/apply",
  email: "hello@thpofficial.com",
} as const;

export const navLinks = [
  { label: "The Problem", href: "#problem" },
  { label: "Method", href: "#method" },
  { label: "How It Works", href: "#how" },
  { label: "Results", href: "#results" },
] as const;
