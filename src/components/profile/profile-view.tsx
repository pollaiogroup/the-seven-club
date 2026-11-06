import Link from 'next/link';
import clsx from 'clsx';
import { AtSign, BookPlus, Globe, Lock, MapPin, Plus } from 'lucide-react';
import type { LibraryEntry, Post, ProfilePage } from '@/lib/types';
import { BookCover } from '@/components/books/book-cover';
import { Avatar } from '@/components/ui/avatar';
import { SevenStar } from '@/components/ui/icons';
import { LinkButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FeedList } from '@/components/feed/feed-list';
import { mediaUrl } from '@/lib/media';
import { PROJECT_CATEGORIES, ROLES } from '@/lib/labels';
import { ProfileActions } from './profile-actions';

export function ProfileView({ p, tab, posts, base, library = [] }: { p: ProfilePage; tab: string; posts: Post[]; base: string; library?: LibraryEntry[] }) {
  const tabs = [
    { key: 'feed', label: 'Feed' },
    { key: 'empresas', label: 'Empresas' },
    { key: 'projetos', label: 'Projetos' },
    { key: 'biblioteca', label: 'Biblioteca' },
  ];
  const first = p.full_name.split(' ')[0];
  return (
    <>
      <section className="mx-4 -mt-1 rounded-[24px] bg-paper p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-4">
          <Avatar name={p.full_name} path={p.avatar_path} size={88} />
          <div className="min-w-0 flex-1 pt-1">
            <h2 className="text-[22px] leading-tight text-espresso">{p.full_name}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-burgundy">
              <SevenStar className="h-3.5 w-3.5" />
              {p.role === 'member' ? 'Membra' : ROLES[p.role]} · The Seven Club
            </p>
            {p.headline && <p className="mt-2 text-[14px] leading-snug">{p.headline}</p>}
          </div>
        </div>
        {p.bio && <p className="mt-4 text-[14px] leading-relaxed whitespace-pre-line text-espresso/90">{p.bio}</p>}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
          {p.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{p.city}</span>}
          {p.instagram && <a href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1"><AtSign className="h-3.5 w-3.5" />{p.instagram}</a>}
          {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1"><Globe className="h-3.5 w-3.5" />{p.website.replace(/^https?:\/\//, '')}</a>}
        </div>
        {p.interests.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.interests.map((i) => <span key={i} className="rounded-full bg-dusty-soft px-3 py-1 text-[12px] text-burgundy">{i}</span>)}
          </div>
        )}
        <dl className="mt-5 grid grid-cols-3 border-t border-line pt-4 text-center">
          {([[p.post_count, 'Publicação', 'Publicações'], [p.projects.length, 'Projeto', 'Projetos'], [p.businesses.length, 'Empresa', 'Empresas']] as const).map(([n, one, many]) => [n, n === 1 ? one : many] as const).map(([n, l]) => (
            <div key={l}><dt className="sr-only">{l}</dt><dd className="font-display text-[22px] text-espresso">{n}</dd><dd className="text-[12px] text-muted">{l}</dd></div>
          ))}
        </dl>
        <div className="mt-4">
          {p.is_me ? <LinkButton href="/perfil/editar" variant="secondary" full size="sm">Editar perfil</LinkButton> : <ProfileActions memberId={p.id} name={first} blocked={p.blocked_by_me} />}
        </div>
      </section>

      <nav className="mt-5 grid grid-cols-4 gap-1.5 px-4">
        {tabs.map((t) => (
          <Link key={t.key} href={`${base}?aba=${t.key}`} scroll={false}
            className={clsx('rounded-full px-1 py-2.5 text-center text-[13px] font-semibold whitespace-nowrap ring-1 transition', tab === t.key ? 'bg-burgundy text-ivory ring-burgundy' : 'bg-paper text-espresso ring-line')}>{t.label}</Link>
        ))}
      </nav>

      <div className="pt-3">
        {tab === 'feed' && (
          <FeedList initial={posts} query={{ author: p.id }}
            empty={<EmptyState title={p.is_me ? 'Seu feed está vazio' : `${first} ainda não publicou`} action={p.is_me && <LinkButton href="/publicar">Publicar</LinkButton>}>
              {p.is_me ? 'Suas publicações e as atividades do SEVEN que você compartilhar aparecem aqui.' : undefined}
            </EmptyState>} />
        )}
        {tab === 'empresas' && (
          <div className="space-y-3 px-4">
            {p.is_me && <LinkButton href="/business/nova" variant="secondary" full><Plus className="h-4 w-4" />Cadastrar empresa</LinkButton>}
            {p.businesses.length === 0 && <EmptyState title="Nenhuma empresa">{p.is_me ? 'Cadastre seu negócio para aparecer no diretório do clube.' : undefined}</EmptyState>}
            {p.businesses.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-[var(--radius-card)] bg-paper p-3 ring-1 ring-line">
                <Link href={`/business/${b.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={b.name} path={b.logo_path} size={52} className="rounded-2xl" />
                  <span className="min-w-0 leading-tight"><span className="block truncate font-semibold">{b.name}</span><span className="block truncate text-[13px] text-muted">{b.tagline || (b.role === 'owner' ? 'Responsável' : 'Administradora')}</span></span>
                </Link>
                {p.is_me && <LinkButton href={`/business/${b.slug}/editar`} size="sm" variant="secondary">Gerenciar</LinkButton>}
              </div>
            ))}
          </div>
        )}
        {tab === 'biblioteca' && (
          <div className="px-4">
            {p.is_me && <LinkButton href="/biblioteca/registrar" variant="secondary" full><BookPlus className="h-4 w-4" />Registrar livro lido</LinkButton>}
            {library.length === 0 ? (
              <EmptyState title="Estante vazia">{p.is_me ? 'Registre os livros que você já leu, do clube ou de antes dele, com suas estrelas e um comentário.' : `${first} ainda não registrou livros.`}</EmptyState>
            ) : (
              <Shelf entries={library} />
            )}
          </div>
        )}
        {tab === 'projetos' && (
          <div className="space-y-3 px-4">
            {p.is_me && <LinkButton href="/projetos/novo" variant="secondary" full><Plus className="h-4 w-4" />Criar projeto</LinkButton>}
            {p.projects.length === 0 && <EmptyState title="Nenhum projeto">{p.is_me ? 'Projetos podem ser ideias, iniciativas ou colaborações. Não precisam ser empresas.' : undefined}</EmptyState>}
            <div className="grid grid-cols-2 gap-3">
              {p.projects.map((pr) => (
                <Link key={pr.id} href={`/projetos/${pr.slug}`} className="overflow-hidden rounded-[var(--radius-card)] bg-paper ring-1 ring-line">
                  <div className="aspect-[4/3] bg-dusty-soft" style={pr.cover_path ? { backgroundImage: `url(${mediaUrl(pr.cover_path)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />
                  <div className="p-3 leading-tight">
                    <p className="flex items-center gap-1 truncate text-[14px] font-semibold">{pr.visibility === 'private' && <Lock className="h-3 w-3 shrink-0" />}{pr.name}</p>
                    <p className="mt-0.5 truncate text-[12px] text-muted">{PROJECT_CATEGORIES[pr.category]}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** Estante: capas em prateleiras de 3, com uma tábua sob cada fileira. */
export function Shelf({ entries }: { entries: LibraryEntry[] }) {
  const rows: LibraryEntry[][] = [];
  for (let i = 0; i < entries.length; i += 3) rows.push(entries.slice(i, i + 3));
  return (
    <div className="mt-5 space-y-6">
      <p className="text-[13px] text-muted">{entries.length} {entries.length === 1 ? 'livro lido' : 'livros lidos'}</p>
      {rows.map((row, i) => (
        <div key={i}>
          <ul className="grid grid-cols-3 items-end gap-4 px-2">
            {row.map((e) => (
              <li key={e.id}>
                <Link href={`/biblioteca/${e.id}`} className="block transition active:scale-[0.98]">
                  <BookCover book={e.book} />
                  <span className="sr-only">{e.book.title}, {e.rating} de 7 estrelas</span>
                </Link>
              </li>
            ))}
          </ul>
          <div aria-hidden className="mt-0 h-3 rounded-b-md bg-gradient-to-b from-[#d9c8b4] to-[#c7b39c] shadow-[0_6px_10px_-6px_rgba(37,37,31,0.4)]" />
        </div>
      ))}
    </div>
  );
}
