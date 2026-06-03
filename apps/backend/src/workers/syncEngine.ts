import { syncAnalyticsData } from '../services/analyticsSync';

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function startSyncEngine() {
  const run = async () => {
    console.log('[SyncEngine] Đồng bộ GA4/GSC...');
    const result = await syncAnalyticsData();
    console.log(`[SyncEngine] ${result.success ? 'OK' : 'Lỗi'}: ${result.message}`);
  };

  setTimeout(run, 30_000);
  setInterval(run, SYNC_INTERVAL_MS);
  console.log('✅ Sync engine started (mỗi 6 giờ)');
}
