"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./Button";
import { Socials } from "./Socials";
import { site, navLinks } from "@/lib/site";

const PORTAL_ROUTES = ["/admin", "/dashboard", "/login", "/register", "/onboarding"];

export function Nav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isPortal = PORTAL_ROUTES.some(r => pathname === r || pathname.startsWith(r + "/"));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (isPortal) return null;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-ink/95 shadow-lg backdrop-blur-sm" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
        <div className="flex items-center gap-5">
          <Link href="/" aria-label="THP home">
            <Image
              src="/images/thprebrandlogo2.png"
              alt="The Hormone Prophet"
              width={160}
              height={64}
              priority
              className="h-12 w-auto drop-shadow-lg md:h-14"
            />
          </Link>
          <Socials className="hidden lg:flex" />
        </div>

        <nav className="hidden items-center gap-8 lg:flex">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="font-mono text-xs uppercase tracking-[0.18em] text-white/70 transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          <Button href={site.bookingUrl} variant="outlineLight" external className="px-5 py-2.5">
            Book a Call
          </Button>
          <Button href={site.applyHref} variant="primary" className="px-5 py-2.5">
            Apply Now
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
          className="flex h-10 w-10 items-center justify-center text-white sm:hidden"
        >
          <span className="text-2xl">{menuOpen ? "✕" : "☰"}</span>
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="border-t border-white/10 bg-ink/98 px-6 py-6 sm:hidden">
          <div className="flex flex-col gap-4">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="font-mono text-sm uppercase tracking-[0.18em] text-white/80"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-3">
              <Button href={site.applyHref} variant="primary">Apply Now</Button>
              <Button href={site.bookingUrl} variant="outlineLight" external>Book a Call</Button>
            </div>
            <Socials className="mt-2" />
          </div>
        </div>
      )}
    </header>
  );
}
