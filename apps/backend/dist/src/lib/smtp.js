"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSmtpConfig = getSmtpConfig;
exports.createSmtpTransporter = createSmtpTransporter;
const nodemailer_1 = __importDefault(require("nodemailer"));
const prisma_1 = __importDefault(require("./prisma"));
async function getSmtpConfig(workspaceId) {
    const conn = await prisma_1.default.socialConnection.findFirst({
        where: { platform: 'email', workspaceId }
    });
    if (conn?.status === 'CONNECTED' && conn.accessToken) {
        try {
            const c = JSON.parse(conn.accessToken);
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
        }
        catch {
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
async function createSmtpTransporter(workspaceId) {
    const config = await getSmtpConfig(workspaceId);
    if (!config)
        return null;
    return nodemailer_1.default.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: { user: config.email, pass: config.password },
    });
}
