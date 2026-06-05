import { Router, Response, Request } from 'express';
import prisma from '../lib/prisma';
import { handleVisitorMessage } from '../services/cskhService';
import { getChatWidgetHtml } from '../services/chatWidgetTemplate';
import PayOS from '@payos/node';
import Stripe from 'stripe';


const router = Router();

// Retrieve all published blog posts of a workspace (public)
router.get('/blog/workspace/:workspaceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaceId = parseInt(req.params.workspaceId as string);
    if (isNaN(workspaceId)) {
      res.status(400).json({ error: 'Workspace ID không hợp lệ' });
      return;
    }
    const posts = await prisma.blogPost.findMany({
      where: { workspaceId, published: true },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        authorName: true,
        tags: true,
        publishedAt: true,
        createdAt: true,
      },
    });
    res.json(posts);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi hệ thống' });
  }
});

// Retrieve details of a published blog post by slug (public)
router.get('/blog/posts/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = req.params.slug as string;
    const post = await prisma.blogPost.findFirst({
      where: { slug, published: true },
    });
    if (!post) {
      res.status(404).json({ error: 'Không tìm thấy bài viết hoặc bài viết chưa xuất bản' });
      return;
    }
    res.json(post);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi hệ thống' });
  }
});

// Retrieve published landing page by slug (public)
router.get('/pages/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = req.params.slug as string;
    const page = await prisma.landingPage.findFirst({
      where: { slug, status: 'PUBLISHED' },
    });
    if (!page) {
      res.status(404).json({ error: 'Không tìm thấy trang đích hoặc trang chưa xuất bản' });
      return;
    }
    res.json(page);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi hệ thống' });
  }
});

// Simple IP-based Rate Limiter (maximum 5 submissions per minute)
const ipSubmissions = new Map<string, number[]>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = ipSubmissions.get(ip) || [];
  const recent = timestamps.filter(t => now - t < 60000);
  if (recent.length >= 5) {
    return false;
  }
  recent.push(now);
  ipSubmissions.set(ip, recent);
  return true;
}

// Public Form Submission Endpoint
router.post('/forms/submit', async (req: Request, res: Response): Promise<void> => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || '';
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: 'Bạn đã gửi yêu cầu quá nhanh. Vui lòng thử lại sau 1 phút.' });
      return;
    }

    const { formId, data } = req.body;
    if (!formId || !data || typeof data !== 'object') {
      res.status(400).json({ error: 'formId và dữ liệu data là bắt buộc.' });
      return;
    }

    // Find the custom form definition
    const form = await prisma.customForm.findUnique({
      where: { id: parseInt(formId) },
    });
    if (!form) {
      res.status(404).json({ error: 'Không tìm thấy biểu mẫu đăng ký này trong hệ thống.' });
      return;
    }

    // Validate fields according to fieldsJson
    let fields: any[] = [];
    try {
      fields = JSON.parse(form.fieldsJson);
    } catch {
      // If parsing fails, proceed without validation
    }

    const validationErrors: string[] = [];
    for (const field of fields) {
      if (field.required && (data[field.name] == null || String(data[field.name]).trim() === '')) {
        validationErrors.push(`Trường "${field.label || field.name}" là bắt buộc.`);
      }
    }

    if (validationErrors.length > 0) {
      res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: validationErrors });
      return;
    }

    // Extract CRM fields
    let email = '';
    let name = '';
    let phone = '';
    let company = '';

    for (const key of Object.keys(data)) {
      const val = String(data[key] || '').trim();
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'email' || lowerKey.includes('mail')) {
        email = val;
      } else if (lowerKey === 'name' || lowerKey.includes('ten') || lowerKey.includes('fullname')) {
        name = val;
      } else if (lowerKey === 'phone' || lowerKey.includes('sdt') || lowerKey.includes('dienthoai')) {
        phone = val;
      } else if (lowerKey === 'company' || lowerKey.includes('congty')) {
        company = val;
      }
    }

    if (!email) {
      res.status(400).json({ error: 'Địa chỉ Email là bắt buộc để lưu thông tin liên hệ.' });
      return;
    }

    // Upsert Customer (CRM)
    let customer = await prisma.customer.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (customer) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          name: name || customer.name,
          phone: phone || customer.phone,
          company: company || customer.company,
          workspaceId: form.workspaceId || customer.workspaceId,
        },
      });
    } else {
      customer = await prisma.customer.create({
        data: {
          name: name || email.split('@')[0],
          email: email.toLowerCase(),
          phone: phone || null,
          company: company || null,
          status: 'NEW',
          workspaceId: form.workspaceId,
        },
      });
    }

    // Save Form Submission Log
    const submission = await prisma.formSubmission.create({
      data: {
        formId: form.id,
        dataJson: JSON.stringify(data),
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || '',
        workspaceId: form.workspaceId || 0,
      },
    });

    // Trigger Drip Email Workflows
    const activeWorkflows = await prisma.emailWorkflow.findMany({
      where: { triggerFormId: form.id, isActive: true },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    for (const workflow of activeWorkflows) {
      const firstStep = workflow.steps[0];
      if (firstStep) {
        const delay = firstStep.delaySeconds || 0;
        await prisma.emailWorkflowQueue.create({
          data: {
            workflowId: workflow.id,
            stepId: firstStep.id,
            customerId: customer.id,
            scheduledAt: new Date(Date.now() + delay * 1000),
            status: 'PENDING',
            workspaceId: form.workspaceId,
          },
        });
      }
    }

    res.json({
      success: true,
      message: 'Đăng ký thành công',
      submissionId: submission.id,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi hệ thống khi gửi biểu mẫu' });
  }
});

// Retrieve published landing page HTML with Pixel scripts injected (Public)
router.get('/pages/:slug/html', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = req.params.slug as string;
    const page = await prisma.landingPage.findFirst({
      where: { slug, status: 'PUBLISHED' },
    });
    if (!page) {
      res.status(404).send('<h1>404 - Không tìm thấy trang</h1>');
      return;
    }

    let html = page.htmlContent;
    let headInject = '';

    // Inject Facebook Pixel
    if (page.fbPixelId) {
      headInject += `
<!-- Facebook Pixel Code -->
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '${page.fbPixelId}');
  fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${page.fbPixelId}&ev=PageView&noscript=1" /></noscript>
<!-- End Facebook Pixel Code -->
`;
    }

    // Inject Google Analytics / Tag Manager
    if (page.googleTagId) {
      headInject += `
<!-- Global site tag (gtag.js) - Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${page.googleTagId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${page.googleTagId}');
</script>
`;
    }

    // Insert before </head> or <body> or prepend
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${headInject}\n</head>`);
    } else if (html.includes('<body>')) {
      html = html.replace('<body>', `<body>\n${headInject}`);
    } else {
      html = headInject + html;
    }

    // Inject Live Chat Widget if enabled
    if (page.workspaceId) {
      const cskhConfig = await prisma.cskhConfig.findUnique({
        where: { workspaceId: page.workspaceId },
      });
      if (cskhConfig?.liveChatEnabled) {
        const widgetHtml = getChatWidgetHtml(page.workspaceId);
        if (html.includes('</body>')) {
          html = html.replace('</body>', `${widgetHtml}\n</body>`);
        } else {
          html = html + '\n' + widgetHtml;
        }
      }
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error: any) {
    res.status(500).send('<h1>Lỗi hệ thống khi tải trang</h1>');
  }
});

// Public chat message processing
router.post('/cskh/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { workspaceId, sessionId, message } = req.body;
    if (!workspaceId || !message) {
      res.status(400).json({ error: 'workspaceId và message là bắt buộc.' });
      return;
    }

    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || '';
    const userAgent = req.headers['user-agent'] || '';

    const result = await handleVisitorMessage(
      parseInt(String(workspaceId), 10),
      sessionId,
      message,
      ip,
      userAgent
    );

    res.json(result);
  } catch (error: any) {
    console.error('Lỗi API Chat công khai:', error);
    res.status(500).json({ error: error.message || 'Lỗi hệ thống khi xử lý chat' });
  }
});

// Public Checkout Endpoint (VietQR / Stripe)
router.post('/checkout', async (req: Request, res: Response): Promise<void> => {
  try {
    const { workspaceId, customerEmail, customerName, customerPhone, productId, paymentMethod, returnUrl, cancelUrl } = req.body;
    if (!workspaceId || !customerEmail || !productId || !paymentMethod) {
      res.status(400).json({ error: 'workspaceId, customerEmail, productId và paymentMethod là bắt buộc.' });
      return;
    }

    // 1. Find product
    const product = await prisma.product.findFirst({
      where: { id: parseInt(String(productId), 10), workspaceId: parseInt(String(workspaceId), 10) },
    });

    if (!product) {
      res.status(404).json({ error: 'Không tìm thấy sản phẩm này trong hệ thống.' });
      return;
    }

    // 2. Find or create customer
    let customer = await prisma.customer.findFirst({
      where: { email: customerEmail.toLowerCase(), workspaceId: parseInt(String(workspaceId), 10) },
    });

    if (customer) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          name: customerName || customer.name,
          phone: customerPhone || customer.phone,
        },
      });
    } else {
      customer = await prisma.customer.create({
        data: {
          name: customerName || customerEmail.split('@')[0],
          email: customerEmail.toLowerCase(),
          phone: customerPhone || null,
          status: 'NEW',
          workspaceId: parseInt(String(workspaceId), 10),
        },
      });
    }

    // 3. Generate unique order number
    let orderNumber = '';
    let isUnique = false;
    while (!isUnique) {
      const rand = Math.floor(100000 + Math.random() * 900000);
      orderNumber = `BT-${rand}`;
      const existingOrder = await prisma.order.findUnique({
        where: { orderNumber },
      });
      if (!existingOrder) {
        isUnique = true;
      }
    }

    // 4. Create Order & OrderItem
    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          totalAmount: product.price,
          status: 'PENDING',
          workspaceId: parseInt(String(workspaceId), 10),
        },
      });

      await tx.orderItem.create({
        data: {
          orderId: createdOrder.id,
          productId: product.id,
          quantity: 1,
          price: product.price,
        },
      });

      return createdOrder;
    });

    // 5. Load Payment Config
    const config = await prisma.paymentConfig.findUnique({
      where: { workspaceId: parseInt(String(workspaceId), 10) },
    });

    if (paymentMethod === 'PAYOS') {
      if (!config || !config.payosClientId || !config.payosApiKey || !config.payosChecksumKey) {
        res.status(400).json({ error: 'Cửa hàng chưa cấu hình cổng thanh toán VietQR (PayOS).' });
        return;
      }

      const orderCode = parseInt(orderNumber.replace(/[^\d]/g, '')) || Math.floor(100000 + Math.random() * 900000);
      const payos = new (PayOS as any)(config.payosClientId, config.payosApiKey, config.payosChecksumKey);

      const paymentData = {
        orderCode,
        amount: Math.round(order.totalAmount),
        description: `Mua ${product.name}`.substring(0, 25),
        items: [
          {
            name: product.name.substring(0, 20),
            quantity: 1,
            price: Math.round(product.price),
          },
        ],
        returnUrl: returnUrl || `http://localhost:3000/checkout/success?orderNumber=${orderNumber}`,
        cancelUrl: cancelUrl || `http://localhost:3000/checkout/cancel?orderNumber=${orderNumber}`,
      };

      const paymentLinkRes = await payos.createPaymentLink(paymentData);

      res.json({
        success: true,
        orderNumber,
        checkoutUrl: paymentLinkRes.checkoutUrl,
        qrCode: paymentLinkRes.qrCode,
      });
    } else if (paymentMethod === 'STRIPE') {
      if (!config || !config.stripeSecretKey) {
        res.status(400).json({ error: 'Cửa hàng chưa cấu hình cổng thanh toán Stripe.' });
        return;
      }

      const stripe = new (Stripe as any)(config.stripeSecretKey);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: product.currency.toLowerCase() || 'vnd',
              product_data: {
                name: product.name,
                description: product.description || undefined,
              },
              unit_amount: Math.round(product.price * (product.currency === 'VND' ? 1 : 100)),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        metadata: {
          orderNumber,
        },
        success_url: returnUrl || `http://localhost:3000/checkout/success?orderNumber=${orderNumber}`,
        cancel_url: cancelUrl || `http://localhost:3000/checkout/cancel?orderNumber=${orderNumber}`,
      });

      res.json({
        success: true,
        orderNumber,
        checkoutUrl: session.url,
      });
    } else {
      res.status(400).json({ error: 'Phương thức thanh toán không hợp lệ.' });
    }
  } catch (error: any) {
    console.error('[Public Checkout Error]:', error);
    res.status(500).json({ error: error.message || 'Lỗi xử lý thanh toán.' });
  }
});

export default router;

