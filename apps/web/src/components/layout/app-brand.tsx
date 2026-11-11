import { ChartNoAxesCombined } from 'lucide-react';
import { Link } from 'react-router';

import { businessIdentity } from '@/app/navigation';
import { cn } from '@/lib/utils';

type AppBrandProps = {
  collapsed?: boolean;
};

export function AppBrand({ collapsed = false }: AppBrandProps) {
  return (
    <Link
      aria-label="Ir al Dashboard"
      className={cn(
        'group flex h-18 items-center gap-3 border-b border-white/8 px-4 text-white',
        collapsed && 'justify-center px-0',
      )}
      to="/dashboard"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-950/30 ring-1 ring-white/15 transition-transform group-hover:-translate-y-0.5">
        <ChartNoAxesCombined aria-hidden="true" className="size-5" strokeWidth={2.2} />
      </span>
      {!collapsed && (
        <span className="min-w-0 leading-none">
          <span className="block truncate text-[0.94rem] font-semibold tracking-[-0.02em]">
            {businessIdentity.name}
          </span>
          <span className="mt-1 block truncate text-[0.68rem] font-medium tracking-wide text-slate-400 uppercase">
            Centro operativo
          </span>
        </span>
      )}
    </Link>
  );
}
