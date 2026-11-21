import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '@/app/providers';
import { appRoutes } from '@/app/router';

const account = {
  id: '1',
  firstName: 'Alicia',
  lastName: 'Pérez',
  email: 'alicia@example.test',
  phone: null,
  createdAt: '2026-11-18T12:00:00.000Z',
};
const token = { accessToken: 'test-access-token', expiresIn: 900, tokenType: 'Bearer' };
const code = 'A'.repeat(43);
const ownerRole = { id: '5', code: 'OWNER', name: 'Propietario' };
const editorRole = { id: '6', code: 'ADMIN', name: 'Administrador' };
const cashierRole = { id: '7', code: 'CASHIER', name: 'Cajero' };
const member = {
  id: '22',
  businessId: '10',
  email: 'caja@example.test',
  firstName: 'Daniel',
  lastName: null,
  role: cashierRole,
  branchIds: ['11'],
  isOwner: false,
  isActive: true,
};
const firstBusiness = {
  id: '10',
  name: 'Ferretería Centro',
  baseCurrencyCode: 'MXN',
  timezone: 'America/Mazatlan',
};
const secondBusiness = {
  ...firstBusiness,
  id: '20',
  name: 'Ferretería Sur',
  baseCurrencyCode: 'USD',
};
const mainBranch = {
  id: '11',
  businessId: '10',
  name: 'Centro',
  code: 'CENTRO',
  timezone: 'America/Mazatlan',
  isMain: true,
};
const northBranch = { ...mainBranch, id: '12', name: 'Norte', code: 'NORTE', isMain: false };
const southBranch = { ...mainBranch, id: '21', businessId: '20', name: 'Sur', code: 'SUR' };
const membership = (business: typeof firstBusiness, branchIds: string[]) => ({
  branchIds,
  business,
  businessUserId: business.id,
  isOwner: true,
  role: ownerRole,
});

function mockApi({
  signedIn = true,
  initialMemberships = [membership(firstBusiness, ['11', '12'])],
  forbidDirectory = false,
  emailAvailable = true,
} = {}) {
  let loggedIn = signedIn;
  let memberships = initialMemberships;
  let branches = [mainBranch, northBranch, southBranch];
  let colleague = member;
  const ok = (data: unknown, status = 200) => Response.json({ data }, { status });
  const fetchMock = vi.fn(async (input: string, options?: RequestInit) => {
    const { pathname } = new URL(input);
    const headers = new Headers(options?.headers);
    switch (pathname) {
      case '/api/v1/auth/refresh':
        return loggedIn
          ? ok({ token })
          : Response.json(
              { error: { code: 'AUTH_REFRESH_MISSING', message: 'Inicia sesión.' } },
              { status: 401 },
            );
      case '/api/v1/auth/login':
      case '/api/v1/auth/register':
        loggedIn = true;
        return ok({ token, user: account }, pathname.endsWith('/register') ? 201 : 200);
      case '/api/v1/auth/me':
        expect(headers.get('authorization')).toBe('Bearer test-access-token');
        return ok({ user: account, memberships });
      case '/api/v1/auth/logout':
        loggedIn = false;
        return ok({ loggedOut: true });
      case '/api/v1/businesses': {
        const body = JSON.parse(String(options?.body));
        const business = { ...firstBusiness, name: body.name };
        const branch = { ...mainBranch, name: body.mainBranch.name };
        memberships = [membership(business, [branch.id])];
        branches = [branch];
        return ok({ business, mainBranch: branch, businessUserId: '10' }, 201);
      }
      case '/api/v1/branches':
        return Response.json({
          data: branches.filter((branch) => branch.businessId === headers.get('x-business-id')),
          meta: { totalPages: 1 },
        });
      case '/api/v1/roles':
        if (forbidDirectory) {
          return Response.json(
            { error: { code: 'PERMISSION_DENIED', message: 'Sin permiso.' } },
            { status: 403 },
          );
        }
        return ok([
          { ...ownerRole, permissionCodes: ['users.read', 'users.manage'] },
          { ...editorRole, permissionCodes: ['users.read', 'users.manage'] },
          { ...cashierRole, permissionCodes: [] },
        ]);
      case '/api/v1/users':
        return Response.json({
          data: [
            {
              ...member,
              id: '10',
              email: account.email,
              firstName: account.firstName,
              isOwner: true,
              role: ownerRole,
            },
            colleague,
          ].filter((row) => row.businessId === headers.get('x-business-id')),
          meta: { page: 1, pageSize: 25, total: 2, totalPages: 1 },
        });
      case '/api/v1/users/invitations':
        return ok({ invitationCode: code, expiresAt: '2026-12-01T12:00:00.000Z' }, 201);
      case '/api/v1/users/invitations/email':
        return emailAvailable
          ? ok({ sent: true, expiresAt: '2026-12-01T12:00:00.000Z' }, 201)
          : Response.json(
              { error: { code: 'INVITATION_EMAIL_UNAVAILABLE', message: 'SMTP unavailable.' } },
              { status: 503 },
            );
      case '/api/v1/users/invitations/accept':
        memberships = [
          ...memberships,
          {
            ...membership(secondBusiness, ['21']),
            role: cashierRole,
            isOwner: false,
          },
        ];
        return ok({ ...member, businessId: '20', branchIds: ['21'], email: account.email }, 201);
      case '/api/v1/users/22': {
        const changes = JSON.parse(String(options?.body));
        colleague = {
          ...colleague,
          ...changes,
          ...(changes.roleId === '6' && { role: editorRole }),
        };
        // The member response includes the role summary rather than a separate roleId.
        const { roleId: _roleId, ...data } = colleague as typeof member & { roleId?: string };
        colleague = data;
        return ok(data);
      }
      default:
        throw new Error(`Unexpected API request: ${pathname}`);
    }
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  mockApi();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function renderRoute(path: string) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });
  const user = userEvent.setup();

  const view = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );

  return { router, user, unmount: view.unmount };
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

    await user.click(await screen.findByRole('link', { name: 'Inventario' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Inventario' }),
    ).toBeInTheDocument();
    expect(screen.getByText('El módulo de inventario está preparado')).toBeInTheDocument();
  });

  it('opens the responsive navigation and closes it after navigating', async () => {
    const { user } = renderRoute('/dashboard');

    await user.click(await screen.findByRole('button', { name: 'Abrir menú' }));

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

  it('redirects a guest and opens the dashboard after login', async () => {
    const api = mockApi({ signedIn: false });
    const { router, user } = renderRoute('/dashboard');
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/login');
    await user.type(screen.getByLabelText('Correo electrónico'), 'alicia@example.test');
    await user.type(screen.getByLabelText('Contraseña'), 'TestPassword7');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('heading', { name: 'Panel de control' })).toBeVisible();
    expect(api.mock.calls.find(([url]) => url.endsWith('/auth/login'))?.[1]).toMatchObject({
      credentials: 'include',
    });
  });

  it('registers a user and creates the first business and branch', async () => {
    const api = mockApi({ signedIn: false, initialMemberships: [] });
    const { user } = renderRoute('/registro');
    await user.click(await screen.findByRole('button', { name: 'Crear cuenta' }));
    expect(screen.getByText('El correo es obligatorio.')).toBeVisible();
    expect(api.mock.calls.some(([url]) => url.endsWith('/auth/register'))).toBe(false);
    await user.type(screen.getByLabelText('Nombre', { exact: true }), 'Alicia');
    await user.type(screen.getByLabelText('Correo electrónico'), 'alicia@example.test');
    await user.type(screen.getByLabelText('Contraseña'), 'TestPassword7');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('heading', { name: 'Configura tu negocio' })).toBeVisible();
    await user.type(screen.getByLabelText('Nombre del negocio'), 'Negocio nuevo');
    await user.click(screen.getByRole('button', { name: 'Crear negocio' }));
    expect(
      await screen.findByRole('button', { name: 'Negocio activo: Negocio nuevo' }),
    ).toBeVisible();
    expect(
      await screen.findByRole('button', { name: 'Sucursal activa: Sucursal principal' }),
    ).toBeVisible();
  });

  it('scopes branches to the active business and returns to login after logout', async () => {
    const api = mockApi({
      initialMemberships: [
        membership(firstBusiness, ['11', '12']),
        membership(secondBusiness, ['21']),
      ],
    });
    const { user } = renderRoute('/dashboard');
    await user.click(await screen.findByRole('button', { name: 'Sucursal activa: Centro' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Norte' }));
    expect(screen.getByRole('button', { name: 'Sucursal activa: Norte' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Negocio activo: Ferretería Centro' }));
    await user.click(await screen.findByRole('menuitemradio', { name: /Ferretería Sur/ }));
    expect(await screen.findByRole('button', { name: 'Sucursal activa: Sur' })).toBeVisible();
    const requests = api.mock.calls
      .filter(([url]) => new URL(url).pathname.endsWith('/branches'))
      .map(([, request]) => new Headers(request?.headers).get('x-business-id'));
    expect(requests).toEqual(['10', '20']);

    await user.click(screen.getByRole('button', { name: 'Cuenta: Alicia Pérez' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Negocio activo/ })).not.toBeInTheDocument();
  });

  it('lets the owner issue a code and edit another membership in the active business', async () => {
    const api = mockApi();
    const { user } = renderRoute('/administration');
    await screen.findByRole('table', { name: 'Usuarios del negocio' });
    expect(
      screen.queryByRole('button', { name: 'Editar acceso de alicia@example.test' }),
    ).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Invitar usuario' }));
    let dialog = await screen.findByRole('dialog', { name: 'Invitar usuario' });
    await user.type(
      within(dialog).getByLabelText('Correo de la persona invitada'),
      'nuevo@example.test',
    );
    await user.selectOptions(within(dialog).getByLabelText('Rol'), '7');
    await user.click(within(dialog).getByRole('checkbox', { name: /Norte/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Generar enlace' }));
    dialog = await screen.findByRole('dialog', { name: 'Invitación creada' });
    expect(within(dialog).getByLabelText('Enlace de invitación')).toHaveValue(
      `${window.location.origin}/registro?continuar=invitacion#codigo=${code}`,
    );
    await user.click(within(dialog).getByText('Ver código manual'));
    expect(within(dialog).getByLabelText('Código de un solo uso')).toHaveValue(code);
    const invitationRequest = api.mock.calls.find(([url]) =>
      url.endsWith('/users/invitations'),
    )?.[1];
    expect(new Headers(invitationRequest?.headers).get('x-business-id')).toBe('10');
    expect(JSON.parse(String(invitationRequest?.body))).toEqual({
      email: 'nuevo@example.test',
      roleId: '7',
      branchIds: ['12'],
    });
    await user.click(within(dialog).getByRole('button', { name: 'Listo' }));
    expect(screen.queryByLabelText('Código de un solo uso')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Editar acceso de caja@example.test' }));
    dialog = await screen.findByRole('dialog', { name: 'Editar acceso' });
    await user.selectOptions(within(dialog).getByLabelText('Rol'), '6');
    await user.click(within(dialog).getByRole('checkbox', { name: /Centro/ }));
    await user.click(within(dialog).getByRole('checkbox', { name: /Norte/ }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Acceso activo al negocio' }));
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Acceso actualizado.')).toBeVisible();
    const change = api.mock.calls.find(([url]) => url.endsWith('/users/22'))?.[1];
    expect(new Headers(change?.headers).get('x-business-id')).toBe('10');
    expect(JSON.parse(String(change?.body))).toEqual({
      roleId: '6',
      branchIds: ['12'],
      isActive: false,
    });
    expect(await within(screen.getByRole('table')).findByText('Inactivo')).toBeVisible();
  });

  it('shows the directory read-only for an administrator and hides denied data for a cashier', async () => {
    mockApi({
      initialMemberships: [
        {
          ...membership(firstBusiness, ['11']),
          role: editorRole,
          isOwner: false,
        },
      ],
    });
    const view = renderRoute('/administration');
    expect(await screen.findByRole('table')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Invitar usuario' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar acceso/ })).not.toBeInTheDocument();
    view.unmount();

    const api = mockApi({ forbidDirectory: true });
    renderRoute('/administration');
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu rol no tiene permiso');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(api.mock.calls.some(([url]) => new URL(url).pathname.endsWith('/users'))).toBe(false);
  });

  it('returns a guest to the invitation after login and selects the newly joined business', async () => {
    const api = mockApi({ signedIn: false, initialMemberships: [] });
    const { user, router } = renderRoute('/invitacion');
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      '/registro?continuar=invitacion',
    );
    await user.type(screen.getByLabelText('Correo electrónico'), account.email);
    await user.type(screen.getByLabelText('Contraseña'), 'TestPassword7');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('heading', { name: 'Aceptar invitación' })).toBeVisible();
    await user.type(screen.getByLabelText('Código de invitación'), code);
    await user.click(screen.getByRole('button', { name: 'Aceptar invitación' }));
    expect(
      await screen.findByRole('button', { name: 'Negocio activo: Ferretería Sur' }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/dashboard');
    const acceptance = api.mock.calls.find(([url]) => url.endsWith('/invitations/accept'))?.[1];
    expect(new Headers(acceptance?.headers).has('x-business-id')).toBe(false);
    expect(JSON.parse(String(acceptance?.body))).toEqual({ invitationCode: code });
  });

  it('offers a copyable link when email is unavailable and reports email success separately', async () => {
    const api = mockApi({ emailAvailable: false });
    const first = renderRoute('/administration');
    await screen.findByRole('table');
    await first.user.click(await screen.findByRole('button', { name: 'Invitar usuario' }));
    let dialog = await screen.findByRole('dialog', { name: 'Invitar usuario' });
    await first.user.type(
      within(dialog).getByLabelText('Correo de la persona invitada'),
      'nuevo@example.test',
    );
    await first.user.selectOptions(within(dialog).getByLabelText('Rol'), '7');
    await first.user.click(within(dialog).getByRole('button', { name: 'Enviar invitación' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'El correo aún no está configurado. Puedes generar un enlace para compartirlo.',
    );
    await first.user.click(within(dialog).getByRole('button', { name: 'Generar enlace' }));
    dialog = await screen.findByRole('dialog', { name: 'Invitación creada' });
    await first.user.click(within(dialog).getByRole('button', { name: 'Copiar enlace' }));
    const copied = await navigator.clipboard.readText();
    expect(copied).toBe(`${window.location.origin}/registro?continuar=invitacion#codigo=${code}`);
    const emailCall = api.mock.calls.find(([url]) => url.endsWith('/invitations/email'))?.[1];
    expect(new Headers(emailCall?.headers).get('x-business-id')).toBe('10');
    first.unmount();

    mockApi();
    const second = renderRoute('/administration');
    await screen.findByRole('table');
    await second.user.click(await screen.findByRole('button', { name: 'Invitar usuario' }));
    dialog = await screen.findByRole('dialog', { name: 'Invitar usuario' });
    await second.user.type(
      within(dialog).getByLabelText('Correo de la persona invitada'),
      'nuevo@example.test',
    );
    await second.user.selectOptions(within(dialog).getByLabelText('Rol'), '7');
    await second.user.click(within(dialog).getByRole('button', { name: 'Enviar invitación' }));
    expect(await screen.findByRole('dialog', { name: 'Invitación enviada' })).toBeVisible();
    expect(screen.queryByLabelText('Enlace de invitación')).not.toBeInTheDocument();
  });

  it('carries the email link through registration and consumes it only on confirmation', async () => {
    const api = mockApi({ signedIn: false, initialMemberships: [] });
    const { user, router } = renderRoute(`/registro?continuar=invitacion#codigo=${code}`);
    expect(await screen.findByRole('heading', { name: 'Crear cuenta' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      `/login?continuar=invitacion#codigo=${code}`,
    );
    expect(router.state.location.hash).toBe(`#codigo=${code}`);
    await user.type(await screen.findByLabelText('Nombre', { exact: true }), 'Alicia');
    await user.type(screen.getByLabelText('Correo electrónico'), account.email);
    await user.type(screen.getByLabelText('Contraseña'), 'TestPassword7');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await screen.findByRole('heading', { name: 'Aceptar invitación' });
    expect(screen.queryByLabelText('Código de invitación')).not.toBeInTheDocument();
    expect(api.mock.calls.some(([url]) => url.endsWith('/invitations/accept'))).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Aceptar invitación' }));
    expect(
      await screen.findByRole('button', { name: 'Negocio activo: Ferretería Sur' }),
    ).toBeVisible();
    expect(router.state.location.hash).toBe('');
    const acceptance = api.mock.calls.find(([url]) => url.endsWith('/invitations/accept'))?.[1];
    expect(JSON.parse(String(acceptance?.body))).toEqual({ invitationCode: code });
  });
});
