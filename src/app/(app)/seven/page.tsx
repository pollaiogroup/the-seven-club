import Link from 'next/link';
import { CalendarDays, Flame, History } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import type { Pillar, SevenOverview } from '@/lib/types';
import { longDate } from '@/lib/format';
import { IconLink, PageHeader, Sheet } from '@/components/ui/page-header';
import { LinkButton } from '@/components/ui/button';
import { ProgressRing } from '@/components/seven/progress-ring';
import { PillarList } from '@/components/seven/pillar-list';

export const metadata = { title: 'Meu Seven' };

export default async function SevenPage() {
  await requireMember();
  const [pillars, overview] = await Promise.all([rpc<Pillar[]>('seven_day'), rpc<SevenOverview>('seven_overview')]);
  const done = pillars.filter((p) => p.check_in?.completed_at).length;
  const next = pillars.find((p) => !p.check_in?.completed_at) || pillars[0]!;
  return (
    <>
      <PageHeader title="Meu Seven" subtitle={`Hoje, ${longDate(overview.today)}`}
        actions={<IconLink href="/seven/evolucao" label="Minha evolução"><CalendarDays className="h-[22px] w-[22px]" /></IconLink>} />
      <Sheet className="px-4 pt-6">
        <ProgressRing done={done} />
        <div className="mt-2 flex justify-center gap-3 text-[13px]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 ring-1 ring-line"><Flame className="h-4 w-4 text-grioh" />{overview.streak} {overview.streak === 1 ? 'dia seguido' : 'dias seguidos'}</span>
          <Link href="/seven/historico" className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 ring-1 ring-line"><History className="h-4 w-4 text-burgundy" />Histórico</Link>
        </div>
        <div className="mt-5"><PillarList pillars={pillars} /></div>
        <p className="mt-3 px-2 text-center text-[12px] leading-relaxed text-muted">Seus registros são privados. Nada vai para o Feed sem você decidir compartilhar.</p>
        <div className="mt-5"><LinkButton href={`/seven/${next.slug}`} full size="lg">Registrar atividade</LinkButton></div>
      </Sheet>
    </>
  );
}
