import type { Metadata } from "next";
import { LegalLayout } from "@/components/ui/LegalLayout";

export const metadata: Metadata = { title: "Medical Disclaimer — THP" };

export default function DisclaimerPage() {
  return (
    <LegalLayout
      title="Medical Disclaimer"
      updated="June 2026"
      sections={[
        {
          heading: "Educational Purpose Only",
          body: [
            "The information and coaching provided by The Hormone Prophet (\"THP\") is for educational and informational purposes only. It is not intended as, and shall not be understood or construed as, medical advice, diagnosis, or treatment.",
          ],
        },
        {
          heading: "Not a Substitute for Medical Care",
          body: [
            "THP is not a licensed physician or medical provider. Always seek the advice of a qualified doctor or healthcare professional before beginning any nutrition, training, supplementation, or hormone-related protocol, and before making changes based on anything you read or receive from THP.",
            "Never disregard professional medical advice or delay seeking it because of something provided by THP.",
          ],
        },
        {
          heading: "Assumption of Risk",
          body: [
            "Any actions you take based on THP coaching are taken at your own risk. Physical activity and dietary changes carry inherent risks. You are responsible for knowing your own health status and limitations.",
          ],
        },
        {
          heading: "No Guarantees",
          body: [
            "Individual results vary and depend on many factors. THP makes no guarantee of any specific outcome, including changes to hormone levels, body composition, or health markers.",
          ],
        },
        {
          heading: "Emergencies",
          body: [
            "If you think you may have a medical emergency, call your doctor or emergency services immediately.",
          ],
        },
      ]}
    />
  );
}
