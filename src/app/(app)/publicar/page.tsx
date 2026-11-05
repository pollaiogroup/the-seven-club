import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import type { BusinessCard, ProjectCard } from '@/lib/types';
import { PageHeader, Sheet } from '@/components/ui/page-header';
import { Composer } from '@/components/feed/composer';

export const metadata = { title: 'Publicar' };

export default async function PublishPage({ searchParams }: { searchParams: Promise<{ empresa?: string; projeto?: string; voltar?: string }> }) {
  const { empresa, projeto, voltar } = await searchParams;
  const me = await requireMember();
  const [businesses, projects] = await Promise.all([
    rpc<BusinessCard[]>('businesses_list', { p_mine: true, p_limit: 50 }),
    rpc<ProjectCard[]>('projects_list', { p_member: me.id, p_limit: 50 }),
  ]);
  const targets = [
    { value: 'member', label: `Meu perfil · ${me.full_name}` },
    ...businesses.map((b) => ({ value: `business:${b.id}`, label: `Empresa · ${b.name}` })),
    ...projects.map((p) => ({ value: `project:${p.id}`, label: `Projeto · ${p.name}` })),
  ];
  const initial = empresa ? `business:${empresa}` : projeto ? `project:${projeto}` : 'member';
  const back = voltar && voltar.startsWith('/') ? voltar : '/feed';
  return (
    <>
      <PageHeader title="Nova publicação" back={back} />
      <Sheet><Composer userId={me.id} targets={targets} initialTarget={initial} back={back} /></Sheet>
    </>
  );
}
