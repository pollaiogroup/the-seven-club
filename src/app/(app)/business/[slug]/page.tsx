import Link from 'next/link';
import { notFound } from 'next/navigation';
import clsx from 'clsx';
import { AtSign, Globe, MapPin, MessageCircle, Pencil, PenLine } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import type { BusinessPage as B, Post } from '@/lib/types';
import { mediaUrl } from '@/lib/media';
import { PageHeader, SectionTitle, Sheet } from '@/components/ui/page-header';
import { Avatar } from '@/components/ui/avatar';
import { LinkButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FeedList } from '@/components/feed/feed-list';
import { ReportButton } from '@/components/report-button';

const TABS = [
  { key: 'sobre', label: 'Sobre' },
  { key: 'ofertas', label: 'Produtos e serviços' },
  { key: 'galeria', label: 'Galeria' },
  { key: 'feed', label: 'Publicações' },
];

export default async function BusinessDetail({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ aba?: string; nova?: string }> }) {
  const { slug } = await params;
  const { aba = 'sobre', nova } = await searchParams;
  await requireMember();
  const b = await rpc<B | null>('business_page', { p_slug: slug });
  if (!b) notFound();
  const posts = aba === 'feed' ? await rpc<Post[]>('feed_page', { p_business: b.id }) : [];
  const cover = mediaUrl(b.cover_path);
  const links = [
    b.whatsapp && { href: `https://wa.me/${b.whatsapp}`, label: 'WhatsApp', icon: MessageCircle },
    b.instagram && { href: `https://instagram.com/${b.instagram}`, label: 'Instagram', icon: AtSign },
    b.website && { href: b.website, label: 'Site', icon: Globe },
    b.address && { href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`, label: 'Mapa', icon: MapPin },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Globe }[];
  const products = b.offerings.filter((o) => o.kind === 'product');
  const services = b.offerings.filter((o) => o.kind === 'service');

  return (
    <>
      <PageHeader title={b.name} back="/business"
        actions={b.can_edit && <Link href={`/business/${b.slug}/editar`} aria-label="Editar empresa" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><Pencil className="h-5 w-5" /></Link>} />
      <Sheet>
        <div className="relative h-36 overflow-hidden rounded-t-[28px] bg-dusty-soft sm:h-48" style={cover ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />
        <div className="-mt-10 px-5">
          <Avatar name={b.name} path={b.logo_path} size={84} className="rounded-3xl ring-4 ring-ivory" />
          <h2 className="mt-3 text-[26px] leading-tight text-burgundy">{b.name}</h2>
          {b.tagline && <p className="mt-1 text-[15px] text-muted">{b.tagline}</p>}
          <p className="mt-2 text-[13px] text-muted">{b.category?.name}{b.city ? ` · ${b.city}` : ''}</p>
          {nova && <p className="mt-4 rounded-2xl bg-olive/15 px-4 py-3 text-[14px] text-olive-ink">Empresa cadastrada. Adicione produtos, serviços e fotos em Editar.</p>}
          {b.hidden && <p className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-[14px] text-danger">Esta empresa está oculta pela moderação.</p>}
          {links.length > 0 && (
            <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
              {links.map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-paper px-4 text-[13px] font-semibold text-burgundy ring-1 ring-line">
                  <l.icon className="h-4 w-4" />{l.label}
                </a>
              ))}
            </div>
          )}
          {b.owner && (
            <Link href={`/integrantes/${b.owner.handle}`} className="mt-4 flex items-center gap-3 rounded-2xl bg-paper p-3 ring-1 ring-line">
              <Avatar name={b.owner.full_name} path={b.owner.avatar_path} size={36} />
              <span className="text-[14px] leading-tight"><span className="block text-[12px] text-muted">Responsável</span>{b.owner.full_name}</span>
            </Link>
          )}
        </div>

        <nav className="no-scrollbar mt-5 flex gap-1 overflow-x-auto border-b border-line px-5">
          {TABS.map((t) => (
            <Link key={t.key} href={`/business/${b.slug}?aba=${t.key}`} scroll={false}
              className={clsx('shrink-0 border-b-2 px-3 py-3 text-[14px] transition', aba === t.key ? 'border-burgundy font-semibold text-burgundy' : 'border-transparent text-muted')}>{t.label}</Link>
          ))}
        </nav>

        {aba === 'sobre' && (
          <div className="px-5 pt-5">
            {b.description ? <p className="text-[15px] leading-relaxed whitespace-pre-line">{b.description}</p> : <p className="text-[14px] text-muted">Sem descrição ainda.</p>}
            {b.service_area && <p className="mt-5 text-[14px]"><span className="font-semibold">Área de atendimento:</span> {b.service_area}</p>}
            {b.address && <p className="mt-2 text-[14px]"><span className="font-semibold">Endereço:</span> {b.address}</p>}
            <div className="mt-8"><ReportButton targetType="business" targetId={b.id} /></div>
          </div>
        )}

        {aba === 'ofertas' && (
          <div className="px-5">
            {b.offerings.length === 0 && <EmptyState title="Nada cadastrado ainda" />}
            {[{ t: 'Serviços', l: services }, { t: 'Produtos', l: products }].filter((g) => g.l.length).map((g) => (
              <section key={g.t}>
                <SectionTitle>{g.t}</SectionTitle>
                <ul className="divide-y divide-line rounded-2xl bg-paper ring-1 ring-line">
                  {g.l.map((o) => (
                    <li key={o.id} className="px-4 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-[15px] font-medium">{o.name}</p>
                        {o.price_text && <p className="shrink-0 text-[13px] font-semibold text-burgundy">{o.price_text}</p>}
                      </div>
                      {o.description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{o.description}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {aba === 'galeria' && (
          b.media.length ? (
            <div className="grid grid-cols-2 gap-1 px-1 pt-1 sm:grid-cols-3">
              {b.media.map((m) => <img key={m.id} src={mediaUrl(m.path)!} alt="" loading="lazy" className="aspect-square w-full bg-dusty-soft object-cover" />)}
            </div>
          ) : <EmptyState title="Galeria vazia" />
        )}

        {aba === 'feed' && (
          <div className="pt-3">
            {b.can_edit && (
              <div className="px-5 pb-3"><LinkButton href={`/publicar?empresa=${b.id}&voltar=/business/${b.slug}?aba=feed`} variant="secondary" full><PenLine className="h-4 w-4" />Publicar como {b.name}</LinkButton></div>
            )}
            <FeedList initial={posts} query={{ business: b.id }} empty={<EmptyState title="Nenhuma publicação da empresa ainda" />} />
          </div>
        )}
      </Sheet>
    </>
  );
}
