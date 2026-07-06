"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getAllUsers, updateUser, linkNotionPage, setProtocolStatus,
  setAccountStatus, setClientType, addPayment, removePayment, removeClient, createClient,
  setSuspended, updatePresence, getAdminProtocols, getAdminDiagnostics, publishDiagnosis,
} from "@/lib/auth";
import type { StoredUser, ClientStatus, ProtocolStatus, AccountStatus, Payment, ClientProtocol, ClientDiagnostic } from "@/lib/auth";
import type { ProtocolId } from "@/lib/protocols";
import { supabase } from "@/lib/supabase";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";

const ADMIN_EMAIL = "info.shopzul@gmail.com";
const ADMIN_PASSWORD = "Fikri!";

const MARKER_DEFAULTS: Record<string, { label: string; unit: string }> = {
  total_t:      { label: "Total T",       unit: "ng/dL" },
  free_t:       { label: "Free T",        unit: "pg/mL" },
  shbg:         { label: "SHBG",          unit: "nmol/L" },
  estradiol:    { label: "Estradiol",     unit: "pg/mL" },
  lh:           { label: "LH",           unit: "mIU/mL" },
  fsh:          { label: "FSH",          unit: "mIU/mL" },
  cortisol:     { label: "Cortisol",     unit: "μg/dL" },
  hematocrit:   { label: "Hematocrit",   unit: "%" },
  hemoglobin:   { label: "Hemoglobin",   unit: "g/dL" },
  rbc:          { label: "RBC",          unit: "M/μL" },
  psa:          { label: "PSA",          unit: "ng/mL" },
  dhea_s:       { label: "DHEA-S",       unit: "μg/dL" },
  igf1:         { label: "IGF-1",        unit: "ng/mL" },
  tsh:          { label: "TSH",          unit: "mIU/L" },
  t3_free:      { label: "Free T3",      unit: "pg/mL" },
  t4_free:      { label: "Free T4",      unit: "ng/dL" },
  vitamin_d:    { label: "Vitamin D",    unit: "ng/mL" },
  ferritin:     { label: "Ferritin",     unit: "ng/mL" },
  cholesterol:  { label: "Cholesterol",  unit: "mg/dL" },
  hdl:          { label: "HDL",          unit: "mg/dL" },
  ldl:          { label: "LDL",          unit: "mg/dL" },
  triglycerides:{ label: "Triglycerides",unit: "mg/dL" },
  glucose:      { label: "Glucose",      unit: "mg/dL" },
  hba1c:        { label: "HbA1c",        unit: "%" },
  creatinine:   { label: "Creatinine",   unit: "mg/dL" },
  alt:          { label: "ALT",          unit: "U/L" },
  ast:          { label: "AST",          unit: "U/L" },
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:  { bg: "oklch(0.60 0.18 165 / 0.15)", color: "var(--color-red)" },
  pending: { bg: "oklch(0.75 0.15 80 / 0.15)",  color: "oklch(0.75 0.15 80)" },
  alumni:  { bg: "var(--surface)",               color: "var(--dim)" },
  new:     { bg: "oklch(0.75 0.15 80 / 0.15)",   color: "oklch(0.75 0.15 80)" },
  hold:    { bg: "oklch(0.62 0.20 25 / 0.15)",   color: "var(--danger)" },
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [clients, setClients] = useState<StoredUser[]>([]);
  const [selected, setSelected] = useState<StoredUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adminView, setAdminView] = useState<'overview' | 'clients' | 'tools'>('overview');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 700);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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

    // Realtime: client submits tracker → notify + refresh their row in the list
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

    // Realtime: new client completes /apply → appear in Applicants section immediately
    const newClientChannel = supabase
      .channel('admin:new_applicants')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'users',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (payload: any) => {
        const row = payload.new;
        if (!row) return;
        const diagData = row.diagnostic_data ?? undefined;
        const newClient: StoredUser = {
          name: row.name ?? row.email,
          email: row.email,
          password: row.password ?? '',
          status: (row.status ?? 'new') as StoredUser['status'],
          streak: row.streak ?? 0,
          longestStreak: row.longest_streak ?? 0,
          lastCheckIn: row.last_check_in ?? undefined,
          joinedAt: row.joined_at,
          diagnosticData: diagData,
        };
        setClients(prev => [newClient, ...prev]);
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try { new Notification(`New applicant: ${row.name ?? row.email}`, { body: 'Completed application form', icon: '/thp.jpg' }); } catch { /* blocked */ }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(checkinChannel);
      supabase.removeChannel(newClientChannel);
    };
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
    const order: Record<ClientStatus, number> = { pending: 0, active: 1, alumni: 2, new: 3, inactive: 5 };
    const all = await getAllUsers();
    const sorted = [...all].sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4));
    setClients(sorted);
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

  function selectClient(u: StoredUser) {
    setSelected(u);
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
    if (!isSuspended && !confirm(`Suspend ${selected.name}? They will lose dashboard access immediately.`)) return;
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


  const q = searchQuery.toLowerCase().trim();
  const searchFiltered = q
    ? clients.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.diagnosticData?.contactInfo ?? "").toLowerCase().includes(q)
      )
    : clients;
  const paying1on1 = searchFiltered.filter(c => (c.status === "active" || c.status === "alumni") && c.diagnosticData?.clientType !== "skool");
  const applicants = searchFiltered.filter(c => (c.status === "new" || c.status === "pending") && c.diagnosticData?.clientType !== "skool");

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
      <header style={{ height: "50px", borderBottom: "1px solid var(--border-subtle)", padding: "0 0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "oklch(0.08 0 0 / 0.7)", backdropFilter: "blur(12px)", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/thprebrandlogo2.png" alt="THP" style={{ height: "24px", width: "auto", filter: "brightness(0) invert(1)", flexShrink: 0 }} />
          <div style={{ display: "flex", gap: "0.25rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "3px", flexShrink: 0 }}>
            {(['overview', 'clients', 'tools'] as const).map(v => (
              <button key={v} onClick={() => { setAdminView(v); if (v === 'overview') setSelected(null); }}
                style={{ height: "26px", padding: isMobile ? "0 0.5rem" : "0 0.75rem", borderRadius: "6px", border: "none", fontSize: isMobile ? "0.7rem" : "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "background 150ms, color 150ms",
                  background: adminView === v ? "var(--primary)" : "transparent",
                  color: adminView === v ? "#fff" : "var(--dim)" }}>
                {v === 'overview' ? (isMobile ? 'Home' : 'Dashboard') : v === 'clients' ? 'Clients' : 'Tools'}
              </button>
            ))}
          </div>
          {loading && !isMobile && <span style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300 }}>Loading…</span>}
        </div>
        <button onClick={handleSignOut} style={{ background: "none", border: "none", color: "var(--dim)", fontSize: "0.75rem", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "color 150ms", flexShrink: 0, whiteSpace: "nowrap" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--muted)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--dim)")}>
          {isMobile ? "Out" : "Sign out"}
        </button>
      </header>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Sidebar — only visible in Clients view; hidden on mobile when a client is selected */}
        {adminView === 'clients' && !(isMobile && selected) && <aside style={{ width: isMobile ? "100%" : "260px", borderRight: isMobile ? "none" : "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
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
            <button onClick={() => setAdminView('tools')}
              title="Create client (Tools)"
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
                {applicants.map(u => <ClientRow key={u.email} u={u} selected={selected} unreadCounts={{}} onSelect={selectClient} />)}
              </>
            )}

            {/* PAYING 1:1 CLIENTS */}
            {paying1on1.length > 0 && (
              <>
                <p style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--dim)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.75rem 0.625rem 0.375rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                  Clients <span style={{ fontWeight: 300 }}>{paying1on1.length}</span>
                </p>
                {paying1on1.map(u => <ClientRow key={u.email} u={u} selected={selected} unreadCounts={{}} onSelect={selectClient} />)}
              </>
            )}

            {/* Skool clients intentionally hidden — filtered from all views */}
          </div>
        </aside>}

        {/* Main — hidden on mobile in Clients view when no client selected (sidebar takes full width) */}
        <main style={{ flex: 1, display: isMobile && adminView === 'clients' && !selected ? "none" : "flex", overflow: "hidden" }}>
          <AnimatePresence mode="wait">
            {adminView === 'overview' ? (
              <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flex: 1, overflowY: "auto", padding: "1.5rem 1.75rem" }}>
                <OverviewPanel clients={clients} onSelect={(u) => { selectClient(u); setAdminView('clients'); }} />
              </motion.div>
            ) : adminView === 'tools' ? (
              <motion.div key="tools" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flex: 1, overflowY: "auto", padding: "1.5rem 1.75rem" }}>
                <ToolsPanel clients={clients} onClientCreated={refreshClients} />
              </motion.div>
            ) : !selected ? (
              // On mobile in Clients view, the sidebar takes full width — no "empty" panel needed
              isMobile ? null : (
                <motion.div key="clients-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p style={{ fontSize: "0.875rem", color: "var(--dim)", fontWeight: 300 }}>Select a client from the sidebar</p>
                </motion.div>
              )
            ) : (
              <motion.div key={selected.email} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} style={{ flex: 1, overflowY: "auto", padding: isMobile ? "1rem" : "1.5rem 1.75rem" }}>
                <CrmPanel
                  client={selected}
                  onBack={() => setSelected(null)}
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
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

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
  const [genSuccess, setGenSuccess] = useState(false);
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
  const [checkoutAmount, setCheckoutAmount] = useState("2000");
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
  const [diagGenerating, setDiagGenerating] = useState(false);
  const [diagGenError, setDiagGenError] = useState("");

  useEffect(() => {
    getAdminProtocols(client.email).then(setClientProtocols).catch(() => {});
    getAdminDiagnostics(client.email).then(setAdminDiagnostics).catch(() => {});
    setTrackerSummary(null);
    setInviteUrl(null);
    setInviteCopied(false);
    setPaymentUrl(null);
    setPaymentLinkCopied(false);
    setPaymentLinkError("");
    setCheckoutAmount("2000");
  }, [client.email]);

  async function handlePublishDiagnosis(diagId: string) {
    setPublishingDiagId(diagId);
    await publishDiagnosis(diagId);
    setAdminDiagnostics(prev => prev.map(d => d.id === diagId ? { ...d, published: true } : d));
    setPublishingDiagId(null);
    // Notify client their diagnosis is ready
    fetch('/api/push-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: client.email,
        adminPw: ADMIN_PASSWORD,
        title: 'Your THP Diagnosis is Ready',
        body: 'Ali has reviewed your intake. Your diagnosis is waiting on your dashboard.',
      }),
    }).catch(() => {});
  }

  async function handleGenerateDiagnosis() {
    setDiagGenerating(true);
    setDiagGenError("");
    try {
      const res = await fetch("/api/generate-diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientEmail: client.email, adminPw: ADMIN_PASSWORD }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Generation failed");
      const updated = await getAdminDiagnostics(client.email);
      setAdminDiagnostics(updated);
    } catch (err) {
      setDiagGenError(err instanceof Error ? err.message : "Unknown error");
    }
    setDiagGenerating(false);
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
        body: JSON.stringify({ email: client.email, adminPw: ADMIN_PASSWORD, amount: Number(checkoutAmount), paymentType: 'deposit' }),
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
    const res = await fetch(`/api/tracker-questions-bank?email=${encodeURIComponent(client.email)}&stage=${currentStage}`);
    const { bank } = await res.json();
    if (bank?.protocol_text) {
      await fetch('/api/generate-tracker-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.NEXT_PUBLIC_INTERNAL_API_KEY ?? '' },
        body: JSON.stringify({ clientEmail: client.email, stage: currentStage, protocolText: bank.protocol_text, diagnosticData: client.diagnosticData ?? {} }),
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

      // Refresh protocols list so THP sees the result immediately
      const updated = await getAdminProtocols(client.email);
      setClientProtocols(updated);

      // Reload admin diagnostics too (protocol generation also creates a diagnosis draft)
      const updatedDiags = await getAdminDiagnostics(client.email);
      setAdminDiagnostics(updatedDiags);

      // Notify client that their protocol is ready
      fetch('/api/push-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: client.email,
          adminPw: ADMIN_PASSWORD,
          title: 'Your THP Protocol is Ready',
          body: 'Your protocol is live. Open your dashboard to read it.',
        }),
      }).catch(() => {}); // fire and forget

      onProtocolGenerated(data.notionPageId);
      setGenSuccess(true);
      setTimeout(() => setGenSuccess(false), 3000);
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
          {(() => {
            const ci = client.diagnosticData?.contactInfo ?? '';
            const phone = ci.split('|').map((s: string) => s.trim()).find((s: string) => /^\+?[\d\s\-()]{7,}$/.test(s));
            return phone ? <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300 }}>{phone}</p> : null;
          })()}
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>Diagnosis</p>
          <button
            onClick={handleGenerateDiagnosis}
            disabled={diagGenerating}
            style={{ height: "28px", padding: "0 0.75rem", background: diagGenerating ? "var(--surface-2)" : "oklch(0.55 0.18 30 / 0.15)", border: "1px solid oklch(0.55 0.18 30 / 0.4)", borderRadius: "6px", color: diagGenerating ? "var(--dim)" : "oklch(0.75 0.18 30)", fontSize: "0.7rem", fontWeight: 600, cursor: diagGenerating ? "default" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", whiteSpace: "nowrap" }}>
            {diagGenerating ? "Generating…" : "+ Generate with AI"}
          </button>
        </div>
        {diagGenError && <p style={{ fontSize: "0.75rem", color: "var(--primary)" }}>{diagGenError}</p>}
        {adminDiagnostics.length === 0 ? (
          <p style={{ fontSize: "0.8rem", color: "var(--dim)", fontWeight: 300 }}>No diagnosis yet. Click &quot;Generate with AI&quot; to run the diagnosis.</p>
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
              {/* Speaking notes — THP only, never shown to client */}
              {diag.content?.speaking_notes && (
                <details style={{ marginTop: "0.5rem", borderTop: "1px solid oklch(0.65 0.14 65 / 0.2)", paddingTop: "0.5rem" }}>
                  <summary style={{ fontSize: "0.7rem", color: "oklch(0.75 0.14 65)", cursor: "pointer", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-ui), system-ui, sans-serif", userSelect: "none" }}>Speaking Notes (THP only)</summary>
                  <div style={{ marginTop: "0.375rem", fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300, lineHeight: 1.6 }}>
                    {!!diag.content.speaking_notes.phase1_summary && <p style={{ marginBottom: "0.5rem" }}><strong style={{ color: "var(--muted)" }}>Phase 1:</strong> {String(diag.content.speaking_notes.phase1_summary)}</p>}
                    {Array.isArray(diag.content.speaking_notes.held_back) && diag.content.speaking_notes.held_back.length > 0 && (
                      <div style={{ marginBottom: "0.5rem" }}><strong style={{ color: "var(--muted)" }}>Held back:</strong>{(diag.content.speaking_notes.held_back as unknown[]).map((item, i) => <p key={i} style={{ marginLeft: "0.75rem", marginTop: "0.125rem" }}>· {String(item)}</p>)}</div>
                    )}
                    {!!diag.content.speaking_notes.next_session_hooks && <p style={{ marginBottom: "0.5rem" }}><strong style={{ color: "var(--muted)" }}>First call hooks:</strong> {String(diag.content.speaking_notes.next_session_hooks)}</p>}
                    {!!diag.content.speaking_notes.red_flags && <p><strong style={{ color: "var(--primary)" }}>Red flags:</strong> {String(diag.content.speaking_notes.red_flags)}</p>}
                  </div>
                </details>
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
        <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.125rem" }}>Send Payment Link</p>
        {!paymentUrl ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <span style={{ fontSize: "0.875rem", color: "var(--muted)", fontWeight: 500, flexShrink: 0 }}>$</span>
              <input
                type="number"
                min="1"
                value={checkoutAmount}
                onChange={e => setCheckoutAmount(e.target.value)}
                placeholder="2000"
                style={{ flex: 1, height: "34px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "7px", padding: "0 0.625rem", fontSize: "0.875rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", outline: "none" }}
                onFocus={e => (e.target.style.borderColor = "var(--primary)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")}
              />
            </div>
            <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300 }}>Standard: $2,000 · Min: $500. Type the agreed amount.</p>
            <button
              onClick={handleGeneratePaymentLink}
              disabled={paymentLinkLoading || !checkoutAmount || Number(checkoutAmount) < 1}
              style={{ height: "36px", background: (paymentLinkLoading || !checkoutAmount || Number(checkoutAmount) < 1) ? "var(--surface-2)" : "var(--surface)", border: "1px solid var(--border)", borderRadius: "7px", color: (paymentLinkLoading || !checkoutAmount || Number(checkoutAmount) < 1) ? "var(--dim)" : "var(--muted)", fontSize: "0.8125rem", fontWeight: 500, cursor: (paymentLinkLoading || !checkoutAmount || Number(checkoutAmount) < 1) ? "default" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
              {paymentLinkLoading ? "Generating…" : `Generate $${checkoutAmount || '—'} link`}
            </button>
            {paymentLinkError && (
              <p style={{ fontSize: "0.75rem", color: "var(--danger)", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>{paymentLinkError}</p>
            )}
          </>
        ) : (
          <>
            <p style={{ fontSize: "0.75rem", color: "oklch(0.7 0.15 145)", fontWeight: 400 }}>${checkoutAmount} checkout link ready</p>
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
            <button onClick={() => { setPaymentUrl(null); setPaymentLinkCopied(false); }}
              style={{ height: "28px", background: "none", border: "none", color: "var(--dim)", fontSize: "0.75rem", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", textAlign: "left" }}>
              ← Generate different amount
            </button>
          </>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
        <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.125rem" }}>Protocol</p>

        {/* No Notion protocol yet - generate or link */}
        {!client.notionPageId && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button
                onClick={handleGenerateProtocol}
                disabled={generating}
                style={{ height: "36px", background: generating ? "var(--surface-2)" : "oklch(0.60 0.18 165 / 0.12)", border: "1px solid oklch(0.60 0.18 165 / 0.3)", borderRadius: "7px", color: generating ? "var(--dim)" : "var(--primary)", fontSize: "0.8125rem", fontWeight: 500, cursor: generating ? "default" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "background 150ms", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem" }}
                onMouseEnter={e => { if (!generating) e.currentTarget.style.background = "oklch(0.60 0.18 165 / 0.2)"; }}
                onMouseLeave={e => { if (!generating) e.currentTarget.style.background = "oklch(0.60 0.18 165 / 0.12)"; }}>
                <SparkleIcon />
                {generating ? "Generating…" : clientProtocols.length === 0 ? "Generate protocol with AI" : `Regenerate protocol stage ${clientProtocols[clientProtocols.length - 1].stage} with AI`}
              </button>
              {genSuccess && <span style={{ fontSize: "0.75rem", color: "oklch(0.7 0.15 145)", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Protocol generated ✓</span>}
            </div>
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg> WhatsApp
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
                  onAddPayment({ date: new Date().toISOString().split('T')[0], amount: amt, currency: '$', type: paymentType, note: paymentNote || undefined });
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
              getAdminProtocols(client.email).then(setClientProtocols).catch(() => {});
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
            Generate protocol stage {nextStage} with AI
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

// ─── CRM PANEL (full-width when client selected) ──────────────────────────

function CrmPanel({ client, onBack, diagnosticOpen, onToggleDiagnostic, onActivate, onSetStatus, onAssignProtocol, onProtocolGenerated, onProtocolStatusChange, onAccountStatusChange, onClientTypeChange, onRemoveClient, onSuspendClient, onAddPayment, onRemovePayment }: {
  client: StoredUser;
  onBack: () => void;
  diagnosticOpen: boolean;
  onToggleDiagnostic: () => void;
  onActivate: (p?: ProtocolId) => void;
  onSetStatus: (s: ClientStatus) => void;
  onAssignProtocol: (p?: ProtocolId) => void;
  onProtocolGenerated: (notionPageId: string) => void;
  onProtocolStatusChange: (status: ProtocolStatus) => void;
  onAccountStatusChange: (status: AccountStatus) => void;
  onClientTypeChange: (t: 'skool' | '1on1') => void;
  onRemoveClient: () => void;
  onSuspendClient: () => void;
  onAddPayment: (p: Omit<Payment, 'id'>) => void;
  onRemovePayment: (id: string) => void;
}) {
  const [analysisMap, setAnalysisMap] = useState<Record<string, { date: string; talking_points: string[]; flags: string[] }>>({});
  const [trackers, setTrackers] = useState<{ date: string; vitals?: Record<string,unknown>; training?: Record<string,unknown>; circadian?: Record<string,unknown>; [k: string]: unknown }[]>([]);
  const [expandedTracker, setExpandedTracker] = useState<string | null>(null);
  const [showAllTrackers, setShowAllTrackers] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [bloodWorkEntries, setBloodWorkEntries] = useState<{ id: string; test_date: string | null; uploaded_at: string; markers: Record<string,{ value: number | null; unit: string; flag?: string | null }> | null }[]>([]);
  const [expandedBWMarker, setExpandedBWMarker] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState("total_t");
  const [userData, setUserData] = useState<{ deposit_paid: number | null; total_owed: number | null; telegram_username: string | null; last_login: string | null; last_tracker_date: string | null; agreed_monthly: number | null; last_monthly_paid: string | null; last_monthly_amount: number | null } | null>(null);
  const [agreedMonthly, setAgreedMonthly] = useState("");
  const [referralCount, setReferralCount] = useState(0);
  const [pendingReferrals, setPendingReferrals] = useState<{ id: string; referred_email: string; created_at: string }[]>([]);
  const [markingReferral, setMarkingReferral] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState("");
  const [pushMsg, setPushMsg] = useState("");
  const [pushSending, setPushSending] = useState(false);
  const [pushResult, setPushResult] = useState<"sent" | "failed" | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);
  const [applyingFreeMonth, setApplyingFreeMonth] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payDeposit, setPayDeposit] = useState("");
  const [payTotal, setPayTotal] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [payLinkType, setPayLinkType] = useState<"deposit" | "monthly">("deposit");
  const [payLinkAmount, setPayLinkAmount] = useState("");
  const [payLinkLoading, setPayLinkLoading] = useState(false);
  const [payLinkUrl, setPayLinkUrl] = useState<string | null>(null);
  const [payLinkError, setPayLinkError] = useState("");
  const [payLinkCopied, setPayLinkCopied] = useState(false);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Protocol generation state
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [clientProtocols, setClientProtocols] = useState<ClientProtocol[]>([]);
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
  const [diagGenerating, setDiagGenerating] = useState(false);
  const [diagGenError, setDiagGenError] = useState("");
  const [sendingProtocolId, setSendingProtocolId] = useState<string | null>(null);
  const [applicationData, setApplicationData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    // Reset profile-panel state on client change
    setTrackerSummary(null);
    setGenError("");
    setDiagGenError("");
    setApplicationData(null);

    // Tracker analysis — via API (bypasses RLS)
    fetch(`/api/tracker-analysis?email=${encodeURIComponent(client.email)}&limit=20`)
      .then(r => r.json())
      .then(d => {
        const map: Record<string, { date: string; talking_points: string[]; flags: string[] }> = {};
        (d.analysis ?? []).forEach((a: { date: string; talking_points: string[]; flags: string[] }) => { map[a.date] = a; });
        setAnalysisMap(map);
      })
      .catch(() => {});

    // Last 10 trackers — via API (bypasses RLS)
    fetch(`/api/tracker-history?email=${encodeURIComponent(client.email)}&limit=10`)
      .then(r => r.json())
      .then(d => setTrackers((d.trackers ?? []) as typeof trackers))
      .catch(() => {});

    // Blood work entries — via API (bypasses RLS)
    fetch(`/api/blood-work-history?email=${encodeURIComponent(client.email)}`)
      .then(r => r.json())
      .then(d => setBloodWorkEntries((d.entries ?? []) as typeof bloodWorkEntries))
      .catch(() => {});

    // User data (deposit, telegram, last login/tracker)
    supabase.from('users').select('deposit_paid, total_owed, telegram_username, last_login, last_tracker_date, agreed_monthly, last_monthly_paid, last_monthly_amount')
      .eq('email', client.email).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setUserData(data as typeof userData);
          setTelegramUsername(data.telegram_username ?? '');
          setAgreedMonthly(data.agreed_monthly ? String(data.agreed_monthly) : (client.diagnosticData?.monthlyRate ? String(client.diagnosticData.monthlyRate) : ''));
        }
      });

    // Referral count (paid) + pending referrals list
    supabase.from('referrals').select('id', { count: 'exact', head: true })
      .eq('referrer_email', client.email).eq('status', 'paid')
      .then(({ count }) => setReferralCount(count ?? 0));
    supabase.from('referrals').select('id, referred_email, created_at')
      .eq('referrer_email', client.email).eq('status', 'pending')
      .then(({ data }) => setPendingReferrals(data ?? []));

    // Private notes
    supabase.from('applicant_notes').select('notes').eq('user_email', client.email).maybeSingle()
      .then(({ data }) => setNotes(data?.notes ?? ''));

    // Application form answers
    supabase.from('application_forms').select('*').eq('email', client.email).maybeSingle()
      .then(({ data }) => { if (data) setApplicationData(data as Record<string, unknown>); });

    // Client protocols + admin diagnostics
    getAdminProtocols(client.email).then(setClientProtocols).catch(() => {});
    getAdminDiagnostics(client.email).then(setAdminDiagnostics).catch(() => {});
  }, [client.email]);

  const saveNotes = (val: string) => {
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      setNotesSaving(true);
      await supabase.from('applicant_notes').upsert({ user_email: client.email, notes: val, updated_at: new Date().toISOString() });
      setNotesSaving(false);
    }, 800);
  };

  const saveTelegram = async () => {
    const { error } = await supabase.from('users').update({ telegram_username: telegramUsername }).eq('email', client.email);
    if (!error) { setSavedField('telegram'); setTimeout(() => setSavedField(null), 2000); }
  };

  const sendPush = async () => {
    if (!pushMsg.trim()) return;
    setPushSending(true);
    setPushResult(null);
    try {
      const res = await fetch('/api/push-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: client.email, adminPw: ADMIN_PASSWORD, title: 'THP', body: pushMsg.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);
      setPushMsg('');
      setPushResult('sent');
    } catch {
      setPushResult('failed');
    }
    setPushSending(false);
    setTimeout(() => setPushResult(null), 4000);
  };

  const applyFreeMonth = async () => {
    setApplyingFreeMonth(true);
    await supabase.from('users').update({ diagnostic_data: { ...(client.diagnosticData ?? {}), freeMonthEarned: true } }).eq('email', client.email);
    setApplyingFreeMonth(false);
  };

  const markReferralPaid = async (referralId: string) => {
    setMarkingReferral(referralId);
    await fetch('/api/admin/mark-referral-paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referralId, adminPw: ADMIN_PASSWORD }),
    });
    setPendingReferrals(prev => prev.filter(r => r.id !== referralId));
    setReferralCount(prev => prev + 1);
    setMarkingReferral(null);
  };

  async function handlePublishDiagnosis(diagId: string) {
    setPublishingDiagId(diagId);
    await publishDiagnosis(diagId);
    setAdminDiagnostics(prev => prev.map(d => d.id === diagId ? { ...d, published: true } : d));
    setPublishingDiagId(null);
    fetch('/api/push-send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail: client.email, adminPw: ADMIN_PASSWORD, title: 'Your THP Diagnosis is Ready', body: 'Ali has reviewed your intake. Your diagnosis is waiting on your dashboard.' }),
    }).catch(() => {});
  }

  async function handleGenerateDiagnosis() {
    setDiagGenerating(true); setDiagGenError("");
    try {
      const res = await fetch("/api/generate-diagnosis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientEmail: client.email, adminPw: ADMIN_PASSWORD }) });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Generation failed");
      const updated = await getAdminDiagnostics(client.email);
      setAdminDiagnostics(updated);
    } catch (err) { setDiagGenError(err instanceof Error ? err.message : "Unknown error"); }
    setDiagGenerating(false);
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
    const res = await fetch(`/api/tracker-questions-bank?email=${encodeURIComponent(client.email)}&stage=${currentStage}`);
    const { bank } = await res.json();
    if (bank?.protocol_text) {
      await fetch('/api/generate-tracker-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.NEXT_PUBLIC_INTERNAL_API_KEY ?? '' },
        body: JSON.stringify({ clientEmail: client.email, stage: currentStage, protocolText: bank.protocol_text, diagnosticData: client.diagnosticData ?? {} }),
      }).catch(() => {});
    }
    setRegeneratingQuestions(false);
  }

  async function handleGenerateProtocol() {
    setGenerating(true); setGenError("");
    try {
      const res = await fetch("/api/generate-protocol", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientEmail: client.email, clientName: client.name, diagnosticData: client.diagnosticData ?? null, phase1Mode: true }) });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Generation failed");
      const updated = await getAdminProtocols(client.email);
      setClientProtocols(updated);
      const updatedDiags = await getAdminDiagnostics(client.email);
      setAdminDiagnostics(updatedDiags);
      onProtocolGenerated(data.notionPageId);
    } catch (err) { setGenError(err instanceof Error ? err.message : "Unknown error"); }
    setGenerating(false);
  }

  const firstName = client.name.split(' ')[0];

  const sectionLabel = (text: string) => (
    <p style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.75rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>{text}</p>
  );

  const initials = client.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const joinedDate = new Date(client.joinedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "860px" }}>

      {/* Compact top strip */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--dim)", cursor: "pointer", fontSize: "0.875rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>← Back</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "1.25rem", fontWeight: 400, color: "var(--ink)", margin: 0 }}>{client.name}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
            {/* Telegram */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--dim)", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>TG:</span>
              <input
                value={telegramUsername}
                onChange={e => setTelegramUsername(e.target.value)}
                placeholder="username"
                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                onBlur={e => { e.target.style.borderColor = 'transparent'; saveTelegram(); }}
                style={{ width: "90px", height: "20px", background: "transparent", border: "1px solid transparent", borderRadius: "4px", padding: "0 0.25rem", fontSize: "0.75rem", color: "var(--dim)", fontFamily: "var(--font-ui), system-ui, sans-serif", outline: "none", transition: "border-color 150ms" }}
              />
              {telegramUsername && (
                <a href={`https://t.me/${telegramUsername}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--dim)", textDecoration: "none", fontSize: "0.7rem", opacity: 0.6 }}>↗</a>
              )}
              {savedField === 'telegram' && <span style={{ fontSize: "0.65rem", color: "oklch(0.7 0.15 145)", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Saved ✓</span>}
            </div>
            <span style={{ color: "var(--border)", fontSize: "0.7rem" }}>·</span>
            {/* Email */}
            <a href={`mailto:${client.email}`} style={{ fontSize: "0.75rem", color: "var(--dim)", fontFamily: "var(--font-ui), system-ui, sans-serif", textDecoration: "none" }}>{client.email}</a>
            {/* Phone from contactInfo if present */}
            {(() => {
              const ci = client.diagnosticData?.contactInfo ?? '';
              const phone = ci.split('|').map((s: string) => s.trim()).find((s: string) => /^\+?[\d\s\-()]{7,}$/.test(s));
              return phone ? (
                <>
                  <span style={{ color: "var(--border)", fontSize: "0.7rem" }}>·</span>
                  <a href={`tel:${phone}`} style={{ fontSize: "0.75rem", color: "var(--dim)", fontFamily: "var(--font-ui), system-ui, sans-serif", textDecoration: "none" }}>{phone}</a>
                </>
              ) : null;
            })()}
            <span style={{ color: "var(--border)", fontSize: "0.7rem" }}>·</span>
            <span style={{ fontSize: "0.75rem", color: "var(--dim)", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>joined {joinedDate}</span>
          </div>
        </div>
        <span style={{ padding: "0.25rem 0.625rem", borderRadius: "20px", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", background: client.status === "active" ? "oklch(0.25 0.08 145)" : "var(--surface)", color: client.status === "active" ? "oklch(0.65 0.15 145)" : "var(--dim)", border: "1px solid", borderColor: client.status === "active" ? "oklch(0.4 0.12 145)" : "var(--border)", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>{client.status}</span>
      </div>

      {/* Quick stats strip — collapsible */}
      <div>
        <button onClick={() => setShowStats(v => !v)} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "none", border: "none", padding: "0", cursor: "pointer", marginBottom: showStats ? "0.75rem" : "0" }}>
          <p style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--dim)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Quick stats</p>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: showStats ? "rotate(180deg)" : "none", transition: "transform 200ms", color: "var(--dim)" }} aria-hidden>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {showStats && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
            <div onClick={() => document.getElementById("crm-application")?.scrollIntoView({ behavior: "smooth" })}
              style={{ padding: "0.625rem 0.75rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "8px", cursor: "pointer" }}>
              <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Application</p>
              <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: applicationData ? "var(--ink)" : "var(--dim)", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>{applicationData ? "View ↓" : "None"}</p>
            </div>
            <div onClick={() => document.getElementById("crm-trackers")?.scrollIntoView({ behavior: "smooth" })}
              style={{ padding: "0.625rem 0.75rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "8px", cursor: "pointer" }}>
              <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Streak</p>
              <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>{client.streak > 0 ? `${client.streak >= 7 ? "🔥" : "⚡"} ${client.streak} days` : "0 days"}</p>
            </div>
            <div onClick={() => document.getElementById("crm-protocol")?.scrollIntoView({ behavior: "smooth" })}
              style={{ padding: "0.625rem 0.75rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "8px", cursor: "pointer" }}>
              <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Protocol</p>
              <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>{client.diagnosticData?.protocolStatus === "building" ? "Active" : client.diagnosticData?.protocolStatus || "—"}</p>
            </div>
            <div style={{ padding: "0.625rem 0.75rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "8px" }}>
              <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Monthly</p>
              <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: client.diagnosticData?.monthlyRate ? "var(--ink)" : "var(--dim)", fontFamily: "var(--font-mono), monospace" }}>
                {client.diagnosticData?.monthlyRate ? `$${client.diagnosticData.monthlyRate}` : "—"}
              </p>
            </div>
            <div style={{ padding: "0.625rem 0.75rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "8px" }}>
              <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Referrals</p>
              <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>{referralCount} / 3</p>
            </div>
          </div>
        )}
      </div>


      {/* Application answers */}
      <div id="crm-application">
        {sectionLabel('Application')}
        {!applicationData ? (
          <p style={{ fontSize: "0.8125rem", color: "var(--dim)", fontWeight: 300, fontStyle: "italic" }}>No application on file.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {[
              { label: "Full name", value: applicationData.full_name },
              { label: "Gender", value: applicationData.gender },
              { label: "Age", value: applicationData.age },
              { label: "Goals", value: Array.isArray(applicationData.current_state_goals) ? (applicationData.current_state_goals as string[]).join(", ") : applicationData.current_state_goals },
              { label: "Other goal", value: applicationData.other_goal },
              { label: "Most important goal", value: applicationData.most_important_goal },
              { label: "Current weight", value: applicationData.current_weight },
              { label: "Height", value: applicationData.height },
              { label: "Body fat %", value: applicationData.body_fat_current },
              { label: "Body fat goal", value: applicationData.body_fat_goal },
              { label: "How long at current BF%", value: applicationData.body_fat_duration },
              { label: "Symptom duration", value: applicationData.symptom_duration },
              { label: "Bloodwork status", value: applicationData.bloodwork_status },
              { label: "Testosterone level", value: applicationData.testosterone_level },
              { label: "Last labs date", value: applicationData.last_labs_date },
              { label: "Previous attempts", value: Array.isArray(applicationData.previous_attempts) ? (applicationData.previous_attempts as string[]).join(", ") : applicationData.previous_attempts },
              { label: "Supplements used", value: applicationData.supplements_used },
              { label: "What they've tried", value: applicationData.what_tried },
              { label: "How long stuck", value: applicationData.how_long_stuck },
              { label: "Why it stopped working", value: applicationData.why_stopped_working },
              { label: "Why still looking", value: applicationData.why_still_looking },
              { label: "Hours per week available", value: applicationData.hours_per_week },
              { label: "Current training program", value: applicationData.current_training_program },
              { label: "Medical conditions", value: applicationData.medical_conditions },
              { label: "Stress & sleep situation", value: applicationData.stress_sleep_situation },
              { label: "Consequences of not fixing this", value: applicationData.consequences },
              { label: "Life if solved", value: applicationData.life_solved },
              { label: "How found THP", value: applicationData.how_found_us },
              { label: "Commitment level", value: applicationData.commitment_level ? `${applicationData.commitment_level}/10` : null },
              { label: "Investment range", value: applicationData.investment_range },
              { label: "Was referred", value: applicationData.was_referred },
              { label: "Referred by", value: applicationData.referred_by },
              { label: "Phone", value: applicationData.phone },
              { label: "Instagram", value: applicationData.instagram },
            ].filter(f => f.value && f.value !== "" && f.value !== "0").map(f => (
              <div key={f.label} style={{ display: "flex", flexDirection: "column", gap: "0.2rem", padding: "0.5rem 0.75rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "8px" }}>
                <p style={{ fontSize: "0.65rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>{f.label}</p>
                <p style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300, lineHeight: 1.5 }}>{String(f.value)}</p>
              </div>
            ))}
            {Array.isArray(applicationData.symptom_severities) && (applicationData.symptom_severities as { symptom: string; severity: number }[]).length > 0 && (
              <div style={{ padding: "0.5rem 0.75rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "8px" }}>
                <p style={{ fontSize: "0.65rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.375rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Symptom severities</p>
                {(applicationData.symptom_severities as { symptom: string; severity: number }[]).map(s => (
                  <p key={s.symptom} style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300, lineHeight: 1.6 }}>{s.symptom}: <span style={{ color: s.severity >= 8 ? "var(--danger)" : s.severity >= 5 ? "oklch(0.75 0.14 65)" : "var(--dim)", fontWeight: 500 }}>{s.severity}/10</span></p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tracker history — always visible */}
      <div id="crm-trackers">
        {sectionLabel('Recent trackers')}
        {trackers.length === 0 ? (
          <p style={{ fontSize: "0.8125rem", color: "var(--dim)", fontWeight: 300, fontStyle: "italic" }}>No trackers submitted yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {(showAllTrackers ? trackers : trackers.slice(0, 3)).map(t => (
              <div key={t.date as string}>
                <button onClick={() => setExpandedTracker(expandedTracker === t.date as string ? null : t.date as string)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.625rem 0.875rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "8px", cursor: "pointer", textAlign: "left", transition: "border-color 150ms", fontFamily: "var(--font-ui), system-ui, sans-serif" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border-subtle)"}>
                  <span style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 400 }}>{t.date as string}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--dim)" }}>{expandedTracker === t.date as string ? '▲' : '▼'}</span>
                </button>
                {expandedTracker === t.date as string && (() => {
                  const dayAnalysis = analysisMap[t.date as string];
                  const SECTION_LABELS = ["Today's tracker", "Last 5 sessions", "Diagnosis connection"];
                  return (
                    <div style={{ border: "1px solid var(--border-subtle)", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
                      {/* Tracker raw data */}
                      <div style={{ padding: "0.875rem", background: "var(--surface)", fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300, lineHeight: 1.7, fontFamily: "var(--font-mono), monospace", borderBottom: dayAnalysis ? "1px solid var(--border-subtle)" : "none" }}>
                        {(['circadian','training','nutrition','vitals','psychological','business'] as const).map(sec => {
                          const data = t[sec] as Record<string,unknown> | undefined;
                          if (!data || Object.keys(data).length === 0) return null;
                          return (
                            <div key={sec} style={{ marginBottom: "0.625rem" }}>
                              <span style={{ color: "var(--primary)", fontWeight: 600, textTransform: "uppercase", fontSize: "0.65rem", letterSpacing: "0.08em" }}>{sec}</span>
                              <div style={{ marginTop: "0.25rem" }}>
                                {Object.entries(data).map(([k, v]) => (
                                  <div key={k}><span style={{ color: "var(--dim)" }}>{k}:</span> {String(v)}</div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* AI speaking notes — inline per tracker */}
                      {dayAnalysis ? (
                        <div style={{ padding: "0.875rem", background: "oklch(0.08 0.01 0)" }}>
                          <p style={{ fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.12em", color: "var(--primary)", textTransform: "uppercase", marginBottom: "0.75rem", fontFamily: "var(--font-mono), monospace" }}>Speaking notes</p>
                          {dayAnalysis.talking_points.map((section, i) => section ? (
                            <div key={i} style={{ marginBottom: i < 2 ? "0.875rem" : 0 }}>
                              <p style={{ fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.08em", color: "var(--dim)", textTransform: "uppercase", marginBottom: "0.25rem", fontFamily: "var(--font-mono), monospace" }}>{SECTION_LABELS[i] ?? `Section ${i + 1}`}</p>
                              <p style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300, lineHeight: 1.6 }}>{section}</p>
                            </div>
                          ) : null)}
                          {dayAnalysis.flags?.length > 0 && (
                            <div style={{ marginTop: "0.75rem", padding: "0.625rem 0.75rem", background: "oklch(0.65 0.14 65 / 0.08)", border: "1px solid oklch(0.65 0.14 65 / 0.2)", borderRadius: "7px" }}>
                              <p style={{ fontSize: "0.6rem", fontWeight: 600, color: "oklch(0.75 0.12 65)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.375rem" }}>Flags</p>
                              {dayAnalysis.flags.map((f, i) => (
                                <p key={i} style={{ fontSize: "0.8125rem", color: "oklch(0.75 0.12 65)", fontWeight: 300, lineHeight: 1.5, marginBottom: i < dayAnalysis.flags.length - 1 ? "0.2rem" : 0 }}>⚠ {f}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ padding: "0.75rem 0.875rem", background: "oklch(0.08 0.01 0)" }}>
                          <p style={{ fontSize: "0.8125rem", color: "var(--dim)", fontWeight: 300, fontStyle: "italic" }}>No AI analysis for this date yet.</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
            {trackers.length > 3 && (
              <button
                onClick={() => setShowAllTrackers(v => !v)}
                style={{ marginTop: "0.25rem", background: "none", border: "1px solid var(--border-subtle)", borderRadius: "7px", padding: "0.5rem 0.875rem", fontSize: "0.75rem", color: "var(--dim)", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "border-color 150ms" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border-subtle)"}
              >
                {showAllTrackers ? "▲ Show less" : `▼ Show ${trackers.length - 3} more`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Payments */}
      <div style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", color: "var(--dim)", textTransform: "uppercase", marginBottom: "0.75rem", fontFamily: "var(--font-mono), monospace" }}>Payments</p>

        {/* Recorded payments */}
        {(userData?.deposit_paid != null || userData?.last_monthly_paid) && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "0.875rem", padding: "0.75rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "8px" }}>
            {userData?.deposit_paid != null && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Deposit paid</span>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "oklch(0.65 0.15 145)" }}>${userData.deposit_paid} ✓</span>
              </div>
            )}
            {userData?.last_monthly_paid && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Last monthly</span>
                <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "oklch(0.65 0.15 145)" }}>
                  ${userData.last_monthly_amount ?? "?"} · {new Date(userData.last_monthly_paid + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </div>
            )}
            {userData?.agreed_monthly && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Monthly rate</span>
                <span style={{ fontSize: "0.8125rem", color: "var(--ink)" }}>${userData.agreed_monthly}/mo</span>
              </div>
            )}
          </div>
        )}

        {/* Send payment link */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {/* Type toggle */}
          <div style={{ display: "flex", gap: "0.25rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "7px", padding: "3px", alignSelf: "flex-start" }}>
            {(['deposit', 'monthly'] as const).map(t => (
              <button key={t} onClick={() => { setPayLinkType(t); setPayLinkUrl(null); setPayLinkError(""); }}
                style={{ height: "26px", padding: "0 0.75rem", borderRadius: "5px", border: "none", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "all 150ms",
                  background: payLinkType === t ? "var(--primary)" : "transparent",
                  color: payLinkType === t ? "#fff" : "var(--dim)" }}>
                {t === 'deposit' ? 'Deposit' : 'Monthly'}
              </button>
            ))}
          </div>

          {/* Amount + generate */}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--dim)", flexShrink: 0 }}>$</span>
            <input
              value={payLinkAmount}
              onChange={e => { setPayLinkAmount(e.target.value); setPayLinkUrl(null); setPayLinkError(""); }}
              placeholder="Amount"
              type="number"
              style={{ flex: 1, height: "36px", padding: "0 0.625rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "7px", color: "var(--ink)", fontSize: "0.875rem", fontFamily: "var(--font-mono), monospace", outline: "none" }}
            />
            <button
              disabled={payLinkLoading || !payLinkAmount || Number(payLinkAmount) < 1}
              onClick={async () => {
                setPayLinkLoading(true); setPayLinkError(""); setPayLinkUrl(null);
                try {
                  const res = await fetch('/api/stripe/create-checkout', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: client.email, adminPw: ADMIN_PASSWORD, amount: Number(payLinkAmount), paymentType: payLinkType }),
                  }).then(r => r.json());
                  if (res.url) { setPayLinkUrl(res.url); } else { setPayLinkError(res.error ?? "Failed"); }
                } catch { setPayLinkError("Network error"); }
                setPayLinkLoading(false);
              }}
              style={{ height: "36px", padding: "0 0.875rem", background: (payLinkLoading || !payLinkAmount || Number(payLinkAmount) < 1) ? "var(--surface)" : "var(--primary)", color: (payLinkLoading || !payLinkAmount || Number(payLinkAmount) < 1) ? "var(--dim)" : "#fff", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "0.8125rem", fontWeight: 500, cursor: (payLinkLoading || !payLinkAmount || Number(payLinkAmount) < 1) ? "not-allowed" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", flexShrink: 0, transition: "all 150ms" }}>
              {payLinkLoading ? "…" : "Generate link"}
            </button>
          </div>

          {payLinkError && <p style={{ fontSize: "0.75rem", color: "var(--primary)" }}>{payLinkError}</p>}

          {payLinkUrl && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input readOnly value={payLinkUrl}
                style={{ flex: 1, height: "34px", padding: "0 0.625rem", background: "var(--surface)", border: "1px solid oklch(0.65 0.15 145 / 0.4)", borderRadius: "7px", color: "var(--dim)", fontSize: "0.7rem", fontFamily: "var(--font-mono), monospace", outline: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} />
              <button onClick={() => { navigator.clipboard.writeText(payLinkUrl!).then(() => { setPayLinkCopied(true); setTimeout(() => setPayLinkCopied(false), 2000); }); }}
                style={{ height: "34px", padding: "0 0.75rem", background: payLinkCopied ? "oklch(0.65 0.15 145 / 0.25)" : "oklch(0.65 0.15 145 / 0.12)", border: `1px solid ${payLinkCopied ? "oklch(0.65 0.15 145 / 0.6)" : "oklch(0.65 0.15 145 / 0.3)"}`, borderRadius: "7px", color: "oklch(0.7 0.15 145)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", flexShrink: 0, transition: "all 150ms" }}>
                {payLinkCopied ? "Copied ✓" : "Copy"}
              </button>
            </div>
          )}
        </div>
      </div>


      {/* Blood work — chart with marker dropdown */}
      {(() => {
        const bwLatest = bloodWorkEntries[0] ?? null;
        return (
          <div>
            {sectionLabel(bwLatest?.test_date ? `Blood Work · ${bwLatest.test_date}` : 'Blood Work')}
            <div style={{ padding: "1rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <p style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.1em", color: "var(--dim)", textTransform: "uppercase", fontFamily: "var(--font-mono), monospace" }}>Trends</p>
                <select value={selectedMarker} onChange={e => setSelectedMarker(e.target.value)}
                  style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--muted)", fontSize: "0.75rem", padding: "0.25rem 0.5rem", fontFamily: "var(--font-mono), monospace", cursor: "pointer" }}>
                  {Object.entries(MARKER_DEFAULTS).map(([key, def]) => (
                    <option key={key} value={key}>{def.label} ({def.unit})</option>
                  ))}
                </select>
              </div>
              {(() => {
                const chartData = [...bloodWorkEntries]
                  .reverse()
                  .map(e => ({
                    date: e.test_date ?? new Date(e.uploaded_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
                    val: e.markers?.[selectedMarker]?.value ?? null,
                  }))
                  .filter((p): p is { date: string; val: number } => p.val !== null);
                const def = MARKER_DEFAULTS[selectedMarker];
                if (chartData.length === 0) {
                  return (
                    <div style={{ height: "180px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", borderRadius: "6px", border: "1px dashed var(--border-subtle)" }}>
                      <p style={{ fontSize: "0.8125rem", color: "var(--dim)", fontWeight: 300 }}>No blood work uploaded yet.</p>
                    </div>
                  );
                }
                return (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--dim)", fontFamily: "var(--font-mono), monospace" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--dim)", fontFamily: "var(--font-mono), monospace" }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip contentStyle={{ background: "#111", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "0.75rem", fontFamily: "var(--font-mono), monospace", color: "#fff" }} formatter={(value) => [`${value} ${def.unit}`, def.label]} />
                      <Line type="monotone" dataKey="val" stroke="#c8102e" strokeWidth={2} dot={{ fill: "#c8102e", r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* Private notes */}
      <div>
        {sectionLabel(`Private notes${notesSaving ? ' · saving…' : ''}`)}
        <textarea value={notes}
          onChange={e => { setNotes(e.target.value); saveNotes(e.target.value); }} rows={4}
          placeholder={`Notes about ${firstName} — only you see this`}
          style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "0.75rem 0.875rem", fontSize: "0.875rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", fontWeight: 300, outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" }}
          onFocus={e => e.target.style.borderColor = 'var(--primary)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'} />
      </div>

      {/* Activity */}
      {userData && (
        <div style={{ padding: "0.75rem 1rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "9px" }}>
          <p style={{ fontSize: "0.65rem", color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.375rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Activity</p>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {userData.last_login && <p style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300 }}>Last login: {new Date(userData.last_login).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>}
            {userData.last_tracker_date && <p style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 300 }}>Last tracker: {userData.last_tracker_date}</p>}
          </div>
        </div>
      )}

      {/* ── ACTIONS SECTION ── */}
      <div style={{ paddingTop: "1.5rem", borderTop: "1px solid var(--border)" }}>
        {sectionLabel('Actions')}

        {/* Diagnosis */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", paddingTop: "1rem", borderTop: "1px solid var(--border)", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Diagnosis</p>
            <button onClick={handleGenerateDiagnosis} disabled={diagGenerating}
              style={{ height: "28px", padding: "0 0.75rem", background: diagGenerating ? "var(--surface-2)" : "oklch(0.55 0.18 30 / 0.15)", border: "1px solid oklch(0.55 0.18 30 / 0.4)", borderRadius: "6px", color: diagGenerating ? "var(--dim)" : "oklch(0.75 0.18 30)", fontSize: "0.7rem", fontWeight: 600, cursor: diagGenerating ? "default" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
              {diagGenerating ? "Generating…" : "+ Generate with AI"}
            </button>
          </div>
          {diagGenError && <p style={{ fontSize: "0.75rem", color: "var(--primary)" }}>{diagGenError}</p>}
          {adminDiagnostics.filter(d =>
            // Only show real diagnostics — filter out generate-protocol artifacts
            // Records whose only section is "What Is Actually Happening" are now stored in Protocol
            d.content?.sections?.some((s: { heading: string }) =>
              ['WHERE YOU ARE RIGHT NOW', 'ROOT PROBLEM', 'WHY IT IS HAPPENING', 'WHY PREVIOUS ATTEMPTS FAILED']
                .includes(s.heading.toUpperCase())
            )
          ).length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--dim)", fontWeight: 300 }}>No diagnosis yet.</p>
          ) : adminDiagnostics.filter(d =>
            d.content?.sections?.some((s: { heading: string }) =>
              ['WHERE YOU ARE RIGHT NOW', 'ROOT PROBLEM', 'WHY IT IS HAPPENING', 'WHY PREVIOUS ATTEMPTS FAILED']
                .includes(s.heading.toUpperCase())
            )
          ).map(diag => {
            const diagLabel = `Diagnosis Stage ${diag.stage}`;
            return (
            <div key={diag.id} style={{ background: "var(--surface)", border: `1px solid ${diag.published ? "oklch(0.7 0.15 145 / 0.3)" : "oklch(0.75 0.15 80 / 0.3)"}`, borderRadius: "8px", padding: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                <p style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--ink)" }}>{diagLabel}</p>
                <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
<span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "2px 7px", borderRadius: "4px", background: diag.published ? "oklch(0.7 0.15 145 / 0.12)" : "oklch(0.75 0.15 80 / 0.12)", color: diag.published ? "oklch(0.7 0.15 145)" : "oklch(0.75 0.15 80)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{diag.published ? "Sent" : "Draft"}</span>
                </div>
              </div>
              {diag.content?.sections.map(s => (
                <details key={s.heading} style={{ marginBottom: "0.25rem" }}>
                  <summary style={{ fontSize: "0.75rem", color: "var(--muted)", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", userSelect: "none" }}>{s.heading}</summary>
                  <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300, lineHeight: 1.6, marginTop: "0.375rem", whiteSpace: "pre-wrap" }}>{s.text}</p>
                </details>
              ))}
              {/* Speaking notes — THP only, never shown to client */}
              {diag.content?.speaking_notes && (
                <details style={{ marginTop: "0.5rem", borderTop: "1px solid oklch(0.65 0.14 65 / 0.2)", paddingTop: "0.5rem" }}>
                  <summary style={{ fontSize: "0.7rem", color: "oklch(0.75 0.14 65)", cursor: "pointer", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-ui), system-ui, sans-serif", userSelect: "none" }}>Speaking Notes (THP only)</summary>
                  <div style={{ marginTop: "0.375rem", fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300, lineHeight: 1.6 }}>
                    {!!diag.content.speaking_notes.phase1_summary && <p style={{ marginBottom: "0.5rem" }}><strong style={{ color: "var(--muted)" }}>Phase 1:</strong> {String(diag.content.speaking_notes.phase1_summary)}</p>}
                    {Array.isArray(diag.content.speaking_notes.held_back) && diag.content.speaking_notes.held_back.length > 0 && (
                      <div style={{ marginBottom: "0.5rem" }}><strong style={{ color: "var(--muted)" }}>Held back:</strong>{(diag.content.speaking_notes.held_back as unknown[]).map((item, i) => <p key={i} style={{ marginLeft: "0.75rem", marginTop: "0.125rem" }}>· {String(item)}</p>)}</div>
                    )}
                    {!!diag.content.speaking_notes.next_session_hooks && <p style={{ marginBottom: "0.5rem" }}><strong style={{ color: "var(--muted)" }}>First call hooks:</strong> {String(diag.content.speaking_notes.next_session_hooks)}</p>}
                    {!!diag.content.speaking_notes.red_flags && <p><strong style={{ color: "var(--primary)" }}>Red flags:</strong> {String(diag.content.speaking_notes.red_flags)}</p>}
                  </div>
                </details>
              )}
            </div>
            );
          })}
        </div>

        {/* Protocol — view draft + send to client */}
        <div id="crm-protocol" style={{ display: "flex", flexDirection: "column", gap: "0.625rem", paddingTop: "1rem", borderTop: "1px solid var(--border)", marginBottom: "1.25rem" }}>
          <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Protocol</p>
          {clientProtocols.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--dim)", fontWeight: 300 }}>No protocol yet — auto-generates after diagnosis.</p>
          ) : clientProtocols.map(proto => (
            <div key={proto.id} style={{ background: "var(--surface)", border: `1px solid ${proto.published ? "oklch(0.7 0.15 145 / 0.3)" : "oklch(0.60 0.18 165 / 0.3)"}`, borderRadius: "8px", padding: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                <p style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--ink)" }}>Protocol Stage {proto.stage}{proto.title?.includes('PDF Import') ? ' — PDF Import' : ''}</p>
                <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "2px 7px", borderRadius: "4px", background: proto.published ? "oklch(0.7 0.15 145 / 0.12)" : "oklch(0.60 0.18 165 / 0.12)", color: proto.published ? "oklch(0.7 0.15 145)" : "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {proto.published ? "Sent to client" : "Draft — not sent"}
                </span>
              </div>
              {proto.content?.sections?.filter(s => s.heading.toUpperCase() !== 'WHAT IS ACTUALLY HAPPENING').map(s => (
                <details key={s.heading} style={{ marginBottom: "0.25rem" }}>
                  <summary style={{ fontSize: "0.75rem", color: "var(--muted)", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", userSelect: "none" }}>{s.heading}</summary>
                  <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300, lineHeight: 1.6, marginTop: "0.375rem", whiteSpace: "pre-wrap" }}>{s.text}</p>
                </details>
              ))}
              {!proto.published && (
                <button
                  onClick={async () => {
                    setSendingProtocolId(proto.id);
                    await fetch('/api/protocol-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ protocolId: proto.id }) });
                    setClientProtocols(prev => prev.map(p => p.id === proto.id ? { ...p, published: true } : p));
                    setSendingProtocolId(null);
                  }}
                  disabled={sendingProtocolId === proto.id}
                  style={{ marginTop: "0.625rem", width: "100%", height: "36px", background: sendingProtocolId === proto.id ? "var(--surface-2)" : "var(--primary)", border: "none", borderRadius: "7px", color: sendingProtocolId === proto.id ? "var(--dim)" : "#fff", fontSize: "0.8125rem", fontWeight: 600, cursor: sendingProtocolId === proto.id ? "default" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", transition: "background 150ms" }}>
                  {sendingProtocolId === proto.id ? "Sending…" : "Send protocol to client →"}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Tracker section */}
        {clientProtocols.length > 0 && (
          <div style={{ paddingTop: "1rem", borderTop: "1px solid var(--border)", marginBottom: "1.25rem" }}>
            <TrackerSection
              protocols={clientProtocols}
              summary={trackerSummary}
              loading={trackerLoading}
              regenerating={regeneratingQuestions}
              onLoadSummary={loadTrackerSummary}
              onRegenerateQuestions={handleRegenerateQuestions}
              onGenerateNextStage={async () => {
                await loadTrackerSummary();
                setGenerating(true); setGenError("");
                try {
                  const res = await fetch("/api/generate-protocol", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientEmail: client.email, clientName: client.name, diagnosticData: client.diagnosticData ?? null, trackerSummary }) });
                  const data = await res.json();
                  if (!res.ok || data.error) throw new Error(data.error || "Generation failed");
                  onProtocolGenerated(data.notionPageId);
                  getAdminProtocols(client.email).then(setClientProtocols).catch(() => {});
                } catch (err) { setGenError(err instanceof Error ? err.message : "Unknown error"); }
                setGenerating(false);
              }}
            />
          </div>
        )}

      </div>

      {/* ── FULL INTAKE ACCORDION ── */}
      {client.diagnosticData && (
        <div style={{ paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
          <button onClick={onToggleDiagnostic}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", padding: "0.125rem 0 0.5rem", cursor: "pointer" }}>
            <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>View Full Intake</p>
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

      {/* ── ACCOUNT CONTROLS (always last) ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)" }}>
        <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.125rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Account</p>
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
          {client.status !== "active" && (
            <button onClick={() => onSetStatus("active")} style={{ height: "28px", padding: "0 0.75rem", background: "oklch(0.45 0.15 145 / 0.08)", border: "1px solid oklch(0.45 0.15 145 / 0.2)", borderRadius: "6px", color: "oklch(0.7 0.15 145)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Mark active</button>
          )}
          {client.status === "active" && (
            <button onClick={() => onSetStatus("alumni")} style={{ height: "28px", padding: "0 0.75rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--dim)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Mark inactive</button>
          )}
          <button onClick={onRemoveClient} style={{ height: "28px", padding: "0 0.75rem", background: "oklch(0.55 0.18 25 / 0.08)", border: "1px solid oklch(0.55 0.18 25 / 0.25)", borderRadius: "6px", color: "oklch(0.68 0.18 25)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Remove client</button>
        </div>
        {referralCount >= 3 && (
          <button onClick={applyFreeMonth} disabled={applyingFreeMonth || !!client.diagnosticData?.freeMonthEarned}
            style={{ marginTop: "0.25rem", height: "32px", padding: "0 0.875rem", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", opacity: client.diagnosticData?.freeMonthEarned ? 0.5 : 1, width: "fit-content" }}>
            {client.diagnosticData?.freeMonthEarned ? 'Free Month Applied' : 'Apply Free Month'}
          </button>
        )}
        {pendingReferrals.length > 0 && (
          <div style={{ marginTop: "0.75rem" }}>
            <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-ui), system-ui, sans-serif", marginBottom: "0.375rem" }}>Pending referrals</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {pendingReferrals.map(r => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.75rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "6px" }}>
                  <span style={{ fontSize: "0.8125rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>{r.referred_email}</span>
                  <button onClick={() => markReferralPaid(r.id)} disabled={markingReferral === r.id}
                    style={{ height: "24px", padding: "0 0.625rem", background: "oklch(0.45 0.15 145 / 0.08)", border: "1px solid oklch(0.45 0.15 145 / 0.2)", borderRadius: "5px", color: "oklch(0.7 0.15 145)", fontSize: "0.7rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", opacity: markingReferral === r.id ? 0.5 : 1 }}>
                    {markingReferral === r.id ? '...' : 'Mark paid'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// ─── TOOLS PANEL ─────────────────────────────────────────────────────────────

function ToolsPanel({ clients, onClientCreated }: { clients: StoredUser[]; onClientCreated: () => void }) {
  const ADMIN_PW = ADMIN_PASSWORD;

  // Tool 1 — Create Client
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createTelegram, setCreateTelegram] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Tool 2 — Send Payment Link
  const [toolsClientEmail, setToolsClientEmail] = useState("");
  const [toolsPayType, setToolsPayType] = useState<"deposit" | "monthly">("deposit");
  const [toolsAmount, setToolsAmount] = useState("");
  const [toolsPayUrl, setToolsPayUrl] = useState<string | null>(null);
  const [toolsPayCopied, setToolsPayCopied] = useState(false);
  const [toolsPayLoading, setToolsPayLoading] = useState(false);
  const [toolsPayError, setToolsPayError] = useState("");

  // Tool 3 — Generate Extra Protocol
  const [protoClientEmail, setProtoClientEmail] = useState("");
  const [protoNote, setProtoNote] = useState("");
  const [protoGenerating, setProtoGenerating] = useState(false);
  const [protoResult, setProtoResult] = useState<"done" | "error" | null>(null);

  const activeClients = clients.filter(c => c.status === 'active' || c.status === 'pending');

  async function handleCreateClient() {
    if (!createName.trim() || !createEmail.trim()) return;
    setCreating(true);
    setCreateError("");
    setInviteUrl(null);
    // Create account with random password (client will set their own via invite)
    const randomPw = Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 6);
    const result = await createClient(createName.trim(), createEmail.trim(), randomPw);
    if (!result.success) {
      setCreateError(result.error ?? "Failed to create client.");
      setCreating(false);
      return;
    }
    // Generate invite link
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
        body: JSON.stringify({ email: createEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.url) setInviteUrl(data.url);
    } catch { /* ignore */ }
    await onClientCreated();
    setCreating(false);
  }

  async function handleSendPaymentLink() {
    if (!toolsClientEmail || !toolsAmount || Number(toolsAmount) < 1) return;
    setToolsPayLoading(true);
    setToolsPayError("");
    setToolsPayUrl(null);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: toolsClientEmail, adminPw: ADMIN_PW, amount: Number(toolsAmount), paymentType: toolsPayType }),
      });
      const data = await res.json();
      if (data.url) { setToolsPayUrl(data.url); } else { setToolsPayError(data.error ?? "Failed to create link"); }
    } catch { setToolsPayError("Network error. Try again."); }
    setToolsPayLoading(false);
  }

  async function handleGenerateExtraProtocol() {
    if (!protoClientEmail) return;
    const clientData = clients.find(c => c.email === protoClientEmail);
    if (!clientData) return;
    setProtoGenerating(true);
    setProtoResult(null);
    try {
      const res = await fetch("/api/generate-protocol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: clientData.email,
          clientName: clientData.name,
          diagnosticData: clientData.diagnosticData ?? null,
          customNote: protoNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed");
      setProtoResult("done");
    } catch { setProtoResult("error"); }
    setProtoGenerating(false);
  }

  const toolCard = (title: string, note: string, children: React.ReactNode) => (
    <div style={{ padding: "1.5rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--ink)", marginBottom: "0.25rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>{title}</p>
        <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300, fontFamily: "var(--font-ui), system-ui, sans-serif" }}>{note}</p>
      </div>
      {children}
    </div>
  );

  const fieldInput = (label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label style={{ display: "block", fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.375rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>{label}</label>
      <input {...props} style={{ width: "100%", height: "36px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "7px", padding: "0 0.75rem", fontSize: "0.875rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", outline: "none", boxSizing: "border-box", ...props.style }}
        onFocus={e => (e.target.style.borderColor = "var(--primary)")} onBlur={e => (e.target.style.borderColor = "var(--border)")} />
    </div>
  );

  return (
    <div style={{ maxWidth: "540px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <p style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Tools</p>
      </div>

      {/* Tool 1: Create Client */}
      {toolCard("Create Client", "Creates an account with a random password. Client sets their own password via the invite link.", (
        <>
          {fieldInput("Full name", { type: "text", value: createName, onChange: e => setCreateName(e.target.value), placeholder: "Tom Bradley" })}
          {fieldInput("Email", { type: "email", value: createEmail, onChange: e => setCreateEmail(e.target.value), placeholder: "tom@email.com" })}
          <div>
            <label style={{ display: "block", fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.375rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Telegram username</label>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <span style={{ fontSize: "0.875rem", color: "var(--dim)", flexShrink: 0 }}>@</span>
              <input type="text" value={createTelegram} onChange={e => setCreateTelegram(e.target.value)} placeholder="username"
                style={{ flex: 1, height: "36px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "7px", padding: "0 0.75rem", fontSize: "0.875rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", outline: "none" }}
                onFocus={e => (e.target.style.borderColor = "var(--primary)")} onBlur={e => (e.target.style.borderColor = "var(--border)")} />
            </div>
          </div>
          {createError && <p style={{ fontSize: "0.75rem", color: "var(--danger)", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>{createError}</p>}
          {inviteUrl ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <p style={{ fontSize: "0.75rem", color: "oklch(0.7 0.15 145)", fontWeight: 400, fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Account created. Send this invite link to {createName || "the client"}:</p>
              <div style={{ display: "flex", gap: "0.375rem" }}>
                <input readOnly value={inviteUrl} style={{ flex: 1, height: "34px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "7px", padding: "0 0.625rem", fontSize: "0.75rem", color: "var(--dim)", fontFamily: "var(--font-mono), monospace", outline: "none" }} />
                <button onClick={() => { navigator.clipboard.writeText(inviteUrl).then(() => { setInviteCopied(true); setTimeout(() => setInviteCopied(false), 2000); }); }}
                  style={{ height: "34px", padding: "0 0.75rem", background: inviteCopied ? "oklch(0.60 0.18 165 / 0.12)" : "var(--surface)", border: "1px solid var(--border)", borderRadius: "7px", color: inviteCopied ? "var(--primary)" : "var(--muted)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {inviteCopied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Client will set their own password via the invite link.</p>
              <button onClick={() => { setCreateName(""); setCreateEmail(""); setCreateTelegram(""); setInviteUrl(null); setCreateError(""); }}
                style={{ height: "32px", background: "none", border: "1px solid var(--border-subtle)", borderRadius: "7px", color: "var(--dim)", fontSize: "0.8125rem", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                Create another
              </button>
            </div>
          ) : (
            <button onClick={handleCreateClient} disabled={creating || !createName.trim() || !createEmail.trim()}
              style={{ height: "38px", background: (creating || !createName.trim() || !createEmail.trim()) ? "var(--surface-2)" : "var(--primary)", border: "none", borderRadius: "8px", color: (creating || !createName.trim() || !createEmail.trim()) ? "var(--dim)" : "#ffffff", fontSize: "0.875rem", fontWeight: 500, cursor: (creating || !createName.trim() || !createEmail.trim()) ? "default" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
              {creating ? "Creating…" : "Create account + generate invite link"}
            </button>
          )}
        </>
      ))}

      {/* Tool 2: Send Payment Link */}
      {toolCard("Send Payment Link", "Generate a Stripe checkout link for any active client.", (
        <>
          <div>
            <label style={{ display: "block", fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.375rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Client</label>
            <select value={toolsClientEmail} onChange={e => { setToolsClientEmail(e.target.value); setToolsPayUrl(null); setToolsPayError(""); }}
              style={{ width: "100%", height: "36px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "7px", padding: "0 0.75rem", fontSize: "0.875rem", color: toolsClientEmail ? "var(--ink)" : "var(--dim)", fontFamily: "var(--font-ui), system-ui, sans-serif", outline: "none" }}>
              <option value="">Select client…</option>
              {activeClients.map(c => <option key={c.email} value={c.email}>{c.name} · {c.email}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.375rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Type</label>
            <div style={{ display: "flex", gap: "0.375rem" }}>
              {(["deposit", "monthly"] as const).map(t => (
                <button key={t} onClick={() => setToolsPayType(t)}
                  style={{ flex: 1, height: "32px", borderRadius: "6px", border: "1px solid", borderColor: toolsPayType === t ? "var(--primary)" : "var(--border)", background: toolsPayType === t ? "oklch(0.60 0.18 165 / 0.1)" : "none", color: toolsPayType === t ? "var(--primary)" : "var(--dim)", fontSize: "0.8125rem", fontWeight: toolsPayType === t ? 600 : 400, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                  {t === "deposit" ? "Deposit" : "Monthly"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.375rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Amount</label>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <span style={{ fontSize: "0.875rem", color: "var(--dim)", flexShrink: 0 }}>$</span>
              <input type="number" min="1" value={toolsAmount} onChange={e => setToolsAmount(e.target.value)} placeholder="2000"
                style={{ flex: 1, height: "36px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "7px", padding: "0 0.75rem", fontSize: "0.875rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", outline: "none" }}
                onFocus={e => (e.target.style.borderColor = "var(--primary)")} onBlur={e => (e.target.style.borderColor = "var(--border)")} />
            </div>
          </div>
          {toolsPayError && <p style={{ fontSize: "0.75rem", color: "var(--danger)", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>{toolsPayError}</p>}
          {toolsPayUrl ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <p style={{ fontSize: "0.75rem", color: "oklch(0.7 0.15 145)", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>${toolsAmount} checkout link ready</p>
              <div style={{ display: "flex", gap: "0.375rem" }}>
                <input readOnly value={toolsPayUrl} style={{ flex: 1, height: "34px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "7px", padding: "0 0.625rem", fontSize: "0.75rem", color: "var(--dim)", fontFamily: "var(--font-mono), monospace", outline: "none" }} />
                <button onClick={() => { navigator.clipboard.writeText(toolsPayUrl!).then(() => { setToolsPayCopied(true); setTimeout(() => setToolsPayCopied(false), 2000); }); }}
                  style={{ height: "34px", padding: "0 0.75rem", background: toolsPayCopied ? "oklch(0.60 0.18 165 / 0.12)" : "var(--surface)", border: "1px solid var(--border)", borderRadius: "7px", color: toolsPayCopied ? "var(--primary)" : "var(--muted)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", whiteSpace: "nowrap" }}>
                  {toolsPayCopied ? "Copied!" : "Copy"}
                </button>
              </div>
              <button onClick={() => { setToolsPayUrl(null); setToolsPayCopied(false); }} style={{ height: "28px", background: "none", border: "none", color: "var(--dim)", fontSize: "0.75rem", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", textAlign: "left" }}>
                ← Generate different amount
              </button>
            </div>
          ) : (
            <button onClick={handleSendPaymentLink} disabled={toolsPayLoading || !toolsClientEmail || !toolsAmount || Number(toolsAmount) < 1}
              style={{ height: "38px", background: (toolsPayLoading || !toolsClientEmail || !toolsAmount || Number(toolsAmount) < 1) ? "var(--surface-2)" : "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", color: (toolsPayLoading || !toolsClientEmail || !toolsAmount || Number(toolsAmount) < 1) ? "var(--dim)" : "var(--muted)", fontSize: "0.875rem", fontWeight: 500, cursor: (toolsPayLoading || !toolsClientEmail || !toolsAmount || Number(toolsAmount) < 1) ? "default" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
              {toolsPayLoading ? "Generating…" : `Generate ${toolsPayType} link · $${toolsAmount || '—'}`}
            </button>
          )}
        </>
      ))}

      {/* Tool 3: Generate Extra Protocol */}
      {toolCard("Generate Extra Protocol", "Run the AI protocol generator for any client with an optional instruction note.", (
        <>
          <div>
            <label style={{ display: "block", fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.375rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Client</label>
            <select value={protoClientEmail} onChange={e => { setProtoClientEmail(e.target.value); setProtoResult(null); }}
              style={{ width: "100%", height: "36px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "7px", padding: "0 0.75rem", fontSize: "0.875rem", color: protoClientEmail ? "var(--ink)" : "var(--dim)", fontFamily: "var(--font-ui), system-ui, sans-serif", outline: "none" }}>
              <option value="">Select client…</option>
              {activeClients.map(c => <option key={c.email} value={c.email}>{c.name} · {c.email}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.7rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.375rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Instruction note (optional)</label>
            <textarea value={protoNote} onChange={e => setProtoNote(e.target.value)} rows={3}
              placeholder="e.g. Focus on optimizing sleep protocol"
              style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "7px", padding: "0.5rem 0.75rem", fontSize: "0.875rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", outline: "none", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box" }}
              onFocus={e => (e.target.style.borderColor = "var(--primary)")} onBlur={e => (e.target.style.borderColor = "var(--border)")} />
          </div>
          {protoResult === "done" && (
            <p style={{ fontSize: "0.8125rem", color: "oklch(0.7 0.15 145)", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Done — check client&apos;s protocols tab.</p>
          )}
          {protoResult === "error" && (
            <p style={{ fontSize: "0.8125rem", color: "var(--danger)", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>Generation failed. Try again.</p>
          )}
          <button onClick={handleGenerateExtraProtocol} disabled={protoGenerating || !protoClientEmail}
            style={{ height: "38px", background: (protoGenerating || !protoClientEmail) ? "var(--surface-2)" : "oklch(0.60 0.18 165 / 0.12)", border: "1px solid", borderColor: (protoGenerating || !protoClientEmail) ? "var(--border)" : "oklch(0.60 0.18 165 / 0.3)", borderRadius: "8px", color: (protoGenerating || !protoClientEmail) ? "var(--dim)" : "var(--primary)", fontSize: "0.875rem", fontWeight: 500, cursor: (protoGenerating || !protoClientEmail) ? "default" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem" }}>
            {!protoGenerating && <SparkleIcon />}
            {protoGenerating ? "Generating…" : "Generate protocol"}
          </button>
        </>
      ))}
    </div>
  );
}

function ClientRow({ u, selected, unreadCounts, onSelect }: { u: StoredUser; selected: StoredUser | null; unreadCounts: Record<string, number>; onSelect: (u: StoredUser) => void }) {
  const unread = unreadCounts[u.email] ?? 0;
  const isSelected = selected?.email === u.email;
  return (
    <button key={u.email} onClick={() => onSelect(u)}
      style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 0.625rem", borderRadius: "9px", border: "none", borderLeft: isSelected ? "3px solid var(--primary)" : "3px solid transparent", background: isSelected ? "var(--surface-hover)" : "none", cursor: "pointer", textAlign: "left", transition: "background 150ms, border-color 150ms" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: statusColor(u.status), flexShrink: 0 }} />
            <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {u.name && !u.name.includes('undefined') ? u.name : u.email.split('@')[0]}
            </p>
          </div>
          {unread > 0 && (
            <span style={{ width: "17px", height: "17px", borderRadius: "50%", background: "var(--primary)", color: "#ffffff", fontSize: "0.625rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{unread}</span>
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
  const active = clients.filter(c => c.status === 'active' && c.diagnosticData?.clientType !== 'skool');
  const pending = clients.filter(c => c.status === 'pending' || c.status === 'new');
  const paying1on1 = active.filter(c => c.diagnosticData?.clientType !== 'skool');

  const [alarms, setAlarms] = useState<{ id: string; user_email: string; type: string; message: string; created_at: string }[]>([]);
  const [pendingProtocols, setPendingProtocols] = useState<{ id: string; user_email: string; title: string; tracker_count: number | null; month_start: string | null; content?: { text?: string } }[]>([]);
  const [unsentDiagnoses, setUnsentDiagnoses] = useState<{ id: string; user_email: string; title: string; created_at: string }[]>([]);
  const [editingProtocol, setEditingProtocol] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [revenue, setRevenue] = useState<{ mrr: number; totalRevenue: number } | null>(null);
  const [showOverviewStats, setShowOverviewStats] = useState(false);

  useEffect(() => {
    // Alarms — use API route (supabaseAdmin bypasses RLS)
    fetch(`/api/alarms?pw=${encodeURIComponent(ADMIN_PASSWORD)}`)
      .then(r => r.json())
      .then(d => setAlarms((d.alarms ?? []) as typeof alarms))
      .catch(() => {});

    // Pending protocols
    supabase.from('protocols').select('id, user_email, title, tracker_count, month_start, content')
      .eq('status', 'pending_review').order('created_at', { ascending: false })
      .then(({ data }) => setPendingProtocols((data as typeof pendingProtocols) ?? []));

    // Unsent diagnoses (published=false)
    supabase.from('diagnostics').select('id, user_email, title, created_at')
      .eq('published', false).order('created_at', { ascending: false })
      .then(({ data }) => setUnsentDiagnoses((data as typeof unsentDiagnoses) ?? []));

    // Revenue
    fetch('/api/revenue').then(r => r.json()).then(d => setRevenue(d)).catch(() => {});
  }, []);

  const dismissAlarm = async (id: string) => {
    setAlarms(prev => prev.filter(a => a.id !== id));
    await fetch('/api/alarms', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, pw: ADMIN_PASSWORD }),
    });
  };

  const sendProtocol = async (id: string) => {
    setSending(id);
    if (editingProtocol === id) {
      // Save edits first
      await supabase.from('protocols').update({ content: { text: editText } }).eq('id', id);
      setEditingProtocol(null);
    }
    await fetch('/api/protocol-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ protocolId: id }) });
    setPendingProtocols(prev => prev.filter(p => p.id !== id));
    setSending(null);
  };

  const sendDiagnosis = async (id: string) => {
    setSending(id);
    await fetch('/api/diagnosis-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ diagnosisId: id }) });
    setUnsentDiagnoses(prev => prev.filter(d => d.id !== id));
    setSending(null);
  };

  const sectionLabel = (text: string, count?: number) => (
    <p style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.75rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
      {text}{count !== undefined && count > 0 ? <span style={{ fontWeight: 300, marginLeft: "0.375rem" }}>{count}</span> : null}
    </p>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem", maxWidth: "860px", margin: "0 auto" }}>

      {/* Top stats — collapsible */}
      <div>
        <button onClick={() => setShowOverviewStats(v => !v)} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "none", border: "none", padding: "0", cursor: "pointer", marginBottom: showOverviewStats ? "0.75rem" : "0" }}>
          {sectionLabel('Stats')}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: showOverviewStats ? "rotate(180deg)" : "none", transition: "transform 200ms", color: "var(--dim)", marginTop: "-0.5rem" }} aria-hidden>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {showOverviewStats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem" }}>
            {[
              { label: "MRR", value: revenue ? `$${Math.round(revenue.mrr)}` : '—', sub: "this calendar month" },
              { label: "Active 1:1", value: paying1on1.length, sub: "paying clients" },
              { label: "Applicants", value: pending.length, sub: pending.length > 0 ? "need attention" : "all clear" },
              { label: "Total Revenue", value: revenue ? `$${Math.round(revenue.totalRevenue)}` : '—', sub: "all time" },
              { label: "Conversion", value: (paying1on1.length + pending.length) > 0 ? `${Math.round(paying1on1.length / (paying1on1.length + pending.length) * 100)}%` : '—', sub: "applicants → clients" },
            ].map(({ label, value, sub }) => (
              <div key={label} style={{ padding: "1rem 1.25rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "10px" }}>
                <p style={{ fontSize: "0.65rem", color: "var(--dim)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.375rem" }}>{label}</p>
                <p style={{ fontSize: "1.5rem", fontWeight: 500, color: "var(--ink)", lineHeight: 1, fontFamily: "var(--font-display), Georgia, serif" }}>{value}</p>
                {sub && <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, marginTop: "0.25rem" }}>{sub}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alarm feed — always visible */}
      <div>
        {sectionLabel('Alarms', alarms.length > 0 ? alarms.length : undefined)}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {alarms.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", padding: "0.75rem 0.875rem", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "9px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "oklch(0.7 0.15 145)", flexShrink: 0 }} />
              <p style={{ fontSize: "0.8125rem", color: "var(--dim)", fontWeight: 300 }}>All clear · no active alarms</p>
            </div>
          ) : alarms.map(a => {
            const alarmClient = clients.find(c => c.email === a.user_email);
            const typeColors: Record<string, string> = {
              new_application: 'oklch(0.72 0.18 260)',
              booking: 'oklch(0.75 0.16 200)',
              intake_submitted: 'oklch(0.78 0.15 145)',
              diagnosis_ready: 'oklch(0.78 0.18 55)',
              protocol_ready: 'oklch(0.72 0.22 25)',
              blood_work_uploaded: 'oklch(0.72 0.16 320)',
              payment: 'oklch(0.72 0.18 145)',
              referral_milestone: 'oklch(0.75 0.14 300)',
            };
            const dotColor = typeColors[a.type] ?? 'oklch(0.75 0.12 65)';
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "0.875rem", padding: "0.75rem 0.875rem", background: "var(--surface)", border: `1px solid ${dotColor}33`, borderRadius: "9px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "0.8125rem", color: "var(--ink)", fontWeight: 500 }}>{a.message}</p>
                  <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, marginTop: "0.125rem" }}>
                    {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
                  {alarmClient && (
                    <button onClick={() => {
                      onSelect(alarmClient);
                      if (a.type === 'new_application') {
                        setTimeout(() => document.getElementById('crm-application')?.scrollIntoView({ behavior: 'smooth' }), 350);
                      }
                    }}
                      style={{ height: "28px", padding: "0 0.625rem", background: `${dotColor}18`, border: `1px solid ${dotColor}44`, borderRadius: "6px", color: dotColor, fontSize: "0.7rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", whiteSpace: "nowrap" }}>
                      View →
                    </button>
                  )}
                  <button onClick={() => dismissAlarm(a.id)}
                    style={{ height: "28px", padding: "0 0.625rem", background: "none", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--dim)", cursor: "pointer", fontSize: "0.7rem", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Protocols queue */}
      {pendingProtocols.length > 0 && (
        <div>
          {sectionLabel('Protocols to send', pendingProtocols.length)}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {pendingProtocols.map(p => {
              const clientName = clients.find(c => c.email === p.user_email)?.name ?? p.user_email;
              const isEditing = editingProtocol === p.id;
              return (
                <div key={p.id} style={{ padding: "1rem 1.25rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: isEditing ? "0.875rem" : 0 }}>
                    <div>
                      <p style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--ink)", marginBottom: "0.25rem" }}>{clientName}</p>
                      <p style={{ fontSize: "0.75rem", color: "var(--dim)", fontWeight: 300 }}>
                        {p.month_start ?? 'Protocol'} · {p.tracker_count ?? 0}/30 trackers
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                      <button onClick={() => { setEditingProtocol(isEditing ? null : p.id); setEditText(p.content?.text ?? ''); }}
                        style={{ height: "32px", padding: "0 0.75rem", background: "none", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--muted)", fontSize: "0.75rem", cursor: "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
                        {isEditing ? 'Collapse' : 'Review'}
                      </button>
                      <button onClick={() => sendProtocol(p.id)} disabled={sending === p.id}
                        style={{ height: "32px", padding: "0 0.875rem", background: "var(--primary)", border: "none", borderRadius: "6px", color: "#fff", fontSize: "0.75rem", fontWeight: 500, cursor: sending === p.id ? "not-allowed" : "pointer", fontFamily: "var(--font-ui), system-ui, sans-serif", opacity: sending === p.id ? 0.7 : 1 }}>
                        {sending === p.id ? '…' : 'Send'}
                      </button>
                    </div>
                  </div>
                  {isEditing && (
                    <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={12}
                      style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "7px", padding: "0.75rem 0.875rem", fontSize: "0.875rem", color: "var(--ink)", fontFamily: "var(--font-ui), system-ui, sans-serif", fontWeight: 300, outline: "none", resize: "vertical", lineHeight: 1.7, boxSizing: "border-box" }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Diagnosis queue — individual clickable cards */}
      {unsentDiagnoses.length > 0 && (
        <div>
          {sectionLabel('Diagnoses to send', unsentDiagnoses.length)}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {unsentDiagnoses.map(d => {
              const c = clients.find(cl => cl.email === d.user_email);
              const name = c?.name ?? d.user_email;
              const stageNum = d.title?.match(/Stage (\d+)/)?.[1] ?? '?';
              return (
                <button key={d.id} onClick={() => c && onSelect(c)}
                  style={{ display: "flex", alignItems: "center", gap: "0.875rem", padding: "0.75rem 0.875rem", background: "var(--surface)", border: "1px solid oklch(0.65 0.14 65 / 0.3)", borderRadius: "9px", cursor: c ? "pointer" : "default", textAlign: "left", width: "100%", transition: "border-color 150ms" }}
                  onMouseEnter={e => { if (c) e.currentTarget.style.borderColor = "oklch(0.65 0.14 65 / 0.6)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "oklch(0.65 0.14 65 / 0.3)"; }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "oklch(0.75 0.12 65)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ink)" }}>{name}</p>
                    <p style={{ fontSize: "0.7rem", color: "var(--dim)", fontWeight: 300, marginTop: "0.1rem" }}>
                      Diagnosis Stage {stageNum} · {new Date(d.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  {c && <span style={{ fontSize: "0.7rem", color: "oklch(0.75 0.12 65)", fontWeight: 600, flexShrink: 0 }}>Open →</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}


      {/* Pending clients */}
      {pending.length > 0 && (
        <div>
          {sectionLabel('Needs attention', pending.length)}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {pending.map(c => (
              <button key={c.email} onClick={() => onSelect(c)}
                style={{ display: "flex", alignItems: "center", gap: "0.875rem", padding: "0.75rem 0.875rem", background: "var(--surface)", border: "1px solid oklch(0.60 0.18 165 / 0.2)", borderRadius: "9px", cursor: "pointer", textAlign: "left", transition: "border-color 150ms", width: "100%" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "oklch(0.60 0.18 165 / 0.4)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "oklch(0.60 0.18 165 / 0.2)"}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
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
    </div>
  );
}

