import { supabase } from './supabase';

export type ClientStatus = 'new' | 'pending' | 'active' | 'alumni' | 'inactive';

export type AttachmentType = 'image' | 'video' | 'audio' | 'file';

export type Message = {
  id: string;
  from: 'client' | 'admin';
  text: string;
  ts: string;
  read?: boolean;
  attachmentUrl?: string;
  attachmentType?: AttachmentType;
  attachmentName?: string;
};

export type ProtocolStatus = 'active' | 'updating' | 'building';
export type AccountStatus = 'active' | 'hold' | 'limited' | 'removed';

export type Payment = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  type: 'deposit' | 'full' | 'monthly' | 'other';
  note?: string;
};

export type TrackerQuestion = {
  id: string;
  label: string;
  hint?: string;
  type: 'rating' | 'boolean' | 'text' | 'textarea';
  category: string;
  weight: number;
  optional?: boolean;
};

export type ClientProtocol = {
  id: string;
  userEmail: string;
  stage: number;
  notionPageId?: string;
  title: string;
  content?: { sections: { heading: string; text: string }[]; todos: string[] };
  createdAt: string;
  published?: boolean;
};

export type ClientDiagnostic = {
  id: string;
  userEmail: string;
  stage: number;
  title: string;
  content?: { sections: { heading: string; text: string }[]; speaking_notes?: Record<string, unknown> };
  pdfUrl?: string;
  published?: boolean;
  createdAt: string;
};

export type WeeklyResponseSummary = {
  days: {
    date: string;
    responses: { questionLabel: string; value: string | number | boolean; category: string }[];
  }[];
  categoryAverages: { category: string; avg: number }[];
  flagged: { date: string; questionLabel: string; value: string | number | boolean }[];
};

// THP 40-field intake
export type DiagnosticData = {
  fullName?: string;
  ageLocation?: string;
  contactInfo?: string;
  travelPattern?: string;
  whatTryingToFix?: string;
  howAskForWhatYouWant?: string;
  avoidDisappointing?: string;
  validationSource?: string;
  energyState?: string;
  selfPerception?: string;
  avoidConflict?: string;
  responseToCriticism?: string;
  internalStateEnteringRoom?: string;
  pastRelationshipPatterns?: string;
  trainingRecovery?: string;
  heightWeightBf?: string;
  sleepDuration?: string;
  relationshipStatus?: string;
  relationshipToRisk?: string;
  sexualConfidence?: string;
  alcoholUse?: string;
  currentMedications?: string;
  relationshipToFood?: string;
  baselineInternalState?: string;
  onTrt?: string;
  whatStaysSolidTraveling?: string;
  caffeineIntake?: string;
  nicotineSubstances?: string;
  sleepQuality?: string;
  trainingFrequency?: string;
  morningErections?: string;
  eyeContact?: string;
  sexualDynamic?: string;
  physiqueFeeling?: string;
  trainingApproach?: string;
  howDecompress?: string;
  libido?: string;
  travelFrequency?: string;
  wakeUpRecovered?: string;
  recentHormonePanel?: string;
  // Admin-managed fields
  protocolStatus?: ProtocolStatus;
  accountStatus?: AccountStatus;
  clientType?: 'skool' | '1on1';
  payments?: Payment[];
  notionPageId?: string;
  suspended?: boolean;
  suspendedAt?: string;
  stripeCustomerId?: string;
  freeMonthEarned?: boolean;
  monthlyRate?: number;
  productName?: string;
  pdfImported?: boolean;
};

export type StoredUser = {
  name: string;
  email: string;
  password: string;
  status: ClientStatus;
  notionPageId?: string;
  streak: number;
  longestStreak: number;
  lastCheckIn?: string;
  joinedAt: string;
  diagnosticData?: DiagnosticData;
  referralCode?: string;
};

// ─── Local session cache ───────────────────────────────────────────────────
export function cacheUser(user: StoredUser) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('thp_current', user.email);
  localStorage.setItem(`thp_user_${user.email}`, JSON.stringify(user));
}

function evictUser(email: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`thp_user_${email}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToUser(row: any): StoredUser {
  const diagData = row.diagnostic_data ?? undefined;
  return {
    name: row.name,
    email: row.email,
    password: row.password,
    status: row.status as ClientStatus,
    notionPageId: diagData?.notionPageId ?? undefined,
    streak: row.streak ?? 0,
    longestStreak: row.longest_streak ?? 0,
    lastCheckIn: row.last_check_in ?? undefined,
    joinedAt: row.joined_at,
    diagnosticData: diagData,
    referralCode: row.referral_code ?? undefined,
  };
}

// ─── User queries ──────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<StoredUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('joined_at', { ascending: false });
  if (error || !data) return [];
  return data.map(rowToUser);
}

export function getCurrentUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;
  const email = localStorage.getItem('thp_current');
  if (!email) return null;
  const raw = localStorage.getItem(`thp_user_${email}`);
  return raw ? JSON.parse(raw) : null;
}

export function signOut(): void {
  if (typeof window === 'undefined') return;
  const email = localStorage.getItem('thp_current');
  if (email) evictUser(email);
  localStorage.removeItem('thp_current');
}

export async function register(
  name: string,
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const json = await res.json();
    if (!res.ok || json.error) return { success: false, error: json.error || 'Could not create account. Please try again.' };
    return { success: true };
  } catch {
    return { success: false, error: 'Network error. Please try again.' };
  }
}

export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; user?: StoredUser; error?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok || json.error) return { success: false, error: json.error || 'Sign in failed.' };
    const user = rowToUser(json.user);
    cacheUser(user);
    return { success: true, user };
  } catch {
    return { success: false, error: 'Network error. Please try again.' };
  }
}

export async function updateUser(email: string, updates: Partial<StoredUser>): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.streak !== undefined) dbUpdates.streak = updates.streak;
  if (updates.longestStreak !== undefined) dbUpdates.longest_streak = updates.longestStreak;
  if (updates.lastCheckIn !== undefined) dbUpdates.last_check_in = updates.lastCheckIn;
  if (updates.diagnosticData !== undefined) dbUpdates.diagnostic_data = updates.diagnosticData;

  await supabase.from('users').update(dbUpdates).eq('email', email);

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(`thp_user_${email}`);
    if (raw) {
      const cached = JSON.parse(raw);
      localStorage.setItem(`thp_user_${email}`, JSON.stringify({ ...cached, ...updates }));
    }
  }
}

export async function submitDiagnostic(email: string, data: DiagnosticData): Promise<void> {
  await updateUser(email, { status: 'pending', diagnosticData: data });
}

export async function linkNotionPage(email: string, notionPageId: string): Promise<void> {
  const { data } = await supabase.from('users').select('diagnostic_data').eq('email', email).maybeSingle();
  const diag = data?.diagnostic_data || {};
  await supabase.from('users').update({ diagnostic_data: { ...diag, notionPageId, protocolStatus: 'active' } }).eq('email', email);
}

export async function setProtocolStatus(email: string, status: ProtocolStatus): Promise<void> {
  const { data } = await supabase.from('users').select('diagnostic_data').eq('email', email).maybeSingle();
  const diag = data?.diagnostic_data || {};
  await supabase.from('users').update({ diagnostic_data: { ...diag, protocolStatus: status } }).eq('email', email);
}

export async function setAccountStatus(email: string, status: AccountStatus): Promise<void> {
  const { data } = await supabase.from('users').select('diagnostic_data').eq('email', email).maybeSingle();
  const diag = data?.diagnostic_data || {};
  await supabase.from('users').update({ diagnostic_data: { ...diag, accountStatus: status } }).eq('email', email);
}

export async function setClientType(email: string, clientType: 'skool' | '1on1'): Promise<void> {
  const { data } = await supabase.from('users').select('diagnostic_data').eq('email', email).maybeSingle();
  const diag = data?.diagnostic_data || {};
  await supabase.from('users').update({ diagnostic_data: { ...diag, clientType } }).eq('email', email);
}

export async function addPayment(email: string, payment: Omit<Payment, 'id'>): Promise<void> {
  const { data } = await supabase.from('users').select('diagnostic_data').eq('email', email).maybeSingle();
  const diag = data?.diagnostic_data || {};
  const payments: Payment[] = diag.payments ?? [];
  payments.push({ ...payment, id: Date.now().toString() });
  await supabase.from('users').update({ diagnostic_data: { ...diag, payments } }).eq('email', email);
}

export async function removePayment(email: string, paymentId: string): Promise<void> {
  const { data } = await supabase.from('users').select('diagnostic_data').eq('email', email).maybeSingle();
  const diag = data?.diagnostic_data || {};
  const payments = (diag.payments ?? []).filter((p: Payment) => p.id !== paymentId);
  await supabase.from('users').update({ diagnostic_data: { ...diag, payments } }).eq('email', email);
}

// ─── Presence ─────────────────────────────────────────────────────────────────

export async function updatePresence(id: string): Promise<void> {
  await supabase.from('presence').upsert({ id, last_seen: new Date().toISOString() });
}

export async function isAdminActive(): Promise<boolean> {
  const { data } = await supabase.from('presence').select('last_seen').eq('id', 'admin').maybeSingle();
  if (!data) return false;
  return Date.now() - new Date(data.last_seen).getTime() < 3 * 60 * 1000;
}

export async function isClientActive(email: string): Promise<boolean> {
  const { data } = await supabase.from('presence').select('last_seen').eq('id', email).maybeSingle();
  if (!data) return false;
  return Date.now() - new Date(data.last_seen).getTime() < 4 * 60 * 1000;
}

export async function removeClient(email: string): Promise<void> {
  await supabase.from('diagnostics').delete().eq('user_email', email);
  await supabase.from('messages').delete().eq('user_email', email);
  await supabase.from('push_subscriptions').delete().eq('user_email', email);
  await supabase.from('tracker_responses').delete().eq('user_email', email);
  await supabase.from('tracker_questions').delete().eq('user_email', email);
  await supabase.from('protocols').delete().eq('user_email', email);
  await supabase.from('invites').delete().eq('email', email);
  await supabase.from('users').delete().eq('email', email);
}

// Used by client dashboard — only shows sent protocols
export async function getClientProtocols(email: string): Promise<ClientProtocol[]> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .eq('user_email', email)
    .eq('status', 'sent')
    .order('stage', { ascending: true });
  if (error || !data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    id: row.id,
    userEmail: row.user_email,
    stage: row.stage,
    notionPageId: row.notion_page_id ?? undefined,
    title: row.title,
    content: row.content ?? undefined,
    createdAt: row.created_at,
  }));
}

// Used by admin — returns ALL protocols including unpublished drafts (uses server API to bypass RLS)
export async function getAdminProtocols(email: string): Promise<ClientProtocol[]> {
  try {
    const res = await fetch(`/api/protocols?email=${encodeURIComponent(email)}&all=1`);
    if (!res.ok) return [];
    const { protocols } = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (protocols ?? []).map((row: any) => ({
      id: row.id,
      userEmail: row.user_email,
      stage: row.stage,
      notionPageId: row.notion_page_id ?? undefined,
      title: row.title,
      content: row.content ?? undefined,
      createdAt: row.created_at,
      published: row.status === 'sent',
    }));
  } catch {
    return [];
  }
}

// Used by client dashboard — only shows published diagnoses
export async function getClientDiagnostics(email: string): Promise<ClientDiagnostic[]> {
  const { data, error } = await supabase
    .from('diagnostics')
    .select('*')
    .eq('user_email', email)
    .eq('published', true)
    .order('stage', { ascending: true });
  if (error || !data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    id: row.id,
    userEmail: row.user_email,
    stage: row.stage,
    title: row.title,
    content: row.content ?? undefined,
    pdfUrl: row.pdf_url ?? undefined,
    published: row.published ?? false,
    createdAt: row.created_at,
  }));
}

// Used by admin — returns ALL diagnostics including unpublished drafts
export async function getAdminDiagnostics(email: string): Promise<ClientDiagnostic[]> {
  const { data, error } = await supabase
    .from('diagnostics')
    .select('*')
    .eq('user_email', email)
    .order('stage', { ascending: true });
  if (error || !data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    id: row.id,
    userEmail: row.user_email,
    stage: row.stage,
    title: row.title,
    content: row.content ?? undefined,
    pdfUrl: row.pdf_url ?? undefined,
    published: row.published ?? false,
    createdAt: row.created_at,
  }));
}

export async function publishDiagnosis(diagId: string): Promise<void> {
  await supabase.from('diagnostics').update({ published: true }).eq('id', diagId);
}

export async function setSuspended(email: string, suspended: boolean): Promise<void> {
  const { data } = await supabase.from('users').select('diagnostic_data').eq('email', email).maybeSingle();
  const diag = data?.diagnostic_data || {};
  await supabase.from('users').update({
    diagnostic_data: { ...diag, suspended, suspendedAt: suspended ? new Date().toISOString() : undefined },
  }).eq('email', email);
}

export async function createClient(
  name: string,
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const norm = email.toLowerCase().trim();
  const { data: existing } = await supabase.from('users').select('email').eq('email', norm).maybeSingle();
  if (existing) return { success: false, error: 'An account with this email already exists.' };
  const { error } = await supabase.from('users').insert({
    name: name.trim(),
    email: norm,
    password,
    status: 'new',
    streak: 0,
    longest_streak: 0,
    joined_at: new Date().toISOString().split('T')[0],
  });
  if (error) return { success: false, error: 'Could not create account.' };
  return { success: true };
}

export function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function hasCheckedInToday(user: StoredUser): boolean {
  return user.lastCheckIn === todayKey();
}

export async function recordCheckIn(email: string, currentStreak: number): Promise<void> {
  const newStreak = currentStreak + 1;
  const today = todayKey();

  const { data } = await supabase.from('users').select('longest_streak').eq('email', email).maybeSingle();
  const newLongest = Math.max(data?.longest_streak ?? 0, newStreak);

  await updateUser(email, { lastCheckIn: today, streak: newStreak, longestStreak: newLongest });

  const raw = typeof window !== 'undefined' ? localStorage.getItem(`thp_user_${email}`) : null;
  if (raw) {
    const cached = JSON.parse(raw);
    cached.lastCheckIn = today;
    cached.streak = newStreak;
    cached.longestStreak = newLongest;
    localStorage.setItem(`thp_user_${email}`, JSON.stringify(cached));
  }
}

// ─── Messages ──────────────────────────────────────────────────────────────

export async function getMessages(email: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('user_email', email)
    .order('ts', { ascending: true });
  if (error || !data) return [];
  return data.map(row => ({
    id: row.id,
    from: row.from_type as 'client' | 'admin',
    text: row.text,
    ts: row.ts,
    read: row.is_read ?? false,
    attachmentUrl: row.attachment_url ?? undefined,
    attachmentType: row.attachment_type ?? undefined,
    attachmentName: row.attachment_name ?? undefined,
  }));
}

export async function addMessage(
  email: string,
  text: string,
  from: 'client' | 'admin',
  attachment?: { url: string; type: AttachmentType; name?: string }
): Promise<Message | null> {
  const id = Date.now().toString();
  const ts = new Date().toISOString();
  const row: Record<string, unknown> = {
    id,
    user_email: email,
    from_type: from,
    text,
    ts,
    is_read: from === 'admin',
  };
  if (attachment) {
    row.attachment_url = attachment.url;
    row.attachment_type = attachment.type;
    row.attachment_name = attachment.name ?? null;
  }
  const { error } = await supabase.from('messages').insert(row);
  if (error) return null;
  return {
    id,
    from,
    text,
    ts,
    read: from === 'admin',
    attachmentUrl: attachment?.url,
    attachmentType: attachment?.type,
    attachmentName: attachment?.name,
  };
}

export async function uploadMessageAttachment(
  file: Blob,
  fileName: string,
  folder: string
): Promise<string | null> {
  const path = `${folder}/${Date.now()}_${fileName}`;
  const { error } = await supabase.storage.from('message-attachments').upload(path, file, { upsert: false });
  if (error) return null;
  const { data } = supabase.storage.from('message-attachments').getPublicUrl(path);
  return data.publicUrl;
}

export async function markClientMessagesRead(email: string): Promise<void> {
  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('user_email', email)
    .eq('from_type', 'client');
}

export async function unreadClientMessageCount(email: string): Promise<number> {
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_email', email)
    .eq('from_type', 'client')
    .eq('is_read', false);
  return count ?? 0;
}

export async function getAllUnreadCounts(): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('messages')
    .select('user_email')
    .eq('from_type', 'client')
    .eq('is_read', false);
  if (!data) return {};
  return data.reduce<Record<string, number>>((acc, row) => {
    acc[row.user_email] = (acc[row.user_email] ?? 0) + 1;
    return acc;
  }, {});
}
