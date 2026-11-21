import {
  Bell,
  Building2,
  ChevronDown,
  LogOut,
  MailCheck,
  MapPin,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from 'lucide-react';
import { Link } from 'react-router';

import { AppBreadcrumbs } from '@/components/layout/app-breadcrumbs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession } from '@/features/auth/session-context';
import { useSignOut } from '@/features/auth/use-sign-out';
import type { ActiveTenant } from '@/features/tenancy/use-active-tenant';

type AppHeaderProps = {
  collapsed: boolean;
  onOpenMobileMenu: () => void;
  onToggleSidebar: () => void;
  tenant: ActiveTenant;
};

function BusinessSwitcher({ tenant }: { tenant: ActiveTenant }) {
  const active = tenant.membership?.business;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Negocio activo: ${active?.name ?? 'Sin negocio'}`}
          className="h-9 max-w-44 gap-1.5 px-2.5"
          variant="outline"
        >
          <Building2 aria-hidden="true" className="shrink-0 text-blue-700" />
          <span className="hidden truncate text-xs sm:block">{active?.name}</span>
          <ChevronDown aria-hidden="true" className="hidden shrink-0 text-slate-400 md:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Negocio activo</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={active?.id ?? ''} onValueChange={tenant.changeBusiness}>
          {tenant.memberships.map(({ business }) => (
            <DropdownMenuRadioItem key={business.id} value={business.id}>
              <span className="min-w-0 flex-1 truncate">{business.name}</span>
              <span className="text-xs text-muted-foreground">{business.baseCurrencyCode}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/onboarding">
            <Plus aria-hidden="true" />
            Crear otro negocio
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BranchSwitcher({ tenant }: { tenant: ActiveTenant }) {
  const fallback = tenant.branchesLoading ? 'Cargando sucursales…' : 'Sin sucursal seleccionada';
  const label =
    tenant.branch?.name ?? (tenant.branchError ? 'Sucursales no disponibles' : fallback);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Sucursal activa: ${label}`}
          className="h-9 max-w-44 gap-1.5 px-2.5"
          variant="ghost"
        >
          <MapPin aria-hidden="true" className="shrink-0 text-slate-500" />
          <span className="hidden truncate text-xs sm:block">{label}</span>
          <ChevronDown aria-hidden="true" className="hidden shrink-0 text-slate-400 md:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Sucursal activa</DropdownMenuLabel>
        {tenant.branchesLoading && (
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            Cargando sucursales…
          </DropdownMenuLabel>
        )}
        {tenant.branchError && (
          <DropdownMenuItem onSelect={tenant.retryBranches}>
            Reintentar cargar sucursales
          </DropdownMenuItem>
        )}
        {!tenant.branchesLoading && !tenant.branchError && tenant.branches.length === 0 && (
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            No tienes sucursales asignadas.
          </DropdownMenuLabel>
        )}
        <DropdownMenuRadioGroup value={tenant.branch?.id ?? ''} onValueChange={tenant.changeBranch}>
          {tenant.branches.map((branch) => (
            <DropdownMenuRadioItem key={branch.id} value={branch.id}>
              <span className="min-w-0 flex-1 truncate">{branch.name}</span>
              {branch.isMain && <span className="text-xs text-muted-foreground">Principal</span>}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppHeader({
  collapsed,
  onOpenMobileMenu,
  onToggleSidebar,
  tenant,
}: AppHeaderProps) {
  const { profile } = useSession();
  const signOut = useSignOut();
  const user = profile?.user;
  const fullName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : '';
  const initials =
    `${user?.firstName.charAt(0) ?? ''}${user?.lastName?.charAt(0) ?? ''}`.toUpperCase();

  return (
    <div className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/92 backdrop-blur-xl">
      <header className="flex h-16 items-center gap-2 px-3 sm:px-5">
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
        <div className="min-w-0 flex-1 overflow-hidden px-1 sm:px-2">
          <AppBreadcrumbs />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <BusinessSwitcher tenant={tenant} />
          <BranchSwitcher tenant={tenant} />
          <Button
            aria-label="Notificaciones"
            className="relative hidden lg:inline-flex"
            size="icon"
            variant="ghost"
          >
            <Bell aria-hidden="true" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={`Cuenta: ${fullName}`}
                className="h-9 max-w-40 gap-2 px-1.5 sm:pr-2"
                variant="ghost"
              >
                <Avatar className="size-7 shrink-0 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-slate-900 text-[0.67rem] font-semibold text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden min-w-0 text-left leading-tight md:block">
                  <span className="block truncate text-xs font-semibold">{fullName}</span>
                  <span className="block truncate text-[0.62rem] font-normal text-muted-foreground">
                    {tenant.membership?.role.name}
                  </span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <span className="block truncate">{fullName}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {user?.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/invitacion">
                  <MailCheck aria-hidden="true" />
                  Aceptar invitación
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={signOut.pending} onSelect={() => void signOut.submit()}>
                <LogOut aria-hidden="true" />
                {signOut.pending ? 'Cerrando sesión…' : 'Cerrar sesión'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {signOut.error && (
        <p
          className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-800"
          role="alert"
        >
          {signOut.error}
        </p>
      )}
    </div>
  );
}
