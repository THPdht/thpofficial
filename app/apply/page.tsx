import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Apply — THP",
  description: "Apply for 1-on-1 coaching with The Hormone Prophet.",
};

// Placeholder. The real qualification form (5–10 questions) → full 72-field
// intake gets built in a later phase.
export default function ApplyPage() {
  return (
    <section className="bg-cream py-28 md:py-36">
      <Container className="max-w-2xl text-center">
        <p className="eyebrow mb-5">Application</p>
        <h1 className="font-display text-4xl leading-tight text-ink md:text-5xl">
          The application opens here soon.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted">
          We&apos;re putting the finishing touches on the qualification form. In the
          meantime, book a call directly and we&apos;ll start the conversation.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button href={site.bookingUrl} variant="primary" external>
            Book a Call
          </Button>
          <Button href="/" variant="ghost">
            Back Home
          </Button>
        </div>
      </Container>
    </section>
  );
}
