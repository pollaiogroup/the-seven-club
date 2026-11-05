import Link from 'next/link';
import clsx from 'clsx';
import { Plus, Search } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import type { BusinessCard } from '@/lib/types';
import { PageHeader, SectionTitle, Sheet } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { LinkButton } from '@/components/ui/button';
import { CategoryIcon } from '@/components/business/category-icon';
import { BusinessFeature, BusinessRow } from '@/components/business/business-card';

export const metadata = { title: 'Business' };
const PAGE = 20;

export default async function BusinessPage({ searchParams }: { searchParams: Promise<{ q?: string; categoria?: string; pagina?: string }> }) {
  const { q = '', categoria, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina) || 1);
  await requireMember();
  const supabase = await createClient();
  const filtering = !!(q || categoria);
  const [{ data: cats }, featured, list] = await Promise.all([
    supabase.from('business_categories').select('id, slug, name, icon').order('sort'),
    filtering ? Promise.resolve([] as BusinessCard[]) : rpc<BusinessCard[]>('businesses_list', { p_featured: true, p_limit: 10 }),
    rpc<BusinessCard[]>('businesses_list', { p_q: q || null, p_category: categoria || null, p_offset: (page - 1) * PAGE, p_limit: PAGE + 1 }),
  ]);
  const hasMore = list.length > PAGE;
  const items = list.slice(0, PAGE);
  const qs = (p: number) => `/business?${new URLSearchParams({ ...(q && { q }), ...(categoria && { categoria }), pagina: String(p) })}`;

  return (
    <>
      <PageHeader title="Business" subtitle="Empresas, produtos e serviços das integrantes"
        actions={<Link href="/business/nova" aria-label="Cadastrar empresa" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><Plus className="h-5 w-5" /></Link>}>
        <form action="/business" role="search" className="relative">
          {categoria && <input type="hidden" name="categoria" value={categoria} />}
          <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} type="search" enterKeyHint="search" placeholder="Buscar empresas, produtos ou serviços"
            className="h-12 w-full rounded-full bg-ivory pr-4 pl-12 text-espresso placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-dusty" />
        </form>
      </PageHeader>
      <Sheet>
        <nav aria-label="Categorias" className="no-scrollbar flex gap-3 overflow-x-auto px-5 pt-5 pb-1">
          {(cats || []).map((c: { id: number; slug: string; name: string; icon: string }) => {
            const active = categoria === c.slug;
            return (
              <Link key={c.id} href={active ? '/business' : `/business?categoria=${c.slug}`} aria-current={active ? 'true' : undefined}
                className={clsx('flex h-[84px] w-[78px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl px-1 text-center text-[11px] leading-tight ring-1 transition',
                  active ? 'bg-burgundy text-ivory ring-burgundy' : 'bg-paper text-espresso ring-line hover:ring-dusty')}>
                <CategoryIcon icon={c.icon} className={clsx('h-6 w-6', active ? 'text-ivory' : 'text-burgundy')} />
                {c.name}
              </Link>
            );
          })}
        </nav>

        {featured.length > 0 && (
          <>
            <SectionTitle>Destaques do Clube</SectionTitle>
            <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1">{featured.map((b) => <BusinessFeature key={b.id} b={b} />)}</div>
          </>
        )}

        <SectionTitle action={filtering && <Link href="/business" className="text-[13px] font-semibold text-burgundy">Limpar filtros</Link>}>
          {q ? `Resultados para “${q}”` : categoria ? (cats || []).find((c: { slug: string }) => c.slug === categoria)?.name || 'Empresas' : 'Todas as Empresas'}
        </SectionTitle>
        {items.length === 0 ? (
          <EmptyState title={filtering ? 'Nada encontrado' : 'Nenhuma empresa cadastrada ainda'}
            action={<LinkButton href="/business/nova">Cadastrar minha empresa</LinkButton>}>
            {filtering ? 'Tente outra palavra: nome da empresa, produto, serviço ou o nome da integrante.' : 'Seja a primeira a apresentar seu negócio para o clube.'}
          </EmptyState>
        ) : (
          <div className="space-y-3 px-5">{items.map((b) => <BusinessRow key={b.id} b={b} />)}</div>
        )}
        {(page > 1 || hasMore) && (
          <div className="flex justify-between px-5 pt-5">
            {page > 1 ? <LinkButton variant="secondary" size="sm" href={qs(page - 1)}>Anteriores</LinkButton> : <span />}
            {hasMore && <LinkButton variant="secondary" size="sm" href={qs(page + 1)}>Mais empresas</LinkButton>}
          </div>
        )}
      </Sheet>
    </>
  );
}
