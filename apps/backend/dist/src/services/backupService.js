"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDatabaseBackup = runDatabaseBackup;
const prisma_1 = __importDefault(require("../lib/prisma"));
const smtp_1 = require("../lib/smtp");
const adm_zip_1 = __importDefault(require("adm-zip"));
async function runDatabaseBackup() {
    try {
        // 1. Get SMTP configuration
        const config = await (0, smtp_1.getSmtpConfig)();
        const transporter = await (0, smtp_1.createSmtpTransporter)();
        if (!config || !transporter) {
            throw new Error('Chưa cấu hình SMTP hệ thống (SMTP_USER/SMTP_PASS)');
        }
        // 2. Query all ADMIN users
        const admins = await prisma_1.default.user.findMany({
            where: { role: 'ADMIN', isActive: true },
            select: { email: true }
        });
        if (admins.length === 0) {
            throw new Error('Không tìm thấy tài khoản ADMIN nào đang hoạt động');
        }
        const adminEmails = admins.map(a => a.email);
        // 3. Query all tables dynamically
        const tables = await prisma_1.default.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
        const zip = new adm_zip_1.default();
        for (const { table_name } of tables) {
            // Skip prisma migrations if we want, but backing it up is fine
            try {
                const rows = await prisma_1.default.$queryRawUnsafe(`SELECT * FROM "${table_name}"`);
                const serialized = JSON.stringify(rows, (key, value) => (typeof value === 'bigint' ? value.toString() : value), 2);
                zip.addFile(`${table_name}.json`, Buffer.from(serialized, 'utf-8'));
            }
            catch (tableErr) {
                console.error(`Failed to dump table ${table_name}:`, tableErr);
                zip.addFile(`${table_name}_error.txt`, Buffer.from(`Lỗi sao lưu bảng: ${tableErr.message || tableErr}`, 'utf-8'));
            }
        }
        const zipBuffer = zip.toBuffer();
        const dateStr = new Date().toISOString().slice(0, 10);
        const filename = `backup_db_${dateStr}.zip`;
        // 4. Send email
        await transporter.sendMail({
            from: config.email,
            to: adminEmails.join(', '),
            subject: `[GROWTH OS] Database Backup - ${dateStr}`,
            text: `Hệ thống gửi file sao lưu định kỳ của cơ sở dữ liệu hệ thống ngày ${dateStr}.\n\nVui lòng xem file đính kèm.`,
            attachments: [
                {
                    filename,
                    content: zipBuffer
                }
            ]
        });
        return {
            success: true,
            message: `Đã sao lưu thành công và gửi email tới: ${adminEmails.join(', ')}`
        };
    }
    catch (error) {
        console.error('[runDatabaseBackup Error]:', error);
        return {
            success: false,
            message: error.message || String(error)
        };
    }
}
