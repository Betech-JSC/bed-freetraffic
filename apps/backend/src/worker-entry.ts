import dotenv from 'dotenv';
dotenv.config();

import prisma from './lib/prisma';
import { emailCampaignWorker } from './queues/emailCampaignQueue';
import { emailWorkflowWorker } from './queues/emailWorkflowQueue';
import { cskhFollowupWorker } from './queues/cskhFollowupQueue';

// Import all other engines
import { startBots } from './workers/botEngine';
import { startRssScannerEngine } from './workers/rssScannerEngine';
import { startBacklinkAuditorEngine } from './workers/backlinkAuditorEngine';
import { startSyncEngine } from './workers/syncEngine';
import { startSchedulerEngine } from './workers/schedulerEngine';
import { startAlertEngine } from './workers/alertEngine';
import { startEmailCampaignEngine } from './workers/emailCampaignEngine';
import { startEmailWorkflowEngine } from './workers/emailWorkflowEngine';
import { startCskhFollowupWorker } from './workers/cskhFollowupWorker';
import { startPageSpeedAuditorEngine } from './workers/pagespeedAuditorEngine';
import { startTikTokSyncWorker } from './workers/tiktokSyncWorker';
import { startBackupWorker } from './workers/backupWorker';
import { startSocialListeningEngine } from './workers/socialListeningWorker';

async function main() {
  console.log('==================================================================');
  console.log('👷 Standalone Growth OS Worker Process Starting...');
  console.log('==================================================================');

  // Verify DB connection
  try {
    await prisma.$connect();
    console.log('✅ Connected to Postgres database successfully.');
  } catch (err) {
    console.error('❌ Failed to connect to Postgres database:', err);
    process.exit(1);
  }

  // Register the BullMQ repeatable jobs and start other engines
  startBots();
  startRssScannerEngine();
  startBacklinkAuditorEngine();
  startSyncEngine();
  startSchedulerEngine();
  startAlertEngine();
  startEmailCampaignEngine();
  startEmailWorkflowEngine();
  startCskhFollowupWorker();
  startPageSpeedAuditorEngine();
  startTikTokSyncWorker();
  startBackupWorker();
  startSocialListeningEngine();

  // Keep references to workers to prevent garbage collection
  const activeWorkers: Record<string, any> = {};
  if (emailCampaignWorker) activeWorkers.emailCampaignWorker = emailCampaignWorker;
  if (emailWorkflowWorker) activeWorkers.emailWorkflowWorker = emailWorkflowWorker;
  if (cskhFollowupWorker) activeWorkers.cskhFollowupWorker = cskhFollowupWorker;

  console.log('🚀 All background tasks & workers started in standalone process.');
  console.log('Press Ctrl+C to terminate...');

}

main().catch((err) => {
  console.error('❌ Fatal error in worker entry point:', err);
  process.exit(1);
});
