import Link from 'next/link';
import clsx from 'clsx';
import { Search } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import type { BusinessCard, EventItem, MemberCard, Post, ProjectCard } from '@/lib/types';
import { PageHeader, SectionTitle, Sheet } from '@/components/ui/page-header';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { BusinessRow } from '@/components/business/business-card';
import { EventCard } from '@/components/events/event-card';
import { PostCard } from '@/components/feed/post-card';
import { PROJECT_CATEGORIES } from '@/lib/labels';

export const metadata = { title: 'Buscar' };

type Offering = { id: string; kind: string; name: string; price_text: string | null; business: { slug: string; name: string; logo_path: string | null } };
type Results = { members?: MemberCard[]; businesses?: BusinessCard[]; offerings?: Offering[]; projects?: ProjectCard[]; posts?: Post[]; events?: EventItem[] };

const KINDS = [
  { k: 'all', l: 'Tudo' }, { k: 'members', l: 'Integrantes' }, { k: 'businesses', l: 'Empresas' }, { k: 'offerings', l: 'Produtos e serviços' },
  { k: 'projects', l: 'Projetos' }, { k: 'posts', l: 'Publicações' }, { k: 'events', l: 'Eventos' },
];

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; tipo?: string }> }) {
  const { q = '', tipo = 'all' } = await searchParams;
  const kind = KINDS.some((k) => k.k === tipo) ? tipo : 'all';
  await requireMember();
  const r: Results = q.trim().length >= 2 ? await rpc<Results>('search_all', { p_q: q, p_kind: kind, p_limit: kind === 'all' ? 4 : 30 }) : {};
  const total = Object.values(r).reduce((n, v) => n + (v?.length || 0), 0);
  const href = (k: string) => `/busca?${new URLSearchParams({ q, tipo: k })}`;
  const more = (k: string, n?: number) => kind === 'all' && (n || 0) >= 4 ? <Link href={href(k)} className="text-[13px] font-semibold text-burgundy">Ver mais</Link> : undefined;

  return (
    <>
      <PageHeader title="Buscar" back="/feed">
        <form role="search" className="relative">
          <input type="hidden" name="tipo" value={kind} />
          <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} type="search" enterKeyHint="search" autoFocus placeholder="Integrantes, empresas, projetos, eventos…"
            className="h-12 w-full rounded-full bg-ivory pr-4 pl-12 text-espresso placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-dusty" />
        </form>
      </PageHeader>
      <Sheet className="pt-4">
        <nav className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
          {KINDS.map((k) => <Link key={k.k} href={href(k.k)} scroll={false} className={clsx('shrink-0 rounded-full px-4 py-2 text-[13px] ring-1', kind === k.k ? 'bg-burgundy text-ivory ring-burgundy' : 'bg-paper ring-line')}>{k.l}</Link>)}
        </nav>
        {q.trim().length < 2 ? (
          <EmptyState title="O que você procura?">Busque por nome de integrante, empresa, produto, serviço, projeto, evento ou palavras de uma publicação.</EmptyState>
        ) : total === 0 ? (
          <EmptyState title="Nada encontrado">Tente outra palavra ou um filtro diferente.</EmptyState>
        ) : (
          <>
            {!!r.members?.length && (<><SectionTitle action={more('members', r.members.length)}>Integrantes</SectionTitle>
              <ul className="space-y-2 px-4">{r.members.map((m) => (
                <li key={m.id}><Link href={`/integrantes/${m.handle}`} className="flex items-center gap-3 rounded-2xl bg-paper p-3 ring-1 ring-line">
                  <Avatar name={m.full_name} path={m.avatar_path} size={44} />
                  <span className="min-w-0 leading-tight"><span className="block truncate font-semibold">{m.full_name}</span><span className="block truncate text-[13px] text-muted">{m.headline || `@${m.handle}`}</span></span>
                </Link></li>))}</ul></>)}
            {!!r.businesses?.length && (<><SectionTitle action={more('businesses', r.businesses.length)}>Empresas</SectionTitle>
              <div className="space-y-2 px-4">{r.businesses.map((b) => <BusinessRow key={b.id} b={b} />)}</div></>)}
            {!!r.offerings?.length && (<><SectionTitle action={more('offerings', r.offerings.length)}>Produtos e serviços</SectionTitle>
              <ul className="space-y-2 px-4">{r.offerings.map((o) => (
                <li key={o.id}><Link href={`/business/${o.business.slug}?aba=ofertas`} className="flex items-center gap-3 rounded-2xl bg-paper p-3 ring-1 ring-line">
                  <Avatar name={o.business.name} path={o.business.logo_path} size={40} className="rounded-xl" />
                  <span className="min-w-0 flex-1 leading-tight"><span className="block truncate font-semibold">{o.name}</span><span className="block truncate text-[13px] text-muted">{o.kind === 'product' ? 'Produto' : 'Serviço'} · {o.business.name}</span></span>
                  {o.price_text && <span className="shrink-0 text-[13px] font-semibold text-burgundy">{o.price_text}</span>}
                </Link></li>))}</ul></>)}
            {!!r.projects?.length && (<><SectionTitle action={more('projects', r.projects.length)}>Projetos</SectionTitle>
              <ul className="space-y-2 px-4">{r.projects.map((p) => (
                <li key={p.id}><Link href={`/projetos/${p.slug}`} className="block rounded-2xl bg-paper p-3 ring-1 ring-line"><span className="block font-semibold">{p.name}</span><span className="text-[13px] text-muted">{PROJECT_CATEGORIES[p.category]}</span></Link></li>))}</ul></>)}
            {!!r.events?.length && (<><SectionTitle action={more('events', r.events.length)}>Eventos</SectionTitle>
              <div className="space-y-2 px-4">{r.events.map((e) => <EventCard key={e.id} e={e} />)}</div></>)}
            {!!r.posts?.length && (<><SectionTitle action={more('posts', r.posts.length)}>Publicações</SectionTitle>
              <div>{r.posts.map((p) => <PostCard key={p.id} post={p} />)}</div></>)}
          </>
        )}
      </Sheet>
    </>
  );
}
