import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AppProviders } from '@/app/providers';
import { appRoutes } from '@/app/router';

function renderRoute(path: string) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });
  const user = userEvent.setup();

  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );

  return { router, user };
}

describe('application router', () => {
  it('renders the Dashboard inside the administrative shell', async () => {
    renderRoute('/dashboard');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Panel de control' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument();
    expect(screen.getByText('Ventas de hoy')).toBeInTheDocument();
    expect(screen.getAllByText('Sin datos')).toHaveLength(4);
  });

  it('navigates to a prepared module from the sidebar', async () => {
    const { user } = renderRoute('/dashboard');

    await user.click(screen.getByRole('link', { name: 'Inventario' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Inventario' }),
    ).toBeInTheDocument();
    expect(screen.getByText('El módulo de inventario está preparado')).toBeInTheDocument();
  });

  it('opens the responsive navigation and closes it after navigating', async () => {
    const { user } = renderRoute('/dashboard');

    await user.click(screen.getByRole('button', { name: 'Abrir menú' }));

    const dialog = await screen.findByRole('dialog', { name: 'Navegación principal' });
    const mobileNavigation = within(dialog).getByRole('navigation', {
      name: 'Navegación principal',
    });

    await user.click(within(mobileNavigation).getByRole('link', { name: 'Ventas' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Ventas' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Navegación principal' })).not.toBeInTheDocument();
  });

  it('renders a clear not-found page for unknown routes', async () => {
    renderRoute('/does-not-exist');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Esta página no existe' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Error 404')).toBeInTheDocument();
  });
});
