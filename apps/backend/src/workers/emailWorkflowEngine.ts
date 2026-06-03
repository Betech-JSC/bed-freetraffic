import prisma from '../lib/prisma';
import { createSmtpTransporter, getSmtpConfig } from '../lib/smtp';

const TICK_MS = 60_000; // Run every 60 seconds

export async function dispatchDueWorkflowEmails(limit = 50): Promise<void> {
  const jobs = await prisma.emailWorkflowQueue.findMany({
    where: {
      scheduledAt: { lte: new Date() },
      status: 'PENDING',
    },
    include: {
      customer: true,
      step: true,
    },
    take: limit,
  });

  if (jobs.length === 0) return;

  console.log(`[EmailWorkflowEngine] Processing ${jobs.length} pending email workflow jobs...`);

  for (const job of jobs) {
    try {
      const { customer, step, workspaceId } = job;
      if (!customer || !step) {
        await prisma.emailWorkflowQueue.update({
          where: { id: job.id },
          data: { status: 'FAILED', errorMessage: 'Thiếu thông tin khách hàng hoặc bước gửi email.' },
        });
        continue;
      }

      // Check if customer status is INACTIVE or unsubscribed (status = INACTIVE)
      if (customer.status === 'INACTIVE') {
        await prisma.emailWorkflowQueue.update({
          where: { id: job.id },
          data: { status: 'CANCELLED', errorMessage: 'Khách hàng ở trạng thái không hoạt động/hủy đăng ký.' },
        });
        continue;
      }

      // Get SMTP Config
      const smtpConfig = await getSmtpConfig(workspaceId || undefined);
      const transporter = await createSmtpTransporter(workspaceId || undefined);

      if (!transporter || !smtpConfig) {
        await prisma.emailWorkflowQueue.update({
          where: { id: job.id },
          data: { status: 'FAILED', errorMessage: 'Chưa cấu hình SMTP cho Workspace này.' },
        });
        continue;
      }

      // Replace template variables
      let subject = step.emailSubject || 'Thông tin chăm sóc khách hàng';
      let body = step.emailBody || '';

      const variables = {
        name: customer.name || 'Quý khách',
        email: customer.email,
        phone: customer.phone || '',
        company: customer.company || '',
      };

      for (const [key, val] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(regex, val);
        body = body.replace(regex, val);
      }

      // Send the mail
      await transporter.sendMail({
        from: `"${smtpConfig.email.split('@')[0]}" <${smtpConfig.email}>`,
        to: customer.email,
        subject,
        html: body,
      });

      // Update current job status
      await prisma.emailWorkflowQueue.update({
        where: { id: job.id },
        data: { status: 'SENT' },
      });

      // Write log to Customer CRM history
      await prisma.customerEmailLog.create({
        data: {
          customerId: customer.id,
          subject,
          body,
          status: 'SENT',
          sentAt: new Date(),
        },
      });

      // Enqueue next step
      const nextStep = await prisma.emailWorkflowStep.findFirst({
        where: {
          workflowId: job.workflowId,
          stepOrder: step.stepOrder + 1,
        },
      });

      if (nextStep) {
        const delay = nextStep.delaySeconds || 0;
        await prisma.emailWorkflowQueue.create({
          data: {
            workflowId: job.workflowId,
            stepId: nextStep.id,
            customerId: customer.id,
            scheduledAt: new Date(Date.now() + delay * 1000),
            status: 'PENDING',
            workspaceId: job.workspaceId,
          },
        });
      }
    } catch (error: any) {
      console.error(`[EmailWorkflowEngine] Job ${job.id} failed:`, error);
      await prisma.emailWorkflowQueue.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message || 'Lỗi không xác định khi gửi mail.',
        },
      });
    }
  }
}

export function startEmailWorkflowEngine(): void {
  setInterval(() => {
    void dispatchDueWorkflowEmails().catch((err) => {
      console.error('[EmailWorkflowEngine]', err);
    });
  }, TICK_MS);

  console.log('✅ Email Workflow Engine — quét hàng đợi Drip mỗi 60 giây');
}
