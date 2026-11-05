import Link from 'next/link';
import { Lock, Plus, Search } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import type { ProjectCard } from '@/lib/types';
import { mediaUrl } from '@/lib/media';
import { PROJECT_CATEGORIES } from '@/lib/labels';
import { PageHeader, Sheet } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { LinkButton } from '@/components/ui/button';

export const metadata = { title: 'Projetos' };

export default async function Projects({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  await requireMember();
  const items = await rpc<ProjectCard[]>('projects_list', { p_q: q || null, p_limit: 40 });
  return (
    <>
      <PageHeader title="Projetos" subtitle="Ideias, iniciativas e colaborações do clube" back="/perfil"
        actions={<Link href="/projetos/novo" aria-label="Criar projeto" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><Plus className="h-5 w-5" /></Link>}>
        <form role="search" className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} type="search" placeholder="Buscar projetos" className="h-12 w-full rounded-full bg-ivory pr-4 pl-12 text-espresso focus:outline-none" />
        </form>
      </PageHeader>
      <Sheet className="px-4 pt-5">
        {items.length === 0 ? (
          <EmptyState title="Nenhum projeto por aqui" action={<LinkButton href="/projetos/novo">Criar projeto</LinkButton>} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((p) => (
              <Link key={p.id} href={`/projetos/${p.slug}`} className="flex gap-3 rounded-[var(--radius-card)] bg-paper p-3 ring-1 ring-line hover:ring-dusty">
                <div className="h-20 w-20 shrink-0 rounded-2xl bg-dusty-soft bg-cover bg-center" style={p.cover_path ? { backgroundImage: `url(${mediaUrl(p.cover_path)})` } : undefined} />
                <div className="min-w-0 leading-tight">
                  <p className="flex items-center gap-1 font-semibold">{p.visibility === 'private' && <Lock className="h-3.5 w-3.5" />}<span className="truncate">{p.name}</span></p>
                  <p className="mt-0.5 text-[12px] text-muted">{PROJECT_CATEGORIES[p.category]} · {p.member_count} {p.member_count === 1 ? 'pessoa' : 'pessoas'}</p>
                  {p.description && <p className="mt-1 line-clamp-2 text-[13px] text-espresso/80">{p.description}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Sheet>
    </>
  );
}
