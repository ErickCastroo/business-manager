import { acceptInvitationSchema, type AcceptInvitationInput } from '@business-manager/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { AccountLayout, FormAlert } from '@/features/auth/components/account-layout';
import { profileKey, useSession } from '@/features/auth/session-context';
import { useSignOut } from '@/features/auth/use-sign-out';
import { acceptInvitation } from '@/features/members/api/members';
import { readInvitationCode } from '@/features/members/invitation-link';
import { apiErrorMessage } from '@/lib/api';

export function AcceptInvitationPage() {
  const { hash } = useLocation();
  return <InvitationForm key={hash} linkedCode={readInvitationCode(hash)} />;
}

function InvitationForm({ linkedCode }: { linkedCode: string | undefined }) {
  const { client, profile } = useSession();
  const signOut = useSignOut();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const {
    handleSubmit,
    register,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AcceptInvitationInput>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: { invitationCode: linkedCode ?? '' },
  });

  const submit = handleSubmit(async (input) => {
    try {
      const { data } = await acceptInvitation(client, input);
      reset();
      await cache.invalidateQueries({ queryKey: profileKey });
      void navigate('/dashboard', { replace: true, state: { businessId: data.businessId } });
    } catch (error) {
      setError('root', { message: apiErrorMessage(error) });
    }
  });
  const back = profile?.memberships.length ? '/dashboard' : '/onboarding';

  return (
    <AccountLayout
      title="Aceptar invitación"
      description={
        linkedCode
          ? 'Confirma que quieres unirte al negocio con esta cuenta.'
          : 'Pega el código que te compartió el propietario del negocio.'
      }
    >
      <p className="mt-5 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Sesión iniciada como{' '}
        <strong className="break-all text-slate-900">{profile?.user.email}</strong>. Usa la cuenta
        que recibió la invitación.
      </p>
      <form className="mt-5 grid gap-4" onSubmit={submit} noValidate>
        {linkedCode ? (
          <input type="hidden" {...register('invitationCode')} />
        ) : (
          <FormField
            label="Código de invitación"
            type="password"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={isSubmitting || signOut.pending}
            error={errors.invitationCode ? 'Pega el código completo de 43 caracteres.' : undefined}
            {...register('invitationCode', { setValueAs: (value: string) => value.trim() })}
          />
        )}
        {errors.root?.message && <FormAlert message={errors.root.message} />}
        <Button className="h-10 w-full" type="submit" disabled={isSubmitting || signOut.pending}>
          {isSubmitting ? 'Aceptando…' : 'Aceptar invitación'}
        </Button>
      </form>
      {signOut.error && (
        <div className="mt-4">
          <FormAlert message={signOut.error} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost">
          <Link to={back} replace={Boolean(linkedCode)}>
            Volver
          </Link>
        </Button>
        <Button
          variant="ghost"
          disabled={signOut.pending || isSubmitting}
          onClick={() => void signOut.submit()}
        >
          {signOut.pending ? 'Cerrando sesión…' : 'Cambiar de cuenta'}
        </Button>
      </div>
    </AccountLayout>
  );
}
