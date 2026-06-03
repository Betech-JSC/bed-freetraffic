import nodemailer from 'nodemailer';
import type Transporter from 'nodemailer/lib/mailer';
import prisma from './prisma';

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  email: string;
  password: string;
};

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const conn = await prisma.socialConnection.findUnique({ where: { platform: 'email' } });
  if (conn?.status === 'CONNECTED' && conn.accessToken) {
    try {
      const c = JSON.parse(conn.accessToken) as SmtpConfig & { user?: string };
      const email = c.email || c.user || conn.pageName || '';
      if (email && c.password && c.host) {
        return {
          host: c.host,
          port: c.port || 587,
          secure: !!c.secure,
          email,
          password: c.password,
        };
      }
    } catch {
      /* fall through */
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

export async function createSmtpTransporter(): Promise<Transporter | null> {
  const config = await getSmtpConfig();
  if (!config) return null;
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.email, pass: config.password },
  });
}
