import { requireMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Sheet } from '@/components/ui/page-header';
import { BusinessForm } from '@/components/business/business-forms';

export const metadata = { title: 'Cadastrar empresa' };

export default async function NewBusiness() {
  const me = await requireMember();
  const supabase = await createClient();
  const { data: cats } = await supabase.from('business_categories').select('id, name').order('sort');
  return (
    <>
      <PageHeader title="Cadastrar empresa" subtitle="Ela fica vinculada a você como responsável" back="/business" />
      <Sheet className="px-5 pt-6"><BusinessForm userId={me.id} categories={cats || []} /></Sheet>
    </>
  );
}
