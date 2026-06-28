import type { Metadata } from "next";
import { LegalLayout } from "@/components/ui/LegalLayout";

export const metadata: Metadata = { title: "Refund Policy — THP" };

export default function RefundsPage() {
  return (
    <LegalLayout
      title="Refund & Cancellation Policy"
      updated="June 2026"
      sections={[
        {
          heading: "Coaching Is a Commitment",
          body: [
            "THP coaching is a personalized service. Because protocols, time, and resources are dedicated to you from the start of each billing period, fees are generally non-refundable once a period has begun.",
          ],
        },
        {
          heading: "Cancellation",
          body: [
            "You may cancel future billing at any time by contacting us before your next renewal date. Cancellation stops future charges; it does not retroactively refund the current period.",
          ],
        },
        {
          heading: "Exceptions",
          body: [
            "If you believe there are exceptional circumstances, contact us — refunds outside this policy are considered case-by-case at our sole discretion.",
          ],
        },
        {
          heading: "Chargebacks",
          body: [
            "Please reach out to us first to resolve any billing issue before initiating a chargeback, so we can help promptly.",
          ],
        },
      ]}
    />
  );
}
