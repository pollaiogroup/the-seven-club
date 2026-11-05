import { SignInForm } from '@/components/auth/forms';

export const metadata = { title: 'Entrar' };

const NOTICES: Record<string, string> = {
  'sem-convite': 'Sua conta ainda não está ligada a um convite do clube. Use o link do convite que você recebeu.',
  suspensa: 'Seu acesso está suspenso. Fale com a administração do clube.',
  'link-invalido': 'O link expirou ou já foi usado. Peça um novo.',
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const { next, erro } = await searchParams;
  return (
    <>
      <h1 className="mb-6 text-center text-[30px]">Bem-vinda de volta</h1>
      <SignInForm next={next} notice={erro ? NOTICES[erro] : undefined} />
    </>
  );
}
