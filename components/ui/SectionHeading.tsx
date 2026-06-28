import { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "center",
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  const alignment = align === "center" ? "text-center mx-auto items-center" : "text-left";
  return (
    <div className={`flex flex-col ${alignment} ${className}`}>
      {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
      <h2 className="display text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white max-w-4xl">
        {title}
      </h2>
      {intro && (
        <p className="mt-5 max-w-2xl font-mono text-sm uppercase tracking-[0.12em] text-white/60">
          {intro}
        </p>
      )}
    </div>
  );
}
