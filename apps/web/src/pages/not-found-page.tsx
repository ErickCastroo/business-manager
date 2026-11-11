import { ArrowLeft, SearchX } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function NotFoundPage() {
  return (
    <Card className="border-slate-200/80 py-0 shadow-sm shadow-slate-200/35">
      <CardContent className="grid min-h-[34rem] place-items-center p-6 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
            <SearchX aria-hidden="true" className="size-7" />
          </span>
          <p className="mt-6 text-xs font-semibold tracking-[0.14em] text-rose-600 uppercase">
            Error 404
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
            Esta página no existe
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            La dirección puede estar incompleta o el contenido todavía no forma parte del sistema.
          </p>
          <Button asChild className="mt-6">
            <Link to="/dashboard">
              <ArrowLeft aria-hidden="true" />
              Volver al Dashboard
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
