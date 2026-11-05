'use client';
import { Form } from '@/components/ui/form';
import { useActionState, useState } from 'react';
import { createPost } from '@/actions/posts';
import { ImagePicker } from '@/components/image-picker';
import { Select, Textarea, FormMessage } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';

type Target = { value: string; label: string };

export function Composer({ userId, targets, initialTarget, back }: { userId: string; targets: Target[]; initialTarget: string; back: string }) {
  const [state, action] = useActionState(createPost, null);
  const [text, setText] = useState('');
  return (
    <Form action={action} className="space-y-4 px-5 pt-5">
      <input type="hidden" name="back" value={back} />
      {targets.length > 1 && (
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">Publicar como</span>
          <Select name="target" defaultValue={initialTarget}>
            {targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </label>
      )}
      {targets.length === 1 && <input type="hidden" name="target" value={targets[0]!.value} />}
      <Textarea name="body" value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} autoFocus
        placeholder="O que você quer compartilhar com o clube? Use @ para mencionar uma integrante." className="min-h-44 text-[16px]" />
      <div className="text-right text-[12px] text-muted">{text.length}/3000</div>
      <ImagePicker userId={userId} />
      <FormMessage state={state} />
      <SubmitButton full size="lg" pendingText="Publicando…">Publicar</SubmitButton>
    </Form>
  );
}
