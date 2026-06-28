import type { Metadata } from "next";
import { LegalLayout } from "@/components/ui/LegalLayout";

export const metadata: Metadata = { title: "Privacy Policy — THP" };

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      updated="June 2026"
      sections={[
        {
          heading: "Overview",
          body: [
            "The Hormone Prophet (\"THP\", \"we\", \"us\") respects your privacy. This policy explains what information we collect, how we use it, and the choices you have. By using thpofficial.com or applying for coaching, you agree to this policy.",
          ],
        },
        {
          heading: "Information We Collect",
          body: [
            "Information you provide: name, email, contact details, application and intake answers, health and lifestyle information you choose to share, and payment details (processed securely by our payment provider — we do not store full card numbers).",
            "Information collected automatically: basic analytics such as pages visited and device/browser type, used to improve the site.",
          ],
        },
        {
          heading: "How We Use Your Information",
          body: [
            "To review applications, deliver and personalize coaching, communicate with you, process payments, and improve our services. We do not sell your personal information.",
          ],
        },
        {
          heading: "Health Information",
          body: [
            "Any health information you share (e.g., bloodwork, symptoms) is used solely to build and adjust your protocol. We treat it as confidential and store it securely. THP is a coaching service, not a medical provider — see our Medical Disclaimer.",
          ],
        },
        {
          heading: "Sharing",
          body: [
            "We share information only with service providers who help us operate (e.g., payment processing, scheduling, email), under confidentiality obligations, or where required by law.",
          ],
        },
        {
          heading: "Your Rights",
          body: [
            "You may request access to, correction of, or deletion of your personal information at any time by contacting us. We retain information only as long as needed to provide the service and meet legal obligations.",
          ],
        },
      ]}
    />
  );
}
