import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Protocol edits from the admin panel. RLS hides protocol rows from anon, so an
// anon update reports success while matching zero rows — the edit silently
// disappears. Admin edits must run with the service role.
function authCheck(req: Request): boolean {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD;
}

type Section = { heading: string; text: string };

// PATCH /api/admin/protocols — body: { id, sections }
// Only `sections` is replaced. `todos` and any other key in `content` are
// carried over untouched: the protocol body is what the panel edits, and a
// partial payload must never blank the rest of the record.
export async function PATCH(req: Request) {
  if (!authCheck(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { id?: string; sections?: Section[] } | null;
  if (!body?.id || !Array.isArray(body.sections)) {
    return Response.json({ error: 'Missing id or sections' }, { status: 400 });
  }
  // An empty result almost always means the editor failed to parse rather than
  // that THP meant to delete the whole protocol body.
  if (body.sections.length === 0) {
    return Response.json({ error: 'Refusing to save an empty protocol' }, { status: 400 });
  }
  if (body.sections.some(s => typeof s?.heading !== 'string' || typeof s?.text !== 'string')) {
    return Response.json({ error: 'Malformed sections' }, { status: 400 });
  }

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('protocols').select('content').eq('id', body.id).maybeSingle();
  if (fetchErr) return Response.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return Response.json({ error: 'Protocol not found' }, { status: 404 });

  const content = { ...(existing.content ?? {}), sections: body.sections };

  // Select the updated row back so a write matching nothing is reported as an
  // error instead of passing as a success.
  const { data, error } = await supabaseAdmin
    .from('protocols')
    .update({ content })
    .eq('id', body.id)
    .select('id');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return Response.json({ error: 'Protocol not found' }, { status: 404 });
  }
  return Response.json({ success: true });
}
