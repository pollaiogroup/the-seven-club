import Link from 'next/link';
import clsx from 'clsx';
import { Lock, Share2 } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { longDate } from '@/lib/format';
import { PageHeader, Sheet } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { LinkButton } from '@/components/ui/button';
import { PillarGlyph } from '@/components/seven/pillar-glyph';

export const metadata = { title: 'Histórico do Seven' };

type Item = { id: string; day: string; note: string | null; photo_path: string | null; pillar: { slug: string; name: string }; activity: string | null; shared: boolean };
const PILLARS = ['body', 'mind', 'leadership', 'business', 'wealth', 'connection', 'lifestyle'];

export default async function SevenHistory({ searchParams }: { searchParams: Promise<{ pilar?: string; antes?: string }> }) {
  const { pilar, antes } = await searchParams;
  await requireMember();
  const items = await rpc<Item[]>('seven_history', { p_pillar: pilar || null, p_before: antes || null, p_limit: 40 });
  const photos = items.filter((i) => i.photo_path).map((i) => i.photo_path!);
  const urls: Record<string, string> = {};
  if (photos.length) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from('private').createSignedUrls(photos, 600);
    (data || []).forEach((d: { path: string | null; signedUrl: string | null }) => { if (d.path && d.signedUrl) urls[d.path] = d.signedUrl; });
  }
  const groups = items.reduce<Record<string, Item[]>>((acc, i) => { (acc[i.day] ||= []).push(i); return acc; }, {});
  const last = items[items.length - 1];
  return (
    <>
      <PageHeader title="Histórico" subtitle="Seus registros concluídos" back="/seven" />
      <Sheet className="pt-4">
        <nav className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2">
          <Link href="/seven/historico" className={clsx('shrink-0 rounded-full px-4 py-2 text-[12px] font-semibold ring-1', !pilar ? 'bg-burgundy text-ivory ring-burgundy' : 'bg-paper ring-line')}>Todos</Link>
          {PILLARS.map((p) => <Link key={p} href={`/seven/historico?pilar=${p}`} className={clsx('shrink-0 rounded-full px-4 py-2 text-[12px] font-bold tracking-wide uppercase ring-1', pilar === p ? 'bg-burgundy text-ivory ring-burgundy' : 'bg-paper ring-line')}>{p}</Link>)}
        </nav>
        {items.length === 0 ? <EmptyState title="Nenhum registro ainda" action={<LinkButton href="/seven">Registrar hoje</LinkButton>} /> : (
          <div className="space-y-6 px-4 pt-3">
            {Object.entries(groups).map(([day, list]) => (
              <section key={day}>
                <h2 className="mb-2 text-[15px] text-burgundy">{longDate(day)}</h2>
                <ul className="space-y-2">
                  {list.map((i) => (
                    <li key={i.id} className="flex gap-3 rounded-2xl bg-paper p-3 ring-1 ring-line">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-burgundy text-ivory"><PillarGlyph slug={i.pillar.slug} className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold tracking-wide">{i.pillar.name}{i.activity && <span className="font-normal tracking-normal text-muted"> · {i.activity}</span>}</p>
                        {i.note && <p className="mt-1 flex gap-1.5 text-[14px] leading-relaxed"><Lock className="mt-1 h-3 w-3 shrink-0 text-muted" />{i.note}</p>}
                        {i.shared && <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-olive-ink"><Share2 className="h-3 w-3" />Compartilhado</p>}
                      </div>
                      {i.photo_path && urls[i.photo_path] && <img src={urls[i.photo_path]} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" loading="lazy" />}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {items.length === 40 && last && <LinkButton variant="secondary" full href={`/seven/historico?${new URLSearchParams({ ...(pilar && { pilar }), antes: last.day })}`}>Registros anteriores</LinkButton>}
          </div>
        )}
      </Sheet>
    </>
  );
}
