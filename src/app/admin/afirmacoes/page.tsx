import clsx from 'clsx';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { THEMES } from '@/lib/labels';
import { longDate } from '@/lib/format';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { AffirmationForm, AffirmationImport, ScheduleForm } from '@/components/admin/forms';

export const metadata = { title: 'Afirmações' };
type A = { id: string; text: string; theme: string; status: string };

export default async function AdminAffirmations({ searchParams }: { searchParams: Promise<{ status?: string; tema?: string }> }) {
  const { status = 'published', tema } = await searchParams;
  await requireStaff('admin');
  const supabase = await createClient();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  let q = supabase.from('affirmations').select('id, text, theme, status', { count: 'exact' }).order('created_at', { ascending: false }).limit(500);
  if (status !== 'all') q = q.eq('status', status);
  if (tema) q = q.eq('theme', tema);
  const [{ data: list, count }, { data: upcoming }, { data: published }] = await Promise.all([
    q,
    supabase.from('affirmation_schedule').select('day, affirmation_id, source').gte('day', today).order('day').limit(14),
    supabase.from('affirmations').select('id, text').eq('status', 'published').order('text').limit(1000),
  ]);
  const byId = new Map(((published || []) as { id: string; text: string }[]).map((a) => [a.id, a.text]));
  return (
    <>
      <AdminTitle title="Afirmações" subtitle="Biblioteca editorial. A seleção diária não repete até usar todas as publicadas." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Nova afirmação"><AffirmationForm /></Panel>
        <Panel title="Importar várias"><AffirmationImport /></Panel>
      </div>
      <Panel title="Agendar uma afirmação para um dia" className="mt-4">
        <ScheduleForm options={[...byId].map(([id, text]) => ({ id, text }))} minDay={today} />
        {!!upcoming?.length && (
          <ul className="mt-4 divide-y divide-line text-[14px]">
            {(upcoming as { day: string; affirmation_id: string; source: string }[]).map((u) => (
              <li key={u.day} className="flex gap-3 py-2"><span className="w-40 shrink-0 text-muted">{longDate(u.day)}</span><span className="flex-1">{byId.get(u.affirmation_id)}</span><span className="text-[12px] text-muted">{u.source === 'manual' ? 'manual' : 'automática'}</span></li>
            ))}
          </ul>
        )}
      </Panel>
      <div className="mt-6 mb-3 flex flex-wrap gap-2">
        {[['published', 'Publicadas'], ['draft', 'Rascunhos'], ['archived', 'Arquivadas'], ['all', 'Todas']].map(([k, l]) => (
          <Link key={k} href={`/admin/afirmacoes?status=${k}${tema ? `&tema=${tema}` : ''}`} className={clsx('rounded-full px-4 py-2 text-[13px] ring-1', status === k ? 'bg-burgundy text-ivory ring-burgundy' : 'bg-paper ring-line')}>{l}</Link>
        ))}
        <span className="mx-1 w-px bg-line" />
        {Object.entries(THEMES).map(([k, l]) => (
          <Link key={k} href={`/admin/afirmacoes?status=${status}${tema === k ? '' : `&tema=${k}`}`} className={clsx('rounded-full px-3 py-2 text-[12px] ring-1', tema === k ? 'bg-olive text-white ring-olive' : 'bg-paper ring-line')}>{l}</Link>
        ))}
      </div>
      <Panel title={`${count ?? list?.length ?? 0} ${count === 1 ? 'afirmação' : 'afirmações'}${(count ?? 0) > (list?.length ?? 0) ? ` · mostrando as ${list?.length} mais recentes` : ''}`}>
        <ul className="divide-y divide-line">
          {((list || []) as A[]).map((a) => <li key={a.id} className="py-3"><AffirmationForm a={a} /></li>)}
        </ul>
      </Panel>
    </>
  );
}
