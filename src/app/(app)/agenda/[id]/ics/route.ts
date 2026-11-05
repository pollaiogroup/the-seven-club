import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/env';

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => `\\${m}`);

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: e } = await supabase.rpc('event_detail', { p_id: id });
  if (!e) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const end = e.ends_at || new Date(new Date(e.starts_at).getTime() + 2 * 3600 * 1000).toISOString();
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//THE SEVEN CLUB//Agenda//PT', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${e.id}@theseven.club`, `DTSTAMP:${stamp(new Date().toISOString())}`, `DTSTART:${stamp(e.starts_at)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc(`${e.description || ''}\n\n${SITE_URL}/agenda/${e.id}`)}`,
    `LOCATION:${esc(e.location || e.online_url || 'Online')}`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  return new NextResponse(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="seven-club-evento.ics"` } });
}
