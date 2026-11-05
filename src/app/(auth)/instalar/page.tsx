import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { InstallGuide } from './install-guide';

export const metadata = { title: 'Instalar o app' };

/** Página pública com o passo a passo de instalação, para mandar junto com o convite. */
export default function InstallPage() {
  return (
    <article>
      <h1 className="text-[28px] leading-tight">Instale o app no seu celular</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ivory/80">
        O THE SEVEN CLUB não fica nas lojas: ele é instalado direto pelo navegador, em menos de um minuto, e ganha um ícone na sua tela de início.
      </p>
      <InstallGuide />
      <div className="mt-10 space-y-3 text-center">
        <Link href="/entrar" className={buttonClass('light', 'lg', true)}>Já tenho conta: entrar</Link>
        <p className="text-[13px] leading-relaxed text-ivory/70">Ainda não tem conta? Abra o link do convite pessoal que você recebeu.</p>
      </div>
    </article>
  );
}
