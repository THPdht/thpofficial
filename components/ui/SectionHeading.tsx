import { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "left",
  dark = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: "left" | "center";
  dark?: boolean;
}) {
  const alignment = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <div className={`max-w-3xl ${alignment}`}>
      {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
      <h2
        className={`font-display text-4xl md:text-5xl leading-[1.05] ${
          dark ? "text-cream" : "text-ink"
        }`}
      >
        {title}
      </h2>
      {intro && (
        <p
          className={`mt-6 text-base md:text-lg leading-relaxed ${
            dark ? "text-cream/70" : "text-muted"
          }`}
        >
          {intro}
        </p>
      )}
    </div>
  );
}
