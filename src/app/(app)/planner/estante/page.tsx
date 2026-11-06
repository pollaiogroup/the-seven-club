import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import type { LibraryEntry } from '@/lib/types';
import { SevenStar } from '@/components/ui/icons';
import { LinkButton } from '@/components/ui/button';
import { Shelf } from '@/components/profile/profile-view';

export const metadata = { title: 'Estante' };

/** A mesma estante do perfil (essa, sim, visível para o clube), dentro do planner. */
export default async function PlannerShelf() {
  const me = await requireMember();
  const library = await rpc<LibraryEntry[]>('library_of', { p_member: me.id });
  return (
    <div className="rounded-[24px] bg-paper p-4 shadow-card ring-1 ring-line sm:p-6 md:rounded-r-[6px] md:p-7">
      <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-[.26em] text-burgundy uppercase"><SevenStar className="h-2.5 w-2.5" />Estante</p>
      <h1 className="mt-1 text-[30px] leading-tight text-burgundy">Livros lidos</h1>
      <p className="mt-1 text-[13px] text-muted">É a mesma estante do seu perfil, que as outras integrantes também veem.</p>
      <div className="mt-4"><LinkButton href="/biblioteca/registrar">Registrar livro lido</LinkButton></div>
      {library.length ? <Shelf entries={library} /> : <p className="mt-6 rounded-2xl bg-ivory px-4 py-4 text-[14px] text-muted">Nenhum livro registrado ainda.</p>}
    </div>
  );
}
