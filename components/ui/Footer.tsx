import Image from "next/image";
import Link from "next/link";
import { Socials } from "./Socials";
import { site } from "@/lib/site";

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Medical Disclaimer", href: "/disclaimer" },
  { label: "Refund Policy", href: "/refunds" },
];

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-ink text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-14 md:flex-row md:justify-between md:px-8">
        <div className="flex flex-col gap-4">
          <Image
            src="/images/thprebrandlogo2.png"
            alt="The Hormone Prophet"
            width={150}
            height={60}
            className="h-12 w-auto"
          />
          <p className="max-w-xs font-mono text-xs leading-relaxed text-white/40">
            {site.fullName}. A biological transformation system for the man who
            refuses to settle for less than what he was built for.
          </p>
          <Socials />
        </div>

        <div className="flex flex-col gap-3 font-mono text-xs uppercase tracking-[0.18em] text-white/60">
          <span className="text-white/30">Legal</span>
          {legalLinks.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white">
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-6 font-mono text-[11px] uppercase tracking-[0.16em] text-white/30 md:px-8">
          © {new Date().getFullYear()} {site.domain} · The Hormone Prophet. Not
          medical advice — see our Medical Disclaimer.
        </div>
      </div>
    </footer>
  );
}
