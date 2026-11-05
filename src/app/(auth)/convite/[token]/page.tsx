import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { InviteForm } from '@/components/auth/forms';

export const metadata = { title: 'Convite' };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc('invitation_lookup', { p_token: token });
  if (!data?.valid) {
    return (
      <div className="text-center">
        <h1 className="text-[28px]">Convite indisponível</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-dusty">
          {data?.used ? 'Este convite já foi usado.' : data?.expired ? 'Este convite expirou.' : 'Não encontramos este convite.'} Peça um novo à administração do clube.
        </p>
        <Link href="/entrar" className="mt-8 inline-block text-dusty underline underline-offset-4">Ir para a entrada</Link>
      </div>
    );
  }
  return (
    <>
      <h1 className="text-center text-[30px] leading-tight">Você foi convidada</h1>
      <p className="mt-2 mb-7 text-center text-[15px] text-dusty">Crie seu acesso para entrar na sociedade.</p>
      <InviteForm token={token} email={data.email} />
    </>
  );
}
