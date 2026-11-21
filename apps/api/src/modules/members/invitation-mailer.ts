import nodemailer from 'nodemailer';
import { z } from 'zod';

export type InvitationMailer = Readonly<{
  send: (message: {
    email: string;
    businessName: string;
    invitationCode: string;
    requiresRegistration: boolean;
  }) => Promise<void>;
}>;

const loopback = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function createInvitationMailer(
  env: NodeJS.ProcessEnv = process.env,
): InvitationMailer | null {
  const host = env.SMTP_HOST?.trim();
  const sender = z.email().safeParse(env.SMTP_FROM?.trim());
  const publicUrl = env.INVITATION_WEB_URL?.trim();
  const port = Number(env.SMTP_PORT?.trim() || '587');
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASSWORD;
  if (!host || !sender.success || !publicUrl || !Number.isInteger(port) || port < 1 || port > 65535)
    return null;
  if (Boolean(user) !== Boolean(pass)) return null;

  let webUrl: URL;
  try {
    webUrl = new URL(publicUrl);
  } catch {
    return null;
  }
  if (webUrl.username || webUrl.password || webUrl.search || webUrl.hash || webUrl.pathname !== '/')
    return null;
  const production = env.NODE_ENV === 'production';
  const localWeb = !production && webUrl.protocol === 'http:' && loopback.has(webUrl.hostname);
  if (webUrl.protocol !== 'https:' && !localWeb) return null;

  const secure = port === 465;
  const localSmtp = !production && loopback.has(host.toLowerCase()) && !user;
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure && !localSmtp,
    ...(user && pass ? { auth: { user, pass } } : {}),
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 10_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });

  return {
    async send({ email, businessName, invitationCode, requiresRegistration }) {
      const link = new URL(requiresRegistration ? '/registro' : '/invitacion', webUrl);
      if (requiresRegistration) link.searchParams.set('continuar', 'invitacion');
      link.hash = new URLSearchParams({ codigo: invitationCode }).toString();
      const href = link.href;
      const action = requiresRegistration ? 'Crear cuenta y continuar' : 'Aceptar invitación';
      const instructions = requiresRegistration
        ? 'Crea tu cuenta con el correo que recibió este mensaje y luego confirma la invitación.'
        : 'Inicia sesión con el correo invitado para confirmar la invitación.';
      const result = await transport.sendMail({
        from: { name: 'Business Manager', address: sender.data },
        to: { name: '', address: email },
        subject: 'Tienes una invitación a Business Manager',
        text: `Te invitaron a unirte a ${businessName} en Business Manager.\n\n${action}: ${href}\n\n${instructions} El enlace vence en 48 horas y se puede usar una sola vez.`,
        html: [
          `<p>Te invitaron a unirte a <strong>${escapeHtml(businessName)}</strong> en Business Manager.</p>`,
          `<p><a href="${escapeHtml(href)}" style="display:inline-block;padding:10px 16px;color:#fff;background:#1d4ed8;text-decoration:none;border-radius:6px">${action}</a></p>`,
          `<p>${instructions} El enlace vence en 48 horas y se puede usar una sola vez.</p>`,
        ].join(''),
      });
      if (result.accepted.length !== 1) throw new Error('Invitation email not accepted by SMTP.');
    },
  };
}
