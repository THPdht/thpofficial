import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireSelfOrAdmin } from '@/lib/apiAuth';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  const limit = parseInt(searchParams.get('limit') ?? '60', 10);

  if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });

  const denied = await requireSelfOrAdmin(req, email);
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from('daily_trackers')
    .select('id, date, circadian, training, nutrition, vitals, psychological, business, submitted_at')
    .eq('user_email', email)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ trackers: data ?? [] });
}
