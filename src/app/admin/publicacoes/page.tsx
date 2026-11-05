import Link from 'next/link';
import clsx from 'clsx';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { postStamp } from '@/lib/format';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { HideToggle } from '@/components/admin/forms';
import { Input } from '@/components/ui/field';

export const metadata = { title: 'Publicações' };

type Row = { id: string; body: string; created_at: string; hidden_at: string | null; author_id: string; post_id?: string; context?: string; source?: string };
const CONTEXT: Record<string, string> = { member: 'Integrante', business: 'Empresa', project: 'Projeto' };
const SOURCE: Record<string, string> = { seven: 'SEVEN', affirmation: 'Afirmação', share: 'Compartilhamento' };

/** Gestão direta de publicações e comentários, sem depender de denúncia. */
export default async function AdminPosts({ searchParams }: { searchParams: Promise<{ tipo?: string; estado?: string; q?: string }> }) {
  const { tipo = 'posts', estado = 'todas', q = '' } = await searchParams;
  await requireStaff('moderator');
  const supabase = await createClient();
  const term = q.trim().slice(0, 80);

  let rows: Row[] = [];
  if (tipo === 'comentarios') {
    let query = supabase.from('comments').select('id, body, created_at, hidden_at, author_id, post_id').order('created_at', { ascending: false }).limit(100);
    if (estado === 'ocultas') query = query.not('hidden_at', 'is', null);
    if (term) query = query.ilike('body', `%${term}%`);
    rows = ((await query).data || []) as Row[];
  } else {
    let query = supabase.from('posts').select('id, body, created_at, hidden_at, author_id, context, source').order('created_at', { ascending: false }).limit(100);
    if (estado === 'ocultas') query = query.not('hidden_at', 'is', null);
    if (term) query = query.ilike('body', `%${term}%`);
    rows = ((await query).data || []) as Row[];
  }
  const ids = [...new Set(rows.map((r) => r.author_id))];
  const { data: authors } = ids.length ? await supabase.from('profiles').select('id, full_name, handle').in('id', ids) : { data: [] };
  const who = new Map(((authors || []) as { id: string; full_name: string; handle: string }[]).map((a) => [a.id, a]));
  const href = (k: string, v: string) => {
    const p = new URLSearchParams({ tipo, estado, ...(term ? { q: term } : {}), [k]: v });
    return `/admin/publicacoes?${p}`;
  };

  return (
    <>
      <AdminTitle title="Publicações" subtitle="As 100 mais recentes. Ocultar tira o conteúdo do app para as integrantes; a autora e a moderação continuam vendo." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[['posts', 'Publicações'], ['comentarios', 'Comentários']].map(([k, l]) => (
          <Link key={k} href={href('tipo', k)} className={clsx('rounded-full px-4 py-2 text-[13px] ring-1', tipo === k ? 'bg-burgundy text-ivory ring-burgundy' : 'bg-paper ring-line')}>{l}</Link>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        {[['todas', 'Todas'], ['ocultas', 'Ocultas']].map(([k, l]) => (
          <Link key={k} href={href('estado', k)} className={clsx('rounded-full px-4 py-2 text-[13px] ring-1', estado === k ? 'bg-espresso text-ivory ring-espresso' : 'bg-paper ring-line')}>{l}</Link>
        ))}
      </div>
      <form className="mb-4 max-w-md">
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="estado" value={estado} />
        <Input name="q" defaultValue={term} type="search" placeholder="Buscar no texto" />
      </form>
      <Panel>
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const a = who.get(r.author_id);
            const link = `/post/${r.post_id || r.id}`;
            return (
              <li key={r.id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-muted">
                    {a ? <Link href={`/integrantes/${a.handle}`} className="font-semibold text-espresso">{a.full_name}</Link> : 'Integrante removida'}
                    {' · '}{postStamp(r.created_at)}
                    {r.context && ` · ${CONTEXT[r.context]}`}{r.source && SOURCE[r.source] ? ` · ${SOURCE[r.source]}` : ''}
                    {r.hidden_at && <span className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 font-semibold text-danger">Oculta</span>}
                  </p>
                  <Link href={link} className="mt-1 line-clamp-3 block text-[14px] whitespace-pre-line">{r.body || '(só imagens)'}</Link>
                </div>
                <HideToggle type={tipo === 'comentarios' ? 'comment' : 'post'} id={r.id} hidden={!!r.hidden_at} />
              </li>
            );
          })}
          {!rows.length && <li className="py-4 text-[14px] text-muted">{term || estado === 'ocultas' ? 'Nada encontrado com esses filtros.' : 'Ainda não há publicações.'}</li>}
        </ul>
      </Panel>
    </>
  );
}
