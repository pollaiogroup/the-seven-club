import { LinkButton } from '@/components/ui/button';
import { SevenStar } from '@/components/ui/icons';

export default function NotFound() {
  return (
    <div className="pt-safe flex min-h-dvh flex-col items-center justify-center bg-ivory px-8 text-center">
      <SevenStar outline className="h-10 w-10 text-dusty" />
      <h1 className="mt-4 text-[26px] text-burgundy">Página não encontrada</h1>
      <p className="mt-2 max-w-xs text-[14px] text-muted">Ela pode ter sido removida, ou é restrita a outras integrantes.</p>
      <LinkButton href="/feed" className="mt-6">Voltar ao Feed</LinkButton>
    </div>
  );
}
