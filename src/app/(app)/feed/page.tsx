import Link from 'next/link';
import clsx from 'clsx';
import { Bell, CalendarDays, PenLine, Search } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import { FEED_SCOPES } from '@/lib/labels';
import { eventWhen } from '@/lib/format';
import type { Affirmation, BookClubHome, EventItem, Post } from '@/lib/types';
import { SevenStar } from '@/components/ui/icons';
import { IconLink } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { LinkButton } from '@/components/ui/button';
import { AffirmationTeaser } from '@/components/affirmation/affirmation-teaser';
import { FeedList } from '@/components/feed/feed-list';
import { BookClubTeaser } from '@/components/books/book-club-teaser';
import { AppSetupCard } from '@/components/settings/app-setup-card';

export const metadata = { title: 'Feed' };

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ escopo?: string; bemvinda?: string }> }) {
  const { escopo = 'all', bemvinda } = await searchParams;
  const scope = FEED_SCOPES.some((s) => s.key === escopo) ? escopo : 'all';
  const me = await requireMember();
  const [affirmation, posts, events, books] = await Promise.all([
    rpc<Affirmation | null>('affirmation_today'),
    rpc<Post[]>('feed_page', { p_scope: scope }),
    rpc<EventItem[]>('events_list', { p_scope: 'upcoming', p_limit: 1 }),
    rpc<BookClubHome | null>('book_club_home'),
  ]);
  const next = events[0];

  return (
    <>
      <header className="pt-safe bg-burgundy text-ivory">
        <div className="mx-auto max-w-2xl px-4 pt-3 pb-5">
          <div className="flex items-center justify-between">
            <IconLink href="/busca" label="Buscar"><Search className="h-[22px] w-[22px]" /></IconLink>
            <div className="flex flex-col items-center">
              <SevenStar className="h-6 w-6 text-dusty" />
              <span className="font-display mt-1 text-[13px] tracking-[0.2em] uppercase">The Seven Club</span>
            </div>
            <IconLink href="/notificacoes" label="Notificações" badge={me.unread}><Bell className="h-[22px] w-[22px]" /></IconLink>
          </div>
          {bemvinda && (
            <p className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-center text-[14px]">
              Bem-vinda ao clube, {me.full_name.split(' ')[0]}. Comece pelo seu perfil e pelo seu primeiro SEVEN.
            </p>
          )}
          <div className="mt-4"><AffirmationTeaser affirmation={affirmation} /></div>
        </div>
      </header>

      <main className="relative -mt-3 rounded-t-[28px] bg-ivory pb-nav">
        <div className="mx-auto max-w-2xl">
          <AppSetupCard welcome={!!bemvinda} />
          <div className="flex items-center gap-2 px-4 pt-4">
            <Link href="/publicar" className="flex h-12 flex-1 items-center gap-3 rounded-full bg-paper px-4 text-[15px] text-muted ring-1 ring-line hover:ring-dusty">
              <PenLine className="h-5 w-5 text-burgundy" /> Compartilhe com o clube…
            </Link>
            <Link href="/agenda" aria-label="Agenda" className="flex h-12 w-12 items-center justify-center rounded-full bg-paper text-burgundy ring-1 ring-line hover:ring-dusty">
              <CalendarDays className="h-5 w-5" />
            </Link>
          </div>

          {books && <BookClubTeaser h={books} />}

          {next && (
            <Link href={`/agenda/${next.id}`} className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-olive/12 px-4 py-3 ring-1 ring-olive/25">
              <CalendarDays className="h-5 w-5 shrink-0 text-olive-ink" />
              <span className="min-w-0 flex-1 text-[13px] leading-tight">
                <span className="block font-semibold text-olive-ink">Próximo encontro</span>
                <span className="block truncate">{next.title} · {eventWhen(next.starts_at)}</span>
              </span>
            </Link>
          )}

          <nav aria-label="Filtrar publicações" className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4 pb-2">
            {FEED_SCOPES.map((s) => (
              <Link key={s.key} href={s.key === 'all' ? '/feed' : `/feed?escopo=${s.key}`} scroll={false}
                className={clsx('shrink-0 rounded-full px-4 py-2 text-[13px] font-medium ring-1 transition', scope === s.key ? 'bg-burgundy text-ivory ring-burgundy' : 'bg-paper text-espresso ring-line')}>
                {s.label}
              </Link>
            ))}
          </nav>

          <FeedList
            key={scope}
            initial={posts}
            query={{ scope }}
            empty={
              <EmptyState title={scope === 'saved' ? 'Nada salvo ainda' : 'O feed está esperando por você'}
                action={scope !== 'saved' && <LinkButton href="/publicar">Fazer a primeira publicação</LinkButton>}>
                {scope === 'saved' ? 'Toque no marcador de uma publicação para guardá-la aqui.' : 'Conte uma conquista, apresente seu negócio ou convide as integrantes para um projeto.'}
              </EmptyState>
            }
          />
        </div>
      </main>
    </>
  );
}
