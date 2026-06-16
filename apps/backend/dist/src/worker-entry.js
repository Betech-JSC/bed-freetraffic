"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma_1 = __importDefault(require("./lib/prisma"));
const emailCampaignQueue_1 = require("./queues/emailCampaignQueue");
const emailWorkflowQueue_1 = require("./queues/emailWorkflowQueue");
const cskhFollowupQueue_1 = require("./queues/cskhFollowupQueue");
// Import all other engines
const botEngine_1 = require("./workers/botEngine");
const rssScannerEngine_1 = require("./workers/rssScannerEngine");
const backlinkAuditorEngine_1 = require("./workers/backlinkAuditorEngine");
const syncEngine_1 = require("./workers/syncEngine");
const schedulerEngine_1 = require("./workers/schedulerEngine");
const alertEngine_1 = require("./workers/alertEngine");
const emailCampaignEngine_1 = require("./workers/emailCampaignEngine");
const emailWorkflowEngine_1 = require("./workers/emailWorkflowEngine");
const cskhFollowupWorker_1 = require("./workers/cskhFollowupWorker");
const pagespeedAuditorEngine_1 = require("./workers/pagespeedAuditorEngine");
const tiktokSyncWorker_1 = require("./workers/tiktokSyncWorker");
const backupWorker_1 = require("./workers/backupWorker");
const socialListeningWorker_1 = require("./workers/socialListeningWorker");
async function main() {
    console.log('==================================================================');
    console.log('👷 Standalone Growth OS Worker Process Starting...');
    console.log('==================================================================');
    // Verify DB connection
    try {
        await prisma_1.default.$connect();
        console.log('✅ Connected to Postgres database successfully.');
    }
    catch (err) {
        console.error('❌ Failed to connect to Postgres database:', err);
        process.exit(1);
    }
    // Register the BullMQ repeatable jobs and start other engines
    (0, botEngine_1.startBots)();
    (0, rssScannerEngine_1.startRssScannerEngine)();
    (0, backlinkAuditorEngine_1.startBacklinkAuditorEngine)();
    (0, syncEngine_1.startSyncEngine)();
    (0, schedulerEngine_1.startSchedulerEngine)();
    (0, alertEngine_1.startAlertEngine)();
    (0, emailCampaignEngine_1.startEmailCampaignEngine)();
    (0, emailWorkflowEngine_1.startEmailWorkflowEngine)();
    (0, cskhFollowupWorker_1.startCskhFollowupWorker)();
    (0, pagespeedAuditorEngine_1.startPageSpeedAuditorEngine)();
    (0, tiktokSyncWorker_1.startTikTokSyncWorker)();
    (0, backupWorker_1.startBackupWorker)();
    (0, socialListeningWorker_1.startSocialListeningEngine)();
    // Keep references to workers to prevent garbage collection
    const activeWorkers = {};
    if (emailCampaignQueue_1.emailCampaignWorker)
        activeWorkers.emailCampaignWorker = emailCampaignQueue_1.emailCampaignWorker;
    if (emailWorkflowQueue_1.emailWorkflowWorker)
        activeWorkers.emailWorkflowWorker = emailWorkflowQueue_1.emailWorkflowWorker;
    if (cskhFollowupQueue_1.cskhFollowupWorker)
        activeWorkers.cskhFollowupWorker = cskhFollowupQueue_1.cskhFollowupWorker;
    console.log('🚀 All background tasks & workers started in standalone process.');
    console.log('Press Ctrl+C to terminate...');
}
main().catch((err) => {
    console.error('❌ Fatal error in worker entry point:', err);
    process.exit(1);
});
