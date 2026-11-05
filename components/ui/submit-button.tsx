'use client';
import { useContext } from 'react';
import { useFormStatus } from 'react-dom';
import { FormPending } from './form';
import { Loader2 } from 'lucide-react';
import { Button } from './button';
import type { ComponentProps } from 'react';

export function SubmitButton({ children, pendingText, ...props }: ComponentProps<typeof Button> & { pendingText?: string }) {
  const status = useFormStatus();
  const ctxPending = useContext(FormPending);
  const pending = status.pending || ctxPending;
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? pendingText || 'Salvando…' : children}
    </Button>
  );
}
