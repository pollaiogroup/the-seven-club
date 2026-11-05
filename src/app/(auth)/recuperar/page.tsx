import { ResetRequestForm } from '@/components/auth/forms';

export const metadata = { title: 'Recuperar acesso' };

export default function ResetPage() {
  return (
    <>
      <h1 className="mb-4 text-center text-[30px]">Recuperar acesso</h1>
      <ResetRequestForm />
    </>
  );
}
