import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Lock, Pencil, PenLine } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import type { Post, ProjectPage } from '@/lib/types';
import { mediaUrl } from '@/lib/media';
import { PROJECT_CATEGORIES } from '@/lib/labels';
import { PageHeader, SectionTitle, Sheet } from '@/components/ui/page-header';
import { Avatar } from '@/components/ui/avatar';
import { LinkButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FeedList } from '@/components/feed/feed-list';
import { ReportButton } from '@/components/report-button';
import { LeaveOrDelete } from '@/components/projects/project-forms';

export default async function ProjectDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await requireMember();
  const p = await rpc<ProjectPage | null>('project_page', { p_slug: slug });
  if (!p) notFound();
  const posts = await rpc<Post[]>('feed_page', { p_project: p.id });
  const cover = mediaUrl(p.cover_path);
  return (
    <>
      <PageHeader title={p.name} subtitle={PROJECT_CATEGORIES[p.category]} back="/projetos"
        actions={p.can_edit && <Link href={`/projetos/${p.slug}/editar`} aria-label="Editar projeto" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><Pencil className="h-5 w-5" /></Link>} />
      <Sheet>
        <div className="aspect-[2/1] max-h-64 w-full rounded-t-[28px] bg-dusty-soft bg-cover bg-center" style={cover ? { backgroundImage: `url(${cover})` } : undefined} />
        <div className="px-5 pt-5">
          {p.visibility === 'private' && <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-olive/15 px-3 py-1 text-[12px] font-semibold text-olive-ink"><Lock className="h-3.5 w-3.5" />Projeto privado</p>}
          {p.hidden && <p className="mb-3 rounded-2xl bg-danger/10 px-4 py-3 text-[14px] text-danger">Projeto oculto pela moderação.</p>}
          {p.description ? <p className="text-[15px] leading-relaxed whitespace-pre-line">{p.description}</p> : <p className="text-[14px] text-muted">Sem descrição.</p>}
        </div>
        <SectionTitle>Quem participa</SectionTitle>
        <div className="no-scrollbar flex gap-4 overflow-x-auto px-5">
          {p.members.map((m) => (
            <Link key={m.id} href={`/integrantes/${m.handle}`} className="flex w-16 shrink-0 flex-col items-center text-center">
              <Avatar name={m.full_name} path={m.avatar_path} size={52} />
              <span className="mt-1 w-full truncate text-[12px]">{m.full_name.split(' ')[0]}</span>
              {m.role === 'owner' && <span className="text-[10px] text-muted">Responsável</span>}
            </Link>
          ))}
        </div>
        <SectionTitle>Feed do projeto</SectionTitle>
        {p.is_member && <div className="px-5 pb-3"><LinkButton href={`/publicar?projeto=${p.id}&voltar=/projetos/${p.slug}`} variant="secondary" full><PenLine className="h-4 w-4" />Publicar no projeto</LinkButton></div>}
        <FeedList initial={posts} query={{ project: p.id }} empty={<EmptyState title="Nenhuma publicação ainda">{p.is_member ? 'Compartilhe atualizações com quem participa.' : undefined}</EmptyState>} />
        <div className="space-y-4 px-5 pt-8">
          <LeaveOrDelete project={p} userId={me.id} />
          {!p.is_owner && <ReportButton targetType="project" targetId={p.id} />}
        </div>
      </Sheet>
    </>
  );
}
