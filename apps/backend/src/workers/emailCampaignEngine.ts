import { dispatchDueEmailCampaigns } from '../services/emailCampaignSend';

const TICK_MS = 60_000;

export function startEmailCampaignEngine() {
  setInterval(() => {
    void dispatchDueEmailCampaigns(10).catch((err) => {
      console.error('[EmailCampaignEngine]', err);
    });
  }, TICK_MS);

  console.log('✅ Email campaign scheduler — quét SCHEDULED mỗi 60 giây');
}
