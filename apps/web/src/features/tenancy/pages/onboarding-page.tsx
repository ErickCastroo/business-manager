import { createBusinessSchema, type CreateBusinessInput } from '@business-manager/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { FormField, SelectField } from '@/components/ui/form-field';
import { AccountLayout, FormAlert } from '@/features/auth/components/account-layout';
import { profileKey, useSession } from '@/features/auth/session-context';
import { useSignOut } from '@/features/auth/use-sign-out';
import { createBusiness } from '@/features/tenancy/api/tenancy';
import { apiErrorMessage } from '@/lib/api';

export function OnboardingPage() {
  const { client, profile } = useSession();
  const signOut = useSignOut();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const create = useMutation({
    mutationFn: (input: CreateBusinessInput) => createBusiness(client, input),
  });
  const {
    handleSubmit,
    register,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateBusinessInput>({
    resolver: zodResolver(createBusinessSchema),
    defaultValues: {
      name: '',
      baseCurrencyCode: 'MXN',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mazatlan',
      mainBranch: { name: 'Sucursal principal', code: 'PRINCIPAL' },
    },
  });
  const submit = handleSubmit(async (input) => {
    try {
      const { data } = await create.mutateAsync(input);
      await cache.invalidateQueries({ queryKey: profileKey });
      void navigate('/dashboard', { replace: true, state: { businessId: data.business.id } });
    } catch (error) {
      setError('root', { message: apiErrorMessage(error) });
    }
  });
  const hasBusiness = Boolean(profile?.memberships.length);

  return (
    <AccountLayout
      title={hasBusiness ? 'Crear otro negocio' : 'Configura tu negocio'}
      description="Define la moneda y la zona horaria del negocio y registra su primera sucursal."
    >
      <form className="mt-6 grid gap-4" onSubmit={submit} noValidate>
        <fieldset className="grid gap-4" disabled={isSubmitting || signOut.pending}>
          <FormField
            label="Nombre del negocio"
            placeholder="Ej. Ferretería Centro"
            error={errors.name?.message}
            {...register('name')}
          />
          <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
            <SelectField
              label="Moneda base"
              error={errors.baseCurrencyCode?.message}
              {...register('baseCurrencyCode')}
            >
              <option value="MXN">MXN · Peso mexicano</option>
              <option value="USD">USD · Dólar estadounidense</option>
            </SelectField>
            <FormField
              label="Zona horaria"
              hint="Ej. America/Mazatlan"
              error={errors.timezone?.message}
              {...register('timezone')}
            />
          </div>
          <fieldset className="mt-1 grid gap-4 rounded-lg border border-slate-200 px-3 pb-3 sm:grid-cols-[1.3fr_0.7fr]">
            <legend className="px-1 text-sm font-semibold text-slate-900">
              Sucursal principal
            </legend>
            <FormField
              label="Nombre de la sucursal"
              error={errors.mainBranch?.name?.message}
              {...register('mainBranch.name')}
            />
            <FormField
              label="Código"
              hint="Letras, números, guion o guion bajo."
              error={errors.mainBranch?.code?.message}
              {...register('mainBranch.code')}
            />
          </fieldset>
          {errors.root?.message && <FormAlert message={errors.root.message} />}
          <Button className="mt-1 h-10 w-full" type="submit">
            {isSubmitting ? 'Guardando…' : 'Crear negocio'}
          </Button>
        </fieldset>
      </form>
      {signOut.error && (
        <div className="mt-4">
          <FormAlert message={signOut.error} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost">
          <Link to="/invitacion">Aceptar invitación</Link>
        </Button>
        {hasBusiness && (
          <Button asChild variant="ghost">
            <Link to="/dashboard">Volver al panel</Link>
          </Button>
        )}
        <Button
          className="ml-auto"
          variant="ghost"
          disabled={signOut.pending || isSubmitting}
          onClick={() => void signOut.submit()}
        >
          {signOut.pending ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </Button>
      </div>
    </AccountLayout>
  );
}
