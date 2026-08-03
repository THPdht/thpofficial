/**
 * Admin control plane for the Instagram bot.
 *
 * Campaigns live in the database rather than in code so a new post only needs a
 * ManyChat trigger and a row here. Nothing about a keyword is ever deployed.
 *
 * Admin-only: these rows contain lead email addresses.
 */

import { requireAdmin } from '@/lib/apiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const thread = new URL(req.url).searchParams.get('thread');

  if (thread) {
    const { data, error } = await supabaseAdmin
      .from('ig_conversations')
      .select('id, role, content, intent, created_at')
      .eq('subscriber_id', thread)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ messages: data ?? [] });
  }

  const [settings, campaigns, contacts] = await Promise.all([
    supabaseAdmin
      .from('ig_settings')
      .select('bot_enabled, test_mode, test_usernames, opener_copy, apply_copy, not_a_fit_copy, holding_copy')
      .eq('id', 1)
      .maybeSingle(),
    supabaseAdmin.from('ig_campaigns').select('*').order('created_at', { ascending: false }),
    supabaseAdmin
      .from('ig_contacts')
      .select('subscriber_id, ig_username, first_name, email, keyword, stage, bot_paused, updated_at')
      .order('updated_at', { ascending: false })
      .limit(200),
  ]);

  return Response.json({
    botEnabled: settings.data?.bot_enabled ?? true,
    testMode: settings.data?.test_mode ?? true,
    testUsernames: settings.data?.test_usernames ?? '',
    messages: {
      opener_copy: settings.data?.opener_copy ?? '',
      apply_copy: settings.data?.apply_copy ?? '',
      not_a_fit_copy: settings.data?.not_a_fit_copy ?? '',
      holding_copy: settings.data?.holding_copy ?? '',
    },
    campaigns: campaigns.data ?? [],
    contacts: contacts.data ?? [],
  });
}

/** Create or update a campaign. Keyword is the identity, matched case-insensitively. */
export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Invalid JSON' }, { status: 400 });

  const keyword = String(body.keyword ?? '').trim();
  const resourceUrl = String(body.resource_url ?? '').trim();
  const dmCopy = String(body.dm_copy ?? '').trim();

  // The link is optional: a keyword can simply open a conversation. The copy is not.
  if (!keyword || !dmCopy) {
    return Response.json({ error: 'keyword and dm_copy are required' }, { status: 400 });
  }

  const row = {
    keyword,
    resource_url: resourceUrl,
    dm_copy: dmCopy,
    post_url: String(body.post_url ?? '').trim() || null,
    active: body.active !== false,
  };

  const { data: existing } = await supabaseAdmin
    .from('ig_campaigns')
    .select('id')
    .ilike('keyword', keyword)
    .maybeSingle();

  const { error } = existing
    ? await supabaseAdmin.from('ig_campaigns').update(row).eq('id', existing.id)
    : await supabaseAdmin.from('ig_campaigns').insert(row);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

/** Kill switch, global or per contact. */
export async function PATCH(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Invalid JSON' }, { status: 400 });

  if (typeof body.botEnabled === 'boolean') {
    const { error } = await supabaseAdmin
      .from('ig_settings')
      .update({ bot_enabled: body.botEnabled, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  // Test mode and its allowlist. Kept separate from the kill switch so the bot
  // can be "on" and still reachable only by us.
  if (typeof body.testMode === 'boolean' || typeof body.testUsernames === 'string') {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.testMode === 'boolean') patch.test_mode = body.testMode;
    if (typeof body.testUsernames === 'string') patch.test_usernames = body.testUsernames.trim() || null;
    const { error } = await supabaseAdmin.from('ig_settings').update(patch).eq('id', 1);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  // The bot's own words. Blank means "use the built-in default", so clearing a
  // field is a valid thing to do rather than a way to send an empty DM.
  if (body.messages && typeof body.messages === 'object') {
    const allowed = ['opener_copy', 'apply_copy', 'not_a_fit_copy', 'holding_copy'] as const;
    const patch: Record<string, string | null> = {};
    for (const key of allowed) {
      if (key in body.messages) patch[key] = String(body.messages[key] ?? '').trim() || null;
    }
    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'Nothing to update' }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from('ig_settings')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  if (body.subscriberId && typeof body.botPaused === 'boolean') {
    const { error } = await supabaseAdmin
      .from('ig_contacts')
      .update({ bot_paused: body.botPaused, updated_at: new Date().toISOString() })
      .eq('subscriber_id', String(body.subscriberId));
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Nothing to update' }, { status: 400 });
}

export async function DELETE(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabaseAdmin.from('ig_campaigns').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
