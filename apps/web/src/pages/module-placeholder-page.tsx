import { ArrowLeft, Construction } from 'lucide-react';
import { Link } from 'react-router';

import type { NavigationItem } from '@/app/navigation';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type ModulePlaceholderPageProps = {
  item: NavigationItem;
};

export function ModulePlaceholderPage({ item }: ModulePlaceholderPageProps) {
  const Icon = item.icon;

  return (
    <div className="space-y-5">
      <PageHeader
        description={item.description}
        eyebrow="Navegación preparada"
        title={item.label}
      />

      <Card className="border-slate-200/80 py-0 shadow-sm shadow-slate-200/35">
        <CardContent className="grid min-h-[28rem] place-items-center p-6 text-center">
          <div className="max-w-md">
            <div className="relative mx-auto w-fit">
              <span className="grid size-16 place-items-center rounded-2xl bg-slate-950 text-white shadow-xl shadow-slate-300">
                <Icon aria-hidden="true" className="size-7" strokeWidth={1.8} />
              </span>
              <span className="absolute -right-2 -bottom-2 grid size-7 place-items-center rounded-lg border-2 border-white bg-blue-500 text-white">
                <Construction aria-hidden="true" className="size-3.5" />
              </span>
            </div>
            <Badge className="mt-6 border-blue-200 bg-blue-50 text-blue-700" variant="outline">
              Próxima fase
            </Badge>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-slate-950">
              El módulo de {item.label.toLowerCase()} está preparado
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              La ruta y la navegación ya forman parte del AppShell. Los datos, formularios y reglas
              de negocio se incorporarán en la fase correspondiente.
            </p>
            <Button asChild className="mt-6" variant="outline">
              <Link to="/dashboard">
                <ArrowLeft aria-hidden="true" />
                Volver al Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
