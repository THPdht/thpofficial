"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

function ReferralInner() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const ref = params.get("ref");
    if (ref) {
      localStorage.setItem("thp_ref", ref);
    }
    router.replace("/apply");
  }, [params, router]);

  return null;
}

export default function ReferralPage() {
  return (
    <Suspense>
      <ReferralInner />
    </Suspense>
  );
}
