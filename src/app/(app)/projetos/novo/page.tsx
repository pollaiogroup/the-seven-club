import { requireMember } from '@/lib/auth';
import { PageHeader, Sheet } from '@/components/ui/page-header';
import { ProjectForm } from '@/components/projects/project-forms';

export const metadata = { title: 'Criar projeto' };

export default async function NewProject() {
  const me = await requireMember();
  return (
    <>
      <PageHeader title="Criar projeto" subtitle="Um projeto não precisa ser uma empresa" back="/perfil?aba=projetos" />
      <Sheet className="px-5 pt-6"><ProjectForm userId={me.id} /></Sheet>
    </>
  );
}
