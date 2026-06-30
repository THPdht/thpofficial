import Link from "next/link";
import { ReactNode } from "react";

type Variant = "primary" | "outlineLight" | "outlineDark";

const base =
  "inline-flex items-center justify-center gap-2 font-mono text-xs sm:text-sm uppercase tracking-[0.18em] px-8 py-3.5 transition-all duration-300 cursor-pointer font-bold";

const variants: Record<Variant, string> = {
  primary: "bg-red text-white hover:bg-red-dark shadow-lg",
  outlineLight: "border-2 border-white text-white hover:bg-white hover:text-ink",
  outlineDark: "border-2 border-ink/40 text-ink hover:bg-ink hover:text-white",
};

export function Button({
  href,
  onClick,
  children,
  variant = "primary",
  external = false,
  className = "",
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  variant?: Variant;
  external?: boolean;
  className?: string;
}) {
  const classes = `${base} ${variants[variant]} ${className}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {children}
      </button>
    );
  }
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href!} className={classes}>
      {children}
    </Link>
  );
}
