import Image from "next/image";

// Smoky grey textured background (matches the reference). Drop inside a
// `relative` section; content should sit in a `relative z-10` wrapper.
export function SmokeBg({ opacity = 80 }: { opacity?: number }) {
  return (
    <>
      <Image
        src="/images/thprebrandbackground.png"
        alt=""
        fill
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-ink" style={{ opacity: opacity / 100 }} />
    </>
  );
}
