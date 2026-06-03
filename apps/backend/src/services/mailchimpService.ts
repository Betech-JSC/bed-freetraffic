import crypto from 'crypto';
import prisma from '../lib/prisma';

export interface MailchimpList {
  id: string;
  name: string;
  memberCount: number;
}

function getMailchimpAuthHeaders(apiKey: string): HeadersInit {
  const encoded = Buffer.from(`any:${apiKey}`).toString('base64');
  return {
    'Authorization': `Basic ${encoded}`,
    'Content-Type': 'application/json',
  };
}

export async function getMailchimpLists(workspaceId?: number): Promise<MailchimpList[]> {
  const conn = await prisma.socialConnection.findFirst({
    where: { platform: 'mailchimp', workspaceId }
  });
  const apiKey = conn?.accessToken || process.env.MAILCHIMP_API_KEY;
  const server = conn?.pageId || process.env.MAILCHIMP_SERVER_PREFIX;

  if (!apiKey || !server) {
    throw new Error('Mailchimp API key hoặc Server Prefix chưa cấu hình.');
  }

  const url = `https://${server}.api.mailchimp.com/3.0/lists?count=100`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: getMailchimpAuthHeaders(apiKey),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const err = await res.json() as { detail?: string };
      throw new Error(err.detail || `Lỗi API Mailchimp: ${res.status}`);
    }

    const data = await res.json() as {
      lists?: Array<{
        id: string;
        name: string;
        stats?: { member_count?: number };
      }>;
    };

    return (data.lists || []).map((list) => ({
      id: list.id,
      name: list.name,
      memberCount: list.stats?.member_count || 0,
    }));
  } catch (error) {
    console.error('Failed to get Mailchimp lists:', error);
    throw error;
  }
}

export async function syncCustomersToMailchimp(
  listId: string,
  customers: Array<{ email: string; name: string }>,
  workspaceId?: number
): Promise<{ successCount: number; total: number }> {
  const conn = await prisma.socialConnection.findFirst({
    where: { platform: 'mailchimp', workspaceId }
  });
  const apiKey = conn?.accessToken || process.env.MAILCHIMP_API_KEY;
  const server = conn?.pageId || process.env.MAILCHIMP_SERVER_PREFIX;

  if (!apiKey || !server) {
    throw new Error('Mailchimp API key hoặc Server Prefix chưa cấu hình.');
  }

  let successCount = 0;

  // Sync each customer sequentially or in parallel batches
  // Using Promise.all for simple fast sync
  const syncPromises = customers.map(async (customer) => {
    const email = customer.email.toLowerCase().trim();
    const subscriberHash = crypto.createHash('md5').update(email).digest('hex');
    const url = `https://${server}.api.mailchimp.com/3.0/lists/${listId}/members/${subscriberHash}`;

    // Split name into first and last name if possible, or just use FNAME
    const parts = customer.name.trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: getMailchimpAuthHeaders(apiKey),
        body: JSON.stringify({
          email_address: email,
          status_if_new: 'subscribed',
          merge_fields: {
            FNAME: firstName,
            LNAME: lastName,
          },
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        successCount++;
      } else {
        const err = await res.json() as { detail?: string };
        console.warn(`Sync failed for ${email}: ${err.detail || res.status}`);
      }
    } catch (e) {
      console.error(`Sync error for ${email}:`, e);
    }
  });

  await Promise.all(syncPromises);

  return {
    successCount,
    total: customers.length,
  };
}

export async function sendMailchimpCampaign(
  listId: string,
  subject: string,
  htmlContent: string,
  workspaceId?: number
): Promise<{ success: boolean; campaignId: string; message: string }> {
  const conn = await prisma.socialConnection.findFirst({
    where: { platform: 'mailchimp', workspaceId }
  });
  const apiKey = conn?.accessToken || process.env.MAILCHIMP_API_KEY;
  const server = conn?.pageId || process.env.MAILCHIMP_SERVER_PREFIX;

  if (!apiKey || !server) {
    throw new Error('Mailchimp API key hoặc Server Prefix chưa cấu hình.');
  }

  // 1. Create campaign
  const campaignUrl = `https://${server}.api.mailchimp.com/3.0/campaigns`;
  const campaignRes = await fetch(campaignUrl, {
    method: 'POST',
    headers: getMailchimpAuthHeaders(apiKey),
    body: JSON.stringify({
      type: 'regular',
      recipients: {
        list_id: listId,
      },
      settings: {
        subject_line: subject,
        title: `Be Traffic - ${subject.slice(0, 30)} - ${new Date().toLocaleDateString('vi-VN')}`,
        from_name: 'Be Traffic Marketing',
        reply_to: 'noreply@betraffic.com',
      },
    }),
  });

  if (!campaignRes.ok) {
    const err = await campaignRes.json() as { detail?: string };
    throw new Error(`Tạo campaign thất bại: ${err.detail || campaignRes.status}`);
  }

  const campaign = await campaignRes.json() as { id: string };
  const campaignId = campaign.id;

  // 2. Set content
  const contentUrl = `https://${server}.api.mailchimp.com/3.0/campaigns/${campaignId}/content`;
  const contentRes = await fetch(contentUrl, {
    method: 'PUT',
    headers: getMailchimpAuthHeaders(apiKey),
    body: JSON.stringify({
      html: htmlContent,
    }),
  });

  if (!contentRes.ok) {
    const err = await contentRes.json() as { detail?: string };
    throw new Error(`Đẩy nội dung campaign thất bại: ${err.detail || contentRes.status}`);
  }

  // 3. Send campaign
  const sendUrl = `https://${server}.api.mailchimp.com/3.0/campaigns/${campaignId}/actions/send`;
  const sendRes = await fetch(sendUrl, {
    method: 'POST',
    headers: getMailchimpAuthHeaders(apiKey),
  });

  if (!sendRes.ok) {
    const err = await sendRes.json() as { detail?: string };
    throw new Error(`Gửi campaign thất bại: ${err.detail || sendRes.status}`);
  }

  return {
    success: true,
    campaignId,
    message: 'Chiến dịch Mailchimp đã được tạo và gửi thành công.',
  };
}
