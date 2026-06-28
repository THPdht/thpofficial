import Image from "next/image";
import Link from "next/link";
import { Socials } from "./Socials";
import { site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-14 md:flex-row md:items-center md:justify-between md:px-8">
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
          <Link href={site.applyHref} className="hover:text-white">Apply</Link>
          <a href={site.bookingUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">
            Book a Call
          </a>
          <span className="text-white/30">
            © {new Date().getFullYear()} {site.domain}
          </span>
        </div>
      </div>
    </footer>
  );
}
