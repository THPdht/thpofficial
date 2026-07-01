// Single source of brand strings + links used across the landing page.

export const site = {
  name: "THP",
  fullName: "The Hormone Prophet",
  domain: "thpofficial.com",
  bookingUrl: "https://cal.com/ali-filali-uks4xi/30min",
  // Cal.com embed expects the link WITHOUT the cal.com host prefix.
  calLink: "ali-filali-uks4xi/30min",
  applyHref: "/apply",
  // Drop a Stripe Payment Link here to let clients check out on-site for the
  // coaching program. Until set, the coaching CTA falls back to /apply.
  checkoutUrl: "" as string,
  email: "hello@thpofficial.com",
} as const;

export const social = {
  youtube: "https://www.youtube.com/@THPDIGITAL",
  tiktok: "https://www.tiktok.com/@thehormoneprophet",
  instagram: "https://www.instagram.com/thp.dht/",
} as const;

export const navLinks = [
  { label: "Transformations", href: "#transformations" },
  { label: "Inside", href: "#your-look-inside" },
  { label: "Book", href: "#booking" },
  { label: "FAQ", href: "#faq" },
] as const;
