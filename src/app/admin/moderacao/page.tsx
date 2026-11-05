import Link from 'next/link';
import clsx from 'clsx';
import { requireStaff } from '@/lib/auth';
import { rpc } from '@/lib/db';
import { timeAgo } from '@/lib/format';
import type { MemberCard } from '@/lib/types';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { ModerationActions } from '@/components/admin/forms';

export const metadata = { title: 'Moderação' };
type R = { id: string; target_type: string; target_id: string; reason: string; status: string; created_at: string; resolution_note: string | null; reporter: MemberCard | null; preview: { body: string; hidden: boolean; author: MemberCard | null; link: string } | null };
const TYPE: Record<string, string> = { post: 'Publicação', comment: 'Comentário', member: 'Integrante', business: 'Empresa', project: 'Projeto' };

export default async function Moderation({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = 'open' } = await searchParams;
  await requireStaff('moderator');
  const list = await rpc<R[]>('admin_reports', { p_status: status });
  return (
    <>
      <AdminTitle title="Moderação" subtitle="Denúncias das integrantes. Quem denunciou não é revelado à autora." />
      <nav className="mb-4 flex gap-2">
        {[['open', 'Abertas'], ['actioned', 'Resolvidas'], ['dismissed', 'Descartadas'], ['all', 'Todas']].map(([k, l]) => (
          <Link key={k} href={`/admin/moderacao?status=${k}`} className={clsx('rounded-full px-4 py-2 text-[13px] ring-1', status === k ? 'bg-burgundy text-ivory ring-burgundy' : 'bg-paper ring-line')}>{l}</Link>
        ))}
      </nav>
      <div className="space-y-3">
        {list.length === 0 && <Panel><p className="text-[14px] text-muted">Nenhuma denúncia aqui.</p></Panel>}
        {list.map((r) => (
          <Panel key={r.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[13px] font-semibold text-burgundy">{TYPE[r.target_type]} · {r.reason}</p>
              <p className="text-[12px] text-muted">por {r.reporter?.full_name || 'integrante removida'} · {timeAgo(r.created_at)}</p>
            </div>
            {r.preview ? (
              <Link href={r.preview.link} className="mt-2 block rounded-xl bg-ivory p-3 text-[14px] ring-1 ring-line">
                <span className="block text-[12px] text-muted">{r.preview.author?.full_name}{r.preview.hidden ? ' · já oculto' : ''}</span>
                <span className="line-clamp-4 whitespace-pre-line">{r.preview.body || '(sem texto)'}</span>
              </Link>
            ) : <p className="mt-2 text-[13px] text-muted">O conteúdo já foi excluído.</p>}
            {r.resolution_note && <p className="mt-2 text-[13px] text-muted">Nota: {r.resolution_note}</p>}
            <ModerationActions report={r} />
          </Panel>
        ))}
      </div>
    </>
  );
}
