import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';

type PageHeaderProps = {
  actions?: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
};

export function PageHeader({ actions, description, eyebrow, title }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow !== undefined && (
          <Badge className="mb-2 border-blue-200 bg-blue-50 text-blue-700" variant="outline">
            {eyebrow}
          </Badge>
        )}
        <h1 className="text-2xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-[1.75rem]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {actions !== undefined && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
