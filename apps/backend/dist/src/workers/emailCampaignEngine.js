"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startEmailCampaignEngine = startEmailCampaignEngine;
const emailCampaignSend_1 = require("../services/emailCampaignSend");
const TICK_MS = 60_000;
function startEmailCampaignEngine() {
    setInterval(() => {
        void (0, emailCampaignSend_1.dispatchDueEmailCampaigns)(10).catch((err) => {
            console.error('[EmailCampaignEngine]', err);
        });
    }, TICK_MS);
    console.log('✅ Email campaign scheduler — quét SCHEDULED mỗi 60 giây');
}
