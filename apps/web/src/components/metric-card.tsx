import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type MetricCardProps = {
  description: string;
  icon: LucideIcon;
  label: string;
  tone: 'amber' | 'blue' | 'emerald' | 'violet';
};

const toneStyles: Record<MetricCardProps['tone'], string> = {
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100',
};

export function MetricCard({ description, icon: Icon, label, tone }: MetricCardProps) {
  return (
    <Card className="gap-0 border-slate-200/80 py-0 shadow-sm shadow-slate-200/35">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className={cn('grid size-9 place-items-center rounded-lg ring-1', toneStyles[tone])}>
            <Icon aria-hidden="true" className="size-[1.05rem]" strokeWidth={2} />
          </div>
          <Badge className="border-slate-200 text-slate-500" variant="outline">
            Sin datos
          </Badge>
        </div>
        <p className="mt-4 text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-950">—</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">{description}</p>
      </CardContent>
    </Card>
  );
}
