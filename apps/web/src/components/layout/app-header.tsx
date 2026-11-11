import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  LogOut,
  MapPin,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserRound,
} from 'lucide-react';

import { businessIdentity } from '@/app/navigation';
import { AppBreadcrumbs } from '@/components/layout/app-breadcrumbs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type AppHeaderProps = {
  collapsed: boolean;
  onOpenMobileMenu: () => void;
  onToggleSidebar: () => void;
};

export function AppHeader({ collapsed, onOpenMobileMenu, onToggleSidebar }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-slate-200/80 bg-white/92 px-3 backdrop-blur-xl sm:px-5">
      <Button
        aria-label="Abrir menú"
        className="lg:hidden"
        onClick={onOpenMobileMenu}
        size="icon"
        variant="ghost"
      >
        <Menu aria-hidden="true" />
      </Button>
      <Button
        aria-label={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
        className="hidden lg:inline-flex"
        onClick={onToggleSidebar}
        size="icon"
        variant="ghost"
      >
        {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
      </Button>

      <div className="min-w-0 flex-1 px-1 sm:px-2">
        <AppBreadcrumbs />
      </div>

      <div className="flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="hidden h-9 max-w-56 justify-start gap-2 border-slate-200 bg-white px-2.5 md:inline-flex"
              variant="outline"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-700">
                <Building2 aria-hidden="true" className="size-3.5" />
              </span>
              <span className="min-w-0 text-left leading-tight">
                <span className="block truncate text-xs font-semibold">
                  {businessIdentity.name}
                </span>
                <span className="block truncate text-[0.62rem] font-normal text-muted-foreground">
                  Entorno de preparación
                </span>
              </span>
              <ChevronDown aria-hidden="true" className="ml-auto size-3.5 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Negocio activo
            </DropdownMenuLabel>
            <DropdownMenuItem className="gap-2.5 py-2">
              <span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-700">
                <Building2 aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">Business Manager</span>
                <span className="block text-xs text-muted-foreground">Configuración pendiente</span>
              </span>
              <Check aria-hidden="true" className="size-4 text-blue-600" />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              La selección multiempresa llegará en una fase posterior
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          aria-label="Sucursal activa: principal"
          className="hidden h-9 gap-2 px-2.5 xl:inline-flex"
          variant="ghost"
        >
          <MapPin aria-hidden="true" className="size-4 text-slate-500" />
          <span className="text-xs font-medium">Sucursal principal</span>
          <ChevronDown aria-hidden="true" className="size-3.5 text-slate-400" />
        </Button>

        <Button aria-label="Notificaciones" className="relative" size="icon" variant="ghost">
          <Bell aria-hidden="true" />
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-blue-500 ring-2 ring-white" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-9 gap-2 px-1.5 sm:pr-2" variant="ghost">
              <Avatar className="size-7 rounded-lg">
                <AvatarFallback className="rounded-lg bg-slate-900 text-[0.67rem] font-semibold text-white">
                  BM
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-xs font-semibold">Propietario</span>
                <span className="block text-[0.62rem] font-normal text-muted-foreground">
                  Perfil pendiente
                </span>
              </span>
              <ChevronDown aria-hidden="true" className="hidden size-3.5 text-slate-400 sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <UserRound aria-hidden="true" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Settings aria-hidden="true" />
              Preferencias
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <LogOut aria-hidden="true" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
