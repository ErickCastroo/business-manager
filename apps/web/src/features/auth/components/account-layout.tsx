import { ChartNoAxesCombined } from 'lucide-react';
import type { ReactNode } from 'react';

export function AccountLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-svh grid-rows-[auto_1fr] bg-[#f5f7fb] md:grid-cols-[minmax(17rem,1fr)_minmax(30rem,1.5fr)] md:grid-rows-1">
      <aside className="flex items-center gap-3 bg-[#101a33] px-5 py-4 text-white md:items-start md:px-10 md:py-10">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-500">
          <ChartNoAxesCombined aria-hidden="true" className="size-5" />
        </span>
        <span className="self-center text-base font-semibold md:self-auto md:pt-2">
          Business Manager
        </span>
      </aside>
      <div className="flex items-center justify-center p-4 sm:p-8">
        <section
          aria-label={title}
          className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
          {children}
        </section>
      </div>
    </main>
  );
}

export function FormAlert({ message }: { message: string }) {
  return (
    <p
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
      role="alert"
    >
      {message}
    </p>
  );
}
