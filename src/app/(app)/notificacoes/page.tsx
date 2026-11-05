import Link from 'next/link';
import clsx from 'clsx';
import { Bell, BookOpen, CalendarDays, Heart, Megaphone, MessageCircle, Quote, Users } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import type { Notification } from '@/lib/types';
import { timeAgo } from '@/lib/format';
import { markAllRead } from '@/actions/notifications';
import { PageHeader, Sheet } from '@/components/ui/page-header';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { SevenStar } from '@/components/ui/icons';
import { SubmitButton } from '@/components/ui/submit-button';

export const metadata = { title: 'Notificações' };

function Icon({ kind }: { kind: string }) {
  const cls = 'h-4 w-4';
  if (kind === 'like') return <Heart className={cls} />;
  if (kind === 'comment' || kind === 'mention') return <MessageCircle className={cls} />;
  if (kind === 'project_invite') return <Users className={cls} />;
  if (kind.startsWith('event')) return <CalendarDays className={cls} />;
  if (kind === 'affirmation') return <Quote className={cls} />;
  if (kind === 'book_club') return <BookOpen className={cls} />;
  if (kind === 'seven_reminder') return <SevenStar className={cls} />;
  if (kind === 'announcement') return <Megaphone className={cls} />;
  return <Bell className={cls} />;
}

export default async function Notifications() {
  const me = await requireMember();
  const items = await rpc<Notification[]>('notifications_list', { p_limit: 60 });
  return (
    <>
      <PageHeader title="Notificações" back="/feed"
        actions={me.unread > 0 && <form action={markAllRead}><SubmitButton variant="light" size="sm" pendingText="…">Marcar lidas</SubmitButton></form>} />
      <Sheet className="pt-3">
        {items.length === 0 ? <EmptyState title="Tudo tranquilo por aqui">Curtidas, comentários, menções, convites e lembretes aparecem aqui.</EmptyState> : (
          <ul>
            {items.map((n) => (
              <li key={n.id}>
                <Link href={n.link || '#'} className={clsx('flex gap-3 border-b border-line px-4 py-4', !n.read && 'bg-dusty-soft/40')}>
                  <div className="relative shrink-0">
                    {n.actor ? <Avatar name={n.actor.full_name} path={n.actor.avatar_path} size={44} /> : <span className="flex h-11 w-11 items-center justify-center rounded-full bg-burgundy text-ivory"><SevenStar className="h-5 w-5" /></span>}
                    <span className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-paper text-burgundy ring-2 ring-ivory"><Icon kind={n.kind} /></span>
                  </div>
                  <div className="min-w-0 flex-1 leading-snug">
                    <p className="text-[14px]"><span className="font-semibold">{n.title}</span></p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-[14px] text-espresso/80">{n.body}</p>}
                    <p className="mt-1 text-[12px] text-muted">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-grioh" aria-label="Não lida" />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}
