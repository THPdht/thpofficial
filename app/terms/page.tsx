import type { Metadata } from "next";
import { LegalLayout } from "@/components/ui/LegalLayout";

export const metadata: Metadata = { title: "Terms of Service — THP" };

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      updated="June 2026"
      sections={[
        {
          heading: "Agreement",
          body: [
            "These Terms govern your use of thpofficial.com and any coaching services from The Hormone Prophet (\"THP\"). By accessing the site or purchasing a program, you agree to these Terms.",
          ],
        },
        {
          heading: "The Service",
          body: [
            "THP provides educational health and fitness coaching, including personalized nutrition, training, and lifestyle protocols. Coaching is delivered remotely. Acceptance into the program is at our discretion following application review.",
          ],
        },
        {
          heading: "Not Medical Advice",
          body: [
            "THP is not a doctor, clinic, or licensed medical provider, and nothing in the service is medical advice, diagnosis, or treatment. You should consult a qualified physician before starting any protocol. See our Medical Disclaimer.",
          ],
        },
        {
          heading: "Payment",
          body: [
            "Fees are billed as described at checkout (e.g., monthly). You authorize us to charge your payment method on the stated schedule. You are responsible for any taxes. Pricing may change with notice for future billing periods.",
          ],
        },
        {
          heading: "Your Responsibilities",
          body: [
            "You agree to provide accurate information, follow protocols at your own discretion and risk, and disclose relevant medical conditions. Results vary and are not guaranteed.",
          ],
        },
        {
          heading: "Intellectual Property",
          body: [
            "All protocols, materials, and content provided by THP are owned by THP and are for your personal use only. You may not resell, redistribute, or share them.",
          ],
        },
        {
          heading: "Limitation of Liability",
          body: [
            "To the maximum extent permitted by law, THP is not liable for any indirect or consequential damages arising from use of the service. Our total liability is limited to the amount you paid in the prior month.",
          ],
        },
      ]}
    />
  );
}
