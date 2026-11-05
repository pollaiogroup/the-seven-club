import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Exportação dos dados pessoais da integrante (LGPD, art. 18).
export async function GET() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data, error } = await supabase.rpc('my_export');
  if (error) return NextResponse.json({ error: 'export_failed' }, { status: 500 });
  return new NextResponse(JSON.stringify({ email: user.user.email, ...data }, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="meus-dados-seven-club.json"', 'Cache-Control': 'no-store' },
  });
}
