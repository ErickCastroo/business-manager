import { useState } from 'react';
import { Outlet } from 'react-router';

import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-svh bg-[#f5f7fb]">
      <a
        className="fixed top-2 left-2 z-100 -translate-y-16 rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white transition-transform focus:translate-y-0"
        href="#main-content"
      >
        Saltar al contenido
      </a>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden border-r border-slate-950/10 transition-[width] duration-200 lg:flex',
          collapsed ? 'w-19' : 'w-64',
        )}
      >
        <AppSidebar collapsed={collapsed} />
      </aside>

      <div
        className={cn(
          'min-h-svh transition-[padding] duration-200',
          collapsed ? 'lg:pl-19' : 'lg:pl-64',
        )}
      >
        <AppHeader
          collapsed={collapsed}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onToggleSidebar={() => setCollapsed((current) => !current)}
        />
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-5 lg:p-6" id="main-content">
          <Outlet />
        </main>
      </div>

      <Sheet onOpenChange={setMobileMenuOpen} open={mobileMenuOpen}>
        <SheetContent
          className="w-[18rem] gap-0 border-r-0 bg-[#101a33] p-0 text-white sm:max-w-[18rem]"
          showCloseButton={false}
          side="left"
        >
          <SheetTitle className="sr-only">Navegación principal</SheetTitle>
          <SheetDescription className="sr-only">
            Menú de navegación de Business Manager
          </SheetDescription>
          <AppSidebar mobile onNavigate={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
