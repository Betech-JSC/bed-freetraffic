"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBackupWorker = startBackupWorker;
const node_cron_1 = __importDefault(require("node-cron"));
const backupService_1 = require("../services/backupService");
function startBackupWorker() {
    console.log('🤖 Database Backup Worker Registered (Sunday at 3:00 AM)');
    // Weekly on Sunday at 3:00 AM -> '0 3 * * 0'
    node_cron_1.default.schedule('0 3 * * 0', async () => {
        console.log('[Backup Worker] Starting weekly database backup...');
        try {
            const res = await (0, backupService_1.runDatabaseBackup)();
            console.log(`[Backup Worker] Result: ${res.message}`);
        }
        catch (err) {
            console.error('[Backup Worker Cron Error]:', err);
        }
    });
    // Enable immediate test trigger via env variable
    if (process.env.TRIGGER_BACKUP_ON_START === 'true') {
        console.log('[Backup Worker] Immediate backup triggered via env variable (TRIGGER_BACKUP_ON_START=true)...');
        (0, backupService_1.runDatabaseBackup)()
            .then((res) => {
            console.log('[Backup Worker] Immediate backup result:', res.message);
        })
            .catch((err) => {
            console.error('[Backup Worker] Immediate backup error:', err);
        });
    }
}
