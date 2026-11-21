import type { BusinessMembership, MemberData } from '@business-manager/contracts';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, UserPlus, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router';

import { PageHeader } from '@/components/page-header';
import { PermissionGuard } from '@/components/permission-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth/session-context';
import { listMembers, listRoles } from '@/features/members/api/members';
import { MemberEditor } from '@/features/members/components/member-editor';
import type { ActiveTenant } from '@/features/tenancy/use-active-tenant';
import { ApiError, apiErrorMessage } from '@/lib/api';

const emptyMembers: MemberData[] = [];
type Editor = { mode: 'invite' } | { mode: 'edit'; member: MemberData };

export function MembersPage() {
  const tenant = useOutletContext<ActiveTenant>();
  const { profile } = useSession();
  if (!tenant.membership || !profile) return null;
  return (
    <MemberDirectory
      key={`${profile.user.id}:${tenant.membership.business.id}`}
      userId={profile.user.id}
      membership={tenant.membership}
      tenant={tenant}
    />
  );
}

function MemberDirectory({
  userId,
  membership,
  tenant,
}: {
  userId: string;
  membership: BusinessMembership;
  tenant: ActiveTenant;
}) {
  const { client } = useSession();
  const cache = useQueryClient();
  const { business, role } = membership;
  const [editor, setEditor] = useState<Editor>();
  const [notice, setNotice] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });

  const prefix = ['tenant', userId, business.id] as const;
  const roles = useQuery({
    queryKey: [...prefix, 'roles'],
    queryFn: ({ signal }) => listRoles(client, business.id, signal),
    retry: false,
  });
  const members = useQuery({
    queryKey: [...prefix, 'members', pagination.pageIndex, pagination.pageSize],
    queryFn: ({ signal }) =>
      listMembers(client, business.id, pagination.pageIndex + 1, pagination.pageSize, signal),
    enabled: roles.isSuccess,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const canManage =
    roles.isSuccess &&
    membership.isOwner &&
    roles.data.data.some(
      (item) => item.id === role.id && item.permissionCodes.includes('users.manage'),
    );
  const editorReady = canManage && !tenant.branchesLoading && !tenant.branchError;
  const columns = useMemo<ColumnDef<MemberData>[]>(
    () => [
      {
        id: 'member',
        header: 'Usuario',
        cell: ({ row: { original } }) => (
          <div className="min-w-28">
            <p className="font-medium text-slate-900">
              {[original.firstName, original.lastName].filter(Boolean).join(' ')}
            </p>
            <p className="break-all text-xs text-muted-foreground">{original.email}</p>
          </div>
        ),
      },
      { id: 'role', header: 'Rol', accessorFn: (member) => member.role.name },
      {
        id: 'branches',
        header: 'Sucursales',
        cell: ({ row: { original } }) => {
          if (original.isOwner) return 'Todas las activas';
          const names = original.branchIds.map(
            (id) => tenant.branches.find((branch) => branch.id === id)?.name,
          );
          if (names.some((name) => name === undefined))
            return `${original.branchIds.length} asignadas`;
          return names.length ? names.join(', ') : 'Sin asignaciones';
        },
      },
      {
        id: 'status',
        header: 'Estado',
        cell: ({ row: { original } }) => (
          <Badge
            variant="outline"
            className={
              original.isActive
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-slate-100 text-slate-700'
            }
          >
            {original.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
        ),
      },
      ...(canManage
        ? [
            {
              id: 'edit',
              header: 'Acceso',
              cell: ({ row: { original } }: { row: { original: MemberData } }) => (
                <PermissionGuard allowed={!original.isOwner && original.role.code !== 'OWNER'}>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Editar acceso de ${original.email}`}
                    disabled={!editorReady}
                    onClick={() => {
                      setNotice('');
                      setEditor({ mode: 'edit', member: original });
                    }}
                  >
                    Editar
                  </Button>
                </PermissionGuard>
              ),
            },
          ]
        : []),
    ],
    [tenant.branches, canManage, editorReady],
  );
  // The table instance is consumed directly here because its pagination methods read mutable state.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: members.data?.data ?? emptyMembers,
    getRowId: (member) => member.id,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: members.data?.meta.total ?? 0,
    onPaginationChange: setPagination,
    state: { pagination },
  });

  const error = roles.error ?? members.error;
  const denied = error instanceof ApiError && error.status === 403;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Usuarios y roles"
        eyebrow="Administración"
        description={`Accesos del negocio ${business.name}.`}
        actions={
          <PermissionGuard allowed={canManage}>
            <Button
              disabled={!editorReady}
              onClick={() => {
                setNotice('');
                setEditor({ mode: 'invite' });
              }}
            >
              <UserPlus aria-hidden="true" /> Invitar usuario
            </Button>
          </PermissionGuard>
        }
      />
      {notice && (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {notice}
        </p>
      )}
      {canManage && tenant.branchError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-4 text-sm"
        >
          <p>No pudimos cargar las sucursales necesarias para editar accesos.</p>
          <Button variant="outline" size="sm" onClick={tenant.retryBranches}>
            Reintentar sucursales
          </Button>
        </div>
      )}
      {error ? (
        <div role="alert" className="space-y-3 rounded-xl border bg-white p-5 text-sm">
          <p>
            {denied
              ? 'Tu rol no tiene permiso para consultar usuarios de este negocio.'
              : apiErrorMessage(error)}
          </p>
          {!denied && (
            <Button
              variant="outline"
              onClick={() => void (roles.isError ? roles.refetch() : members.refetch())}
            >
              Reintentar
            </Button>
          )}
        </div>
      ) : members.isPending ? (
        <p role="status" className="rounded-xl border bg-white p-5 text-sm text-muted-foreground">
          Cargando usuarios…
        </p>
      ) : (
        <section
          aria-label="Membresías del negocio"
          className="overflow-hidden rounded-xl border bg-white shadow-sm"
        >
          <div className="overflow-x-auto">
            <table
              aria-label="Usuarios del negocio"
              aria-busy={members.isFetching}
              className="w-full text-left text-sm"
            >
              <thead className="bg-slate-50 text-xs font-medium text-slate-600">
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => (
                      <th scope="col" className="px-3 py-3 sm:px-4" key={header.id}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 text-slate-700">
                    {row.getVisibleCells().map((cell) => (
                      <td className="px-3 py-3 sm:px-4" key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {table.getRowModel().rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                      No hay usuarios en esta página.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-3 text-sm sm:px-4">
            <span className="text-muted-foreground">{members.data?.meta.total ?? 0} usuarios</span>
            <div className="flex items-center gap-2">
              <Button
                aria-label="Página anterior"
                size="icon-sm"
                variant="outline"
                disabled={!table.getCanPreviousPage() || members.isPlaceholderData}
                onClick={() => table.previousPage()}
              >
                <ChevronLeft />
              </Button>
              <span>
                Página {pagination.pageIndex + 1} de {Math.max(1, table.getPageCount())}
              </span>
              <Button
                aria-label="Página siguiente"
                size="icon-sm"
                variant="outline"
                disabled={!table.getCanNextPage() || members.isPlaceholderData}
                onClick={() => table.nextPage()}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </section>
      )}
      {roles.isSuccess && (
        <details className="rounded-xl border bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">
            <UsersRound aria-hidden="true" className="mr-2 inline size-4" />
            Roles y permisos
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {roles.data.data.map((item) => (
              <details key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  {item.name}{' '}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    · {item.permissionCodes.length} permisos
                  </span>
                </summary>
                <ul className="mt-2 space-y-1 break-all text-xs text-slate-600">
                  {item.permissionCodes.map((code) => (
                    <li key={code}>
                      <code>{code}</code>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </details>
      )}
      {editor && editorReady && roles.isSuccess && (
        <MemberEditor
          businessId={business.id}
          branches={tenant.branches}
          roles={roles.data.data.filter(({ code }) => code !== 'OWNER')}
          member={editor.mode === 'edit' ? editor.member : undefined}
          onClose={() => setEditor(undefined)}
          onSaved={() => {
            setEditor(undefined);
            setNotice('Acceso actualizado.');
            void cache.invalidateQueries({ queryKey: [...prefix, 'members'] });
          }}
        />
      )}
    </div>
  );
}
