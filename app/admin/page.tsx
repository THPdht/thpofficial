"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getAllUsers, updateUser, linkNotionPage, setProtocolStatus,
  setAccountStatus, setClientType, addPayment, removePayment, removeClient, createClient,
  getMessages, addMessage, uploadMessageAttachment, markClientMessagesRead, getAllUnreadCounts, setSuspended,
  updatePresence, isClientActive, getClientProtocols, getAdminDiagnostics, publishDiagnosis,
} from "@/lib/auth";
import type { StoredUser, Message, ClientStatus, ProtocolStatus, AccountStatus, Payment, AttachmentType, ClientProtocol, ClientDiagnostic } from "@/lib/auth";
import type { ProtocolId } from "@/lib/protocols";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "info.shopzul@gmail.com";
const ADMIN_PASSWORD = "Fikri!";
const WHATSAPP_NUMBER = "447453172081";

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:  { bg: "oklch(0.60 0.18 165 / 0.15)", color: "var(--color-red)" },
  pending: { bg: "oklch(0.75 0.15 80 / 0.15)",  color: "oklch(0.75 0.15 80)" },
  alumni:  { bg: "var(--surface)",               color: "var(--dim)" },
  new:     { bg: "oklch(0.75 0.15 80 / 0.15)",   color: "oklch(0.75 0.15 80)" },
  hold:    { bg: "oklch(0.62 0.20 25 / 0.15)",   color: "var(--danger)" },
};

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [clients, setClients] = useState<StoredUser[]>([]);
  const [selected, setSelected] = useState<StoredUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [compose, setCompose] = useState("");
  const [composeFocused, setComposeFocused] = useState(false);
  const [diagnosticOpen, setDiagnosticOpen] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Chatbot state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const msgEndRef = useRef<HTMLDivElement | null>(null);
  const adminFileInputRef = useRef<HTMLInputElement | null>(null);

  // Client brief
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  // Draft reply
  const [drafting, setDrafting] = useState(false);

  // Admin attachment state
  const [adminPendingFile, setAdminPendingFile] = useState<File | null>(null);
  const [adminPendingType, setAdminPendingType] = useState<AttachmentType | null>(null);
  const [adminRecording, setAdminRecording] = useState(false);
  const [adminAudioBlob, setAdminAudioBlob] = useState<Blob | null>(null);
  const [selectedClientActive, setSelectedClientActive] = useState(false);
  const adminMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [adminUploading, setAdminUploading] = useState(false);
  const [adminSendError, setAdminSendError] = useState<string | null>(null);

  // Create client modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  // Check auth on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("mn_admin");
    if (stored === "1") {
      setAuthed(true);
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set up realtime channels whenever authed (covers both mount and password-login paths)
  useEffect(() => {
    if (!authed) return;

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { /* ignore */ });
    }

    // Realtime: client sends a message → update unread badge + browser notification
    const channel = supabase
      .channel('admin:new_client_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: 'from_type=eq.client',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (payload: any) => {
        const row = payload.new;
        if (!row) return;
        setUnreadCounts(prev => ({ ...prev, [row.user_email]: (prev[row.user_email] ?? 0) + 1 }));
        setSelected(prev => {
          if (prev?.email === row.user_email) {
            const newMsg: Message = { id: row.id, from: 'client', text: row.text, ts: row.ts, read: false };
            setMessages(msgs => [...msgs, newMsg]);
            setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
            setUnreadCounts(c => ({ ...c, [row.user_email]: 0 }));
            markClientMessagesRead(row.user_email).catch(() => {});
          }
          return prev;
        });
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try { new Notification(`Message from ${row.user_email}`, { body: (row.text ?? '').slice(0, 100), icon: '/thp.jpg' }); } catch { /* blocked */ }
        }
      })
      .subscribe();

    // Realtime: client checks in → notify + refresh their row in the list
    const checkinChannel = supabase
      .channel('admin:checkins')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (payload: any) => {
        const row = payload.new;
        if (!row) return;
        const today = new Date().toISOString().split('T')[0];
        if (row.last_check_in === today) {
          setClients(prev => prev.map(c => c.email === row.email ? {
            ...c, streak: row.streak ?? c.streak, lastCheckIn: row.last_check_in, longestStreak: row.longest_streak ?? c.longestStreak,
          } : c));
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try { new Notification(`${row.name} checked in`, { body: `Day ${row.streak} streak.`, icon: '/thp.jpg' }); } catch { /* blocked */ }
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); supabase.removeChannel(checkinChannel); };
  }, [authed]);

  // Admin presence heartbeat: mark THP as active while in admin panel
  useEffect(() => {
    if (!authed) return;
    updatePresence('admin').catch(() => {});
    const interval = setInterval(() => updatePresence('admin').catch(() => {}), 60000);
    return () => clearInterval(interval);
  }, [authed]);

  async function loadData() {
    setLoading(true);
    await refreshClients();
    setLoading(false);
  }

  async function refreshClients() {
    const order: Record<ClientStatus, number> = { pending: 0, active: 1, alumni: 2, new: 3 };
    const [all, counts] = await Promise.all([getAllUsers(), getAllUnreadCounts()]);
    const sorted = all.sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4));
    setClients(sorted);
    setUnreadCounts(counts);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (adminEmail.trim().toLowerCase() === ADMIN_EMAIL && pw === ADMIN_PASSWORD) {
      localStorage.setItem("mn_admin", "1");
      setAuthed(true);
      loadData();
    } else {
      setPwError("Incorrect email or password.");
    }
  }

  function handleSignOut() {
    localStorage.removeItem("mn_admin");
    setAuthed(false);
  }

  async function selectClient(u: StoredUser) {
    setSelected(u);
    setBrief(null);
    setSelectedClientActive(false);
    isClientActive(u.email).then(setSelectedClientActive).catch(() => {});
    await markClientMessagesRead(u.email);
    const msgs = await getMessages(u.email);
    setMessages(msgs);
    setUnreadCounts(prev => ({ ...prev, [u.email]: 0 }));
    setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 120);

    // Auto-generate client brief if they have intake data
    if (u.diagnosticData && u.diagnosticData.whatTryingToFix) {
      setBriefLoading(true);
      const d = u.diagnosticData;
      const ctx = `Client: ${u.name}, joined ${u.joinedAt}
What they are trying to fix: ${d.whatTryingToFix || 'not specified'}
Age / location: ${d.ageLocation || 'not specified'}
Energy state: ${d.energyState || 'not provided'}
Self-perception: ${d.selfPerception || 'not provided'}
Baseline internal state: ${d.baselineInternalState || 'not provided'}
Sleep quality: ${d.sleepQuality || 'not provided'} | Duration: ${d.sleepDuration || 'not provided'}
On TRT / peptides: ${d.onTrt || 'not provided'}
Libido: ${d.libido || 'not provided'}
Sexual confidence: ${d.sexualConfidence || 'not provided'}
Training: ${d.trainingApproach || 'not provided'} — ${d.trainingFrequency || 'not provided'}
Height / weight / BF: ${d.heightWeightBf || 'not provided'}`;
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: 'Write the client brief.' }], clientContext: ctx, mode: 'brief' }),
        });
        const data = await res.json();
        if (data.content) setBrief(data.content);
      } catch { /* ignore */ }
      setBriefLoading(false);
    }
  }

  async function handleCreateClient() {
    if (!createName.trim() || !createEmail.trim()) return;
    setCreating(true);
    setCreateError("");
    const pw = createPassword.trim() || Math.random().toString(36).slice(2, 10);
    const result = await createClient(createName.trim(), createEmail.trim(), pw);
    if (!result.success) {
      setCreateError(result.error ?? "Failed to create client.");
      setCreating(false);
      return;
    }
    setCreatePassword(pw); // show the generated password
    await refreshClients();
    setCreating(false);
  }

  async function draftReply() {
    if (!selected || drafting) return;
    setDrafting(true);
    const d = selected.diagnosticData;
    const ctx = d ? `Client: ${selected.name}
Trying to fix: ${d.whatTryingToFix || 'not specified'}
Energy: ${d.energyState || 'not provided'} | Sleep: ${d.sleepQuality || 'not provided'}
Self-perception: ${d.selfPerception || 'not provided'}
Libido: ${d.libido || 'not provided'}` : `Client: ${selected.name}`;

    const recentMessages = messages.slice(-8).map(m => `${m.from === 'client' ? selected.name.split(' ')[0] : 'THP'}: ${m.text}`).join('\n');
    const prompt = `Draft a reply to ${selected.name.split(' ')[0]}'s last message.\n\nConversation:\n${recentMessages}`;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], clientContext: ctx, mode: 'draft' }),
      });
      const data = await res.json();
      if (data.content) setCompose(data.content);
    } catch { /* ignore */ }
    setDrafting(false);
  }

  async function sendAdminMessage() {
    if ((!compose.trim() && !adminPendingFile && !adminAudioBlob) || !selected) return;
    setAdminUploading(true);
    setAdminSendError(null);
    let attachment: { url: string; type: AttachmentType; name?: string } | undefined;
    if (adminAudioBlob) {
      const url = await uploadMessageAttachment(adminAudioBlob, "voice.webm", `admin-${selected.email}`);
      if (url) {
        attachment = { url, type: "audio", name: "Voice note" };
      } else {
        setAdminAudioBlob(null);
        setAdminUploading(false);
        setAdminSendError("Upload failed. Check your Supabase storage bucket.");
        return;
      }
      setAdminAudioBlob(null);
    } else if (adminPendingFile) {
      const url = await uploadMessageAttachment(adminPendingFile, adminPendingFile.name, `admin-${selected.email}`);
      if (url) {
        attachment = { url, type: adminPendingType!, name: adminPendingFile.name };
      } else {
        setAdminPendingFile(null);
        setAdminPendingType(null);
        setAdminUploading(false);
        setAdminSendError("Upload failed. Check your Supabase storage bucket.");
        return;
      }
      setAdminPendingFile(null);
      setAdminPendingType(null);
    }
    const text = compose.trim();
    if (!text && !attachment) { setAdminUploading(false); return; }
    setCompose("");
    setAdminUploading(false);
    const savedMsg = await addMessage(selected.email, text, "admin", attachment);
    // Optimistically append to local state so UI updates instantly
    if (savedMsg) {
      setMessages(msgs => [...msgs, savedMsg]);
    } else {
      const msgs = await getMessages(selected.email);
      setMessages(msgs);
    }
    setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);

    // Push notification to client
    const preview = text ? text.slice(0, 80) : (attachment?.type === "audio" ? "Voice note from THP" : "New message from THP");
    fetch('/api/push-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail: selected.email, title: 'THP', body: preview, adminPw: ADMIN_PASSWORD }),
    }).catch(() => { /* non-critical */ });
  }

  function startAdminRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      mr.onstop = () => {
        setAdminAudioBlob(new Blob(chunks, { type: mr.mimeType || "audio/webm" }));
        setAdminPendingType("audio");
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      adminMediaRecorderRef.current = mr;
      setAdminRecording(true);
    }).catch(() => { /* mic denied */ });
  }

  function stopAdminRecording() {
    adminMediaRecorderRef.current?.stop();
    setAdminRecording(false);
  }

  async function activateClient(_protocolId?: ProtocolId) {
    if (!selected) return;
    await updateUser(selected.email, { status: "active" });
    const updated = { ...selected, status: "active" as ClientStatus };
    setSelected(updated);
    await refreshClients();
  }

  async function assignProtocol(_protocolId?: ProtocolId) {
    if (!selected) return;
    await refreshClients();
  }

  async function setStatus(status: ClientStatus) {
    if (!selected) return;
    await updateUser(selected.email, { status });
    const updated = { ...selected, status };
    setSelected(updated);
    await refreshClients();
  }

  async function handleProtocolStatusChange(status: ProtocolStatus) {
    if (!selected) return;
    await setProtocolStatus(selected.email, status);
    const updatedDiag = { ...(selected.diagnosticData || {}), protocolStatus: status };
    const updated = { ...selected, diagnosticData: updatedDiag };
    setSelected(updated);
    await refreshClients();
  }

  async function handleAccountStatusChange(status: AccountStatus) {
    if (!selected) return;
    await setAccountStatus(selected.email, status);
    const updatedDiag = { ...(selected.diagnosticData || {}), accountStatus: status };
    const updated = { ...selected, diagnosticData: updatedDiag };
    setSelected(updated);
    await refreshClients();
  }

  async function handleClientTypeChange(clientType: 'skool' | '1on1') {
    if (!selected) return;
    await setClientType(selected.email, clientType);
    const updatedDiag = { ...(selected.diagnosticData || {}), clientType };
    const updated = { ...selected, diagnosticData: updatedDiag };
    setSelected(updated);
    await refreshClients();
  }

  async function handleRemoveClient() {
    if (!selected) return;
    if (!window.confirm(`Remove ${selected.name} permanently? This cannot be undone.`)) return;
    await removeClient(selected.email);
    setSelected(null);
    await refreshClients();
  }

  async function handleSuspendClient() {
    if (!selected) return;
    const isSuspended = selected.diagnosticData?.suspended;
    await setSuspended(selected.email, !isSuspended);
    const updatedDiag = { ...(selected.diagnosticData || {}), suspended: !isSuspended, suspendedAt: !isSuspended ? new Date().toISOString() : undefined };
    const updated = { ...selected, diagnosticData: updatedDiag };
    setSelected(updated);
    await refreshClients();
  }

  async function handleAddPayment(payment: Omit<Payment, 'id'>) {
    if (!selected) return;
    await addPayment(selected.email, payment);
    const newPayment: Payment = { ...payment, id: Date.now().toString() };
    const updatedPayments = [...(selected.diagnosticData?.payments ?? []), newPayment];
    const updatedDiag = { ...(selected.diagnosticData || {}), payments: updatedPayments };
    const updated = { ...selected, diagnosticData: updatedDiag };
    setSelected(updated);
    await refreshClients();
  }

  async function handleRemovePayment(paymentId: string) {
    if (!selected) return;
    await removePayment(selected.email, paymentId);
    const updatedPayments = (selected.diagnosticData?.payments ?? []).filter((p: Payment) => p.id !== paymentId);
    const updatedDiag = { ...(selected.diagnosticData || {}), payments: updatedPayments };
    const updated = { ...selected, diagnosticData: updatedDiag };
    setSelected(updated);
  }

  async function sendChatMessage() {
    if (!chatInput.trim() || chatLoading) return;
    const text = chatInput.trim();
    setChatInput("");
    const newMsgs: ChatMsg[] = [...chatMsgs, { role: "user", content: text }];
    setChatMsgs(newMsgs);
    setChatLoading(true);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    let clientContext = "";
    if (selected) {
      const d = selected.diagnosticData;
      clientContext = `Client: ${selected.name} (${selected.email})
Status: ${selected.status} | Streak: ${selected.streak} days
Joined: ${selected.joinedAt}${d ? `
Trying to fix: ${d.whatTryingToFix || "not specified"}
Energy: ${d.energyState || "not provided"} | Sleep: ${d.sleepQuality || "not provided"} (${d.sleepDuration || "?"})
Self-perception: ${d.selfPerception || "not provided"}
Baseline internal state: ${d.baselineInternalState || "not provided"}
On TRT: ${d.onTrt || "not provided"} | Libido: ${d.libido || "not provided"}
Training: ${d.trainingApproach || "not provided"} — ${d.trainingFrequency || "not provided"}
Height / weight / BF: ${d.heightWeightBf || "not provided"}` : " (no intake form submitted yet)"}`;
    } else if (clients.length) {
      clientContext = `Total clients: ${clients.length}
Active: ${clients.filter(c => c.status === "active").length} | Pending: ${clients.filter(c => c.status === "pending").length} | New (not yet submitted intake): ${clients.filter(c => c.status === "new").length}`;
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMsgs.map(m => ({ role: m.role, content: m.content })),
          clientContext,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const reply = data.content;
      setChatMsgs([...newMsgs, { role: "assistant", content: reply }]);
    } catch {
      setChatMsgs([...newMsgs, { role: "assistant", content: "Sorry, AI is not available right now. Make sure ANTHROPIC_API_KEY is set in Vercel." }]);
    }
    setChatLoading(false);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }

  const q = searchQuery.toLowerCase().trim();
  const searchFiltered = q
    ? clients.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.diagnosticData?.contactInfo ?? "").toLowerCase().includes(q)
      )
    : clients;
  const paying1on1 = searchFiltered.filter(c => (c.status === "active" || c.status === "alumni") && c.diagnosticData?.clientType !== "skool");
  const applicants = searchFiltered.filter(c => c.status === "new" || c.status === "pending");
  const skoolClients = searchFiltered.filter(c => c.diagnosticData?.clientType === "skool");

  if (!authed) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} style={{ width: "100%", maxWidth: "320px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/thprebrandlogo2.png" alt="THP" style={{ height: "48px", width: "auto", marginBottom: "2rem", filter: "brightness(0) invert(1)" }} />
          <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "1.875rem", fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: "0.375rem" }}>Command Center</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", fontWeight: 300, marginBottom: "2rem" }}>This area is private.</p>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <input type="email" value={adminEmail} onChange={e => { setAdminEmail(e.target.value); setPwError(""); }}
              placeholder="Email" autoFocus
              style={{ width: "100%", height: "44px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "7px", padding: "0 0.875rem", fontSize: "0.9375rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", fontWeight: 300, outline: "none", transition: "border-color 150ms" }}
              onFocus={e => (e.target.style.borderColor = "var(--primary)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")} />
            <input type="password" value={pw} onChange={e => { setPw(e.target.value); setPwError(""); }}
              placeholder="Password"
              style={{ width: "100%", height: "44px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "7px", padding: "0 0.875rem", fontSize: "0.9375rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", fontWeight: 300, outline: "none", transition: "border-color 150ms" }}
              onFocus={e => (e.target.style.borderColor = "var(--primary)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")} />
            <AnimatePresence>
              {pwError && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ fontSize: "0.8125rem", color: "var(--danger)" }}>{pwError}</motion.p>}
            </AnimatePresence>
            <button type="submit" style={{ height: "44px", background: "var(--primary)", color: "#ffffff", border: "none", borderRadius: "7px", fontSize: "0.9375rem", fontWeight: 500, fontFamily: "var(--font-ui), system-ui, sans-serif", cursor: "pointer", transition: "background 150ms" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--primary-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--primary)")}>
              Enter
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ height: "100dvh", background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <header style={{ height: "50px", borderBottom: "1px solid var(--border-subtle)", padding: "0 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "oklch(0.08 0 0 / 0.7)", backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/thprebrandlogo2.png" alt="THP" style={{ height: "28px", width: "auto", filter: "brightness(0) invert(1)" }} />
          <span style={{ width: "1px", height: "14px", background: "var(--border)" }} />
          <span style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 400 }}>Command Center</span>
          {loading && <span style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300 }}>Loading…</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={() => setChatOpen(v => !v)}
            style={{ height: "30px", padding: "0 0.875rem", borderRadius: "7px", border: "1px solid", borderColor: chatOpen ? "var(--primary)" : "var(--border)", background: chatOpen ? "oklch(0.60 0.18 165 / 0.12)" : "none", color: chatOpen ? "var(--primary)" : "var(--muted)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", display: "flex", alignItems: "center", gap: "0.4rem", transition: "all 150ms" }}>
            <SparkleIcon />
            AI
          </button>
          <button onClick={handleSignOut} style={{ background: "none", border: "none", color: "var(--dim)", fontSize: "0.8125rem", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "color 150ms" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--muted)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--dim)")}>
            Sign out
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Sidebar */}
        <aside style={{ width: "260px", borderRight: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
          {selected && (
            <div style={{ padding: "0.5rem 0.875rem", borderBottom: "1px solid var(--border-subtle)" }}>
              <button
                onClick={() => setSelected(null)}
                style={{ display: "flex", alignItems: "center", gap: "0.375rem", background: "none", border: "none", color: "var(--dim)", fontSize: "0.8125rem", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", padding: "0.25rem 0", transition: "color 150ms" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--muted)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--dim)")}>
                ← Home
              </button>
            </div>
          )}
          <div style={{ padding: "0.625rem 0.875rem", borderBottom: "1px solid var(--border-subtle)", display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search name, email, phone…"
              style={{ flex: 1, height: "30px", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "7px", padding: "0 0.625rem", fontSize: "0.8rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", outline: "none" }}
              onFocus={e => (e.target.style.borderColor = "var(--primary)")}
              onBlur={e => (e.target.style.borderColor = "var(--border-subtle)")}
            />
            <button onClick={() => { setShowCreate(true); setCreateName(""); setCreateEmail(""); setCreatePassword(""); setCreateError(""); }}
              title="Add client manually"
              style={{ width: "30px", height: "30px", borderRadius: "6px", border: "1px solid var(--border-subtle)", background: "none", color: "var(--dim)", fontSize: "1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "border-color 150ms, color 150ms" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.color = "var(--dim)"; }}>
              +
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem 0.5rem 1rem" }}>
            {searchFiltered.length === 0 && (
              <p style={{ fontSize: "0.8125rem", color: "var(--dim)", fontWeight: 300, padding: "1.5rem 1rem", textAlign: "center" }}>No clients found</p>
            )}

            {/* APPLICANTS */}
            {applicants.length > 0 && (
              <>
                <p style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--dim)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.75rem 0.625rem 0.375rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                  Applicants <span style={{ fontWeight: 300 }}>{applicants.length}</span>
                </p>
                {applicants.map(u => <ClientRow key={u.email} u={u} selected={selected} unreadCounts={unreadCounts} onSelect={selectClient} />)}
              </>
            )}

            {/* PAYING 1:1 CLIENTS */}
            {paying1on1.length > 0 && (
              <>
                <p style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--dim)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.75rem 0.625rem 0.375rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                  Paying 1:1 <span style={{ fontWeight: 300 }}>{paying1on1.length}</span>
                </p>
                {paying1on1.map(u => <ClientRow key={u.email} u={u} selected={selected} unreadCounts={unreadCounts} onSelect={selectClient} />)}
              </>
            )}

            {/* SKOOL CLIENTS */}
            {skoolClients.length > 0 && (
              <>
                <p style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--dim)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.75rem 0.625rem 0.375rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                  Skool <span style={{ fontWeight: 300 }}>{skoolClients.length}</span>
                </p>
                {skoolClients.map(u => <ClientRow key={u.email} u={u} selected={selected} unreadCounts={unreadCounts} onSelect={selectClient} />)}
              </>
            )}
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <AnimatePresence mode="wait">
            {!selected ? (
              <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flex: 1, overflowY: "auto", padding: "1.5rem 1.75rem" }}>
                <OverviewPanel clients={clients} onSelect={selectClient} />
              </motion.div>
            ) : (
              <motion.div key={selected.email} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                {/* Left: profile + diagnostic */}
                <div style={{ width: "300px", borderRight: "1px solid var(--border-subtle)", overflowY: "auto", padding: "1.5rem 1.25rem", flexShrink: 0 }}>
                  <ProfilePanel
                    client={selected}
                    diagnosticOpen={diagnosticOpen}
                    onToggleDiagnostic={() => setDiagnosticOpen(v => !v)}
                    onActivate={activateClient}
                    onSetStatus={setStatus}
                    onAssignProtocol={assignProtocol}
                    onProtocolGenerated={(notionPageId) => {
                      const updatedDiag = { ...(selected.diagnosticData || {}), notionPageId, protocolStatus: 'active' as ProtocolStatus };
                      const updated = { ...selected, notionPageId, diagnosticData: updatedDiag };
                      setSelected(updated);
                      refreshClients();
                    }}
                    onProtocolStatusChange={handleProtocolStatusChange}
                    onAccountStatusChange={handleAccountStatusChange}
                    onClientTypeChange={handleClientTypeChange}
                    onRemoveClient={handleRemoveClient}
                    onSuspendClient={handleSuspendClient}
                    onAddPayment={handleAddPayment}
                    onRemovePayment={handleRemovePayment}
                    whatsappNumber={WHATSAPP_NUMBER}
                  />
                </div>

                {/* Right: messages */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: brief || briefLoading ? "0.625rem" : 0 }}>
                      <div>
                        <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ink)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          Messages
                          {selectedClientActive && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", color: "var(--color-red)", fontWeight: 400 }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "oklch(0.7 0.15 145)", display: "inline-block" }} />
                              on dashboard now
                            </span>
                          )}
                        </p>
                        <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300 }}>{selected.name}</p>
                      </div>
                    </div>
                    {briefLoading && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "var(--surface)", borderRadius: "7px", border: "1px solid var(--border-subtle)" }}>
                        <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--primary)", animation: "pulse 1.2s ease infinite" }} />
                        <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300, fontStyle: "italic" }}>Generating brief...</p>
                      </div>
                    )}
                    {brief && !briefLoading && (
                      <div style={{ padding: "0.625rem 0.75rem", background: "var(--surface)", borderRadius: "7px", border: "1px solid var(--border-subtle)" }}>
                        <p style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 300, lineHeight: 1.65 }}>{brief}</p>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
                    {messages.length === 0 && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                        <p style={{ fontSize: "0.875rem", color: "var(--dim)", fontWeight: 300 }}>No messages yet</p>
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {messages.map((msg, i) => {
                        const isAdmin = msg.from === "admin";
                        const showDate = i === 0 || new Date(messages[i - 1].ts).toDateString() !== new Date(msg.ts).toDateString();
                        return (
                          <div key={msg.id}>
                            {showDate && (
                              <p style={{ textAlign: "center", fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, margin: "0.75rem 0 0.375rem" }}>
                                {new Date(msg.ts).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                              </p>
                            )}
                            <div style={{ display: "flex", justifyContent: isAdmin ? "flex-end" : "flex-start" }}>
                              <div style={{ maxWidth: "75%", padding: "0.625rem 0.875rem", borderRadius: isAdmin ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: isAdmin ? "oklch(0.60 0.18 165 / 0.12)" : "var(--surface)", border: isAdmin ? "1px solid oklch(0.60 0.18 165 / 0.35)" : "1px solid var(--border)" }}>
                                {msg.text && msg.attachmentType !== "audio" && <p style={{ fontSize: "0.875rem", color: "var(--ink)", fontWeight: 300, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.text}</p>}
                                {msg.attachmentUrl && msg.attachmentType && (
                                  msg.attachmentType === "audio"
                                    ? (
                                      <VoiceNotePlayer
                                        url={msg.attachmentUrl}
                                        isAdmin={isAdmin}
                                        transcript={msg.text || undefined}
                                      />
                                    )
                                    : msg.attachmentType === "image"
                                    ? <img src={msg.attachmentUrl} alt={msg.attachmentName || "Image"} style={{ maxWidth: "200px", borderRadius: "8px", marginTop: "0.25rem", cursor: "pointer", display: "block" }} onClick={() => window.open(msg.attachmentUrl, "_blank")} />
                                    : msg.attachmentType === "video"
                                    ? <video controls src={msg.attachmentUrl} style={{ maxWidth: "200px", borderRadius: "8px", marginTop: "0.25rem", display: "block" }} />
                                    : <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", color: "var(--primary)", textDecoration: "underline", marginTop: "0.25rem" }}>📎 {msg.attachmentName || "File"}</a>
                                )}
                                <p style={{ fontSize: "0.65rem", color: "var(--dim)", fontWeight: 300, marginTop: "0.25rem", textAlign: isAdmin ? "right" : "left" }}>
                                  {new Date(msg.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={msgEndRef} />
                    </div>
                  </div>

                  <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid var(--border-subtle)", flexShrink: 0 }}>
                    {adminSendError && (
                      <div style={{ padding: "0.375rem 0.75rem", background: "oklch(0.25 0.08 25 / 0.8)", border: "1px solid oklch(0.55 0.18 25 / 0.5)", borderRadius: "7px", marginBottom: "0.5rem", fontSize: "0.8rem", color: "oklch(0.85 0.12 25)" }}>
                        {adminSendError}
                        <button onClick={() => setAdminSendError(null)} style={{ marginLeft: "0.5rem", background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: "1rem", lineHeight: 1 }}>×</button>
                      </div>
                    )}
                    {(adminPendingFile || adminAudioBlob) && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.375rem 0.75rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "7px", marginBottom: "0.5rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                        {adminAudioBlob ? "Voice note ready" : adminPendingFile?.name}
                        <button onClick={() => { setAdminPendingFile(null); setAdminPendingType(null); setAdminAudioBlob(null); }} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--dim)", fontSize: "1rem", lineHeight: 1 }}>×</button>
                      </div>
                    )}
                    <input ref={adminFileInputRef} type="file" accept="image/*,video/*,application/pdf,.doc,.docx,.txt"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const type: AttachmentType = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file";
                        setAdminPendingFile(file);
                        setAdminPendingType(type);
                        e.target.value = "";
                      }} style={{ display: "none" }} aria-hidden />
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", background: "var(--surface)", borderRadius: "24px", border: "1px solid var(--border)", padding: "0.375rem 0.5rem" }}>
                      {/* AI draft */}
                      <button onClick={draftReply} disabled={drafting || messages.length === 0} title="Draft reply in THP's tone"
                        style={{ width: "34px", height: "34px", borderRadius: "50%", background: "none", border: "none", cursor: (drafting || messages.length === 0) ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 150ms", opacity: messages.length === 0 ? 0.4 : 1, color: "var(--dim)" }}
                        onMouseEnter={e => { if (messages.length > 0) { e.currentTarget.style.background = "oklch(0.60 0.18 165 / 0.08)"; e.currentTarget.style.color = "var(--primary)"; } }}
                        onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--dim)"; }}>
                        {drafting ? <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--primary)", animation: "pulse 1s ease infinite" }} /> : <SparkleIcon />}
                      </button>
                      {/* Attach */}
                      <button onClick={() => adminFileInputRef.current?.click()} title="Attach file, image, or video"
                        style={{ width: "34px", height: "34px", borderRadius: "50%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--dim)", transition: "background 150ms" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-2)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                      </button>
                      {/* Mic */}
                      <button onClick={adminRecording ? stopAdminRecording : startAdminRecording} title={adminRecording ? "Stop recording" : "Voice note"}
                        style={{ width: "34px", height: "34px", borderRadius: "50%", background: adminRecording ? "#ef4444" : "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: adminRecording ? "white" : "var(--dim)", transition: "all 150ms" }}>
                        {adminRecording
                          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                        }
                      </button>
                      <textarea
                        value={compose}
                        onChange={e => setCompose(e.target.value)}
                        onFocus={() => setComposeFocused(true)}
                        onBlur={() => setComposeFocused(false)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAdminMessage(); } }}
                        placeholder="Message or hit ✦ to draft with AI..."
                        rows={1}
                        style={{ flex: 1, background: "none", border: "none", borderRadius: "0", padding: "0.375rem 0.25rem", fontSize: "0.9rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", fontWeight: 300, outline: "none", resize: "none", lineHeight: 1.5, minHeight: "34px", maxHeight: "120px", overflow: "auto" }}
                      />
                      {(compose.trim() || adminPendingFile || adminAudioBlob) && (
                        <button onClick={sendAdminMessage}
                          style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--primary)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 150ms" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--primary-hover)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "var(--primary)")}>
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                            <path d="M8 13V3M3 8l5-5 5 5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, marginTop: "0.375rem" }}>Enter to send · Shift+Enter for new line</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Create client modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "fixed", inset: 0, zIndex: 400, background: "oklch(0.06 0 0 / 0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
              onClick={() => setShowCreate(false)}>
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "16px", padding: "1.75rem", width: "100%", maxWidth: "400px" }}
                onClick={e => e.stopPropagation()}>
                <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ink)", marginBottom: "0.25rem" }}>Add client</p>
                <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300, marginBottom: "1.25rem" }}>Creates an active account. They sign in at mentorship.thp.coach.</p>

                {[
                  { label: "Full name", value: createName, set: setCreateName, placeholder: "Tom Bradley", type: "text" },
                  { label: "Email", value: createEmail, set: setCreateEmail, placeholder: "tom@email.com", type: "email" },
                  { label: "Password", value: createPassword, set: setCreatePassword, placeholder: "Leave blank to auto-generate", type: "text" },
                ].map(({ label, value, set, placeholder, type }) => (
                  <div key={label} style={{ marginBottom: "0.875rem" }}>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.375rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>{label}</label>
                    <input type={type} value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                      style={{ width: "100%", height: "36px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "7px", padding: "0 0.75rem", fontSize: "0.875rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", outline: "none", boxSizing: "border-box" }} />
                  </div>
                ))}

                {/* Show generated password after creation */}
                {!creating && !createError && createPassword && createEmail && clients.find(c => c.email === createEmail.toLowerCase().trim()) && (
                  <div style={{ padding: "0.625rem 0.75rem", background: "oklch(0.45 0.15 145 / 0.08)", border: "1px solid oklch(0.45 0.15 145 / 0.2)", borderRadius: "7px", marginBottom: "0.875rem" }}>
                    <p style={{ fontSize: "0.75rem", color: "oklch(0.72 0.14 145)", fontWeight: 400 }}>Account created. Password: <strong style={{ fontFamily: "monospace" }}>{createPassword}</strong></p>
                    <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, marginTop: "0.2rem" }}>Send this to them so they can log in.</p>
                  </div>
                )}

                {createError && (
                  <p style={{ fontSize: "0.75rem", color: "oklch(0.68 0.18 25)", marginBottom: "0.75rem" }}>{createError}</p>
                )}

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={handleCreateClient} disabled={creating || !createName.trim() || !createEmail.trim()}
                    style={{ flex: 1, height: "38px", background: (creating || !createName.trim() || !createEmail.trim()) ? "var(--surface-2)" : "var(--primary)", border: "none", borderRadius: "8px", color: (creating || !createName.trim() || !createEmail.trim()) ? "var(--dim)" : "#ffffff", fontSize: "0.875rem", fontWeight: 500, cursor: (creating || !createName.trim() || !createEmail.trim()) ? "default" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                    {creating ? "Creating..." : "Create account"}
                  </button>
                  <button onClick={() => setShowCreate(false)}
                    style={{ height: "38px", padding: "0 1rem", background: "none", border: "1px solid var(--border-subtle)", borderRadius: "8px", color: "var(--dim)", fontSize: "0.875rem", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Chat Panel */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{ borderLeft: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
              <div style={{ padding: "0.875rem 1rem", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <SparkleIcon />
                  <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--ink)" }}>AI Assistant</span>
                </div>
                {selected && (
                  <span style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300 }}>{selected.name.split(" ")[0]}'s context</span>
                )}
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {chatMsgs.length === 0 && (
                  <div style={{ padding: "1rem 0" }}>
                    <p style={{ fontSize: "0.8125rem", color: "var(--dim)", fontWeight: 300, lineHeight: 1.6, marginBottom: "0.75rem" }}>
                      {selected
                        ? `Ask me anything about ${selected.name.split(" ")[0]}, or have me draft a message for them.`
                        : "Ask me anything about your clients or coaching practice."}
                    </p>
                    {[
                      selected ? `Summarise ${selected.name.split(" ")[0]}'s progress` : "Who needs the most attention right now?",
                      selected ? `Draft a check-in message for ${selected.name.split(" ")[0]}` : "What should I focus on this week?",
                    ].map(prompt => (
                      <button key={prompt} onClick={() => { setChatInput(prompt); }}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem 0.625rem", marginBottom: "0.375rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "8px", color: "var(--muted)", fontSize: "0.8rem", fontWeight: 300, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "border-color 150ms" }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border)")}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-subtle)")}>
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
                {chatMsgs.map((msg, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "88%", padding: "0.5rem 0.75rem", borderRadius: msg.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px", background: msg.role === "user" ? "var(--primary)" : "var(--surface)", border: msg.role === "user" ? "none" : "1px solid var(--border-subtle)" }}>
                      {msg.role === "assistant" && (
                        <p style={{ fontSize: "0.65rem", color: "var(--primary)", fontWeight: 500, marginBottom: "0.2rem" }}>AI</p>
                      )}
                      <p style={{ fontSize: "0.8125rem", color: msg.role === "user" ? "#ffffff" : "var(--ink)", fontWeight: 300, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.content}</p>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div style={{ padding: "0.5rem 0.75rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "12px 12px 12px 3px" }}>
                      <p style={{ fontSize: "0.65rem", color: "var(--primary)", fontWeight: 500, marginBottom: "0.2rem" }}>AI</p>
                      <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                        {[0, 1, 2].map(i => (
                          <span key={i} style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--dim)", animation: `dot 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                        ))}
                        <style>{`@keyframes dot{0%,80%,100%{opacity:.2}40%{opacity:1}}`}</style>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--border-subtle)", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
                  <textarea
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                    placeholder="Ask anything…"
                    rows={1}
                    style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "9px", padding: "0.5rem 0.75rem", fontSize: "0.8125rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", fontWeight: 300, outline: "none", resize: "none", lineHeight: 1.5, transition: "border-color 150ms", minHeight: "34px", maxHeight: "100px", overflow: "auto" }}
                    onFocus={e => (e.target.style.borderColor = "var(--primary)")}
                    onBlur={e => (e.target.style.borderColor = "var(--border)")}
                  />
                  <button onClick={sendChatMessage} disabled={!chatInput.trim() || chatLoading}
                    style={{ width: "34px", height: "34px", borderRadius: "9px", background: chatInput.trim() && !chatLoading ? "var(--primary)" : "var(--surface-2)", border: "none", cursor: chatInput.trim() && !chatLoading ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 150ms" }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M8 13V3M3 8l5-5 5 5" stroke={chatInput.trim() && !chatLoading ? "#ffffff" : "var(--dim)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ProfilePanel({ client, diagnosticOpen, onToggleDiagnostic, onActivate, onSetStatus, onAssignProtocol, onProtocolGenerated, onProtocolStatusChange, onAccountStatusChange, onClientTypeChange, onRemoveClient, onSuspendClient, onAddPayment, onRemovePayment, whatsappNumber }: {
  client: StoredUser;
  diagnosticOpen: boolean;
  onToggleDiagnostic: () => void;
  onActivate: (p: ProtocolId) => void;
  onSetStatus: (s: ClientStatus) => void;
  onAssignProtocol: (p: ProtocolId) => void;
  onProtocolGenerated: (notionPageId: string) => void;
  onProtocolStatusChange: (status: ProtocolStatus) => void;
  onAccountStatusChange: (status: AccountStatus) => void;
  onClientTypeChange: (t: 'skool' | '1on1') => void;
  onRemoveClient: () => void;
  onSuspendClient: () => void;
  onAddPayment: (p: Omit<Payment, 'id'>) => void;
  onRemovePayment: (id: string) => void;
  whatsappNumber: string;
}) {
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentType, setPaymentType] = useState<Payment['type']>('monthly');
  const [paymentNote, setPaymentNote] = useState("");
  const [addingPayment, setAddingPayment] = useState(false);
  const [clientProtocols, setClientProtocols] = useState<ClientProtocol[]>([]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentLinkLoading, setPaymentLinkLoading] = useState(false);
  const [paymentLinkCopied, setPaymentLinkCopied] = useState(false);
  const [paymentLinkError, setPaymentLinkError] = useState("");
  const [trackerSummary, setTrackerSummary] = useState<{
    trends: { category: string; avgScore: number; direction: string; delta: number }[];
    flagged: { date: string; questionLabel: string; value: string | number | boolean; category: string }[];
    totalDaysTracked: number;
    currentStage: number;
  } | null>(null);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [regeneratingQuestions, setRegeneratingQuestions] = useState(false);
  const [adminDiagnostics, setAdminDiagnostics] = useState<ClientDiagnostic[]>([]);
  const [publishingDiagId, setPublishingDiagId] = useState<string | null>(null);

  useEffect(() => {
    getClientProtocols(client.email).then(setClientProtocols).catch(() => {});
    getAdminDiagnostics(client.email).then(setAdminDiagnostics).catch(() => {});
    setTrackerSummary(null);
    setInviteUrl(null);
    setInviteCopied(false);
    setPaymentUrl(null);
    setPaymentLinkCopied(false);
    setPaymentLinkError("");
  }, [client.email]);

  async function handlePublishDiagnosis(diagId: string) {
    setPublishingDiagId(diagId);
    await publishDiagnosis(diagId);
    setAdminDiagnostics(prev => prev.map(d => d.id === diagId ? { ...d, published: true } : d));
    setPublishingDiagId(null);
  }

  async function handleGenerateInvite() {
    setInviteLoading(true);
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PASSWORD },
        body: JSON.stringify({ email: client.email }),
      });
      const data = await res.json();
      if (data.url) setInviteUrl(data.url);
    } catch { /* ignore */ }
    setInviteLoading(false);
  }

  function copyInviteUrl() {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    });
  }

  async function handleGeneratePaymentLink() {
    setPaymentLinkLoading(true);
    setPaymentLinkError("");
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: client.email, adminPw: ADMIN_PASSWORD }),
      });
      const data = await res.json();
      if (data.url) {
        setPaymentUrl(data.url);
      } else {
        setPaymentLinkError(data.error ?? "Failed to create payment link");
      }
    } catch {
      setPaymentLinkError("Network error. Please try again.");
    }
    setPaymentLinkLoading(false);
  }

  function copyPaymentUrl() {
    if (!paymentUrl) return;
    navigator.clipboard.writeText(paymentUrl).then(() => {
      setPaymentLinkCopied(true);
      setTimeout(() => setPaymentLinkCopied(false), 2000);
    });
  }

  async function loadTrackerSummary() {
    setTrackerLoading(true);
    try {
      const res = await fetch(`/api/tracker-summary?userEmail=${encodeURIComponent(client.email)}&days=28`, { headers: { 'x-api-key': process.env.NEXT_PUBLIC_INTERNAL_API_KEY ?? '' } });
      const data = await res.json();
      if (!data.error) setTrackerSummary(data);
    } catch { /* ignore */ }
    setTrackerLoading(false);
  }

  async function handleRegenerateQuestions() {
    if (clientProtocols.length === 0) return;
    setRegeneratingQuestions(true);
    const currentStage = clientProtocols[clientProtocols.length - 1].stage;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bankRow } = await supabase
      .from('tracker_questions')
      .select('protocol_text')
      .eq('user_email', client.email)
      .eq('stage', currentStage)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((bankRow as any)?.protocol_text) {
      await fetch('/api/generate-tracker-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.NEXT_PUBLIC_INTERNAL_API_KEY ?? '' },
        body: JSON.stringify({
          clientEmail: client.email,
          stage: currentStage,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          protocolText: (bankRow as any).protocol_text,
          diagnosticData: client.diagnosticData ?? {},
        }),
      }).catch(() => {});
    }
    setRegeneratingQuestions(false);
  }

  async function handleGenerateProtocol() {
    setGenerating(true);
    setGenError("");
    try {
      const res = await fetch("/api/generate-protocol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: client.email,
          clientName: client.name,
          diagnosticData: client.diagnosticData ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Generation failed");
      onProtocolGenerated(data.notionPageId);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Unknown error");
    }
    setGenerating(false);
  }

  async function handleLinkNotion() {
    const raw = linkUrl.trim();
    if (!raw) return;
    // Accept full Notion URL or bare UUID
    const match = raw.match(/([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12})/i)
      || raw.match(/([0-9a-f]{32})/i);
    if (!match) { setLinkError("Paste a Notion page URL or ID"); return; }
    const rawId = match[1].replace(/-/g, "");
    const pageId = `${rawId.slice(0,8)}-${rawId.slice(8,12)}-${rawId.slice(12,16)}-${rawId.slice(16,20)}-${rawId.slice(20)}`;
    setLinking(true);
    setLinkError("");
    try {
      await linkNotionPage(client.email, pageId);
      onProtocolGenerated(pageId);
      setLinkUrl("");
    } catch {
      setLinkError("Failed to link page");
    }
    setLinking(false);
  }

  const initials = client.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const joinedDate = new Date(client.joinedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.875rem", fontWeight: 600, color: statusColor(client.status), fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
          {initials}
        </div>
        <div>
          <p style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--ink)" }}>{client.name}</p>
          <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300 }}>{client.email}</p>
        </div>
      </div>

      {(client.status === "new" || client.status === "pending") && (
        <PromoteButton client={client} onSetStatus={onSetStatus} onClientTypeChange={onClientTypeChange} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
        {[
          { label: "Status", value: <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: statusColor(client.status) }} />{client.status}</span> },
          { label: "Joined", value: joinedDate },
          { label: "Streak", value: client.streak > 0 ? `${client.streak} days ${client.streak >= 7 ? "🔥" : "⚡"}` : "0 days" },
          { label: "Protocol", value: client.diagnosticData?.protocolStatus || "None" },
        ].map(s => (
          <div key={s.label} style={{ padding: "0.625rem 0.75rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "8px" }}>
            <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
            <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--ink)" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Client type */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
        <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.125rem" }}>Client Type</p>
        <div style={{ display: "flex", gap: "0.375rem" }}>
          {(['skool', '1on1'] as const).map(t => {
            const active = client.diagnosticData?.clientType === t;
            return (
              <button key={t} onClick={() => onClientTypeChange(t)}
                style={{ flex: 1, height: "32px", borderRadius: "6px", border: "1px solid", borderColor: active ? (t === 'skool' ? "oklch(0.72 0.15 260 / 0.5)" : "oklch(0.72 0.14 145 / 0.5)") : "var(--border)", background: active ? (t === 'skool' ? "oklch(0.72 0.15 260 / 0.1)" : "oklch(0.72 0.14 145 / 0.1)") : "none", color: active ? (t === 'skool' ? "oklch(0.72 0.15 260)" : "oklch(0.72 0.14 145)") : "var(--dim)", fontSize: "0.75rem", fontWeight: active ? 600 : 400, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "all 150ms" }}>
                {t === 'skool' ? 'Skool' : '1:1 Coaching'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Diagnosis — THP review & send */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
        <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>Diagnosis</p>
        {adminDiagnostics.length === 0 ? (
          <p style={{ fontSize: "0.8rem", color: "var(--dim)", fontWeight: 300 }}>No diagnosis generated yet.</p>
        ) : (
          adminDiagnostics.map(diag => (
            <div key={diag.id} style={{ background: "var(--surface)", border: `1px solid ${diag.published ? "oklch(0.7 0.15 145 / 0.3)" : "oklch(0.75 0.15 80 / 0.3)"}`, borderRadius: "8px", padding: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                <p style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--ink)" }}>Stage {diag.stage}</p>
                <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "2px 7px", borderRadius: "4px", background: diag.published ? "oklch(0.7 0.15 145 / 0.12)" : "oklch(0.75 0.15 80 / 0.12)", color: diag.published ? "oklch(0.7 0.15 145)" : "oklch(0.75 0.15 80)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {diag.published ? "Sent" : "Draft"}
                </span>
              </div>
              {diag.content?.sections.map(s => (
                <details key={s.heading} style={{ marginBottom: "0.25rem" }}>
                  <summary style={{ fontSize: "0.75rem", color: "var(--muted)", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", userSelect: "none" }}>{s.heading}</summary>
                  <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300, lineHeight: 1.6, marginTop: "0.375rem", whiteSpace: "pre-wrap" }}>{s.text}</p>
                </details>
              ))}
              {!diag.published && (
                <button
                  onClick={() => handlePublishDiagnosis(diag.id)}
                  disabled={publishingDiagId === diag.id}
                  style={{ marginTop: "0.625rem", width: "100%", height: "36px", background: publishingDiagId === diag.id ? "var(--surface-2)" : "var(--primary)", border: "none", borderRadius: "7px", color: publishingDiagId === diag.id ? "var(--dim)" : "#fff", fontSize: "0.8125rem", fontWeight: 600, cursor: publishingDiagId === diag.id ? "default" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "background 150ms" }}>
                  {publishingDiagId === diag.id ? "Sending…" : "Send diagnosis to client →"}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Invite link */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
        <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.125rem" }}>Portal Access</p>
        {!inviteUrl ? (
          <button
            onClick={handleGenerateInvite}
            disabled={inviteLoading}
            style={{ height: "36px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "7px", color: inviteLoading ? "var(--dim)" : "var(--muted)", fontSize: "0.8125rem", fontWeight: 500, cursor: inviteLoading ? "default" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
            {inviteLoading ? "Generating…" : "Generate invite link"}
          </button>
        ) : (
          <div style={{ display: "flex", gap: "0.375rem" }}>
            <input
              readOnly
              value={inviteUrl}
              style={{ flex: 1, height: "34px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "7px", padding: "0 0.625rem", fontSize: "0.75rem", color: "var(--dim)", fontFamily: "var(--font-mono), monospace", outline: "none" }}
            />
            <button
              onClick={copyInviteUrl}
              style={{ height: "34px", padding: "0 0.75rem", background: inviteCopied ? "oklch(0.60 0.18 165 / 0.12)" : "var(--surface)", border: "1px solid var(--border)", borderRadius: "7px", color: inviteCopied ? "var(--primary)" : "var(--muted)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", whiteSpace: "nowrap", flexShrink: 0 }}>
              {inviteCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
      </div>

      {/* Payment link */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
        <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.125rem" }}>Payment Link</p>
        {!paymentUrl ? (
          <>
            <button
              onClick={handleGeneratePaymentLink}
              disabled={paymentLinkLoading}
              style={{ height: "36px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "7px", color: paymentLinkLoading ? "var(--dim)" : "var(--muted)", fontSize: "0.8125rem", fontWeight: 500, cursor: paymentLinkLoading ? "default" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
              {paymentLinkLoading ? "Generating…" : "Generate Stripe payment link"}
            </button>
            {paymentLinkError && (
              <p style={{ fontSize: "0.75rem", color: "var(--danger)", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>{paymentLinkError}</p>
            )}
          </>
        ) : (
          <div style={{ display: "flex", gap: "0.375rem" }}>
            <input
              readOnly
              value={paymentUrl}
              style={{ flex: 1, height: "34px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "7px", padding: "0 0.625rem", fontSize: "0.75rem", color: "var(--dim)", fontFamily: "var(--font-mono), monospace", outline: "none" }}
            />
            <button
              onClick={copyPaymentUrl}
              style={{ height: "34px", padding: "0 0.75rem", background: paymentLinkCopied ? "oklch(0.60 0.18 165 / 0.12)" : "var(--surface)", border: "1px solid var(--border)", borderRadius: "7px", color: paymentLinkCopied ? "var(--primary)" : "var(--muted)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", whiteSpace: "nowrap", flexShrink: 0 }}>
              {paymentLinkCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
        <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.125rem" }}>Protocol</p>

        {/* No Notion protocol yet - generate or link */}
        {!client.notionPageId && (
          <>
            <button
              onClick={handleGenerateProtocol}
              disabled={generating}
              style={{ height: "36px", background: generating ? "var(--surface-2)" : "oklch(0.60 0.18 165 / 0.12)", border: "1px solid oklch(0.60 0.18 165 / 0.3)", borderRadius: "7px", color: generating ? "var(--dim)" : "var(--primary)", fontSize: "0.8125rem", fontWeight: 500, cursor: generating ? "default" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "background 150ms", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem" }}
              onMouseEnter={e => { if (!generating) e.currentTarget.style.background = "oklch(0.60 0.18 165 / 0.2)"; }}
              onMouseLeave={e => { if (!generating) e.currentTarget.style.background = "oklch(0.60 0.18 165 / 0.12)"; }}>
              <SparkleIcon />
              {generating ? "Generating…" : clientProtocols.length === 0 ? "Generate stage 1 with AI" : `Regenerate stage ${clientProtocols[clientProtocols.length - 1].stage} with AI`}
            </button>
          </>
        )}

        {/* Has Notion protocol - show status + controls */}
        {client.notionPageId && (() => {
          const ps = client.diagnosticData?.protocolStatus ?? 'active';
          const statusMeta: Record<string, { label: string; color: string; bg: string }> = {
            active:   { label: "Live",     color: "oklch(0.72 0.14 145)", bg: "oklch(0.45 0.15 145 / 0.1)" },
            updating: { label: "Updating", color: "oklch(0.84 0.12 65)", bg: "oklch(0.65 0.14 65 / 0.1)" },
            building: { label: "Building", color: "var(--primary)",       bg: "oklch(0.60 0.18 165 / 0.1)" },
          };
          const sm = statusMeta[ps] ?? statusMeta['active'];
          return (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.625rem 0.875rem", background: sm.bg, border: `1px solid ${sm.color}40`, borderRadius: "8px" }}>
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: sm.color, animation: ps !== 'active' ? "pulse 2s ease infinite" : "none", flexShrink: 0 }} aria-hidden />
                <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: sm.color, flex: 1 }}>Protocol {sm.label}</p>
              </div>
              {/* Protocol status controls */}
              <div style={{ display: "flex", gap: "0.375rem" }}>
                {ps !== 'active' && (
                  <button onClick={() => onProtocolStatusChange('active')}
                    style={{ flex: 1, height: "32px", background: "oklch(0.45 0.15 145 / 0.1)", border: "1px solid oklch(0.45 0.15 145 / 0.2)", borderRadius: "6px", color: "oklch(0.72 0.14 145)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                    Mark as live
                  </button>
                )}
                {ps !== 'updating' && (
                  <button onClick={() => onProtocolStatusChange('updating')}
                    style={{ flex: 1, height: "32px", background: "oklch(0.65 0.14 65 / 0.08)", border: "1px solid oklch(0.65 0.14 65 / 0.2)", borderRadius: "6px", color: "oklch(0.84 0.12 65)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                    Mark as updating
                  </button>
                )}
                {ps !== 'building' && (
                  <button onClick={() => onProtocolStatusChange('building')}
                    style={{ flex: 1, height: "32px", background: "oklch(0.60 0.18 165 / 0.08)", border: "1px solid oklch(0.60 0.18 165 / 0.2)", borderRadius: "6px", color: "var(--primary)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                    Mark as building
                  </button>
                )}
              </div>
              {/* Allow regenerating protocol even if one exists */}
              <button
                onClick={handleGenerateProtocol}
                disabled={generating}
                style={{ height: "32px", background: generating ? "var(--surface-2)" : "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px", color: generating ? "var(--dim)" : "var(--muted)", fontSize: "0.75rem", fontWeight: 500, cursor: generating ? "default" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem" }}>
                <SparkleIcon />
                {generating ? "Generating…" : "Regenerate with AI"}
              </button>
            </>
          );
        })()}

        {genError && <p style={{ fontSize: "0.75rem", color: "var(--danger)", fontWeight: 300 }}>{genError}</p>}
        {linkError && <p style={{ fontSize: "0.75rem", color: "var(--danger)", fontWeight: 300 }}>{linkError}</p>}

        {client.status === "pending" && (
          <button
            onClick={() => onSetStatus("active")}
            style={{ height: "36px", background: "oklch(0.60 0.18 165 / 0.12)", border: "1px solid oklch(0.60 0.18 165 / 0.3)", borderRadius: "7px", color: "var(--primary)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "background 150ms" }}
            onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.60 0.18 165 / 0.2)")}
            onMouseLeave={e => (e.currentTarget.style.background = "oklch(0.60 0.18 165 / 0.12)")}>
            Activate dashboard
          </button>
        )}

        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
          {(["pending", "active", "alumni"] as ClientStatus[]).filter(s => s !== client.status).map(s => (
            <button key={s} onClick={() => onSetStatus(s)}
              style={{ height: "28px", padding: "0 0.75rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "6px", color: "var(--dim)", fontSize: "0.75rem", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "border-color 150ms, color 150ms" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.color = "var(--dim)"; }}>
              Set {s}
            </button>
          ))}
        </div>

        <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", height: "34px", padding: "0 0.875rem", background: "oklch(0.45 0.15 145 / 0.1)", border: "1px solid oklch(0.45 0.15 145 / 0.2)", borderRadius: "7px", color: "oklch(0.72 0.14 145)", textDecoration: "none", fontSize: "0.8125rem", fontWeight: 500, transition: "background 150ms", alignSelf: "flex-start" }}
          onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.45 0.15 145 / 0.18)")}
          onMouseLeave={e => (e.currentTarget.style.background = "oklch(0.45 0.15 145 / 0.1)")}>
          <WhatsAppIcon /> WhatsApp
        </a>
      </div>

      {/* Account controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
        <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.125rem" }}>Account</p>
        {(() => {
          const as = client.diagnosticData?.accountStatus ?? 'active';
          const asMeta: Record<string, { label: string; color: string }> = {
            active:  { label: "Active",   color: "oklch(0.7 0.15 145)" },
            hold:    { label: "On hold",  color: "oklch(0.82 0.10 62)" },
            limited: { label: "Limited",  color: "oklch(0.65 0.14 300)" },
          };
          const meta = asMeta[as] ?? asMeta['active'];
          return (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "7px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
                <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: meta.color }}>{meta.label}</span>
              </div>
              <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                {as !== 'active' && (
                  <button onClick={() => onAccountStatusChange('active')}
                    style={{ height: "28px", padding: "0 0.75rem", background: "oklch(0.45 0.15 145 / 0.08)", border: "1px solid oklch(0.45 0.15 145 / 0.2)", borderRadius: "6px", color: "oklch(0.7 0.15 145)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                    Activate
                  </button>
                )}
                {as !== 'hold' && (
                  <button onClick={() => onAccountStatusChange('hold')}
                    style={{ height: "28px", padding: "0 0.75rem", background: "oklch(0.65 0.14 65 / 0.08)", border: "1px solid oklch(0.65 0.14 65 / 0.2)", borderRadius: "6px", color: "oklch(0.82 0.10 62)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                    Put on hold
                  </button>
                )}
                {as !== 'limited' && (
                  <button onClick={() => onAccountStatusChange('limited')}
                    style={{ height: "28px", padding: "0 0.75rem", background: "oklch(0.65 0.14 300 / 0.08)", border: "1px solid oklch(0.65 0.14 300 / 0.2)", borderRadius: "6px", color: "oklch(0.65 0.14 300)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                    Limit access
                  </button>
                )}
                <button onClick={onSuspendClient}
                  style={{ height: "28px", padding: "0 0.75rem", background: client.diagnosticData?.suspended ? "oklch(0.60 0.18 165 / 0.08)" : "oklch(0.55 0.18 25 / 0.06)", border: `1px solid ${client.diagnosticData?.suspended ? "oklch(0.60 0.18 165 / 0.3)" : "oklch(0.65 0.15 50 / 0.3)"}`, borderRadius: "6px", color: client.diagnosticData?.suspended ? "var(--primary)" : "oklch(0.72 0.14 50)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                  {client.diagnosticData?.suspended ? "Unsuspend" : "Suspend"}
                </button>
                <button onClick={onRemoveClient}
                  style={{ height: "28px", padding: "0 0.75rem", background: "oklch(0.55 0.18 25 / 0.08)", border: "1px solid oklch(0.55 0.18 25 / 0.25)", borderRadius: "6px", color: "oklch(0.68 0.18 25)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                  Remove client
                </button>
              </div>
            </>
          );
        })()}
      </div>

      {/* Payments */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
        <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.125rem" }}>Payments</p>
        {(client.diagnosticData?.payments ?? []).length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginBottom: "0.25rem" }}>
            {(client.diagnosticData?.payments ?? []).map((p: Payment) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.75rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "7px" }}>
                <div>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--ink)" }}>
                    {p.currency}{p.amount}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300, marginLeft: "0.5rem" }}>
                    {p.type} · {new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  {p.note && <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, marginTop: "0.15rem" }}>{p.note}</p>}
                </div>
                <button onClick={() => onRemovePayment(p.id)}
                  style={{ background: "none", border: "none", color: "var(--dim)", cursor: "pointer", fontSize: "0.75rem", padding: "0 0.25rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}
                  title="Remove">
                  ×
                </button>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "0.25rem 0" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 500 }}>
                Total: {(() => {
                  const ps = client.diagnosticData?.payments ?? [];
                  if (!ps.length) return '';
                  const currency = ps[0].currency;
                  const total = ps.reduce((s: number, p: Payment) => s + p.amount, 0);
                  return `${currency}${total}`;
                })()}
              </span>
            </div>
          </div>
        )}
        {!addingPayment ? (
          <button onClick={() => setAddingPayment(true)}
            style={{ height: "32px", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "6px", color: "var(--dim)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "border-color 150ms, color 150ms" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.color = "var(--dim)"; }}>
            + Log payment
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", padding: "0.75rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px" }}>
            <div style={{ display: "flex", gap: "0.375rem" }}>
              <input
                type="number" min="0" placeholder="Amount"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                style={{ flex: 1, height: "32px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "6px", padding: "0 0.625rem", fontSize: "0.8125rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", outline: "none" }}
              />
              <select
                value={paymentType}
                onChange={e => setPaymentType(e.target.value as Payment['type'])}
                style={{ height: "32px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "6px", padding: "0 0.5rem", fontSize: "0.8125rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", outline: "none" }}>
                <option value="deposit">Deposit</option>
                <option value="full">Full</option>
                <option value="monthly">Monthly</option>
                <option value="other">Other</option>
              </select>
            </div>
            <input
              type="text" placeholder="Note (optional)"
              value={paymentNote}
              onChange={e => setPaymentNote(e.target.value)}
              style={{ height: "32px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "6px", padding: "0 0.625rem", fontSize: "0.8125rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", outline: "none" }}
            />
            <div style={{ display: "flex", gap: "0.375rem" }}>
              <button
                onClick={() => {
                  const amt = parseFloat(paymentAmount);
                  if (!amt || isNaN(amt)) return;
                  onAddPayment({ date: new Date().toISOString().split('T')[0], amount: amt, currency: '£', type: paymentType, note: paymentNote || undefined });
                  setPaymentAmount(""); setPaymentNote(""); setAddingPayment(false);
                }}
                disabled={!paymentAmount}
                style={{ flex: 1, height: "30px", background: paymentAmount ? "var(--primary)" : "var(--surface-2)", border: "none", borderRadius: "6px", color: paymentAmount ? "#ffffff" : "var(--dim)", fontSize: "0.75rem", fontWeight: 500, cursor: paymentAmount ? "pointer" : "default", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                Save
              </button>
              <button onClick={() => { setAddingPayment(false); setPaymentAmount(""); setPaymentNote(""); }}
                style={{ height: "30px", padding: "0 0.625rem", background: "none", border: "1px solid var(--border-subtle)", borderRadius: "6px", color: "var(--dim)", fontSize: "0.75rem", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {clientProtocols.length > 0 && (
        <TrackerSection
          protocols={clientProtocols}
          summary={trackerSummary}
          loading={trackerLoading}
          regenerating={regeneratingQuestions}
          onLoadSummary={loadTrackerSummary}
          onRegenerateQuestions={handleRegenerateQuestions}
          onGenerateNextStage={async () => {
            await loadTrackerSummary();
            setGenerating(true);
            setGenError("");
            try {
              const res = await fetch("/api/generate-protocol", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  clientEmail: client.email,
                  clientName: client.name,
                  diagnosticData: client.diagnosticData ?? null,
                  trackerSummary,
                }),
              });
              const data = await res.json();
              if (!res.ok || data.error) throw new Error(data.error || "Generation failed");
              onProtocolGenerated(data.notionPageId);
              getClientProtocols(client.email).then(setClientProtocols).catch(() => {});
            } catch (err) {
              setGenError(err instanceof Error ? err.message : "Unknown error");
            }
            setGenerating(false);
          }}
        />
      )}

      {client.diagnosticData && (
        <div style={{ paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
          <button onClick={onToggleDiagnostic}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", padding: "0.125rem 0 0.5rem", cursor: "pointer" }}>
            <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>Diagnostic</p>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: diagnosticOpen ? "rotate(180deg)" : "none", transition: "transform 200ms", color: "var(--dim)" }} aria-hidden>
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <AnimatePresence initial={false}>
            {diagnosticOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} style={{ overflow: "hidden" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingTop: "0.5rem" }}>
                  {[
                    { label: "Full Name", value: client.diagnosticData.fullName },
                    { label: "Age / Location", value: client.diagnosticData.ageLocation },
                    { label: "Contact Info", value: client.diagnosticData.contactInfo },
                    { label: "Travel Pattern", value: client.diagnosticData.travelPattern },
                    { label: "What They're Trying To Fix", value: client.diagnosticData.whatTryingToFix },
                    { label: "How They Ask For What They Want", value: client.diagnosticData.howAskForWhatYouWant },
                    { label: "Avoiding Disappointing Others", value: client.diagnosticData.avoidDisappointing },
                    { label: "Validation Source", value: client.diagnosticData.validationSource },
                    { label: "Energy State", value: client.diagnosticData.energyState },
                    { label: "Self-Perception", value: client.diagnosticData.selfPerception },
                    { label: "Avoids Conflict", value: client.diagnosticData.avoidConflict },
                    { label: "Response To Criticism", value: client.diagnosticData.responseToCriticism },
                    { label: "Internal State Entering Room", value: client.diagnosticData.internalStateEnteringRoom },
                    { label: "Past Relationship Patterns", value: client.diagnosticData.pastRelationshipPatterns },
                    { label: "Training Recovery", value: client.diagnosticData.trainingRecovery },
                    { label: "Height / Weight / BF%", value: client.diagnosticData.heightWeightBf },
                    { label: "Sleep Duration", value: client.diagnosticData.sleepDuration },
                    { label: "Relationship Status", value: client.diagnosticData.relationshipStatus },
                    { label: "Relationship To Risk", value: client.diagnosticData.relationshipToRisk },
                    { label: "Sexual Confidence", value: client.diagnosticData.sexualConfidence },
                    { label: "Alcohol Use", value: client.diagnosticData.alcoholUse },
                    { label: "Current Medications", value: client.diagnosticData.currentMedications },
                    { label: "Relationship To Food", value: client.diagnosticData.relationshipToFood },
                    { label: "Baseline Internal State", value: client.diagnosticData.baselineInternalState },
                    { label: "On TRT / Peptides", value: client.diagnosticData.onTrt },
                    { label: "What Stays Solid Traveling", value: client.diagnosticData.whatStaysSolidTraveling },
                    { label: "Caffeine Intake", value: client.diagnosticData.caffeineIntake },
                    { label: "Nicotine / Other Substances", value: client.diagnosticData.nicotineSubstances },
                    { label: "Sleep Quality", value: client.diagnosticData.sleepQuality },
                    { label: "Training Frequency", value: client.diagnosticData.trainingFrequency },
                    { label: "Morning Erections", value: client.diagnosticData.morningErections },
                    { label: "Eye Contact", value: client.diagnosticData.eyeContact },
                    { label: "Sexual Dynamic", value: client.diagnosticData.sexualDynamic },
                    { label: "Physique Feeling", value: client.diagnosticData.physiqueFeeling },
                    { label: "Training Approach", value: client.diagnosticData.trainingApproach },
                    { label: "How They Decompress", value: client.diagnosticData.howDecompress },
                    { label: "Libido", value: client.diagnosticData.libido },
                    { label: "Travel Frequency", value: client.diagnosticData.travelFrequency },
                    { label: "Wake Up Recovered", value: client.diagnosticData.wakeUpRecovered },
                    { label: "Recent Hormone Panel", value: client.diagnosticData.recentHormonePanel },
                  ].filter(f => f.value).map(f => (
                    <div key={f.label} style={{ padding: "0.625rem 0.75rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "8px" }}>
                      <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, marginBottom: "0.2rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</p>
                      <p style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300, lineHeight: 1.55 }}>{f.value}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function TrackerSection({ protocols, summary, loading, regenerating, onLoadSummary, onRegenerateQuestions, onGenerateNextStage }: {
  protocols: ClientProtocol[];
  summary: {
    trends: { category: string; avgScore: number; direction: string; delta: number }[];
    flagged: { date: string; questionLabel: string; value: string | number | boolean; category: string }[];
    totalDaysTracked: number;
    currentStage: number;
  } | null;
  loading: boolean;
  regenerating: boolean;
  onLoadSummary: () => void;
  onRegenerateQuestions: () => void;
  onGenerateNextStage: () => void;
}) {
  const nextStage = protocols.length + 1;
  const currentStage = protocols[protocols.length - 1]?.stage ?? 1;

  const directionArrow = (d: string) => d === 'improving' ? '↑' : d === 'declining' ? '↓' : '→';
  const directionColor = (d: string) => d === 'improving' ? 'oklch(0.7 0.15 145)' : d === 'declining' ? 'var(--danger)' : 'var(--dim)';

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Tracker · Stage {currentStage}
        </p>
        <button
          onClick={onRegenerateQuestions}
          disabled={regenerating}
          style={{ height: "22px", padding: "0 0.5rem", background: "none", border: "1px solid var(--border-subtle)", borderRadius: "5px", color: "var(--dim)", fontSize: "0.7rem", cursor: regenerating ? "default" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "border-color 150ms, color 150ms" }}
          onMouseEnter={e => { if (!regenerating) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; } }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.color = "var(--dim)"; }}>
          {regenerating ? "Regenerating..." : "Regenerate questions"}
        </button>
      </div>

      {!summary && !loading && (
        <button
          onClick={onLoadSummary}
          style={{ height: "32px", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "6px", color: "var(--dim)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "border-color 150ms, color 150ms" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.color = "var(--dim)"; }}>
          Load tracker summary
        </button>
      )}

      {loading && (
        <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300 }}>Loading...</p>
      )}

      {summary && (
        <>
          <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300 }}>
            {summary.totalDaysTracked} days tracked
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {summary.trends.map(t => (
              <div key={t.category} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.375rem 0.625rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "6px" }}>
                <span style={{ fontSize: "0.7rem", color: directionColor(t.direction), fontWeight: 500, width: "14px", textAlign: "center" }}>{directionArrow(t.direction)}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 300, flex: 1 }}>{t.category.replace('_', ' ')}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--ink)", fontWeight: 500, fontFamily: "var(--font-mono), monospace" }}>{t.avgScore}/10</span>
              </div>
            ))}
          </div>

          {summary.flagged.length > 0 && (
            <>
              <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "0.25rem" }}>Flagged</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {summary.flagged.slice(0, 5).map((f, i) => (
                  <div key={i} style={{ padding: "0.375rem 0.625rem", background: "oklch(0.55 0.18 25 / 0.06)", border: "1px solid oklch(0.55 0.18 25 / 0.15)", borderRadius: "6px" }}>
                    <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, marginBottom: "0.15rem" }}>
                      {new Date(f.date + 'T12:00:00').toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · {f.category.replace('_', ' ')}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 300, lineHeight: 1.4 }}>
                      {f.questionLabel}: <strong style={{ color: "var(--ink)" }}>{String(f.value)}</strong>
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          <button
            onClick={onGenerateNextStage}
            style={{ height: "36px", background: "oklch(0.60 0.18 165 / 0.12)", border: "1px solid oklch(0.60 0.18 165 / 0.3)", borderRadius: "7px", color: "var(--primary)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "background 150ms", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem", marginTop: "0.25rem" }}
            onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.60 0.18 165 / 0.2)")}
            onMouseLeave={e => (e.currentTarget.style.background = "oklch(0.60 0.18 165 / 0.12)")}>
            <SparkleIcon />
            Generate stage {nextStage} with AI
          </button>
        </>
      )}
    </div>
  );
}

function PromoteButton({ client, onSetStatus, onClientTypeChange }: { client: StoredUser; onSetStatus: (s: ClientStatus) => void; onClientTypeChange: (t: 'skool' | '1on1') => void }) {
  const [promoting, setPromoting] = useState(false);
  async function handlePromote() {
    setPromoting(true);
    await updateUser(client.email, { status: 'active' as ClientStatus });
    await setClientType(client.email, '1on1');
    onSetStatus('active' as ClientStatus);
    onClientTypeChange('1on1');
    setPromoting(false);
  }
  return (
    <button
      onClick={handlePromote}
      disabled={promoting}
      style={{ width: "100%", height: "42px", background: promoting ? "var(--surface-2)" : "var(--primary)", border: "none", borderRadius: "8px", color: promoting ? "var(--dim)" : "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: promoting ? "default" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "background 150ms" }}
      onMouseEnter={e => { if (!promoting) e.currentTarget.style.background = "var(--primary-hover)"; }}
      onMouseLeave={e => { if (!promoting) e.currentTarget.style.background = "var(--primary)"; }}
    >
      {promoting ? "Promoting…" : "Promote to Paying Client →"}
    </button>
  );
}

function ClientRow({ u, selected, unreadCounts, onSelect }: { u: StoredUser; selected: StoredUser | null; unreadCounts: Record<string, number>; onSelect: (u: StoredUser) => void }) {
  const unread = unreadCounts[u.email] ?? 0;
  const isSelected = selected?.email === u.email;
  const initials = u.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  return (
    <button key={u.email} onClick={() => onSelect(u)}
      style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 0.625rem", borderRadius: "9px", border: "none", borderLeft: isSelected ? "3px solid var(--primary)" : "3px solid transparent", background: isSelected ? "var(--surface-hover)" : "none", cursor: "pointer", textAlign: "left", transition: "background 150ms, border-color 150ms" }}>
      <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.7rem", fontWeight: 600, color: statusColor(u.status), fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{u.name}</p>
          {unread > 0 && (
            <span style={{ width: "17px", height: "17px", borderRadius: "50%", background: "var(--primary)", color: "#ffffff", fontSize: "0.625rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{unread}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginTop: "0.1rem" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: statusColor(u.status), flexShrink: 0 }} />
          <span style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {u.diagnosticData?.protocolStatus || u.status}
            {u.streak > 0 ? ` · ${u.streak >= 7 ? "🔥" : "⚡"}${u.streak}` : ""}
          </span>
          {u.diagnosticData?.clientType && (
            <span style={{ fontSize: "0.6rem", fontWeight: 600, color: u.diagnosticData.clientType === 'skool' ? "oklch(0.72 0.15 260)" : "oklch(0.72 0.14 145)", background: u.diagnosticData.clientType === 'skool' ? "oklch(0.72 0.15 260 / 0.12)" : "oklch(0.72 0.14 145 / 0.12)", borderRadius: "4px", padding: "1px 5px", flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {u.diagnosticData.clientType === 'skool' ? 'Skool' : '1:1'}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function statusColor(status: ClientStatus): string {
  if (status === "active") return "oklch(0.7 0.15 145)";
  if (status === "pending") return "oklch(0.82 0.10 62)";
  if (status === "alumni") return "var(--primary)";
  if (status === "new") return "oklch(0.7 0.12 300)";
  return "var(--dim)";
}

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

function NotionIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
    </svg>
  );
}

// ─── OVERVIEW PANEL ───────────────────────────────────────────────────────────

function OverviewPanel({ clients, onSelect }: { clients: StoredUser[]; onSelect: (u: StoredUser) => void }) {
  const today = new Date().toISOString().split('T')[0];
  const active = clients.filter(c => c.status === 'active');
  const checkedInToday = active.filter(c => c.lastCheckIn === today);
  const notCheckedIn = active.filter(c => c.lastCheckIn !== today);
  const pending = clients.filter(c => c.status === 'pending' || c.status === 'new');

  const totalRevenue = clients.reduce((sum, c) => {
    const payments = c.diagnosticData?.payments ?? [];
    return sum + payments.reduce((s: number, p: Payment) => s + (p.amount || 0), 0);
  }, 0);

  const statCard = (label: string, value: string | number, sub?: string, color?: string) => (
    <div style={{ padding: "1rem 1.25rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "10px" }}>
      <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.375rem" }}>{label}</p>
      <p style={{ fontSize: "1.5rem", fontWeight: 500, color: color ?? "var(--ink)", lineHeight: 1, fontFamily: "var(--font-display), Georgia, serif" }}>{value}</p>
      {sub && <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300, marginTop: "0.25rem" }}>{sub}</p>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", maxWidth: "860px" }}>
      <div>
        <p style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.875rem" }}>Overview</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem" }}>
          {statCard("Active clients", active.length)}
          {statCard("Checked in today", checkedInToday.length, `of ${active.length} active`, checkedInToday.length === active.length ? "oklch(0.7 0.15 145)" : "var(--ink)")}
          {statCard("Pending review", pending.length, pending.length > 0 ? "need protocols" : "all set")}
          {statCard("Total revenue", `£${totalRevenue}`, "all clients combined")}
        </div>
      </div>

      {/* Today's check-in status */}
      {active.length > 0 && (
        <div>
          <p style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>Today</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {active.map(c => {
              const checked = c.lastCheckIn === today;
              const payments = c.diagnosticData?.payments ?? [];
              const totalPaid = payments.reduce((s: number, p: Payment) => s + (p.amount || 0), 0);
              const lastPayment = payments.length > 0 ? payments[payments.length - 1] : null;
              return (
                <button key={c.email} onClick={() => onSelect(c)}
                  style={{ display: "flex", alignItems: "center", gap: "0.875rem", padding: "0.75rem 0.875rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "9px", cursor: "pointer", textAlign: "left", transition: "border-color 150ms", width: "100%" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border-subtle)"}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: checked ? "oklch(0.7 0.15 145)" : "oklch(0.65 0.14 65 / 0.6)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ink)" }}>{c.name}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300 }}>
                      {checked ? `Checked in · ${c.streak} day streak` : c.lastCheckIn ? `Last check-in: ${new Date(c.lastCheckIn + 'T12:00:00').toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}` : "No check-ins yet"}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {totalPaid > 0 && <p style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--muted)" }}>£{totalPaid}</p>}
                    {lastPayment && <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300 }}>{lastPayment.type}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending clients */}
      {pending.length > 0 && (
        <div>
          <p style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>Needs attention</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {pending.map(c => (
              <button key={c.email} onClick={() => onSelect(c)}
                style={{ display: "flex", alignItems: "center", gap: "0.875rem", padding: "0.75rem 0.875rem", background: "var(--surface)", border: "1px solid oklch(0.60 0.18 165 / 0.2)", borderRadius: "9px", cursor: "pointer", textAlign: "left", transition: "border-color 150ms", width: "100%" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "oklch(0.60 0.18 165 / 0.4)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "oklch(0.60 0.18 165 / 0.2)"}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent)", animation: "pulse 2s ease infinite", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ink)" }}>{c.name}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300 }}>
                    {c.status === 'pending' ? "Intake complete · needs protocol" : "Registered · no intake yet"} · joined {new Date(c.joinedAt + 'T12:00:00').toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Payment summary */}
      {clients.some(c => (c.diagnosticData?.payments ?? []).length > 0) && (
        <div>
          <p style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>Payments</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {clients.filter(c => (c.diagnosticData?.payments ?? []).length > 0).map(c => {
              const payments: Payment[] = c.diagnosticData?.payments ?? [];
              const total = payments.reduce((s, p) => s + (p.amount || 0), 0);
              const last = payments[payments.length - 1];
              return (
                <button key={c.email} onClick={() => onSelect(c)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 0.875rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "9px", cursor: "pointer", transition: "border-color 150ms", width: "100%" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border-subtle)"}>
                  <div>
                    <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ink)" }}>{c.name}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300 }}>
                      Last: £{last.amount} {last.type} · {new Date(last.date + 'T12:00:00').toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <p style={{ fontSize: "1rem", fontWeight: 500, color: "var(--ink)", fontFamily: "var(--font-display), Georgia, serif" }}>£{total}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ─── Voice Note Player (matches client dashboard UI) ─────────────────────────

const WAVEFORM_BARS = [0.4, 0.7, 0.5, 1.0, 0.6, 0.8, 0.3, 0.9, 0.5, 0.7, 0.4, 0.6, 0.8, 0.5, 0.9, 0.4, 0.7, 0.3, 0.6, 0.8];

function VoiceNotePlayer({ url, isAdmin, transcript }: { url: string; isAdmin: boolean; transcript?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); } else { a.play(); }
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onPlay = () => { setPlaying(true); tickRef.current = setInterval(() => setElapsed(a.currentTime), 100); };
    const onPause = () => { setPlaying(false); if (tickRef.current) clearInterval(tickRef.current); };
    const onEnded = () => { setPlaying(false); setElapsed(0); if (tickRef.current) clearInterval(tickRef.current); };
    const onMeta = () => setDuration(isFinite(a.duration) ? a.duration : 0);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("loadedmetadata", onMeta);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("loadedmetadata", onMeta);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const progress = duration > 0 ? elapsed / duration : 0;
  const accent = isAdmin ? "var(--color-red)" : "oklch(0.70 0.20 220)";
  const bg = isAdmin ? "oklch(0.60 0.18 165 / 0.12)" : "oklch(0.15 0.02 220 / 0.5)";

  return (
    <div style={{ marginTop: "0.375rem" }}>
      <audio ref={audioRef} src={url} preload="metadata" style={{ display: "none" }} />
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.5rem 0.75rem", background: bg, borderRadius: "10px", minWidth: "180px", maxWidth: "240px" }}>
        <button onClick={togglePlay}
          style={{ width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0, background: accent, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity 150ms" }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = "0.8"}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = "1"}>
          {playing
            ? <svg width="10" height="10" viewBox="0 0 10 10" fill="#ffffff" aria-hidden><rect x="1" y="1" width="3" height="8" rx="1"/><rect x="6" y="1" width="3" height="8" rx="1"/></svg>
            : <svg width="10" height="10" viewBox="0 0 10 10" fill="#ffffff" aria-hidden style={{ marginLeft: "1px" }}><polygon points="2,1 9,5 2,9"/></svg>
          }
        </button>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "22px" }}>
            {WAVEFORM_BARS.map((h, i) => (
              <div key={i} style={{ width: "2.5px", borderRadius: "2px", flexShrink: 0, height: `${h * 100}%`, background: (i / WAVEFORM_BARS.length) <= progress ? accent : (isAdmin ? "oklch(0.60 0.18 165 / 0.35)" : "oklch(0.97 0.005 220 / 0.25)"), transition: "background 80ms" }} />
            ))}
          </div>
          <span style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono), monospace", color: isAdmin ? "var(--dim)" : "oklch(0.97 0.005 220 / 0.55)", fontWeight: 300 }}>
            {playing || elapsed > 0 ? fmt(elapsed) : duration > 0 ? fmt(duration) : "0:00"}
          </span>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isAdmin ? "var(--dim)" : "oklch(0.97 0.005 220 / 0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        </svg>
      </div>
      {transcript && (
        <p style={{ marginTop: "0.375rem", fontSize: "0.8rem", color: isAdmin ? "var(--muted)" : "oklch(0.97 0.005 220 / 0.7)", fontWeight: 300, lineHeight: 1.5, fontStyle: "italic", maxWidth: "240px" }}>
          &ldquo;{transcript}&rdquo;
        </p>
      )}
    </div>
  );
}
