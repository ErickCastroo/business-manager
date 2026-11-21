import { registerRequestSchema, type RegisterRequest } from '@business-manager/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { AccountLayout, FormAlert } from '@/features/auth/components/account-layout';
import { useSession } from '@/features/auth/session-context';
import { invitationContinuation, invitationDestination } from '@/features/members/invitation-link';
import { apiErrorMessage } from '@/lib/api';

export function RegisterPage() {
  const { registerAccount } = useSession();
  const { search, hash } = useLocation();
  const fromInvitation = search === invitationContinuation;
  const {
    handleSubmit,
    register,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: { firstName: '', email: '', password: '' },
  });

  const submit = handleSubmit(async (input) => {
    try {
      await registerAccount(input);
    } catch (error) {
      setError('root', { message: apiErrorMessage(error) });
    }
  });

  return (
    <AccountLayout
      title="Crear cuenta"
      description={
        fromInvitation
          ? 'Regístrate con el correo invitado. Después podrás confirmar la invitación.'
          : 'Registra tus datos para configurar tu primer negocio.'
      }
    >
      <form className="mt-6 grid gap-4" onSubmit={submit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Nombre"
            autoComplete="given-name"
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <FormField
            label="Apellido (opcional)"
            autoComplete="family-name"
            error={errors.lastName?.message}
            {...register('lastName', { setValueAs: (value: string) => value.trim() || undefined })}
          />
        </div>
        <FormField
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <FormField
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          hint="Al menos 12 caracteres, con una mayúscula, una minúscula y un número."
          error={errors.password?.message}
          {...register('password')}
        />
        {errors.root?.message && <FormAlert message={errors.root.message} />}
        <Button className="mt-1 h-10 w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
      </form>
      <p className="mt-5 text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{' '}
        <Link
          className="font-medium text-blue-700 underline-offset-4 hover:underline"
          replace={fromInvitation}
          to={fromInvitation ? invitationDestination('/login', hash) : '/login'}
        >
          Iniciar sesión
        </Link>
      </p>
    </AccountLayout>
  );
}
