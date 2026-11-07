import Link from 'next/link';
import { adminClient } from '@/lib/supabase/admin';
import { buttonClass } from '@/components/ui/button';
import { AutoRefresh } from './auto-refresh';

export const metadata = { title: 'Assinatura', robots: { index: false } };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Volta do Asaas Checkout. O código `ref` só existe no endereço de retorno de quem pagou.
 * Enquanto o webhook não confirma o pagamento, a página se atualiza sozinha; depois, mostra o convite pessoal.
 */
export default async function ThankYou({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const db = adminClient();
  const { data: s } = ref && UUID.test(ref)
    ? await db.from('checkout_sessions').select('full_name, email, status, created_at, invitation:invitations(token, accepted_at, expires_at)').eq('id', ref).maybeSingle()
    : { data: null };
  const session = s as { full_name: string; email: string; status: string; created_at: string; invitation: { token: string; accepted_at: string | null; expires_at: string } | null } | null;
  const first = session?.full_name.split(' ')[0];

  if (!session) {
    return (
      <article className="text-center">
        <h1 className="text-[28px] leading-tight">Não encontramos esta assinatura</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ivory/80">Confira o endereço desta página. Se você já pagou, fale com a equipe do clube.</p>
      </article>
    );
  }
  if (session.status !== 'paid' || !session.invitation) {
    const waited = Date.now() - new Date(session.created_at).getTime();
    return (
      <article className="text-center">
        <h1 className="text-[28px] leading-tight">Estamos confirmando o seu pagamento, {first}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ivory/80">Isso costuma levar alguns segundos. Esta página atualiza sozinha. Assim que o Asaas confirmar, o seu convite aparece aqui.</p>
        <div className="mx-auto mt-8 h-1.5 w-40 overflow-hidden rounded-full bg-white/15"><div className="h-full w-1/3 animate-pulse rounded-full bg-dusty" /></div>
        {waited > 15 * 60e3 && <p className="mt-8 text-[13px] text-ivory/70">Está demorando mais que o normal. Se o pagamento foi aprovado, a equipe do clube também recebe o seu convite e entra em contato.</p>}
        <AutoRefresh seconds={4} />
      </article>
    );
  }
  if (session.invitation.accepted_at) {
    return (
      <article className="text-center">
        <h1 className="text-[28px] leading-tight">Sua conta já está criada</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ivory/80">É só entrar com o e-mail {session.email}.</p>
        <Link href="/entrar" className={`${buttonClass('light', 'lg', true)} mt-8`}>Entrar no clube</Link>
      </article>
    );
  }
  return (
    <article className="text-center">
      <h1 className="text-[30px] leading-tight">Bem-vinda ao clube, {first}!</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ivory/80">Pagamento confirmado. Agora crie a sua conta com o e-mail <b className="text-ivory">{session.email}</b>.</p>
      <Link href={`/convite/${session.invitation.token}`} className={`${buttonClass('light', 'lg', true)} mt-8`}>Criar minha conta</Link>
      <p className="mt-6 text-[13px] leading-relaxed text-ivory/70">Depois, instale o app no celular, direto pelo navegador e sem loja. O passo a passo aparece no seu feed.</p>
    </article>
  );
}
