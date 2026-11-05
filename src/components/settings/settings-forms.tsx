'use client';
import { Form } from '@/components/ui/form';
import { useActionState } from 'react';
import { deleteAccount, updatePreferences } from '@/actions/profile';
import { FormMessage, Input, Toggle } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';

export type Prefs = {
  notify_likes: boolean; notify_comments: boolean; notify_mentions: boolean; notify_projects: boolean; notify_events: boolean;
  notify_affirmation: boolean; affirmation_time: string; notify_seven_reminder: boolean; seven_reminder_time: string; notify_book_club: boolean;
};

export function PreferencesForm({ prefs }: { prefs: Prefs }) {
  const [state, action] = useActionState(updatePreferences, null);
  return (
    <Form action={action} className="divide-y divide-line">
      <div className="pb-2">
        <Toggle name="notify_affirmation" defaultChecked={prefs.notify_affirmation} label="Afirmação do dia" hint="Um aviso por dia, no horário escolhido" />
        <label className="flex items-center justify-between pb-3 text-[14px]"><span className="text-muted">Horário</span>
          <Input type="time" name="affirmation_time" defaultValue={prefs.affirmation_time.slice(0, 5)} className="!h-10 w-32 text-center" /></label>
      </div>
      <div className="pb-2">
        <Toggle name="notify_seven_reminder" defaultChecked={prefs.notify_seven_reminder} label="Lembrete do SEVEN" hint="Só se você ainda não registrou nada no dia" />
        <label className="flex items-center justify-between pb-3 text-[14px]"><span className="text-muted">Horário</span>
          <Input type="time" name="seven_reminder_time" defaultValue={prefs.seven_reminder_time.slice(0, 5)} className="!h-10 w-32 text-center" /></label>
      </div>
      <Toggle name="notify_book_club" defaultChecked={prefs.notify_book_club} label="Clube do Livro" hint="Livro do mês, votação, cupons e encontros dos livros que você vai ler" />
      <Toggle name="notify_comments" defaultChecked={prefs.notify_comments} label="Comentários" />
      <Toggle name="notify_mentions" defaultChecked={prefs.notify_mentions} label="Menções" />
      <Toggle name="notify_likes" defaultChecked={prefs.notify_likes} label="Curtidas" />
      <Toggle name="notify_projects" defaultChecked={prefs.notify_projects} label="Convites para projetos" />
      <Toggle name="notify_events" defaultChecked={prefs.notify_events} label="Eventos e lembretes de agenda" />
      <div className="space-y-3 pt-4"><FormMessage state={state} /><SubmitButton full variant="secondary">Salvar preferências</SubmitButton></div>
    </Form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccount, null);
  return (
    <Form action={action} className="space-y-3">
      <p className="text-[13px] leading-relaxed text-muted">Apaga sua conta, perfil, publicações, comentários, check-ins e empresas que você criou. Não dá para desfazer. Digite <strong>EXCLUIR</strong> para confirmar.</p>
      <Input name="confirm" autoCapitalize="characters" placeholder="EXCLUIR" />
      <FormMessage state={state} />
      <SubmitButton variant="danger" full pendingText="Excluindo…">Excluir minha conta</SubmitButton>
    </Form>
  );
}
