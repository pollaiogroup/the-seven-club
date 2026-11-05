import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { SettingForm } from '@/components/admin/forms';

export const metadata = { title: 'Conteúdo' };

export default async function AdminContent() {
  await requireStaff('admin');
  const supabase = await createClient();
  const { data } = await supabase.from('app_settings').select('key, value');
  const get = (k: string) => { const v = (data || []).find((d: { key: string }) => d.key === k)?.value; return typeof v === 'string' ? v : ''; };
  return (
    <>
      <AdminTitle title="Conteúdo e Grioh" subtitle="Textos institucionais e o link da área ENSINO" />
      <div className="space-y-4">
        <Panel title="Comunidade Grioh"><SettingForm k="grioh_url" value={get('grioh_url')} label="Link da comunidade Grioh" hint="O botão da área ENSINO abre este endereço no navegador. Enquanto estiver vazio, a área mostra que o acesso será liberado em breve." /></Panel>
        <Panel title="Regras da comunidade"><SettingForm k="community_rules" value={get('community_rules')} multiline label="Texto" /></Panel>
        <Panel title="Política de privacidade"><SettingForm k="privacy_policy" value={get('privacy_policy')} multiline label="Texto" hint="Revise com o jurídico antes de abrir o clube." /></Panel>
        <Panel title="Termos de uso"><SettingForm k="terms" value={get('terms')} multiline label="Texto" /></Panel>
      </div>
    </>
  );
}
