import clsx from 'clsx';
import type { ComponentProps, ReactNode } from 'react';

const control =
  'w-full rounded-2xl bg-paper px-4 text-espresso ring-1 ring-line placeholder:text-taupe focus:outline-none focus:ring-2 focus:ring-burgundy transition';

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-semibold text-espresso">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[12px] leading-snug text-muted">{hint}</span>}
    </label>
  );
}

export function Input(props: ComponentProps<'input'>) {
  return <input {...props} className={clsx(control, 'h-12', props.className)} />;
}

export function Textarea(props: ComponentProps<'textarea'>) {
  return <textarea {...props} className={clsx(control, 'min-h-28 py-3 leading-relaxed', props.className)} />;
}

export function Select(props: ComponentProps<'select'>) {
  return <select {...props} className={clsx(control, 'h-12 appearance-none bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10', props.className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b5f51' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} />;
}

export function Toggle({ name, defaultChecked, label, hint }: { name: string; defaultChecked?: boolean; label: string; hint?: string }) {
  return (
    <label className="flex items-center justify-between gap-4 py-3">
      <span>
        <span className="block text-[15px] font-medium">{label}</span>
        {hint && <span className="block text-[12px] text-muted">{hint}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="h-7 w-12 rounded-full bg-line transition peer-checked:bg-burgundy peer-focus-visible:ring-2 peer-focus-visible:ring-burgundy peer-focus-visible:ring-offset-2" />
        <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function FormMessage({ state }: { state: { error?: string; message?: string } | null }) {
  if (!state?.error && !state?.message) return null;
  return (
    <p role={state.error ? 'alert' : 'status'} className={clsx('rounded-2xl px-4 py-3 text-[14px]', state.error ? 'bg-danger/10 text-danger' : 'bg-olive/15 text-olive-ink')}>
      {state.error || state.message}
    </p>
  );
}
