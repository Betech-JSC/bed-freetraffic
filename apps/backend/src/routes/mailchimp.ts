import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';
import {
  getMailchimpLists,
  syncCustomersToMailchimp,
  sendMailchimpCampaign,
} from '../services/mailchimpService';

const router = Router();
router.use(authenticate);

// 1. Get all lists (audiences)
router.get('/lists', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lists = await getMailchimpLists(req.workspaceId ?? 0);
    res.json(lists);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Không thể tải danh sách Mailchimp' });
  }
});

// 2. Sync CRM Customers to Mailchimp
router.post('/sync', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { listId } = req.body;
  if (!listId) {
    res.status(400).json({ error: 'listId là bắt buộc' });
    return;
  }

  try {
    const customers = await prisma.customer.findMany({
      where: { workspaceId: req.workspaceId },
      select: { name: true, email: true },
    });

    if (customers.length === 0) {
      res.status(400).json({ error: 'Không có khách hàng nào trong CRM để đồng bộ.' });
      return;
    }

    const result = await syncCustomersToMailchimp(listId, customers, req.workspaceId ?? 0);
    res.json({
      message: `Đã hoàn tất đồng bộ: Thành công ${result.successCount} / ${result.total} khách hàng.`,
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Đồng bộ Mailchimp thất bại.' });
  }
});

// 3. Send Campaign to Mailchimp list
router.post('/campaign', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { listId, subject, htmlContent } = req.body;

  if (!listId || !subject || !htmlContent) {
    res.status(400).json({ error: 'Các trường listId, subject, htmlContent là bắt buộc' });
    return;
  }

  try {
    const result = await sendMailchimpCampaign(listId, subject, htmlContent, req.workspaceId ?? 0);

    // Save to local EmailCampaign log for reporting
    await prisma.emailCampaign.create({
      data: {
        name: `Mailchimp: ${subject}`,
        subject,
        htmlContent,
        recipients: `Mailchimp List ID: ${listId}`,
        status: 'SENT',
        sentAt: new Date(),
        sentCount: 0, // Mailchimp handles tracking
        workspaceId: req.workspaceId,
      },
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gửi chiến dịch Mailchimp thất bại.' });
  }
});

export default router;
