import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NewPasswordForm } from '@/components/auth/forms';

export const metadata = { title: 'Nova senha' };

export default async function NewPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/entrar?erro=link-invalido');
  return (
    <>
      <h1 className="mb-6 text-center text-[30px]">Crie uma nova senha</h1>
      <NewPasswordForm />
    </>
  );
}
