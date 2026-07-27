"use client";

import { useEffect, useState } from "react";
import {
  getPushState, requestPushPermission, subscribeToPush, subscribeAdminToPush,
  unsubscribeFromPush, isIos, type PushState,
} from "@/lib/push";

/**
 * Turns notifications on. The permission prompt must fire from inside a tap —
 * iOS refuses prompts without a user gesture, and a refused prompt is permanent,
 * so this must never be called automatically on page load.
 *
 * On iOS the Push API only exists inside a home-screen web app, so before the
 * install there is nothing to ask for and the control says so instead.
 */
export default function NotificationToggle(
  props: ({ mode: "client"; email: string; password: string } | { mode: "admin"; adminPassword: string })
    & { hideWhenGranted?: boolean }
) {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const s = getPushState();
    setState(s);
    // Permission already granted means we can re-register without a prompt. Do it:
    // the browser can drop a subscription (storage cleared, push service rotated)
    // while permission survives, which would leave this reading "on" while the
    // server has nowhere to send to.
    if (s === "granted") {
      const resync = props.mode === "admin"
        ? subscribeAdminToPush(props.adminPassword)
        : subscribeToPush(props.email, props.password);
      resync.catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enable() {
    setBusy(true); setError("");
    try {
      const permission = await requestPushPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "default");
        return;
      }
      const ok = props.mode === "admin"
        ? await subscribeAdminToPush(props.adminPassword)
        : await subscribeToPush(props.email, props.password);
      if (!ok) { setError("Could not register this device. Try again."); return; }
      setState("granted");
    } catch {
      setError("Could not register this device. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (props.mode !== "client") return;
    setBusy(true);
    await unsubscribeFromPush(props.email, props.password);
    setState(getPushState());
    setBusy(false);
  }

  if (state === "loading") return null;
  if (props.hideWhenGranted && (state === "granted" || state === "unsupported")) return null;

  const label = { fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.08em", fontFamily: "var(--font-ui), system-ui, sans-serif" };
  const body = { fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300, lineHeight: 1.6, fontFamily: "var(--font-ui), system-ui, sans-serif" };
  const button = {
    height: "38px", padding: "0 1rem", background: busy ? "var(--surface-2)" : "var(--primary)",
    border: "none", borderRadius: "8px", color: busy ? "var(--dim)" : "#fff",
    fontSize: "0.8125rem", fontWeight: 600, cursor: busy ? "default" : "pointer",
    fontFamily: "var(--font-ui), system-ui, sans-serif", alignSelf: "flex-start" as const,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.875rem 1rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "10px" }}>
      <p style={label}>Notifications</p>

      {state === "needs-install" && (
        <>
          <p style={body}>
            Add THP to your home screen first — iPhone only allows notifications from an
            installed app.
          </p>
          <p style={{ ...body, color: "var(--dim)" }}>
            Tap Share at the bottom of Safari, then <strong>Add to Home Screen</strong>. Open THP
            from the new icon and turn notifications on there.
          </p>
        </>
      )}

      {state === "unsupported" && (
        <p style={body}>This browser does not support notifications.</p>
      )}

      {state === "default" && (
        <>
          <p style={body}>
            {props.mode === "admin"
              ? "Get alerted when a client messages you, files a tracker, applies or pays."
              : "Get told the moment a new protocol lands, without checking the app."}
          </p>
          <button onClick={enable} disabled={busy} style={button}>
            {busy ? "Turning on…" : "Turn on notifications"}
          </button>
        </>
      )}

      {state === "denied" && (
        <p style={body}>
          Notifications are blocked for this site. Turn them back on in{" "}
          {isIos() ? "Settings › Notifications › THP" : "your browser's site settings"}, then
          reopen the app.
        </p>
      )}

      {state === "granted" && (
        <>
          <p style={{ ...body, color: "oklch(0.7 0.15 145)" }}>Notifications are on for this device.</p>
          {props.mode === "client" && (
            <button onClick={disable} disabled={busy}
              style={{ ...button, background: "none", border: "1px solid var(--border)", color: "var(--dim)", fontWeight: 500 }}>
              {busy ? "Turning off…" : "Turn off"}
            </button>
          )}
        </>
      )}

      {error && <p style={{ ...body, color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
