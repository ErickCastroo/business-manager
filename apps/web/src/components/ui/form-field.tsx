import { useId, type ComponentProps, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

type FieldProps = {
  label: string;
  error?: string | undefined;
  hint?: string;
  children?: ReactNode;
};

const controlClass =
  'h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 aria-invalid:border-destructive disabled:opacity-60';

export function FormField({
  label,
  error,
  hint,
  className,
  ...props
}: FieldProps & ComponentProps<'input'>) {
  const id = useId();
  const description = error ?? hint;
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium text-slate-800" htmlFor={id}>
        {label}
      </label>
      <input
        {...props}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={description ? `${id}-message` : undefined}
        className={cn(controlClass, className)}
      />
      {description && (
        <p
          id={`${id}-message`}
          className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}
        >
          {description}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  error,
  className,
  ...props
}: FieldProps & ComponentProps<'select'>) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium text-slate-800" htmlFor={id}>
        {label}
      </label>
      <select
        {...props}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-message` : undefined}
        className={cn(controlClass, className)}
      />
      {error && (
        <p id={`${id}-message`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
