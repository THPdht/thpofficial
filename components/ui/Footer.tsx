import Link from "next/link";
import { site } from "@/lib/site";

const legalLinks = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Medical Disclaimer", href: "/disclaimer" },
  { label: "Refunds", href: "/refunds" },
];

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-ink text-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/40 md:flex-row md:px-8">
        <span>
          © {new Date().getFullYear()} {site.domain}
        </span>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {legalLinks.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
