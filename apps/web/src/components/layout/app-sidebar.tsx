import { CircleCheck, ShieldCheck } from 'lucide-react';
import { NavLink } from 'react-router';

import { navigationGroups, type NavigationItem } from '@/app/navigation';
import { AppBrand } from '@/components/layout/app-brand';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type AppSidebarProps = {
  collapsed?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
};

type SidebarLinkProps = {
  collapsed: boolean;
  item: NavigationItem;
  onNavigate?: () => void;
};

function SidebarLink({ collapsed, item, onNavigate }: SidebarLinkProps) {
  const Icon = item.icon;
  const link = (
    <NavLink
      aria-label={item.label}
      className={({ isActive }) =>
        cn(
          'group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[0.83rem] font-medium text-slate-300 transition-colors hover:bg-white/7 hover:text-white',
          collapsed && 'justify-center px-0',
          isActive &&
            'bg-blue-500/16 text-white shadow-[inset_0_0_0_1px_rgb(96_165_250/0.16)] before:absolute before:top-2 before:bottom-2 before:left-0 before:w-0.5 before:rounded-full before:bg-blue-400',
        )
      }
      onClick={onNavigate}
      to={item.href}
    >
      <Icon aria-hidden="true" className="size-[1.05rem] shrink-0" strokeWidth={1.9} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );

  if (!collapsed) {
    return link;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

export function AppSidebar({ collapsed = false, mobile = false, onNavigate }: AppSidebarProps) {
  const isCollapsed = collapsed && !mobile;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#101a33] text-white">
      <AppBrand collapsed={isCollapsed} />

      <nav
        aria-label="Navegación principal"
        className={cn('min-h-0 flex-1 overflow-y-auto px-3 py-4', isCollapsed && 'px-2')}
      >
        <div className="space-y-5">
          {navigationGroups.map((group) => (
            <section key={group.label}>
              {!isCollapsed && (
                <p className="mb-1.5 px-3 text-[0.64rem] font-semibold tracking-[0.14em] text-slate-500 uppercase">
                  {group.label}
                </p>
              )}
              {isCollapsed && <Separator className="mb-2 bg-white/8" />}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <SidebarLink
                    collapsed={isCollapsed}
                    item={item}
                    key={item.href}
                    {...(onNavigate === undefined ? {} : { onNavigate })}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </nav>

      <div className={cn('border-t border-white/8 p-3', isCollapsed && 'px-2')}>
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="grid h-9 place-items-center rounded-lg text-emerald-300">
                <ShieldCheck aria-hidden="true" className="size-[1.05rem]" />
                <span className="sr-only">Entorno protegido</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              Entorno protegido
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2.5 ring-1 ring-white/7">
            <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-emerald-400" />
            <div className="min-w-0">
              <p className="truncate text-[0.74rem] font-medium text-slate-200">
                Interfaz preparada
              </p>
              <p className="truncate text-[0.66rem] text-slate-500">Sin conexión a datos todavía</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
