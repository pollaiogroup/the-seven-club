import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import type { Pillar } from '@/lib/types';
import { PageHeader, SectionTitle, Sheet } from '@/components/ui/page-header';
import { PillarGlyph } from '@/components/seven/pillar-glyph';
import { CheckInForm, ShareForm } from '@/components/seven/check-in-form';

export default async function PillarPage({ params }: { params: Promise<{ pilar: string }> }) {
  const { pilar } = await params;
  const me = await requireMember();
  const pillars = await rpc<Pillar[]>('seven_day');
  const p = pillars.find((x) => x.slug === pilar);
  if (!p) notFound();
  let photoUrl: string | null = null;
  if (p.check_in?.photo_path) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from('private').createSignedUrl(p.check_in.photo_path, 600);
    photoUrl = data?.signedUrl || null;
  }
  const activity = p.activities.find((a) => a.id === p.check_in?.activity_id)?.title;
  const idx = pillars.findIndex((x) => x.slug === pilar);
  const nextP = pillars[(idx + 1) % pillars.length]!;
  return (
    <>
      <PageHeader title={p.name} subtitle={p.description} back="/seven" />
      <Sheet className="px-5 pt-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-burgundy text-ivory"><PillarGlyph slug={p.slug} className="h-6 w-6" /></span>
          <p className="font-display text-[20px] text-burgundy">{p.prompt}</p>
        </div>
        <CheckInForm pillar={p} userId={me.id} photoUrl={photoUrl} />
        {p.check_in?.completed_at && (
          <>
            <SectionTitle>Compartilhar</SectionTitle>
            {p.check_in.shared ? (
              <p className="flex items-center gap-2 rounded-2xl bg-olive/15 px-4 py-3 text-[14px] text-olive-ink"><CheckCircle2 className="h-5 w-5" />Compartilhada no Feed.</p>
            ) : (
              <ShareForm pillar={p} hasPhoto={!!p.check_in.photo_path} defaultText={activity ? `${activity}. ` : ''} />
            )}
          </>
        )}
        <Link href={`/seven/${nextP.slug}`} className="mt-8 block text-center text-[14px] font-semibold text-burgundy">Próximo pilar: {nextP.name} →</Link>
      </Sheet>
    </>
  );
}
