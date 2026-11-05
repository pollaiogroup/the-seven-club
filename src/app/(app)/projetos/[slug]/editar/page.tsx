import { notFound, redirect } from 'next/navigation';
import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import type { ProjectPage } from '@/lib/types';
import { PageHeader, SectionTitle, Sheet } from '@/components/ui/page-header';
import { MembersManager, ProjectForm } from '@/components/projects/project-forms';

export const metadata = { title: 'Editar projeto' };

export default async function EditProject({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await requireMember();
  const p = await rpc<ProjectPage | null>('project_page', { p_slug: slug });
  if (!p) notFound();
  if (!p.can_edit) redirect(`/projetos/${slug}`);
  return (
    <>
      <PageHeader title="Editar projeto" subtitle={p.name} back={`/projetos/${slug}`} />
      <Sheet>
        <div className="px-5 pt-6"><ProjectForm userId={me.id} project={p} /></div>
        <SectionTitle>Colaboradoras</SectionTitle>
        <div className="px-5"><MembersManager project={p} /></div>
      </Sheet>
    </>
  );
}
