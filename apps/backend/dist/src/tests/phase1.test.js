"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../lib/prisma"));
const wordpress_1 = require("../lib/dispatch/wordpress");
const backupService_1 = require("../services/backupService");
const nodemailer_1 = __importDefault(require("nodemailer"));
// Mock Prisma client
jest.mock('../lib/prisma', () => ({
    __esModule: true,
    default: {
        socialConnection: {
            findFirst: jest.fn(),
        },
        user: {
            findMany: jest.fn(),
        },
        $queryRawUnsafe: jest.fn(),
    },
}));
// Mock Nodemailer
jest.mock('nodemailer', () => ({
    createTransport: jest.fn().mockReturnValue({
        sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-id' }),
    }),
}));
describe('Phase 1 Integration Tests', () => {
    let mockFetch;
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch = jest.fn();
        global.fetch = mockFetch;
    });
    describe('WordPress Publishing', () => {
        it('should return error if no WordPress connection config exists', async () => {
            prisma_1.default.socialConnection.findFirst.mockResolvedValue(null);
            // Ensure env variables are empty
            const originalEnv = { ...process.env };
            delete process.env.WORDPRESS_SITE_URL;
            delete process.env.WORDPRESS_USERNAME;
            delete process.env.WORDPRESS_APP_PASSWORD;
            const result = await (0, wordpress_1.dispatchWordPress)({
                title: 'Test Title',
                content: 'Test Content',
                workspaceId: 1,
            });
            expect(result.success).toBe(false);
            expect(result.message).toContain('Chưa cấu hình tài khoản WordPress');
            process.env = originalEnv;
        });
        it('should successfully publish a WordPress post', async () => {
            prisma_1.default.socialConnection.findFirst.mockResolvedValue({
                pageId: 'https://mysite.com',
                pageName: 'admin',
                accessToken: 'app-password',
            });
            mockFetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ link: 'https://mysite.com/test-post' }),
            });
            const result = await (0, wordpress_1.dispatchWordPress)({
                title: 'Test Title',
                content: 'Test Content',
                workspaceId: 1,
            });
            expect(result.success).toBe(true);
            expect(result.message).toContain('Đăng WordPress thành công');
            expect(mockFetch).toHaveBeenCalledTimes(1);
            // Verify fetch details
            const [calledUrl, calledInit] = mockFetch.mock.calls[0];
            expect(calledUrl).toBe('https://mysite.com/wp-json/wp/v2/posts');
            expect(calledInit.method).toBe('POST');
            expect(calledInit.headers.Authorization).toBe('Basic YWRtaW46YXBwLXBhc3N3b3Jk');
            const body = JSON.parse(calledInit.body);
            expect(body.title).toBe('Test Title');
            expect(body.content).toBe('<p>Test Content</p>');
        });
    });
    describe('Database Backup & SMTP Notification', () => {
        it('should fail if SMTP configuration is not present', async () => {
            const originalEnv = { ...process.env };
            delete process.env.SMTP_USER;
            delete process.env.SMTP_PASS;
            // Mock DB connection configuration to return null
            prisma_1.default.socialConnection.findFirst.mockResolvedValue(null);
            const result = await (0, backupService_1.runDatabaseBackup)();
            expect(result.success).toBe(false);
            expect(result.message).toContain('Chưa cấu hình SMTP hệ thống');
            process.env = originalEnv;
        });
        it('should fail if no active admin users are found', async () => {
            const originalEnv = { ...process.env };
            process.env.SMTP_USER = 'admin@growthos.com';
            process.env.SMTP_PASS = 'password123';
            prisma_1.default.user.findMany.mockResolvedValue([]);
            const result = await (0, backupService_1.runDatabaseBackup)();
            expect(result.success).toBe(false);
            expect(result.message).toContain('Không tìm thấy tài khoản ADMIN nào đang hoạt động');
            process.env = originalEnv;
        });
        it('should build a zip archive of database tables and send it via SMTP to ADMINs', async () => {
            const originalEnv = { ...process.env };
            process.env.SMTP_USER = 'admin@growthos.com';
            process.env.SMTP_PASS = 'password123';
            // Mock admin users
            prisma_1.default.user.findMany.mockResolvedValue([
                { email: 'admin1@growthos.com' },
                { email: 'admin2@growthos.com' },
            ]);
            // Mock database tables
            prisma_1.default.$queryRawUnsafe
                .mockResolvedValueOnce([
                { table_name: 'User' },
                { table_name: 'Customer' },
            ]) // first call retrieves table names
                .mockResolvedValueOnce([
                { id: 1, name: 'User 1' },
            ]) // second call retrieves User rows
                .mockResolvedValueOnce([
                { id: 1, name: 'Customer 1', trafficSource: 'google', utmCampaign: 'blackfriday' },
            ]); // third call retrieves Customer rows
            const result = await (0, backupService_1.runDatabaseBackup)();
            expect(result.success).toBe(true);
            expect(result.message).toContain('Đã sao lưu thành công');
            // Verify SMTP transport created
            expect(nodemailer_1.default.createTransport).toHaveBeenCalled();
            // Verify email details
            const transporter = nodemailer_1.default.createTransport.mock.results[0].value;
            expect(transporter.sendMail).toHaveBeenCalledTimes(1);
            const mailOpts = transporter.sendMail.mock.calls[0][0];
            expect(mailOpts.from).toBe('admin@growthos.com');
            expect(mailOpts.to).toBe('admin1@growthos.com, admin2@growthos.com');
            expect(mailOpts.subject).toContain('[GROWTH OS] Database Backup -');
            expect(mailOpts.attachments).toHaveLength(1);
            expect(mailOpts.attachments[0].filename).toContain('backup_db_');
            expect(mailOpts.attachments[0].content).toBeInstanceOf(Buffer);
            process.env = originalEnv;
        });
    });
});
