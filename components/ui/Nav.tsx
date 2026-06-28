import Link from "next/link";
import { Button } from "./Button";
import { Container } from "./Container";
import { site, navLinks } from "@/lib/site";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-cream/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between">
        {/* Logo — swap the wordmark for the uploaded logo image later. */}
        <Link href="/" className="font-display text-xl tracking-tight text-ink">
          {site.name}
          <span className="text-red">.</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="font-mono text-xs uppercase tracking-[0.16em] text-muted hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button href={site.bookingUrl} variant="ghost" external className="hidden sm:inline-flex">
            Book a Call
          </Button>
          <Button href={site.applyHref} variant="primary">
            Apply Now
          </Button>
        </div>
      </Container>
    </header>
  );
}
