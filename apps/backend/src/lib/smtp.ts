import nodemailer from 'nodemailer';
import type Transporter from 'nodemailer/lib/mailer';
import prisma from './prisma';

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  email: string;
  password: string;
  oauthConnected?: boolean;
};

export async function getSmtpConfig(workspaceId?: number): Promise<SmtpConfig | null> {
  if (workspaceId) {
    const conn = await prisma.socialConnection.findFirst({
      where: { platform: 'email', workspaceId }
    });
    if (conn?.status === 'CONNECTED' && conn.accessToken) {
      try {
        const c = JSON.parse(conn.accessToken) as SmtpConfig & { user?: string };
        const email = c.email || c.user || conn.pageName || '';
        if (email) {
          return {
            host: c.host || 'smtp.gmail.com',
            port: c.port || 587,
            secure: !!c.secure,
            email,
            password: c.password || '',
            oauthConnected: !!c.oauthConnected
          };
        }
      } catch {
        /* fall through */
      }
    }
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      email: process.env.SMTP_USER,
      password: process.env.SMTP_PASS,
    };
  }

  return null;
}

export async function createSmtpTransporter(workspaceId?: number): Promise<Transporter | null> {
  const config = await getSmtpConfig(workspaceId);
  if (!config) return null;

  // Nếu là Google OAuth và có workspaceId, thiết lập OAuth2 cho transporter
  if (config.oauthConnected && workspaceId) {
    const googleInt = await prisma.googleIntegration.findFirst({
      where: { workspaceId }
    });

    if (googleInt && googleInt.refreshToken) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (clientId && clientSecret) {
        return nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: {
            type: 'OAuth2',
            user: config.email,
            clientId: clientId,
            clientSecret: clientSecret,
            refreshToken: googleInt.refreshToken,
            accessToken: googleInt.accessToken || undefined,
          }
        } as any);
      } else {
        console.error("[SMTP OAuth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET for OAuth SMTP.");
      }
    }
  }

  // Trường hợp SMTP thường dùng mật khẩu (hoặc App Password)
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.email, pass: config.password },
  });
}
