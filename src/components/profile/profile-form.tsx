'use client';
import { Form } from '@/components/ui/form';
import { useActionState } from 'react';
import { updateProfile } from '@/actions/profile';
import type { ProfilePage } from '@/lib/types';
import { Field, FormMessage, Input, Textarea } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { ImagePicker } from '@/components/image-picker';

export function ProfileForm({ p, userId }: { p: ProfilePage; userId: string }) {
  const [state, action] = useActionState(updateProfile, null);
  return (
    <Form action={action} className="space-y-5">
      <input type="hidden" name="current_avatar" value={p.avatar_path || ''} />
      <div><span className="mb-1.5 block text-[13px] font-semibold">Foto</span>
        <ImagePicker userId={userId} name="avatar" max={1} square label="Foto" initial={p.avatar_path ? [{ path: p.avatar_path, width: 1, height: 1 }] : []} /></div>
      <Field label="Nome"><Input name="full_name" required maxLength={80} defaultValue={p.full_name} autoComplete="name" /></Field>
      <Field label="Uma linha sobre você" hint="Ex.: Criativa, empreendedora e em constante evolução."><Input name="headline" maxLength={120} defaultValue={p.headline || ''} /></Field>
      <Field label="Biografia"><Textarea name="bio" maxLength={600} defaultValue={p.bio || ''} /></Field>
      <Field label="Cidade"><Input name="city" maxLength={80} defaultValue={p.city || ''} autoComplete="address-level2" /></Field>
      <Field label="Interesses" hint="Separe por vírgulas. Ex.: liderança, moda, investimentos"><Input name="interests" maxLength={300} defaultValue={p.interests.join(', ')} /></Field>
      <Field label="Instagram"><Input name="instagram" autoCapitalize="none" defaultValue={p.instagram ? `@${p.instagram}` : ''} /></Field>
      <Field label="Site"><Input name="website" inputMode="url" autoCapitalize="none" defaultValue={p.website || ''} /></Field>
      <p className="text-[13px] text-muted">Seu @ no clube é <strong>@{p.handle}</strong> e não pode ser alterado.</p>
      <FormMessage state={state} />
      <SubmitButton full size="lg">Salvar perfil</SubmitButton>
    </Form>
  );
}
