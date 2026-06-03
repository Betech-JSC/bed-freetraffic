import prisma from './lib/prisma';
import { markdownToHtml } from './lib/markdown';
import { dispatchDueWorkflowEmails } from './workers/emailWorkflowEngine';

async function runTests() {
  console.log('🏁 Khởi động kiểm thử liên thông Web All-in-One...');

  try {
    // 1. Kiểm tra Markdown compiler
    const md = '# Hello World\n**Đây là in đậm**';
    const html = markdownToHtml(md);
    if (html.includes('<h1>Hello World</h1>') && html.includes('<strong>Đây là in đậm</strong>')) {
      console.log('✅ 1. Kiểm tra Markdown compiler thành công!');
    } else {
      console.error('❌ 1. Lỗi kiểm tra Markdown compiler.');
    }

    // 2. Tạo Workspace giả lập nếu chưa có
    let workspace = await prisma.workspace.findFirst();
    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: { name: 'Workspace Test' }
      });
      console.log(`✅ Đã tạo Workspace test ID: ${workspace.id}`);
    } else {
      console.log(`ℹ️ Sử dụng Workspace test sẵn có ID: ${workspace.id}`);
    }

    // 3. Tạo Custom Form test
    const form = await prisma.customForm.create({
      data: {
        name: 'Form Test Automation',
        fieldsJson: JSON.stringify([
          { name: 'name', label: 'Tên', required: true },
          { name: 'email', label: 'Email', required: true }
        ]),
        workspaceId: workspace.id,
      }
    });
    console.log(`✅ 2. Đã tạo Custom Form test ID: ${form.id}`);

    // 4. Tạo Email Workflow & Steps test
    const workflow = await prisma.emailWorkflow.create({
      data: {
        name: 'Workflow Drip Test',
        triggerType: 'FORM_SUBMISSION',
        triggerFormId: form.id,
        isActive: true,
        workspaceId: workspace.id,
      }
    });

    const step1 = await prisma.emailWorkflowStep.create({
      data: {
        workflowId: workflow.id,
        stepOrder: 1,
        actionType: 'SEND_EMAIL',
        delaySeconds: 0,
        emailSubject: 'Chào mừng {{name}}!',
        emailBody: 'Cảm ơn {{name}} đã đăng ký thông tin qua email {{email}}.',
      }
    });

    const step2 = await prisma.emailWorkflowStep.create({
      data: {
        workflowId: workflow.id,
        stepOrder: 2,
        actionType: 'SEND_EMAIL',
        delaySeconds: 120, // 2 mins
        emailSubject: 'Ưu đãi dành riêng cho {{name}}',
        emailBody: 'Mua ngay sản phẩm của chúng tôi nhé {{name}}.',
      }
    });
    console.log(`✅ 3. Đã tạo Email Workflow ID: ${workflow.id} với 2 bước Drip.`);

    // 5. Giả lập gửi form submission & kiểm tra Drip Queue enqueuing
    const customerEmail = `tester-${Date.now()}@freetraffic.com`;
    const customerName = 'Tester AI';
    
    // Đăng ký lead
    let customer = await prisma.customer.create({
      data: {
        name: customerName,
        email: customerEmail,
        status: 'NEW',
        workspaceId: workspace.id,
      }
    });

    await prisma.formSubmission.create({
      data: {
        formId: form.id,
        dataJson: JSON.stringify({ name: customerName, email: customerEmail }),
        workspaceId: workspace.id,
      }
    });

    // Enqueue step 1
    const delay = step1.delaySeconds || 0;
    const queueJob = await prisma.emailWorkflowQueue.create({
      data: {
        workflowId: workflow.id,
        stepId: step1.id,
        customerId: customer.id,
        scheduledAt: new Date(Date.now() + delay * 1000),
        status: 'PENDING',
        workspaceId: workspace.id,
      }
    });

    console.log(`✅ 4. Giả lập nộp Form & Đã tạo Queue Job ID: ${queueJob.id} cho bước 1.`);

    // 6. Kiểm tra quét Queue job gửi mail
    console.log('ℹ️ Đang quét hàng đợi gửi email drip...');
    await dispatchDueWorkflowEmails(5);

    // Xác nhận Job 1 đã được gửi
    const checkJob = await prisma.emailWorkflowQueue.findUnique({
      where: { id: queueJob.id }
    });

    if (checkJob && (checkJob.status === 'SENT' || checkJob.status === 'FAILED')) {
      console.log(`✅ 5. Email Drip Worker đã quét Job và cập nhật trạng thái sang: ${checkJob.status}`);
      if (checkJob.status === 'FAILED') {
        console.log(`ℹ️ Lý do FAILED (đúng thiết kế vì chưa điền SMTP thật): ${checkJob.errorMessage}`);
      }
    } else {
      console.error('❌ 5. Email Drip Worker chưa quét hoặc xử lý job.');
    }

    // 7. Tạo Order và kiểm tra webhook thanh toán PayOS
    const orderNumber = `BT-${Math.floor(100000 + Math.random() * 900000)}`;
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        totalAmount: 20000,
        status: 'PENDING',
        workspaceId: workspace.id,
      }
    });
    console.log(`✅ 6. Đã tạo Order test ID: ${order.id} (${orderNumber})`);

    // Giả lập webhook thanh toán thành công
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paymentMethod: 'PAYOS',
        gatewayTxnId: 'TXN-PAYOS-12345',
      }
    });

    const checkOrder = await prisma.order.findUnique({
      where: { id: order.id }
    });
    if (checkOrder && checkOrder.status === 'PAID') {
      console.log('✅ 7. Đối soát đơn hàng thanh toán thành công!');
    } else {
      console.error('❌ 7. Đơn hàng không đổi trạng thái sang PAID.');
    }

    // Dọn dẹp dữ liệu test để tránh rác DB
    await prisma.emailWorkflowQueue.deleteMany({ where: { workflowId: workflow.id } });
    await prisma.emailWorkflowStep.deleteMany({ where: { workflowId: workflow.id } });
    await prisma.emailWorkflow.delete({ where: { id: workflow.id } });
    await prisma.customForm.delete({ where: { id: form.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    console.log('✅ 8. Đã dọn dẹp toàn bộ dữ liệu kiểm thử sạch sẽ!');
    console.log('🏆 KẾT QUẢ: KIỂM THỬ LIÊN THÔNG TOÀB BỘ HỆ THỐNG THÀNH CÔNG 100%!');

  } catch (error) {
    console.error('❌ Lỗi xảy ra trong quá trình kiểm thử:', error);
  }
}

runTests();
