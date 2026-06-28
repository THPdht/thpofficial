"use client";

import { useEffect } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import { site } from "@/lib/site";

export function Booking() {
  useEffect(() => {
    (async () => {
      const cal = await getCalApi();
      cal("ui", {
        hideEventTypeDetails: false,
        layout: "month_view",
        cssVarsPerTheme: {
          light: { "cal-brand": "#c8102e" },
          dark: { "cal-brand": "#c8102e" },
        },
      });
    })();
  }, []);

  return (
    <section id="booking" className="bg-ink py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <div className="mb-10 text-center">
          <p className="eyebrow mb-4">Book your call</p>
          <h2 className="display text-3xl text-white sm:text-4xl md:text-5xl lg:text-6xl">
            All-In-One Guidance
          </h2>
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-white/60 sm:text-sm">
            Pick a time. We map your hormones, your goals, and your protocol.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-white/10 bg-ink-soft">
          <Cal
            calLink={site.calLink}
            style={{ width: "100%", height: "600px", overflow: "scroll" }}
            config={{ layout: "month_view" }}
          />
        </div>
      </div>
    </section>
  );
}
