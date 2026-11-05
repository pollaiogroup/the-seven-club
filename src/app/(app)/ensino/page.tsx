import { ArrowUpRight } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { GriohIcon } from '@/components/ui/icons';
import { Sheet } from '@/components/ui/page-header';

export const metadata = { title: 'Ensino · Grioh' };

/** A Grioh fica fora do app: esta área só leva a integrante para a comunidade da Grioh. */
export default async function Ensino() {
  await requireMember();
  const supabase = await createClient();
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'grioh_url').maybeSingle();
  const url = typeof data?.value === 'string' && /^https:\/\//.test(data.value) ? data.value : null;
  return (
    <>
      <header className="pt-safe bg-burgundy text-ivory">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 pt-4 pb-5">
          <GriohIcon className="h-11 w-11 text-ivory" />
          <div>
            <h1 className="text-[28px] leading-tight">Ensino</h1>
            <p className="text-[14px] text-dusty">Powered by Grioh</p>
          </div>
        </div>
      </header>
      <Sheet className="px-5 pt-6">
        <div className="rounded-[28px] bg-burgundy-deep p-6 text-ivory">
          <div className="flex items-center justify-between gap-4">
            <p className="font-display text-[44px] leading-none">Grioh</p>
            <img src="/brand/grioh/grioh-tile.png" alt="Grioh" className="h-20 w-20 shrink-0 rounded-[22px]" />
          </div>
          <p className="mt-5 text-[16px] leading-snug text-ivory/90">A comunidade de ensino do The Seven Club, com cursos, trilhas e comunidades de estudo.</p>
        </div>
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="mt-6 flex h-14 items-center justify-center gap-2 rounded-full bg-burgundy text-[16px] font-semibold text-ivory">
            Abrir a comunidade Grioh <ArrowUpRight className="h-5 w-5" />
          </a>
        ) : (
          <p className="mt-6 rounded-2xl bg-paper px-5 py-4 text-center text-[14px] leading-relaxed text-muted ring-1 ring-line">
            O acesso à comunidade Grioh será liberado em breve. Assim que o link for configurado pela administração, o botão aparece aqui.
          </p>
        )}
        <p className="mt-4 text-center text-[12px] text-muted">A Grioh abre fora do app, no navegador do seu celular.</p>
      </Sheet>
    </>
  );
}
