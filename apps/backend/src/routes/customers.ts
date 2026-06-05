import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { createSmtpTransporter, getSmtpConfig } from '../lib/smtp';
import { renderCareEmail } from '../lib/careEmail';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const STATUSES = ['NEW', 'ACTIVE', 'NEED_FOLLOWUP', 'VIP', 'INACTIVE'] as const;

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const status = (req.query.status as string) || undefined;
  const q = ((req.query.q as string) || '').trim();

  const customers = await prisma.customer.findMany({
    where: {
      workspaceId: req.workspaceId,
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { company: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      notes: { orderBy: { createdAt: 'desc' }, take: 1 },
      _count: { select: { emailLogs: true, notes: true } },
    },
  });
  res.json(customers);
});

router.get('/meta/statuses', (_req: AuthRequest, res: Response): void => {
  res.json(STATUSES);
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const customer = await prisma.customer.findFirst({
    where: { id, workspaceId: req.workspaceId },
    include: {
      notes: { orderBy: { createdAt: 'desc' } },
      emailLogs: { orderBy: { sentAt: 'desc' }, take: 50 },
    },
  });
  if (!customer) {
    res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    return;
  }
  res.json(customer);
});

router.post('/', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, email, phone, company, status, note } = req.body;
  if (!name?.trim() || !email?.trim()) {
    res.status(400).json({ error: 'Tên và email là bắt buộc' });
    return;
  }

  try {
    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        company: company?.trim() || null,
        status: status && (STATUSES as readonly string[]).includes(status) ? status : 'NEW',
        workspaceId: req.workspaceId,
        notes: note?.trim()
          ? { create: [{ content: note.trim() }] }
          : undefined,
      },
      include: { notes: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
    res.status(201).json(customer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi tạo khách';
    if (msg.includes('Unique constraint')) {
      res.status(400).json({ error: 'Email này đã tồn tại trong hệ thống' });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

router.patch('/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { name, email, phone, company, status } = req.body;
  const data: Record<string, unknown> = {};
  if (name != null) data.name = String(name).trim();
  if (email != null) data.email = String(email).trim().toLowerCase();
  if (phone !== undefined) data.phone = phone?.trim() || null;
  if (company !== undefined) data.company = company?.trim() || null;
  if (status != null && (STATUSES as readonly string[]).includes(status)) data.status = status;

  try {
    const existing = await prisma.customer.findFirst({
      where: { id, workspaceId: req.workspaceId }
    });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy khách hàng' });
      return;
    }
    const customer = await prisma.customer.update({ where: { id }, data });
    res.json(customer);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Cập nhật thất bại' });
  }
});

router.delete('/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const existing = await prisma.customer.findFirst({
    where: { id, workspaceId: req.workspaceId }
  });
  if (!existing) {
    res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    return;
  }
  await prisma.customer.delete({ where: { id } });
  res.status(204).send();
});

router.post('/:id/notes', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { content } = req.body;
  if (!content?.trim()) {
    res.status(400).json({ error: 'Nội dung ghi chú không được trống' });
    return;
  }
  const existing = await prisma.customer.findFirst({
    where: { id, workspaceId: req.workspaceId }
  });
  if (!existing) {
    res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    return;
  }
  const note = await prisma.customerNote.create({
    data: { customerId: id, content: content.trim() },
  });
  await prisma.customer.update({ where: { id }, data: { updatedAt: new Date() } });
  res.status(201).json(note);
});

router.post('/send-care', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { customerIds, subject, htmlContent, channel = 'email' } = req.body as {
    customerIds: number[];
    subject: string;
    htmlContent: string;
    channel?: string;
  };

  if (!Array.isArray(customerIds) || customerIds.length === 0) {
    res.status(400).json({ error: 'Chọn ít nhất một khách hàng' });
    return;
  }
  if (!subject?.trim() || !htmlContent?.trim()) {
    res.status(400).json({ error: 'Tiêu đề và nội dung chăm sóc là bắt buộc' });
    return;
  }

  // If sending via Email, check SMTP config
  let transporter: any = null;
  let fromAddress = '';
  if (channel === 'email') {
    transporter = await createSmtpTransporter(req.workspaceId);
    if (!transporter) {
      res.status(400).json({
        error: 'Chưa cấu hình SMTP. Vào Cài đặt → Email để kết nối trước khi gửi.',
      });
      return;
    }
    const smtpCfg = await getSmtpConfig(req.workspaceId);
    fromAddress = process.env.SMTP_FROM || smtpCfg?.email || '';
  }

  const customers = await prisma.customer.findMany({
    where: {
      id: { in: customerIds.map((x) => parseInt(String(x))) },
      workspaceId: req.workspaceId,
    },
    include: { notes: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  let sent = 0;
  const errors: string[] = [];

  for (const customer of customers) {
    const latestNote = customer.notes[0]?.content;
    const html = renderCareEmail(htmlContent, customer, latestNote);
    const renderedSubject = renderCareEmail(subject, customer, latestNote).replace(/<[^>]+>/g, '');

    try {
      if (channel === 'email') {
        await transporter.sendMail({
          from: fromAddress,
          to: customer.email,
          subject: renderedSubject,
          html,
        });
      } else if (channel === 'zalo') {
        if (!customer.phone) {
          throw new Error('Khách hàng chưa đăng ký số điện thoại để nhận Zalo.');
        }
        // Mock Zalo sending
        console.log(`[Zalo OA Mock] Gửi tin nhắn đến ${customer.phone}: ${renderedSubject} - ${html.slice(0, 100)}...`);
      } else if (channel === 'messenger') {
        // Mock Messenger sending
        console.log(`[Messenger Mock] Gửi tin nhắn đến khách hàng ${customer.name}: ${renderedSubject} - ${html.slice(0, 100)}...`);
      } else {
        throw new Error(`Kênh gửi "${channel}" chưa được hỗ trợ.`);
      }

      await prisma.customerEmailLog.create({
        data: {
          customerId: customer.id,
          subject: renderedSubject,
          body: html,
          status: 'SENT',
          channel,
        },
      });
      await prisma.customer.update({
        where: { id: customer.id },
        data: { lastContactAt: new Date(), status: customer.status === 'NEW' ? 'ACTIVE' : customer.status },
      });
      sent++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gửi thất bại';
      await prisma.customerEmailLog.create({
        data: {
          customerId: customer.id,
          subject: renderedSubject,
          body: html,
          status: 'FAILED',
          errorMessage: msg,
          channel,
        },
      });
      errors.push(`${customer.email || customer.name}: ${msg}`);
    }
  }

  const channelLabel = channel === 'email' ? 'email' : channel === 'zalo' ? 'tin nhắn Zalo' : 'tin nhắn Messenger';
  res.json({
    message: `Đã gửi ${sent}/${customers.length} ${channelLabel} chăm sóc`,
    sent,
    total: customers.length,
    errors: errors.length ? errors : undefined,
  });
});

export default router;
