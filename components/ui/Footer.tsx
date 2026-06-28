import Link from "next/link";
import { Container } from "./Container";
import { site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-cream/10 bg-ink text-cream">
      <Container className="flex flex-col gap-6 py-12 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/" className="font-display text-2xl">
            {site.name}
            <span className="text-red">.</span>
          </Link>
          <p className="mt-2 max-w-xs font-mono text-xs leading-relaxed text-cream/50">
            {site.fullName}. Built for the man who refuses to settle for less than
            what he was made for.
          </p>
        </div>

        <div className="flex flex-col gap-2 font-mono text-xs uppercase tracking-[0.16em] text-cream/60">
          <Link href={site.applyHref} className="hover:text-cream">
            Apply
          </Link>
          <a
            href={site.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-cream"
          >
            Book a Call
          </a>
          <span className="text-cream/30">
            © {new Date().getFullYear()} {site.domain}
          </span>
        </div>
      </Container>
    </footer>
  );
}
