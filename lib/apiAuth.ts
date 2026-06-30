export function requireApiKey(req: Request): Response | null {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  if (req.headers.get('x-api-key') !== key) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
