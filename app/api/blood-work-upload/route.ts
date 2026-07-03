import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const userEmail = formData.get('userEmail') as string | null;

    if (!file || !userEmail) {
      return Response.json({ error: 'Missing file or userEmail' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const fileName = `${userEmail}/${Date.now()}.${ext}`;

    // Upload to Supabase Storage bucket 'blood-work'
    const buffer = await file.arrayBuffer();
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('blood-work')
      .upload(fileName, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      });

    if (uploadErr) {
      console.error('[blood-work-upload] storage error:', uploadErr);
      return Response.json({ error: 'Upload failed' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('blood-work')
      .getPublicUrl(fileName);

    const imageUrl = urlData.publicUrl;

    // Insert stub row in blood_work table
    const { data: inserted, error: dbErr } = await supabaseAdmin
      .from('blood_work')
      .insert({
        user_email: userEmail,
        image_url: imageUrl,
        uploaded_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (dbErr || !inserted) {
      console.error('[blood-work-upload] db error:', dbErr);
      return Response.json({ error: 'Failed to record upload' }, { status: 500 });
    }

    // Fire-and-forget: call analyze-blood-work Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    fetch(`${supabaseUrl}/functions/v1/analyze-blood-work`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ bloodWorkId: inserted.id, imageUrl, userEmail }),
    }).catch((err) => console.error('[blood-work-upload] analyze invoke failed:', err));

    return Response.json({ success: true, uploadId: inserted.id, imageUrl });
  } catch (err) {
    console.error('[blood-work-upload]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
