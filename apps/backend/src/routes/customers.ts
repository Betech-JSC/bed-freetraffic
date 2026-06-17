import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { createSmtpTransporter, getSmtpConfig } from '../lib/smtp';
import { renderCareEmail } from '../lib/careEmail';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';
import { logActivity } from '../lib/auditLogger';
import { invalidateWorkspaceCache } from '../lib/cache';

const router = Router();
router.use(authenticate);

const STATUSES = ['NEW', 'ACTIVE', 'NEED_FOLLOWUP', 'VIP', 'INACTIVE'] as const;

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const status = (req.query.status as string) || undefined;
  const q = ((req.query.q as string) || '').trim();
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const skip = (page - 1) * limit;

  const where = {
    workspaceId: req.workspaceId,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
            { company: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  try {
    const [total, vipCount, followupCount, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.count({ where: { workspaceId: req.workspaceId, status: 'VIP' } }),
      prisma.customer.count({ where: { workspaceId: req.workspaceId, status: 'NEED_FOLLOWUP' } }),
      prisma.customer.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          notes: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { emailLogs: true, notes: true } },
        },
      }),
    ]);

    res.json({
      data: customers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        vipCount,
        followupCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy danh sách khách hàng' });
  }
});

router.get('/export/csv', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const customers = await prisma.customer.findMany({
      where: { workspaceId: req.workspaceId },
      orderBy: { createdAt: 'desc' }
    });

    let csv = 'ID,Họ tên,Email,Số điện thoại,Công ty,Trạng thái,Nguồn traffic,Chiến dịch UTM,Thời gian tạo\n';
    for (const c of customers) {
      const formattedDate = c.createdAt.toISOString();
      csv += `"${c.id}","${(c.name || '').replace(/"/g, '""')}","${(c.email || '').replace(/"/g, '""')}","${(c.phone || '').replace(/"/g, '""')}","${(c.company || '').replace(/"/g, '""')}","${c.status}","${(c.trafficSource || '').replace(/"/g, '""')}","${(c.utmCampaign || '').replace(/"/g, '""')}","${formattedDate}"\n`;
    }

    // Ghi audit log
    await logActivity({
      userId: req.user!.userId,
      workspaceId: req.workspaceId!,
      action: 'EXPORT_CRM',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { count: customers.length }
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
    res.send('\uFEFF' + csv);
  } catch (error: any) {
    console.error('[GET /customers/export/csv]', error);
    res.status(500).json({ error: error.message || 'Lỗi xuất file' });
  }
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
  const { name, email, phone, zaloUserId, company, status, note } = req.body;
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
        zaloUserId: zaloUserId?.trim() || null,
        company: company?.trim() || null,
        status: status && (STATUSES as readonly string[]).includes(status) ? status : 'NEW',
        workspaceId: req.workspaceId,
        notes: note?.trim()
          ? { create: [{ content: note.trim() }] }
          : undefined,
      },
      include: { notes: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });

    // Kích hoạt gửi email chào mừng cho khách hàng mới
    const { triggerEmailEvent } = await import('../services/emailEventTrigger');
    void triggerEmailEvent('WELCOME', {
      customerId: customer.id,
      workspaceId: req.workspaceId
    }).catch(e => console.error('Error triggering customer welcome email:', e));
    // Ghi audit log
    await logActivity({
      userId: req.user!.userId,
      workspaceId: req.workspaceId!,
      action: 'CREATE_CUSTOMER',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { customerId: customer.id, customerName: customer.name, email: customer.email }
    });

    if (req.workspaceId) {
      void invalidateWorkspaceCache(req.workspaceId, ['dashboard', 'report']).catch(err => {
        console.error('[Cache Invalidation Error]:', err);
      });
    }

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
  const { name, email, phone, zaloUserId, company, status } = req.body;
  const data: Record<string, unknown> = {};
  if (name != null) data.name = String(name).trim();
  if (email != null) data.email = String(email).trim().toLowerCase();
  if (phone !== undefined) data.phone = phone?.trim() || null;
  if (zaloUserId !== undefined) data.zaloUserId = zaloUserId?.trim() || null;
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

    // Ghi audit log
    await logActivity({
      userId: req.user!.userId,
      workspaceId: req.workspaceId!,
      action: 'UPDATE_CUSTOMER',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { customerId: id, email: customer.email, updatedFields: Object.keys(data) }
    });

    if (req.workspaceId) {
      void invalidateWorkspaceCache(req.workspaceId, ['dashboard', 'report']).catch(err => {
        console.error('[Cache Invalidation Error]:', err);
      });
    }

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

  // Ghi audit log
  await logActivity({
    userId: req.user!.userId,
    workspaceId: req.workspaceId!,
    action: 'DELETE_CUSTOMER',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { customerId: id, email: existing.email, customerName: existing.name }
  });

  if (req.workspaceId) {
    void invalidateWorkspaceCache(req.workspaceId, ['dashboard', 'report']).catch(err => {
      console.error('[Cache Invalidation Error]:', err);
    });
  }

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

  let zaloConn: any = null;
  if (channel === 'zalo') {
    zaloConn = await prisma.socialConnection.findFirst({
      where: { platform: 'zalo', workspaceId: req.workspaceId }
    });
    if (!zaloConn || zaloConn.status !== 'CONNECTED' || !zaloConn.accessToken) {
      res.status(400).json({
        error: 'Chưa kết nối Zalo OA. Vui lòng kết nối Zalo OA trong Cài đặt trước.',
      });
      return;
    }
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

        const plainText = html.replace(/<[^>]+>/g, '');

        if (customer.zaloUserId) {
          const zaloRes = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
            method: 'POST',
            headers: {
              'access_token': zaloConn.accessToken,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              recipient: {
                user_id: customer.zaloUserId
              },
              message: {
                text: `${renderedSubject}\n\n${plainText}`
              }
            })
          });
          const zaloData = await zaloRes.json() as { error?: number; message?: string };
          if (zaloData.error !== 0 && zaloData.error !== undefined) {
            throw new Error(zaloData.message || `Zalo OA API Error code ${zaloData.error}`);
          }
        } else if (customer.phone) {
          let phoneFormatted = customer.phone.replace(/[^0-9]/g, '');
          if (phoneFormatted.startsWith('0')) {
            phoneFormatted = '84' + phoneFormatted.substring(1);
          }

          const znsTemplateId = process.env.ZALO_ZNS_TEMPLATE_ID || 'default';
          const znsRes = await fetch('https://business.openapi.zalo.me/message/template', {
            method: 'POST',
            headers: {
              'access_token': zaloConn.accessToken,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              phone: phoneFormatted,
              template_id: znsTemplateId,
              template_data: {
                name: customer.name,
                subject: renderedSubject,
                content: plainText.substring(0, 100)
              }
            })
          });
          const znsData = await znsRes.json() as { error?: number; message?: string };
          if (znsData.error !== 0 && znsData.error !== undefined) {
            throw new Error(`Zalo API error: ${znsData.message || 'Không gửi được tin nhắn'}. Bạn cần liên kết Zalo User ID hoặc đăng ký ZNS Template.`);
          }
        } else {
          throw new Error('Khách hàng này không có Zalo User ID hoặc Số điện thoại để gửi Zalo.');
        }
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

// Import danh sách khách hàng hàng loạt (CSV/JSON)
router.post('/import', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { customers } = req.body;
  if (!Array.isArray(customers) || customers.length === 0) {
    res.status(400).json({ error: 'Danh sách khách hàng không hợp lệ hoặc rỗng.' });
    return;
  }

  let createdCount = 0;
  let updatedCount = 0;
  const errors: string[] = [];

  try {
    // 1. Lọc các bản ghi hợp lệ
    const validCustomers = [];
    for (const c of customers) {
      const name = c.name?.trim();
      const email = c.email?.trim()?.toLowerCase();
      if (!name || !email) {
        errors.push(`Bỏ qua dòng không hợp lệ: thiếu Tên hoặc Email`);
        continue;
      }
      validCustomers.push({
        name,
        email,
        phone: c.phone?.trim() || null,
        company: c.company?.trim() || null,
        status: c.status || 'NEW',
      });
    }

    if (validCustomers.length === 0) {
      res.status(400).json({
        error: 'Không tìm thấy khách hàng hợp lệ để nhập.',
        errors: errors.length > 0 ? errors : undefined,
      });
      return;
    }

    // 2. Lấy toàn bộ khách hàng hiện tại khớp với danh sách email cần nhập trong workspace
    const emailsToImport = validCustomers.map((c) => c.email);
    const existingCustomers = await prisma.customer.findMany({
      where: {
        workspaceId: req.workspaceId,
        email: { in: emailsToImport },
      },
      select: { id: true, email: true, phone: true, company: true },
    });

    const existingMap = new Map(existingCustomers.map((c) => [c.email, c]));

    // 3. Phân nhóm tạo mới và cập nhật
    const toCreate: any[] = [];
    const toUpdate: { id: number; data: any }[] = [];

    for (const c of validCustomers) {
      const existing = existingMap.get(c.email);
      if (existing) {
        toUpdate.push({
          id: existing.id,
          data: {
            name: c.name,
            phone: c.phone || existing.phone,
            company: c.company || existing.company,
            status: c.status,
          },
        });
      } else {
        toCreate.push({
          name: c.name,
          email: c.email,
          phone: c.phone,
          company: c.company,
          status: c.status,
          workspaceId: req.workspaceId,
        });
      }
    }

    // 4. Thực thi ghi dữ liệu theo lô (Batch size = 50) trong transaction
    const BATCH_SIZE = 50;

    // Xử lý tạo mới
    for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
      const batch = toCreate.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(
        batch.map((data) => prisma.customer.create({ data }))
      );
      createdCount += batch.length;
    }

    // Xử lý cập nhật
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const batch = toUpdate.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(
        batch.map((item) =>
          prisma.customer.update({
            where: { id: item.id },
            data: item.data,
          })
        )
      );
      updatedCount += batch.length;
    }

    // Ghi audit log
    await logActivity({
      userId: req.user!.userId,
      workspaceId: req.workspaceId!,
      action: 'IMPORT_CUSTOMERS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { createdCount, updatedCount, totalImported: createdCount + updatedCount }
    });

    if (req.workspaceId) {
      void invalidateWorkspaceCache(req.workspaceId, ['dashboard', 'report']).catch(err => {
        console.error('[Cache Invalidation Error]:', err);
      });
    }

    res.json({
      message: `Nhập thành công: tạo mới ${createdCount}, cập nhật ${updatedCount} khách hàng.`,
      createdCount,
      updatedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    res.status(500).json({
      error: err.message || 'Lỗi hệ thống khi nhập khách hàng.',
      errors: errors.length > 0 ? errors : undefined,
    });
  }
});

export default router;
