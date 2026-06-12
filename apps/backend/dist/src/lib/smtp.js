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
    if (workspaceId) {
        const conn = await prisma_1.default.socialConnection.findFirst({
            where: { platform: 'email', workspaceId }
        });
        if (conn?.status === 'CONNECTED' && conn.accessToken) {
            try {
                const c = JSON.parse(conn.accessToken);
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
            }
            catch {
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
async function createSmtpTransporter(workspaceId) {
    const config = await getSmtpConfig(workspaceId);
    if (!config)
        return null;
    // Nếu là Google OAuth và có workspaceId, thiết lập OAuth2 cho transporter
    if (config.oauthConnected && workspaceId) {
        const googleInt = await prisma_1.default.googleIntegration.findFirst({
            where: { workspaceId }
        });
        if (googleInt && googleInt.refreshToken) {
            const clientId = process.env.GOOGLE_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
            if (clientId && clientSecret) {
                return nodemailer_1.default.createTransport({
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
                });
            }
            else {
                console.error("[SMTP OAuth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET for OAuth SMTP.");
            }
        }
    }
    // Trường hợp SMTP thường dùng mật khẩu (hoặc App Password)
    return nodemailer_1.default.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: { user: config.email, pass: config.password },
    });
}
