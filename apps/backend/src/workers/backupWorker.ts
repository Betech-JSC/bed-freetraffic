import cron from 'node-cron';
import { runDatabaseBackup } from '../services/backupService';

export function startBackupWorker() {
  console.log('🤖 Database Backup Worker Registered (Sunday at 3:00 AM)');

  // Weekly on Sunday at 3:00 AM -> '0 3 * * 0'
  cron.schedule('0 3 * * 0', async () => {
    console.log('[Backup Worker] Starting weekly database backup...');
    try {
      const res = await runDatabaseBackup();
      console.log(`[Backup Worker] Result: ${res.message}`);
    } catch (err) {
      console.error('[Backup Worker Cron Error]:', err);
    }
  });

  // Enable immediate test trigger via env variable
  if (process.env.TRIGGER_BACKUP_ON_START === 'true') {
    console.log('[Backup Worker] Immediate backup triggered via env variable (TRIGGER_BACKUP_ON_START=true)...');
    runDatabaseBackup()
      .then((res) => {
        console.log('[Backup Worker] Immediate backup result:', res.message);
      })
      .catch((err) => {
        console.error('[Backup Worker] Immediate backup error:', err);
      });
  }
}
