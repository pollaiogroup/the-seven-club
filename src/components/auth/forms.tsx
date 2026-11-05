'use client';
import { Form } from '@/components/ui/form';
import { useActionState } from 'react';
import Link from 'next/link';
import { acceptInvite, requestReset, signIn, updatePassword } from '@/actions/auth';
import { SubmitButton } from '@/components/ui/submit-button';

const dark = 'w-full h-12 rounded-2xl bg-white/8 px-4 text-ivory ring-1 ring-white/15 placeholder:text-dusty/70 focus:outline-none focus:ring-2 focus:ring-dusty';
const label = 'mb-1.5 block text-[13px] font-semibold text-dusty';

function Msg({ state }: { state: { error?: string; message?: string } | null }) {
  if (!state?.error && !state?.message) return null;
  return <p role="alert" className={`rounded-2xl px-4 py-3 text-[14px] ${state.error ? 'bg-white/10 text-white' : 'bg-white/10 text-ivory'}`}>{state.error || state.message}</p>;
}

export function SignInForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action] = useActionState(signIn, null);
  return (
    <Form action={action} className="space-y-4">
      {notice && <p className="rounded-2xl bg-white/10 px-4 py-3 text-[14px]">{notice}</p>}
      <input type="hidden" name="next" value={next || '/feed'} />
      <label className="block"><span className={label}>E-mail</span>
        <input name="email" type="email" inputMode="email" autoComplete="email" required className={dark} placeholder="voce@email.com" /></label>
      <label className="block"><span className={label}>Senha</span>
        <input name="password" type="password" autoComplete="current-password" required className={dark} /></label>
      <Msg state={state} />
      <SubmitButton variant="light" full size="lg" pendingText="Entrando…">Entrar</SubmitButton>
      <div className="pt-2 text-center text-[14px]">
        <Link href="/recuperar" className="text-dusty underline-offset-4 hover:underline">Esqueci minha senha</Link>
      </div>
      <p className="pt-6 text-center text-[13px] leading-relaxed text-dusty/80">O clube é fechado. Para entrar, você precisa de um convite de uma integrante ou da administração.</p>
    </Form>
  );
}

export function InviteForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useActionState(acceptInvite.bind(null, token), null);
  return (
    <Form action={action} className="space-y-4">
      <div className="rounded-2xl bg-white/8 px-4 py-3 text-[14px] ring-1 ring-white/10">
        Convite para <strong className="font-semibold">{email}</strong>
      </div>
      <label className="block"><span className={label}>Nome completo</span>
        <input name="full_name" required autoComplete="name" className={dark} /></label>
      <label className="block"><span className={label}>Seu @ no clube</span>
        <input name="handle" required autoCapitalize="none" autoCorrect="off" pattern="[a-z0-9_.]{3,30}" className={dark} placeholder="ex.: seu.nome" /></label>
      <label className="block"><span className={label}>Crie uma senha</span>
        <input name="password" type="password" minLength={8} required autoComplete="new-password" className={dark} /></label>
      <label className="flex items-start gap-3 py-1 text-[13px] leading-relaxed text-dusty">
        <input type="checkbox" name="terms" required className="mt-1 h-5 w-5 accent-[#C9AFA8]" />
        <span>Li e aceito as <Link href="/sobre/regras" target="_blank" className="underline">regras da comunidade</Link> e a <Link href="/sobre/privacidade" target="_blank" className="underline">política de privacidade</Link>.</span>
      </label>
      <Msg state={state} />
      <SubmitButton variant="light" full size="lg" pendingText="Criando sua conta…">Entrar para o clube</SubmitButton>
    </Form>
  );
}

export function ResetRequestForm() {
  const [state, action] = useActionState(requestReset, null);
  return (
    <Form action={action} className="space-y-4">
      <p className="text-[15px] leading-relaxed text-dusty">Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.</p>
      <label className="block"><span className={label}>E-mail</span>
        <input name="email" type="email" inputMode="email" autoComplete="email" required className={dark} /></label>
      <Msg state={state} />
      <SubmitButton variant="light" full size="lg" pendingText="Enviando…">Enviar link</SubmitButton>
      <p className="text-center text-[14px]"><Link href="/entrar" className="text-dusty underline-offset-4 hover:underline">Voltar para a entrada</Link></p>
    </Form>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, null);
  return (
    <Form action={action} className="space-y-4">
      <label className="block"><span className={label}>Nova senha</span>
        <input name="password" type="password" minLength={8} required autoComplete="new-password" className={dark} /></label>
      <label className="block"><span className={label}>Repita a senha</span>
        <input name="confirm" type="password" minLength={8} required autoComplete="new-password" className={dark} /></label>
      <Msg state={state} />
      <SubmitButton variant="light" full size="lg">Salvar nova senha</SubmitButton>
    </Form>
  );
}
