import { notFound, redirect } from 'next/navigation';
import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import type { BusinessPage } from '@/lib/types';
import { PageHeader, SectionTitle, Sheet } from '@/components/ui/page-header';
import { AdminsManager, BusinessForm, GalleryManager, OfferingsManager } from '@/components/business/business-forms';
import { DeleteBusiness } from '@/components/business/delete-business';
import { BusinessInsights, type Insights } from '@/components/business/business-insights';

export const metadata = { title: 'Editar empresa' };

export default async function EditBusiness({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await requireMember();
  const b = await rpc<BusinessPage | null>('business_page', { p_slug: slug });
  if (!b) notFound();
  if (!b.can_edit) redirect(`/business/${slug}`);
  const supabase = await createClient();
  const [{ data: cats }, insights] = await Promise.all([
    supabase.from('business_categories').select('id, name').order('sort'),
    rpc<Insights | null>('business_insights', { p_business: b.id }),
  ]);
  return (
    <>
      <PageHeader title="Editar empresa" subtitle={b.name} back={`/business/${slug}`} />
      <Sheet>
        {insights && <><SectionTitle>Interações nos últimos 30 dias</SectionTitle><div className="px-5"><BusinessInsights i={insights} slug={slug} /></div></>}
        <SectionTitle>Informações</SectionTitle>
        <div className="px-5"><BusinessForm userId={me.id} categories={cats || []} business={b} /></div>
        <SectionTitle>Produtos e serviços</SectionTitle>
        <div className="px-5"><OfferingsManager business={b} /></div>
        <SectionTitle>Galeria</SectionTitle>
        <div className="px-5"><GalleryManager business={b} userId={me.id} /></div>
        <SectionTitle>Quem administra</SectionTitle>
        <div className="px-5"><AdminsManager business={b} /></div>
        {b.is_owner && <div className="px-5 pt-10"><DeleteBusiness id={b.id} /></div>}
      </Sheet>
    </>
  );
}
