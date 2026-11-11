import {
  Activity,
  ArrowRight,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  HandCoins,
  PackageSearch,
  ReceiptText,
  Settings2,
  ShoppingCart,
  Sparkles,
  Store,
  WalletCards,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { MetricCard } from '@/components/metric-card';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

const periodOptions = ['Hoy', 'Esta semana', 'Este mes'] as const;

const quickLinks = [
  { href: '/sales', icon: ShoppingCart, label: 'Ir a Ventas' },
  { href: '/purchases', icon: ReceiptText, label: 'Ir a Compras' },
  { href: '/inventory', icon: Boxes, label: 'Ver Inventario' },
  { href: '/finance', icon: WalletCards, label: 'Abrir Finanzas' },
] as const;

const setupSteps = [
  { icon: Store, label: 'Completar información del negocio' },
  { icon: Settings2, label: 'Configurar la sucursal principal' },
  { icon: PackageSearch, label: 'Agregar el primer producto' },
  { icon: ClipboardCheck, label: 'Registrar una operación inicial' },
] as const;

export function DashboardPage() {
  const [period, setPeriod] = useState<(typeof periodOptions)[number]>('Este mes');

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2 bg-white" variant="outline">
                  <CalendarDays aria-hidden="true" />
                  {period}
                  <ChevronDown aria-hidden="true" className="size-3.5 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                {periodOptions.map((option) => (
                  <DropdownMenuItem key={option} onSelect={() => setPeriod(option)}>
                    {option}
                    {period === option && <CheckCircle2 aria-hidden="true" className="ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild>
              <Link to="/administration">
                <Settings2 aria-hidden="true" />
                Configurar negocio
              </Link>
            </Button>
          </>
        }
        description="Consulta el estado general del negocio y accede a las tareas operativas más frecuentes."
        eyebrow="Vista general"
        title="Panel de control"
      />

      <section
        aria-label="Indicadores principales"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          description="Aparecerá cuando existan operaciones registradas."
          icon={CircleDollarSign}
          label="Ventas de hoy"
          tone="blue"
        />
        <MetricCard
          description="Los cobros se resumirán por periodo y sucursal."
          icon={HandCoins}
          label="Cobrado del mes"
          tone="emerald"
        />
        <MetricCard
          description="Aquí se mostrará el saldo abierto de clientes."
          icon={ReceiptText}
          label="Cuentas por cobrar"
          tone="violet"
        />
        <MetricCard
          description="Se activará con los mínimos de inventario."
          icon={PackageSearch}
          label="Productos con stock bajo"
          tone="amber"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.75fr)]">
        <Card className="gap-0 border-slate-200/80 py-0 shadow-sm shadow-slate-200/35">
          <CardHeader className="flex-row items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div>
              <CardTitle className="text-sm font-semibold">Actividad del negocio</CardTitle>
              <CardDescription className="mt-1 text-xs">
                Ventas e ingresos del periodo seleccionado
              </CardDescription>
            </div>
            <Badge className="border-slate-200 text-slate-500" variant="outline">
              Esperando datos
            </Badge>
          </CardHeader>
          <CardContent className="p-5">
            <div className="relative flex min-h-64 items-end gap-2 overflow-hidden rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-5 sm:gap-3">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_0,transparent_calc(100%-1px),rgb(226_232_240/0.55)_calc(100%-1px)),linear-gradient(to_bottom,transparent_0,transparent_calc(100%-1px),rgb(226_232_240/0.55)_calc(100%-1px))] bg-[size:12.5%_100%,100%_25%]"
              />
              {[32, 47, 38, 64, 52, 73, 58, 82, 66, 76, 61, 71].map((height, index) => (
                <Skeleton
                  aria-hidden="true"
                  className="relative flex-1 rounded-t-md rounded-b-sm bg-slate-200/75"
                  key={`${height}-${index}`}
                  style={{ height: `${height}%` }}
                />
              ))}
              <div className="absolute inset-0 grid place-items-center p-6 text-center">
                <div className="max-w-xs rounded-xl border border-white/80 bg-white/94 px-5 py-4 shadow-lg shadow-slate-200/50 backdrop-blur">
                  <span className="mx-auto grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-700">
                    <Activity aria-hidden="true" className="size-4" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    Todavía no hay actividad
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Las tendencias aparecerán cuando se conecten ventas y movimientos financieros.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 border-slate-200/80 py-0 shadow-sm shadow-slate-200/35">
          <CardHeader className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-blue-50 text-blue-700">
                <Sparkles aria-hidden="true" className="size-3.5" />
              </span>
              <CardTitle className="text-sm font-semibold">Primeros pasos</CardTitle>
            </div>
            <CardDescription className="text-xs">
              La configuración operativa se habilitará por etapas.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 py-2">
            {setupSteps.map((step, index) => {
              const Icon = step.icon;

              return (
                <div key={step.label}>
                  <div className="flex items-center gap-3 py-3.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                      <Icon aria-hidden="true" className="size-4" />
                    </span>
                    <p className="min-w-0 flex-1 text-xs font-medium text-slate-700">
                      {step.label}
                    </p>
                    <Badge
                      className="border-slate-200 text-[0.65rem] text-slate-500"
                      variant="outline"
                    >
                      Pendiente
                    </Badge>
                  </div>
                  {index < setupSteps.length - 1 && <Separator />}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <Card className="gap-0 border-slate-200/80 py-0 shadow-sm shadow-slate-200/35">
          <CardHeader className="border-b border-slate-100 px-5 py-4">
            <CardTitle className="text-sm font-semibold">Accesos rápidos</CardTitle>
            <CardDescription className="text-xs">
              Navega a las áreas principales del sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 sm:grid-cols-2">
            {quickLinks.map((item) => {
              const Icon = item.icon;

              return (
                <Button
                  asChild
                  className="h-11 justify-start bg-white px-3"
                  key={item.href}
                  variant="outline"
                >
                  <Link to={item.href}>
                    <span className="grid size-7 place-items-center rounded-md bg-slate-100 text-slate-600">
                      <Icon aria-hidden="true" className="size-3.5" />
                    </span>
                    <span className="flex-1 text-left text-xs">{item.label}</span>
                    <ArrowRight aria-hidden="true" className="size-3.5 text-slate-400" />
                  </Link>
                </Button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="gap-0 border-slate-200/80 py-0 shadow-sm shadow-slate-200/35">
          <CardHeader className="border-b border-slate-100 px-5 py-4">
            <CardTitle className="text-sm font-semibold">Actividad reciente</CardTitle>
            <CardDescription className="text-xs">Últimos movimientos del negocio</CardDescription>
          </CardHeader>
          <CardContent className="grid min-h-36 place-items-center p-5 text-center">
            <div>
              <span className="mx-auto grid size-9 place-items-center rounded-full bg-slate-100 text-slate-500">
                <Activity aria-hidden="true" className="size-4" />
              </span>
              <p className="mt-3 text-xs font-semibold text-slate-700">Sin movimientos todavía</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Aquí aparecerán ventas, compras y pagos.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
