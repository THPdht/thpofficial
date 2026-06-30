"use client";
import { useEffect } from "react";

export default function RegisterRedirect() {
  useEffect(() => {
    window.location.replace("https://onboarding.thp.coach");
  }, []);
  return null;
}
