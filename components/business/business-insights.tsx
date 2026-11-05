import Link from 'next/link';
import type { MemberCard } from '@/lib/types';
import { Avatar } from '@/components/ui/avatar';
import { timeAgo } from '@/lib/format';

export type Insights = {
  posts_total: number; posts_30d: number; likes_30d: number; comments_30d: number; people_30d: number;
  recent_comments: { id: string; post_id: string; body: string; created_at: string; author: MemberCard | null }[];
};

/** Resumo das interações recebidas pelo feed da empresa. Visível só para quem administra. */
export function BusinessInsights({ i, slug }: { i: Insights; slug: string }) {
  const stats = [
    [i.people_30d, i.people_30d === 1 ? 'integrante interagiu' : 'integrantes interagiram'],
    [i.comments_30d, i.comments_30d === 1 ? 'comentário' : 'comentários'],
    [i.likes_30d, i.likes_30d === 1 ? 'curtida' : 'curtidas'],
    [i.posts_30d, i.posts_30d === 1 ? 'publicação' : 'publicações'],
  ] as const;
  return (
    <div className="rounded-[var(--radius-card)] bg-paper p-4 ring-1 ring-line">
      <dl className="grid grid-cols-2 gap-y-4">
        {stats.map(([n, l]) => (
          <div key={l}><dd className="font-display text-[26px] leading-none text-espresso">{n}</dd><dt className="mt-1 text-[12px] text-muted">{l}</dt></div>
        ))}
      </dl>
      {i.recent_comments.length > 0 ? (
        <ul className="mt-4 space-y-3 border-t border-line pt-4">
          {i.recent_comments.map((c) => (
            <li key={c.id}>
              <Link href={`/post/${c.post_id}`} className="flex gap-3">
                <Avatar name={c.author?.full_name || '?'} path={c.author?.avatar_path ?? null} size={32} />
                <span className="min-w-0 flex-1 text-[13px] leading-snug">
                  <span className="font-semibold">{c.author?.full_name || 'Integrante'}</span> <span className="text-muted">· {timeAgo(c.created_at)}</span>
                  <span className="mt-0.5 line-clamp-2 block">{c.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-t border-line pt-4 text-[13px] text-muted">
          {i.posts_total ? 'Ainda sem comentários nas publicações da empresa.' : 'Publique no feed da empresa para começar a receber interações.'}{' '}
          <Link href={`/business/${slug}?aba=feed`} className="font-semibold text-burgundy">Ver feed da empresa</Link>
        </p>
      )}
    </div>
  );
}
