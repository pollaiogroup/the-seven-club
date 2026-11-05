import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Row = { full_name: string; handle: string; email: string; role: string; status: string; created_at: string; membership: { plan: string; status: string; ends_at: string | null } | null };
const csv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

// Relatório de integrantes e assinaturas para a administração.
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_members', { p_limit: 200 });
  if (error) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const rows = (data as Row[]).map((m) => [m.full_name, `@${m.handle}`, m.email, m.role, m.status, m.created_at.slice(0, 10), m.membership?.plan, m.membership?.status, m.membership?.ends_at].map(csv).join(','));
  const body = ['nome,usuario,email,papel,status,entrada,plano,assinatura,fim_assinatura', ...rows].join('\n');
  return new NextResponse('﻿' + body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="integrantes-seven-club.csv"', 'Cache-Control': 'no-store' } });
}
