import {
  inviteMemberSchema,
  type BranchData,
  type MemberData,
  type UpdateMemberInput,
} from '@business-manager/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, Mail } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { FormField, SelectField } from '@/components/ui/form-field';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { FormAlert } from '@/features/auth/components/account-layout';
import { useSession } from '@/features/auth/session-context';
import {
  emailInvitation,
  issueInvitation,
  updateMembership,
  type MemberRole,
} from '@/features/members/api/members';
import { invitationDestination } from '@/features/members/invitation-link';
import { ApiError, apiErrorMessage } from '@/lib/api';

const editorSchema = inviteMemberSchema.extend({ isActive: z.boolean() });
type EditorInput = z.infer<typeof editorSchema>;
type IssuedInvitation =
  | { delivery: 'manual'; invitationCode: string; expiresAt: string }
  | { delivery: 'email'; email: string; expiresAt: string };

type MemberEditorProps = {
  businessId: string;
  branches: readonly BranchData[];
  roles: readonly MemberRole[];
  member: MemberData | undefined;
  onClose: () => void;
  onSaved: () => void;
};

export function MemberEditor({
  businessId,
  branches,
  roles,
  member,
  onClose,
  onSaved,
}: MemberEditorProps) {
  const { client } = useSession();
  const [invitation, setInvitation] = useState<IssuedInvitation>();
  const [copyMessage, setCopyMessage] = useState('');
  const {
    control,
    handleSubmit,
    register,
    setError,
    formState: { errors, dirtyFields, isDirty, isSubmitting },
  } = useForm<EditorInput>({
    resolver: zodResolver(editorSchema),
    defaultValues: {
      email: member?.email ?? '',
      roleId: member?.role.id ?? '',
      branchIds: member?.branchIds ?? [],
      isActive: member?.isActive ?? true,
    },
  });

  const submit = (delivery: 'email' | 'manual') =>
    handleSubmit(async ({ email, roleId, branchIds, isActive }) => {
      try {
        if (!member) {
          if (delivery === 'email') {
            const { data } = await emailInvitation(client, businessId, {
              email,
              roleId,
              branchIds,
            });
            setInvitation({ delivery: 'email', email, expiresAt: data.expiresAt });
          } else {
            const { data } = await issueInvitation(client, businessId, {
              email,
              roleId,
              branchIds,
            });
            setInvitation({ delivery: 'manual', ...data });
          }
          return;
        }
        const changes: UpdateMemberInput = {};
        if (dirtyFields.roleId) changes.roleId = roleId;
        if (dirtyFields.branchIds) changes.branchIds = branchIds;
        if (dirtyFields.isActive) changes.isActive = isActive;
        await updateMembership(client, businessId, member.id, changes);
        onSaved();
      } catch (error) {
        const emailError =
          error instanceof ApiError &&
          (error.code === 'INVITATION_EMAIL_UNAVAILABLE' ||
            error.code === 'INVITATION_EMAIL_FAILED');
        setError('root', {
          message: emailError
            ? error.code === 'INVITATION_EMAIL_UNAVAILABLE'
              ? 'El correo aún no está configurado. Puedes generar un enlace para compartirlo.'
              : 'No se pudo confirmar el envío. Reintenta o genera un enlace para compartirlo.'
            : apiErrorMessage(error),
        });
      }
    });

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopyMessage('Enlace copiado.');
    } catch {
      setCopyMessage('Selecciona el enlace y cópialo manualmente.');
    }
  }

  const manualLink =
    invitation?.delivery === 'manual'
      ? new URL(
          invitationDestination('/registro', `#codigo=${invitation.invitationCode}`),
          window.location.origin,
        ).href
      : undefined;
  const localLink = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  const title =
    invitation?.delivery === 'email'
      ? 'Invitación enviada'
      : invitation
        ? 'Invitación creada'
        : member
          ? 'Editar acceso'
          : 'Invitar usuario';

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
    >
      <SheetContent
        className="overflow-y-auto p-5 data-[side=right]:w-full data-[side=right]:sm:max-w-md sm:p-6"
        showCloseButton={false}
      >
        <div className="space-y-1.5">
          <SheetTitle className="text-lg">{title}</SheetTitle>
          <SheetDescription>
            {invitation
              ? invitation.delivery === 'email'
                ? 'El servidor de correo aceptó la invitación.'
                : 'Copia el enlace antes de cerrar y compártelo en privado con la persona invitada.'
              : member
                ? member.email
                : 'Elige el rol y las sucursales a las que tendrá acceso la persona invitada.'}
          </SheetDescription>
        </div>

        {invitation ? (
          <div className="space-y-4">
            {invitation.delivery === 'manual' ? (
              <>
                <FormField
                  label="Enlace de invitación"
                  readOnly
                  value={manualLink}
                  onFocus={(event) => event.currentTarget.select()}
                />
                {localLink && (
                  <p className="text-sm text-slate-600">
                    Este enlace apunta a localhost y funciona en el equipo donde corre la web.
                  </p>
                )}
                <details className="text-sm">
                  <summary className="cursor-pointer">Ver código manual</summary>
                  <div className="mt-2">
                    <FormField
                      label="Código de un solo uso"
                      className="font-mono"
                      readOnly
                      value={invitation.invitationCode}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  </div>
                </details>
              </>
            ) : (
              <p className="break-all text-sm font-medium">{invitation.email}</p>
            )}
            <p className="text-sm text-slate-600">
              Vence el{' '}
              {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(
                new Date(invitation.expiresAt),
              )}
              .
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              {manualLink && (
                <Button variant="outline" onClick={() => void copyLink(manualLink)}>
                  <Copy aria-hidden="true" />
                  Copiar enlace
                </Button>
              )}
              <Button onClick={onClose}>Listo</Button>
            </div>
            <p className="text-sm text-slate-600" role="status">
              {copyMessage}
            </p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={submit('email')} noValidate>
            <fieldset className="space-y-4" disabled={isSubmitting}>
              {!member && (
                <FormField
                  label="Correo de la persona invitada"
                  type="email"
                  autoComplete="off"
                  error={errors.email ? 'Ingresa un correo electrónico válido.' : undefined}
                  {...register('email', { setValueAs: (value: string) => value.trim() })}
                />
              )}
              <SelectField
                label="Rol"
                error={errors.roleId ? 'Selecciona un rol.' : undefined}
                {...register('roleId')}
              >
                <option value="">Selecciona un rol</option>
                {member && !roles.some(({ id }) => id === member.role.id) && (
                  <option disabled value={member.role.id}>
                    {member.role.name} (inactivo)
                  </option>
                )}
                {roles.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </SelectField>
              <fieldset className="space-y-2 rounded-md border border-slate-200 p-3">
                <legend className="px-1 text-sm font-medium">Sucursales permitidas</legend>
                <Controller
                  control={control}
                  name="branchIds"
                  render={({ field }) => (
                    <div className="max-h-55 space-y-2 overflow-y-auto">
                      {branches.length === 0 && (
                        <p className="text-muted-foreground">Sin sucursales activas.</p>
                      )}
                      {branches.map(({ id, name, code }) => (
                        <label className="flex items-center gap-2" key={id}>
                          <input
                            type="checkbox"
                            className="size-4 accent-blue-600"
                            checked={field.value.includes(id)}
                            onChange={(event) =>
                              field.onChange(
                                event.target.checked
                                  ? [...field.value, id]
                                  : field.value.filter((value) => value !== id),
                              )
                            }
                          />
                          <span className="min-w-0 break-words">
                            {name} <span className="text-xs text-muted-foreground">({code})</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                />
                {errors.branchIds && (
                  <p role="alert" className="text-xs text-destructive">
                    Selecciona hasta 100 sucursales válidas.
                  </p>
                )}
              </fieldset>
              {member && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-blue-600"
                    {...register('isActive')}
                  />{' '}
                  Acceso activo al negocio
                </label>
              )}
              {errors.root?.message && <FormAlert message={errors.root.message} />}
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                {!member && (
                  <Button type="button" variant="outline" onClick={submit('manual')}>
                    Generar enlace
                  </Button>
                )}
                <Button type="submit" disabled={Boolean(member) && !isDirty}>
                  {!member && <Mail aria-hidden="true" />}
                  {isSubmitting ? 'Procesando…' : member ? 'Guardar cambios' : 'Enviar invitación'}
                </Button>
              </div>
            </fieldset>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
