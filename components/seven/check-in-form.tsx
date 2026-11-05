'use client';
import { Form } from '@/components/ui/form';
import { useActionState, useState } from 'react';
import clsx from 'clsx';
import { Lock } from 'lucide-react';
import type { Pillar } from '@/lib/types';
import { saveCheckIn, shareCheckIn } from '@/actions/seven';
import { FormMessage, Input, Textarea } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { ImagePicker } from '@/components/image-picker';

export function CheckInForm({ pillar, userId, photoUrl }: { pillar: Pillar; userId: string; photoUrl: string | null }) {
  const ci = pillar.check_in;
  const [state, action] = useActionState(saveCheckIn.bind(null, pillar.id), null);
  const [activity, setActivity] = useState(ci?.activity_id || '');
  const [adding, setAdding] = useState(false);
  return (
    <Form action={action} className="space-y-5">
      <input type="hidden" name="activity_id" value={adding ? '' : activity} />
      <div>
        <p className="mb-2 text-[13px] font-semibold">O que você fez</p>
        <div className="flex flex-wrap gap-2">
          {pillar.activities.map((a) => (
            <button type="button" key={a.id} onClick={() => { setActivity(activity === a.id ? '' : a.id); setAdding(false); }}
              className={clsx('rounded-full px-4 py-2 text-[13px] ring-1 transition', activity === a.id && !adding ? 'bg-burgundy text-ivory ring-burgundy' : 'bg-paper ring-line')}>{a.title}</button>
          ))}
          <button type="button" onClick={() => setAdding(!adding)} className={clsx('rounded-full px-4 py-2 text-[13px] ring-1 ring-dashed', adding ? 'bg-burgundy text-ivory ring-burgundy' : 'bg-transparent ring-taupe text-muted')}>+ Outra</button>
        </div>
        {adding && <Input name="new_activity" className="mt-3" placeholder="Descreva a atividade" maxLength={80} autoFocus />}
      </div>
      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold"><Lock className="h-3.5 w-3.5" />Observação privada</span>
        <Textarea name="note" maxLength={1000} defaultValue={ci?.note || ''} placeholder="Só você vê. Como foi? O que aprendeu?" />
      </label>
      <div>
        <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold"><Lock className="h-3.5 w-3.5" />Foto (privada)</span>
        <ImagePicker userId={userId} name="photo" max={1} bucket="private" label="Foto"
          initial={ci?.photo_path ? [{ path: ci.photo_path, width: 1, height: 1, preview: photoUrl || undefined }] : []} />
      </div>
      <label className="flex items-center justify-between gap-4 rounded-2xl bg-paper p-4 ring-1 ring-line">
        <span><span className="block text-[15px] font-semibold">Concluí hoje</span><span className="block text-[12px] text-muted">Marcar como concluída não publica nada.</span></span>
        <span className="relative inline-flex shrink-0">
          <input type="checkbox" name="done" defaultChecked={!!ci?.completed_at || !ci} className="peer sr-only" />
          <span className="h-7 w-12 rounded-full bg-line transition peer-checked:bg-burgundy" />
          <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
        </span>
      </label>
      <FormMessage state={state} />
      <SubmitButton full size="lg">Salvar registro</SubmitButton>
    </Form>
  );
}

export function ShareForm({ pillar, hasPhoto, defaultText }: { pillar: Pillar; hasPhoto: boolean; defaultText: string }) {
  const [state, action] = useActionState(shareCheckIn.bind(null, pillar.check_in!.id), null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <Form action={action} className="space-y-3 rounded-[var(--radius-card)] bg-paper p-4 ring-1 ring-line">
      <p className="text-[14px] leading-relaxed text-muted">Quer inspirar o clube? A publicação mostra <strong className="text-burgundy">{pillar.name}</strong> e o texto abaixo. Sua observação privada não é incluída.</p>
      <Textarea name="body" maxLength={3000} defaultValue={defaultText} className="min-h-24" />
      {hasPhoto && (
        <label className="flex items-center gap-3 text-[14px]"><input type="checkbox" name="with_photo" className="h-5 w-5 accent-[#450B18]" />Incluir a foto do registro</label>
      )}
      <FormMessage state={state} />
      <SubmitButton variant="secondary" full pendingText="Compartilhando…">Compartilhar no Feed</SubmitButton>
    </Form>
  );
}
