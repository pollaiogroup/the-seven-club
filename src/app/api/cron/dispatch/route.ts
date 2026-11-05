import { NextResponse, type NextRequest } from 'next/server';
import webpush from 'web-push';
import { adminClient } from '@/lib/supabase/admin';

// Rotina a cada 10 minutos (vercel.json): agenda afirmação do dia, lembretes do SEVEN e de eventos, marca assinaturas vencidas
// e envia por push as notificações ainda não entregues. Protegida por CRON_SECRET.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = adminClient();
  const queued = {
    affirmation: (await db.rpc('queue_daily_affirmations')).data ?? 0,
    seven: (await db.rpc('queue_seven_reminders')).data ?? 0,
    events: (await db.rpc('queue_event_reminders')).data ?? 0,
    memberships_due: (await db.rpc('expire_memberships')).data ?? 0,
    book_club: (await db.rpc('queue_book_club')).data ?? 0,
  };

  let sent = 0;
  let dropped = 0;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const { data: pending } = await db.from('notifications').select('id, recipient_id, title, body, link, kind').is('pushed_at', null).gte('created_at', since).limit(500);
  const ids = (pending || []).map((n: { id: string }) => n.id);

  if (vapidPublic && vapidPrivate && ids.length) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contato@theseven.club', vapidPublic, vapidPrivate);
    const recipients = [...new Set((pending || []).map((n: { recipient_id: string }) => n.recipient_id))];
    const { data: subs } = await db.from('push_subscriptions').select('id, member_id, endpoint, p256dh, auth').in('member_id', recipients);
    for (const n of pending || []) {
      for (const s of (subs || []).filter((x: { member_id: string }) => x.member_id === n.recipient_id)) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: n.title || 'THE SEVEN CLUB', body: n.body || '', url: n.link || '/notificacoes', tag: n.kind }), { TTL: 6 * 3600 });
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) { await db.from('push_subscriptions').delete().eq('id', s.id); dropped++; }
        }
      }
    }
  }
  if (ids.length) await db.from('notifications').update({ pushed_at: new Date().toISOString() }).in('id', ids);
  return NextResponse.json({ queued, considered: ids.length, sent, dropped });
}
