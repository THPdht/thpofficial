import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Tells /apply whether an email already belongs to a client, so an existing client
// gets stopped at the email step instead of filling in the whole form and hitting
// a 409 at the very end.
export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });

    const norm = String(email).toLowerCase().trim();
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('email', norm)
      .maybeSingle();

    // On a lookup failure, report "not taken" — the register route still blocks
    // duplicates, so the worst case is the old behaviour, not a false rejection.
    if (error) {
      console.error('[check-email]', error);
      return Response.json({ exists: false });
    }

    return Response.json({ exists: !!data });
  } catch (err) {
    console.error('[check-email]', err);
    return Response.json({ exists: false });
  }
}
