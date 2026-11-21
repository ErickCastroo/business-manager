import { loginRequestSchema, type LoginRequest } from '@business-manager/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { AccountLayout, FormAlert } from '@/features/auth/components/account-layout';
import { useSession } from '@/features/auth/session-context';
import { invitationContinuation, invitationDestination } from '@/features/members/invitation-link';
import { apiErrorMessage } from '@/lib/api';

export function LoginPage() {
  const { signIn } = useSession();
  const { search, hash } = useLocation();
  const {
    handleSubmit,
    register,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (input) => {
    try {
      await signIn(input);
    } catch (error) {
      setError('root', { message: apiErrorMessage(error) });
    }
  });

  return (
    <AccountLayout
      title="Iniciar sesión"
      description="Accede a los negocios asociados a tu cuenta."
    >
      <form className="mt-6 grid gap-4" onSubmit={submit} noValidate>
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
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        {errors.root?.message && <FormAlert message={errors.root.message} />}
        <Button className="mt-1 h-10 w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
        </Button>
      </form>
      <p className="mt-5 text-sm text-muted-foreground">
        ¿Todavía no tienes cuenta?{' '}
        <Link
          className="font-medium text-blue-700 underline-offset-4 hover:underline"
          replace={search === invitationContinuation}
          to={
            search === invitationContinuation
              ? invitationDestination('/registro', hash)
              : '/registro'
          }
        >
          Crear cuenta
        </Link>
      </p>
    </AccountLayout>
  );
}
