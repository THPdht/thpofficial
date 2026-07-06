"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Cal, { getCalApi } from "@calcom/embed-react";
import { site } from "@/lib/site";

export function Booking() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const cal = await getCalApi();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cal as any)("ui", {
        hideEventTypeDetails: false,
        layout: "month_view",
        cssVarsPerTheme: {
          light: { "cal-brand": "#c8102e" },
          dark: { "cal-brand": "#c8102e" },
        },
        // Tell cal.com to redirect to our own page after booking is confirmed
        // This fires even if the bookingSuccessful JS event doesn't fire
        redirect_url: "https://thpofficial.com/booking-confirmed",
      });
      // Redirect to confirmation screen after booking is confirmed + fire booking alarm
      cal("on", {
        action: "bookingSuccessful",
        callback: () => {
          // Try to get logged-in user email from localStorage for the alarm
          try {
            const currentEmail = localStorage.getItem('thp_current');
            if (currentEmail) {
              const userData = localStorage.getItem(`thp_user_${currentEmail}`);
              const name = userData ? (JSON.parse(userData)?.name ?? currentEmail) : currentEmail;
              fetch('/api/alarms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  user_email: currentEmail,
                  type: 'booking',
                  message: `${name} booked a strategy call`,
                }),
              }).catch(() => {});
            }
          } catch { /* silent — alarm is non-critical */ }
          router.push("/booking-confirmed");
        },
      });
    })();
  }, [router]);

  return (
    <section id="booking" className="bg-ink py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <div className="mb-10 text-center">
          <p className="eyebrow mb-4">Book your call</p>
          <h2 className="display text-3xl text-white sm:text-4xl md:text-5xl">
            All-In-One Guidance
          </h2>
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-white/60 sm:text-sm">
            Pick a time. We map your hormones, your goals, and your protocol.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-white/10 bg-ink-soft">
          <Cal
            calLink={site.calLink}
            style={{ width: "100%", height: "min(600px, 85dvh)", overflow: "scroll" }}
            config={{ layout: "month_view" }}
          />
        </div>
      </div>
    </section>
  );
}
