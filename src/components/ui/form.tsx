'use client';
import { createContext, useTransition, type ComponentProps, type FormEvent } from 'react';

export const FormPending = createContext(false);

/**
 * Formulário ligado a uma Server Action sem o reset automático do React 19:
 * se a ação devolver um erro (senha errada, WhatsApp inválido), o que a integrante digitou continua no lugar.
 */
export function Form({ action, onBeforeSubmit, children, ...rest }: Omit<ComponentProps<'form'>, 'action' | 'onSubmit'> & {
  action: (fd: FormData) => void;
  onBeforeSubmit?: (e: FormEvent<HTMLFormElement>) => boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <FormPending.Provider value={pending}>
      <form
        method="post"
        {...rest}
        onSubmit={(e) => {
          e.preventDefault();
          if (pending || (onBeforeSubmit && !onBeforeSubmit(e))) return;
          const fd = new FormData(e.currentTarget);
          start(() => action(fd));
        }}
      >
        {children}
      </form>
    </FormPending.Provider>
  );
}
