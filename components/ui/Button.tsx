import Link from "next/link";
import { ReactNode } from "react";

type Variant = "primary" | "ghost" | "light";

const base =
  "inline-flex items-center justify-center gap-2 font-mono text-sm uppercase tracking-[0.14em] px-7 py-3.5 transition-colors duration-200 cursor-pointer";

const variants: Record<Variant, string> = {
  // Solid red — the main "Apply" action.
  primary: "bg-red text-white hover:bg-red-dark",
  // Outlined on dark/cream — secondary "Book a call".
  ghost: "border border-ink/30 text-ink hover:border-ink hover:bg-ink hover:text-cream",
  // Outlined on dark hero backgrounds.
  light: "border border-white/40 text-white hover:bg-white hover:text-ink",
};

export function Button({
  href,
  children,
  variant = "primary",
  external = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  external?: boolean;
  className?: string;
}) {
  const classes = `${base} ${variants[variant]} ${className}`;

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
