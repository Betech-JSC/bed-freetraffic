import { Router, Response, Request } from 'express';
import prisma from '../lib/prisma';
import { handleVisitorMessage } from '../services/cskhService';
// import { getChatWidgetHtml } from '../services/chatWidgetTemplate';
import PayOS from '@payos/node';
import Stripe from 'stripe';
import { invalidateWorkspaceCache } from '../lib/cache';
import { publicSpamLimiter } from '../middleware/rateLimiter';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import FormData from 'form-data';
import { getAiConfig } from '../lib/ai';
import { markdownToHtml } from '../lib/markdown';
import { checkAndApplyReferral } from './referrals';

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `cskh-img-${uniqueSuffix}${ext}`);
  }
});

const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ cho phép tải lên định dạng hình ảnh (JPEG, PNG, GIF, WEBP).') as any, false);
    }
  }
});


const router = Router();

// Redirect Short Link: GET /r/:code
router.get('/r/:code', async (req: Request, res: Response): Promise<void> => {
  const code = String(req.params.code || '');
  if (!code) {
    res.status(400).send('Mã rút gọn không hợp lệ');
    return;
  }
  
  try {
    const link = await prisma.shortLink.findUnique({
      where: { code }
    });
    
    if (!link) {
      res.status(404).send('Không tìm thấy liên kết hoặc liên kết đã bị xóa');
      return;
    }
    
    const rawReferrer = req.headers['referer'] || req.headers['referrer'];
    const referrer = (Array.isArray(rawReferrer) ? rawReferrer[0] : rawReferrer) || null;
    const rawUa = req.headers['user-agent'];
    const userAgent = (Array.isArray(rawUa) ? rawUa[0] : rawUa) || null;
    
    // Parse device
    const deviceType = parseDeviceType(userAgent || undefined);
    
    // Parse IP
    const xForwardedFor = req.headers['x-forwarded-for'];
    const ipAddress = (Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor?.split(',')[0]) || req.ip || null;
    
    // Country mockup
    const country = mockCountry(ipAddress || undefined);
    
    // Log click asynchronously
    prisma.shortLinkClick.create({
      data: {
        shortLinkId: link.id,
        referrer,
        userAgent,
        deviceType,
        ipAddress,
        country,
      }
    }).catch((err: any) => {
      console.error('Failed to log shortlink click:', err);
    });
    
    // Build target UTM URL
    let targetUrl = link.originalUrl;
    const utmParams: string[] = [];
    if (link.utmSource) utmParams.push(`utm_source=${encodeURIComponent(link.utmSource)}`);
    if (link.utmMedium) utmParams.push(`utm_medium=${encodeURIComponent(link.utmMedium)}`);
    if (link.utmCampaign) utmParams.push(`utm_campaign=${encodeURIComponent(link.utmCampaign)}`);
    
    if (utmParams.length > 0) {
      const separator = targetUrl.includes('?') ? '&' : '?';
      targetUrl = targetUrl + separator + utmParams.join('&');
    }
    
    // Perform redirect
    res.redirect(302, targetUrl);
  } catch (error: any) {
    console.error('[GET /public/r/:code]', error);
    res.status(500).send('Lỗi máy chủ khi chuyển hướng liên kết');
  }
});

function parseDeviceType(ua?: string): string {
  if (!ua) return 'desktop';
  const uaLower = ua.toLowerCase();
  if (uaLower.includes('tablet') || uaLower.includes('ipad') || (uaLower.includes('android') && !uaLower.includes('mobile'))) {
    return 'tablet';
  }
  if (uaLower.includes('mobile') || uaLower.includes('iphone') || uaLower.includes('android') || uaLower.includes('phone')) {
    return 'mobile';
  }
  return 'desktop';
}

function mockCountry(ip?: string): string {
  if (!ip) return 'Vietnam';
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return 'Vietnam';
  }
  const countries = ['Vietnam', 'United States', 'Singapore', 'Japan', 'United Kingdom', 'Germany'];
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash += ip.charCodeAt(i);
  }
  return countries[hash % countries.length];
}

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

// Serve published blog post as rendered HTML (Public)
router.get('/blog/posts/:slug/html', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = req.params.slug as string;
    const post = await prisma.blogPost.findFirst({
      where: { slug, published: true },
    });
    if (!post) {
      res.status(404).send('<h1>404 - Không tìm thấy bài viết hoặc bài viết chưa xuất bản</h1>');
      return;
    }

    let workspaceName = 'Trang chủ';
    if (post.workspaceId) {
      const ws = await prisma.workspace.findUnique({ where: { id: post.workspaceId } });
      if (ws) workspaceName = ws.name;
    }

    // Find the landing page slug belonging to the same workspace to construct correct backlinks
    let landingSlug = 'home';
    let brandConfig: any = null;
    let theme = 'ocean-breeze';
    if (post.workspaceId) {
      const lp = await prisma.landingPage.findFirst({
        where: { workspaceId: post.workspaceId },
        select: { slug: true, layoutJson: true }
      });
      if (lp) {
        landingSlug = lp.slug;
        try {
          if (lp.layoutJson) {
            const layout = JSON.parse(lp.layoutJson as string);
            if (layout.theme) theme = layout.theme;
            if (layout.brandConfig) brandConfig = layout.brandConfig;
          }
        } catch (e) {}
      }
    }

    const htmlContent = post.htmlContent || markdownToHtml(post.content || '');

    const bodyHtml = `
      <div class="max-w-4xl mx-auto px-6 py-12">
        <nav class="mb-8">
          <a href="/api/public/pages/${landingSlug}/html" class="text-[#f25c22] font-black text-sm hover:underline">← Quay lại Trang chủ</a>
        </nav>
        <header class="mb-12 border-b border-slate-100 pb-8">
          <h1 class="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight mb-4">${post.title}</h1>
          <div class="flex items-center gap-4 text-xs font-bold text-slate-400">
            <span>Tác giả: <strong class="text-slate-600">${post.authorName || 'Admin'}</strong></span>
            <span>•</span>
            <span>Đăng ngày: ${post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('vi-VN') : new Date(post.createdAt).toLocaleDateString('vi-VN')}</span>
          </div>
          ${post.tags ? `
            <div class="flex gap-2 flex-wrap mt-4">
              ${post.tags.split(',').map(tag => `<span class="bg-[#fff4ef] text-[#f25c22] px-2.5 py-1 rounded-lg text-[10px] font-extrabold border border-[#ffd8c7]">#${tag.trim()}</span>`).join('')}
            </div>
          ` : ''}
        </header>
        <article class="prose prose-slate max-w-none text-slate-700 leading-relaxed text-sm md:text-base space-y-6">
          ${htmlContent}
        </article>
      </div>
    `;

    let finalHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${post.title}</title>
          <meta name="description" content="${post.summary || ''}">
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            h2 { font-size: 1.5rem; font-weight: 850; color: #0f172a; margin-top: 2rem; margin-bottom: 1rem; }
            h3 { font-size: 1.25rem; font-weight: 800; color: #1e293b; margin-top: 1.5rem; margin-bottom: 0.75rem; }
            p { margin-top: 0; margin-bottom: 1.25rem; }
            strong { color: #0f172a; font-weight: 700; }
            ul, ol { margin-top: 0; margin-bottom: 1.25rem; padding-left: 1.25rem; }
            li { margin-bottom: 0.5rem; }
          </style>
        </head>
        <body>
          ${bodyHtml}
        </body>
      </html>
    `;

    try {
      finalHtml = injectNavbarAndFooter(finalHtml, landingSlug, workspaceName, 'blog', theme, brandConfig);
    } catch (e) {
      // Ignore
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(finalHtml);
  } catch (error: any) {
    res.status(500).send('<h1>Lỗi hệ thống khi tải bài viết</h1>');
  }
});

// Retrieve published landing page by slug (public)
router.get('/pages/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = req.params.slug as string;
    const preview = req.query.preview === 'true';
    const page = await prisma.landingPage.findFirst({
      where: preview ? { slug } : { slug, status: 'PUBLISHED' },
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
router.post('/forms/submit', publicSpamLimiter, async (req: Request, res: Response): Promise<void> => {
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

    const trafficSourceVal = req.body.trafficSource || data.trafficSource || data.utm_source || data.utmSource || null;
    const utmCampaignVal = req.body.utmCampaign || data.utmCampaign || data.utm_campaign || data.utmCampaign || null;

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
          trafficSource: trafficSourceVal || customer.trafficSource,
          utmCampaign: utmCampaignVal || customer.utmCampaign,
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
          trafficSource: trafficSourceVal,
          utmCampaign: utmCampaignVal,
        },
      });

      // Kích hoạt gửi email chào mừng cho khách hàng mới từ landing page
      const { triggerEmailEvent } = await import('../services/emailEventTrigger');
      void triggerEmailEvent('WELCOME', {
        customerId: customer.id,
        workspaceId: form.workspaceId
      }).catch(e => console.error('Error triggering welcome email from landing page:', e));
    }

    await checkAndApplyReferral(customer.id, req);

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

    // Check for A/B testing cookies to register a conversion
    const cookieHeader = req.headers.cookie || '';
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith('ab_variant_')) {
        const parts = cookie.split('=');
        if (parts.length === 2) {
          const testIdStr = parts[0].replace('ab_variant_', '');
          const variantVal = parts[1];
          const testId = parseInt(testIdStr, 10);
          if (!isNaN(testId)) {
            prisma.abTest.findUnique({
              where: { id: testId }
            }).then(test => {
              if (test && test.status === 'RUNNING') {
                prisma.abTest.update({
                  where: { id: testId },
                  data: variantVal === 'B' ? { clicksB: { increment: 1 } } : { clicksA: { increment: 1 } }
                }).catch(err => console.error('Error incrementing clicks:', err));
              }
            }).catch(err => console.error('Error finding abTest:', err));
          }
        }
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

/**
 * POST /api/public/lead-magnet/generate
 * Public endpoint to submit lead magnet target URL and email.
 * Generates an AI report PDF, creates/updates the Customer in CRM, and emails the PDF.
 */
router.post('/lead-magnet/generate', async (req: Request, res: Response): Promise<void> => {
  const { targetUrl, email, name, workspaceId } = req.body;

  if (!targetUrl || !targetUrl.trim() || !email || !email.trim()) {
    res.status(400).json({ error: 'targetUrl và email là bắt buộc.' });
    return;
  }

  // Use provided workspaceId or default to the first workspace in the system
  let finalWorkspaceId = parseInt(workspaceId, 10);
  if (isNaN(finalWorkspaceId)) {
    const firstWorkspace = await prisma.workspace.findFirst({ select: { id: true } });
    finalWorkspaceId = firstWorkspace?.id || 1;
  }

  try {
    const { generateAndSendLeadReport } = await import('../services/leadMagnetService');
    
    // Trigger in the background so the HTTP request returns quickly
    // This provides a smooth user experience on the landing page
    setImmediate(async () => {
      try {
        await generateAndSendLeadReport(finalWorkspaceId, targetUrl.trim(), email.trim(), name);
      } catch (err: any) {
        console.error('❌ Failed to run background lead report generator:', err.message);
      }
    });

    res.json({
      success: true,
      message: 'Báo cáo đang được khởi tạo bằng AI và sẽ gửi qua email của bạn trong vài phút!'
    });
  } catch (err: any) {
    console.error('❌ Failed to trigger lead magnet generation:', err);
    res.status(500).json({ error: err.message || 'Lỗi hệ thống khi khởi chạy dịch vụ.' });
  }
});

// Retrieve published landing page HTML with Pixel scripts injected (Public)
router.get('/pages/:slug/html', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = req.params.slug as string;
    const preview = req.query.preview === 'true';
    const page = await prisma.landingPage.findFirst({
      where: preview ? { slug } : { slug, status: 'PUBLISHED' },
    });
    if (!page) {
      res.status(404).send('<h1>404 - Không tìm thấy trang</h1>');
      return;
    }

    let targetPage = page;
    let activeTest = null;
    let variant: 'A' | 'B' = 'A';

    if (!preview) {
      activeTest = await prisma.abTest.findFirst({
        where: {
          landingPageAId: page.id,
          status: 'RUNNING'
        }
      });

      if (activeTest) {
        // Parse cookie manually
        const cookieHeader = req.headers.cookie || '';
        const cookieName = `ab_variant_${activeTest.id}`;
        const matches = cookieHeader.match(new RegExp(
          "(?:^|; )" + cookieName.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
        ));
        let variantCookie = matches ? decodeURIComponent(matches[1]) : '';

        if (variantCookie === 'A' || variantCookie === 'B') {
          variant = variantCookie as 'A' | 'B';
        } else {
          // 50/50 Split
          variant = Math.random() < 0.5 ? 'A' : 'B';
          res.setHeader('Set-Cookie', `${cookieName}=${variant}; Path=/; Max-Age=31536000; SameSite=Lax`);
        }

        // If variant B, load Variant B page details
        if (variant === 'B' && activeTest.landingPageBId) {
          const pageB = await prisma.landingPage.findUnique({
            where: { id: activeTest.landingPageBId }
          });
          if (pageB) {
            targetPage = pageB;
          }
        }

        // Increment impressions in database asynchronously
        if (variant === 'A') {
          prisma.abTest.update({
            where: { id: activeTest.id },
            data: { impressionsA: { increment: 1 } }
          }).catch(err => console.error('Error incrementing impressionsA:', err));
        } else {
          prisma.abTest.update({
            where: { id: activeTest.id },
            data: { impressionsB: { increment: 1 } }
          }).catch(err => console.error('Error incrementing impressionsB:', err));
        }
      } else {
        // AUTO WINNER ROUTING:
        // Check if there is a completed A/B test for this Landing Page A where Variant B won
        const completedTest = await prisma.abTest.findFirst({
          where: {
            landingPageAId: page.id,
            status: 'COMPLETED',
            winner: 'B'
          },
          orderBy: { updatedAt: 'desc' }
        });
        if (completedTest && completedTest.landingPageBId) {
          const pageB = await prisma.landingPage.findUnique({
            where: { id: completedTest.landingPageBId }
          });
          if (pageB) {
            targetPage = pageB;
          }
        }
      }
    }

    let html = targetPage.htmlContent;
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

    // Inject Live Chat Widget if enabled or previewing
    if (page.workspaceId) {
      const cskhConfig = await prisma.cskhConfig.findUnique({
        where: { workspaceId: page.workspaceId },
      });
      if (cskhConfig?.liveChatEnabled || preview) {
        const widgetHtml = `<script src="/api/public/cskh/widget.js" data-workspace-id="${page.workspaceId}"></script>`;
        if (html.includes('</body>')) {
          html = html.replace('</body>', `${widgetHtml}\n</body>`);
        } else {
          html = html + '\n' + widgetHtml;
        }
      }
    }

    // Inject Facebook Messenger Chat Widget if enabled
    if (page.enableMessengerChat && page.workspaceId) {
      const facebookConn = await prisma.socialConnection.findFirst({
        where: { platform: 'facebook', workspaceId: page.workspaceId, status: 'CONNECTED' }
      });
      if (facebookConn && facebookConn.pageId) {
        const fbWidgetHtml = `
<!-- Messenger Plugin Chat SDK -->
<div id="fb-root"></div>
<div id="fb-customer-chat" class="fb-customerchat"></div>
<script>
  var chatbox = document.getElementById('fb-customer-chat');
  chatbox.setAttribute("page_id", "${facebookConn.pageId}");
  chatbox.setAttribute("attribution", "biz_inbox");
</script>
<script>
  window.fbAsyncInit = function() {
    FB.init({
      xfbml            : true,
      version          : 'v21.0'
    });
  };

  (function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = 'https://connect.facebook.net/vi_VN/sdk/xfbml.customerchat.js';
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'facebook-jssdk'));
</script>
`;
        if (html.includes('</body>')) {
          html = html.replace('</body>', `${fbWidgetHtml}\n</body>`);
        } else {
          html = html + '\n' + fbWidgetHtml;
        }
      }
    }

    let theme = 'ocean-breeze';
    let brandConfig: any = null;
    try {
      if (page.layoutJson) {
        const layout = JSON.parse(page.layoutJson);
        if (layout.theme) {
          theme = layout.theme;
        }
        if (layout.brandConfig) {
          brandConfig = layout.brandConfig;
        }
      }
    } catch (e) {
      // Ignore
    }

    let workspaceName = 'Trang chủ';
    if (page.workspaceId) {
      const ws = await prisma.workspace.findUnique({ where: { id: page.workspaceId } });
      if (ws) workspaceName = ws.name;
    }
    html = injectNavbarAndFooter(html, slug, workspaceName, 'home', theme, brandConfig);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error: any) {
    res.status(500).send('<h1>Lỗi hệ thống khi tải trang</h1>');
  }
});

// Public endpoint to upload images for chat widget
router.post('/cskh/upload-image', (req: Request, res: Response): void => {
  uploadImage.single('image')(req, res, (err) => {
    if (err) {
      const isLimitSize = err.code === 'LIMIT_FILE_SIZE';
      res.status(400).json({
        error: isLimitSize
          ? 'Kích thước tệp quá lớn. Vui lòng tải lên tệp dưới giới hạn cho phép.'
          : (err.message || 'Lỗi tải tệp tin.')
      });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Không tìm thấy tệp tin được tải lên.' });
      return;
    }
    const publicUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, imageUrl: publicUrl });
  });
});

const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || '.webm';
    cb(null, `cskh-audio-${uniqueSuffix}${ext}`);
  }
});

const uploadAudio = multer({
  storage: audioStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.flac', '.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.ogg', '.wav', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận các tệp tin âm thanh hợp lệ.') as any, false);
    }
  }
});

// Public endpoint to transcribe audio for voice chat (Whisper fallback)
router.post('/cskh/transcribe', (req: Request, res: Response): void => {
  uploadAudio.single('audio')(req, res, async (err) => {
    if (err) {
      console.error('[STT Fallback] Multer error:', err);
      const isLimitSize = err.code === 'LIMIT_FILE_SIZE';
      res.status(400).json({
        error: isLimitSize
          ? 'Kích thước tệp quá lớn. Vui lòng tải lên tệp dưới giới hạn cho phép.'
          : (err.message || 'Lỗi tải tệp tin âm thanh.')
      });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Không tìm thấy tệp tin âm thanh được tải lên.' });
      return;
    }

    try {
      const ai = getAiConfig('/audio/transcriptions');
      if (!ai.apiKey) {
        res.status(400).json({ error: 'AI provider is not configured for transcription.' });
        return;
      }

      const form = new FormData();
      form.append('file', fs.createReadStream(req.file.path), {
        filename: req.file.filename,
        contentType: req.file.mimetype
      });
      form.append('model', 'whisper-1');
      form.append('language', 'vi');

      const headers = { ...ai.headers };
      delete headers['Content-Type'];
      Object.assign(headers, form.getHeaders());

      const response = await fetch(ai.url, {
        method: 'POST',
        headers,
        body: form as any
      });

      const cleanup = () => {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      };

      if (!response.ok) {
        const errText = await response.text();
        console.error('[STT Fallback] Whisper API response error:', errText);
        cleanup();
        res.status(response.status).json({ error: 'Không thể nhận diện giọng nói từ API.' });
        return;
      }

      const result = await response.json();
      cleanup();
      res.json({ success: true, text: result.text || '' });
    } catch (error: any) {
      console.error('[STT Fallback] Error in transcribe route:', error);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: error.message || 'Lỗi hệ thống khi nhận diện giọng nói.' });
    }
  });
});

// Public chat message processing
router.post('/cskh/chat', publicSpamLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { workspaceId, sessionId, message, imageUrl } = req.body;
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
      userAgent,
      imageUrl
    );

    res.json(result);
  } catch (error: any) {
    console.error('Lỗi API Chat công khai:', error);
    res.status(500).json({ error: error.message || 'Lỗi hệ thống khi xử lý chat' });
  }
});

// Public chat session sync endpoint (polling)
router.get('/cskh/chat/sync', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId là bắt buộc.' });
      return;
    }

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        sender: true,
        content: true,
        createdAt: true,
      },
    });

    res.json({ success: true, messages });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi đồng bộ tin nhắn.' });
  }
});

// Public Checkout Endpoint (VietQR / Stripe)
const handleCheckout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { workspaceId, customerEmail, customerName, customerPhone, productId, paymentMethod, returnUrl, cancelUrl, trafficSource, utmCampaign } = req.body;
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
          trafficSource: trafficSource || customer.trafficSource,
          utmCampaign: utmCampaign || customer.utmCampaign,
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
          trafficSource: trafficSource || null,
          utmCampaign: utmCampaign || null,
        },
      });
    }

    await checkAndApplyReferral(customer.id, req);

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

    // Invalidate cache for dashboard and reports
    void invalidateWorkspaceCache(parseInt(String(workspaceId), 10), ['dashboard', 'report']).catch(err => {
      console.error('[Cache Invalidation Error]:', err);
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
    } else if (paymentMethod === 'SEPAY') {
      if (!config || !config.sepayAccountNumber || !config.sepayBankCode) {
        res.status(400).json({ error: 'Cửa hàng chưa cấu hình số tài khoản hoặc ngân hàng đối soát SePay.vn.' });
        return;
      }

      res.json({
        success: true,
        orderNumber,
        checkoutUrl: `/api/public/checkout/vietqr?orderNumber=${orderNumber}`
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
};

router.post('/checkout', publicSpamLimiter, handleCheckout);
router.post('/orders/checkout', publicSpamLimiter, handleCheckout);

// =======================================================
// MULTI-PAGE WEBSITE GENERATOR & CUSTOMER PORTAL SUPPORT
// =======================================================

const isColorLight = (hex: string): boolean => {
  const cleanHex = (hex || '').replace('#', '');
  if (cleanHex.length !== 6) return false;
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150;
};

const getDynamicFallbackProducts = (title: string, theme: string) => {
  const combined = `${title} ${theme}`.toLowerCase();
  
  if (combined.includes('mật ong') || combined.includes('honey') || combined.includes('ong')) {
    return [
      { id: 'fallback-1', idNum: 9901, name: 'Mật Ong Rừng Tây Bắc', description: 'Mật ong rừng tự nhiên nguyên chất được khai thác trực tiếp từ rừng Tây Bắc.', price: 250000, currency: 'VND' },
      { id: 'fallback-2', idNum: 9902, name: 'Mật Ong Hoa Nhãn', description: 'Mật ong từ hoa nhãn ngọt thanh, giàu dưỡng chất tốt cho sức khỏe.', price: 180000, currency: 'VND' },
      { id: 'fallback-3', idNum: 9903, name: 'Mật Ong Bạc Hà', description: 'Mật ong hoa bạc hà đặc sản Hà Giang thơm mát, chất lượng thượng hạng.', price: 320000, currency: 'VND' }
    ];
  }
  
  if (combined.includes('học') || combined.includes('course') || combined.includes('lập trình') || combined.includes('đào tạo') || combined.includes('tiếng anh') || theme === 'education-theme') {
    return [
      { id: 'fallback-1', idNum: 9901, name: 'Khóa Học HTML/CSS/JS Cơ Bản', description: 'Khóa học nền tảng lập trình web cho người mới bắt đầu từ số 0.', price: 499000, currency: 'VND' },
      { id: 'fallback-2', idNum: 9902, name: 'Khóa Học React & Next.js Pro', description: 'Xây dựng dự án web thực tế chuẩn chuyên nghiệp cùng Mentor.', price: 999000, currency: 'VND' },
      { id: 'fallback-3', idNum: 9903, name: 'Khóa Học Node.js Backend Developer', description: 'Làm chủ kiến trúc hệ thống và cơ sở dữ liệu chuyên sâu.', price: 899000, currency: 'VND' }
    ];
  }
  
  if (combined.includes('vé') || combined.includes('bay') || combined.includes('flight') || combined.includes('du lịch') || combined.includes('travel') || combined.includes('tour') || theme === 'saleticket-theme') {
    return [
      { id: 'fallback-1', idNum: 9901, name: 'Combo Vé Máy Bay & Resort 3N2Đ', description: 'Trọn gói vé máy bay khứ hồi kèm phòng nghỉ dưỡng cao cấp ven biển.', price: 2490000, currency: 'VND' },
      { id: 'fallback-2', idNum: 9902, name: 'Tour Du Lịch Trọn Gói Đà Lạt', description: 'Khám phá thành phố ngàn hoa thơ mộng với hướng dẫn viên chu đáo.', price: 3190000, currency: 'VND' },
      { id: 'fallback-3', idNum: 9903, name: 'Vé Máy Bay Khứ Hồi Hà Nội - Phú Quốc', description: 'Hãng hàng không chất lượng, giờ bay đẹp, hỗ trợ 24/7.', price: 1890000, currency: 'VND' }
    ];
  }

  if (combined.includes('hải sản') || combined.includes('seafood') || combined.includes('tôm') || combined.includes('cá') || combined.includes('ngâm tương') || theme === 'sale-theme') {
    return [
      { id: 'fallback-1', idNum: 9901, name: 'Tôm Sú Cà Mau Ngâm Tương', description: 'Tôm sú tươi sống ngâm nước tương cốt gia truyền đậm vị đặc sản.', price: 250000, currency: 'VND' },
      { id: 'fallback-2', idNum: 9902, name: 'Cá Hồi Na Uy Ngâm Tương', description: 'Cá hồi Na Uy tươi rói ngâm tương mẻ mới làm sạch sẽ mỗi ngày.', price: 280000, currency: 'VND' },
      { id: 'fallback-3', idNum: 9903, name: 'Mực Trứng Sốt Tương Cay', description: 'Mực trứng nhiều gạch bùi béo sốt tương ớt cay nồng đậm vị.', price: 190000, currency: 'VND' }
    ];
  }

  const cleanTitle = title || 'Sản phẩm';
  return [
    { id: 'fallback-1', idNum: 9901, name: `${cleanTitle} Cao Cấp`, description: 'Mô tả chi tiết sản phẩm chất lượng cao của cửa hàng.', price: 150000, currency: 'VND' },
    { id: 'fallback-2', idNum: 9902, name: `${cleanTitle} Thượng Hạng`, description: 'Sản phẩm tuyển chọn loại thượng hạng chất lượng vượt trội.', price: 250000, currency: 'VND' },
    { id: 'fallback-3', idNum: 9903, name: `${cleanTitle} Đặc Biệt`, description: 'Sản phẩm độc quyền phiên bản giới hạn đặc biệt.', price: 350000, currency: 'VND' }
  ];
};

function injectNavbarAndFooter(html: string, slug: string, workspaceName: string, activeTab: string, theme = 'ocean-breeze', brandConfig: any = null): string {
  let headInject = '';
  if (!html.includes('cdn.tailwindcss.com')) {
    headInject += `<script src="https://cdn.tailwindcss.com"></script>\n`;
  }

  const fontName = brandConfig?.fontFamily || 'Plus Jakarta Sans';
  const formattedFont = fontName.replace(/\s+/g, '+');

  headInject += `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${formattedFont}:ital,wght@0,300..900;1,300..900&display=swap" rel="stylesheet">
<style>
  body, button, input, select, textarea { font-family: '${fontName}', system-ui, -apple-system, sans-serif !important; }
  
  /* Scroll entrance animation */
  .animate-scroll-up {
    opacity: 0;
    transform: translateY(30px);
    transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .animate-scroll-up.is-visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* Vanilla CSS Fallback for Navigation Header */
  .custom-navbar {
    position: sticky;
    top: 0;
    z-index: 50;
    width: 100%;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: all 0.3s ease;
  }
  .custom-navbar.navbar-light {
    background-color: rgba(255, 255, 255, 0.85);
    border-bottom: 1px solid rgba(226, 232, 240, 0.8);
    color: #1e293b;
  }
  .custom-navbar.navbar-dark {
    background-color: rgba(15, 23, 42, 0.85);
    border-bottom: 1px solid rgba(51, 65, 85, 0.5);
    color: #f1f5f9;
  }
  .custom-nav-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 16px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .custom-nav-logo {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    font-weight: 950;
    font-size: 20px;
    letter-spacing: -0.5px;
    color: inherit;
  }
  .custom-nav-logo img {
    height: 36px;
    max-width: 200px;
    object-fit: contain;
  }
  .custom-nav-menu {
    display: none;
    gap: 24px;
    align-items: center;
  }
  @media (min-width: 768px) {
    .custom-nav-menu {
      display: flex;
    }
  }
  .custom-nav-link {
    font-size: 14px;
    font-weight: 700;
    text-decoration: none;
    transition: color 0.2s ease;
  }
  .navbar-light .custom-nav-link {
    color: #475569;
  }
  .navbar-light .custom-nav-link:hover {
    color: #f25c22;
  }
  .navbar-dark .custom-nav-link {
    color: #cbd5e1;
  }
  .navbar-dark .custom-nav-link:hover {
    color: #f25c22;
  }
  .navbar-light .custom-nav-link.active {
    color: #f25c22;
  }
  .navbar-dark .custom-nav-link.active {
    color: #f25c22;
  }
  
  .custom-nav-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .custom-auth-section {
    display: none;
    align-items: center;
    gap: 12px;
  }
  @media (min-width: 768px) {
    .custom-auth-section {
      display: flex;
    }
  }
  .custom-btn-login {
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    padding: 6px 12px;
    transition: color 0.2s ease;
  }
  .navbar-light .custom-btn-login {
    color: #475569;
  }
  .navbar-light .custom-btn-login:hover {
    color: #0f172a;
  }
  .navbar-dark .custom-btn-login {
    color: #94a3b8;
  }
  .navbar-dark .custom-btn-login:hover {
    color: #f8fafc;
  }
  
  .custom-btn-register {
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    padding: 8px 16px;
    border-radius: 12px;
    color: #ffffff !important;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }
  .custom-btn-register:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  }
  
  .custom-hamburger {
    background: none;
    border: none;
    padding: 8px;
    cursor: pointer;
    border-radius: 8px;
    transition: background-color 0.2s;
    color: inherit;
  }
  @media (min-width: 768px) {
    .custom-hamburger {
      display: none;
    }
  }
  .navbar-light .custom-hamburger:hover {
    background-color: rgba(0,0,0,0.05);
  }
  .navbar-dark .custom-hamburger:hover {
    background-color: rgba(255,255,255,0.05);
  }
  .custom-hamburger svg {
    width: 24px;
    height: 24px;
    stroke: currentColor;
  }
  
  .custom-mobile-panel {
    display: none;
    flex-direction: column;
    gap: 16px;
    padding: 16px 24px;
    transition: all 0.3s ease;
  }
  .navbar-light .custom-mobile-panel {
    background-color: rgba(255, 255, 255, 0.98);
    border-top: 1px solid rgba(226, 232, 240, 0.5);
  }
  .navbar-dark .custom-mobile-panel {
    background-color: rgba(15, 23, 42, 0.98);
    border-top: 1px solid rgba(51, 65, 85, 0.3);
  }
  @media (min-width: 768px) {
    .custom-mobile-panel {
      display: none !important;
    }
  }
  .custom-mobile-panel.show {
    display: flex;
  }
  .custom-mobile-panel nav {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .custom-mobile-panel .custom-nav-link {
    padding: 8px 0;
  }
  .custom-mobile-divider {
    height: 1px;
    width: 100%;
  }
  .navbar-light .custom-mobile-divider {
    background-color: rgba(226, 232, 240, 0.8);
  }
  .navbar-dark .custom-mobile-divider {
    background-color: rgba(51, 65, 85, 0.5);
  }
  .custom-mobile-auth {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .custom-mobile-auth .custom-btn-login,
  .custom-mobile-auth .custom-btn-register {
    text-align: center;
    width: 100%;
    box-sizing: border-box;
  }

  /* Theme color rules */
  .theme-orange .active-text-color { color: #f25c22 !important; }
  .theme-orange .custom-nav-link:hover { color: #f25c22 !important; }
  .theme-orange .theme-btn-bg { background-color: #f25c22 !important; }
  .theme-orange .theme-btn-bg:hover { background-color: #d94d1a !important; }
  
  .theme-sky .active-text-color { color: #0284c7 !important; }
  .theme-sky .custom-nav-link:hover { color: #0284c7 !important; }
  .theme-sky .theme-btn-bg { background-color: #0284c7 !important; }
  .theme-sky .theme-btn-bg:hover { background-color: #0369a1 !important; }
  
  .theme-red .active-text-color { color: #f05123 !important; }
  .theme-red .custom-nav-link:hover { color: #f05123 !important; }
  .theme-red .theme-btn-bg { background-color: #f05123 !important; }
  .theme-red .theme-btn-bg:hover { background-color: #d94416 !important; }
</style>\n`;

  const isDark = html.includes('bg-gray-950') || html.includes('bg-slate-950') || html.includes('bg-gray-900') || html.includes('background-color: #0f172a') || html.includes('background-color: #030712') || html.includes('background-color: #0b0f19') || html.includes('background-color: #111827');

  let themeNameClass = 'theme-orange';
  
  if (theme === 'saleticket-theme') {
    themeNameClass = 'theme-sky';
  } else if (theme === 'education-theme') {
    themeNameClass = 'theme-red';
  }

  const brandTitleText = brandConfig?.brandTitle || workspaceName;
  const brandLogoHtml = brandConfig?.logoUrl 
    ? `<img src="${brandConfig.logoUrl}" alt="${brandTitleText}" />`
    : `<span class="active-text-color">${brandTitleText}</span>`;

  const logoLinkHtml = `
    <a href="/api/public/pages/${slug}/html" class="custom-nav-logo">
      ${brandLogoHtml}
    </a>
  `;

  const navbarHtml = `
<header class="custom-navbar ${isDark ? 'navbar-dark' : 'navbar-light'} ${themeNameClass} transition-all duration-300">
  <div class="custom-nav-container">
    ${logoLinkHtml}
    
    <!-- Desktop navigation menu -->
    <nav class="custom-nav-menu">
      <a href="/api/public/pages/${slug}/html" class="custom-nav-link ${activeTab === 'home' ? 'active active-text-color' : ''}">Trang chủ</a>
      <a href="/api/public/pages/${slug}/html/blog" class="custom-nav-link ${activeTab === 'blog' ? 'active active-text-color' : ''}">Blog</a>
      <a href="/api/public/pages/${slug}/html/products" class="custom-nav-link ${activeTab === 'products' ? 'active active-text-color' : ''}">Sản phẩm</a>
      <a href="/api/public/pages/${slug}/html/about" class="custom-nav-link ${activeTab === 'about' ? 'active active-text-color' : ''}">Giới thiệu</a>
    </nav>
    
    <div class="custom-nav-right">
      <!-- Desktop Auth links (hidden on mobile) -->
      <div class="custom-auth-section" id="nav-auth-section-desktop">
        <a href="/api/public/pages/${slug}/html/login" class="custom-btn-login">Đăng nhập</a>
        <a href="/api/public/pages/${slug}/html/register" class="custom-btn-register theme-btn-bg">Đăng ký</a>
      </div>
      
      <!-- Mobile Menu Button (Hamburger) -->
      <button id="mobile-menu-btn" class="custom-hamburger" aria-label="Toggle Menu">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path id="hamburger-icon" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
          <path id="close-icon" class="hidden" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  </div>
  
  <!-- Mobile Navigation Panel (Dropdown/Drawer) -->
  <div id="mobile-nav-panel" class="custom-mobile-panel">
    <nav>
      <a href="/api/public/pages/${slug}/html" class="custom-nav-link ${activeTab === 'home' ? 'active active-text-color' : ''}">Trang chủ</a>
      <a href="/api/public/pages/${slug}/html/blog" class="custom-nav-link ${activeTab === 'blog' ? 'active active-text-color' : ''}">Blog</a>
      <a href="/api/public/pages/${slug}/html/products" class="custom-nav-link ${activeTab === 'products' ? 'active active-text-color' : ''}">Sản phẩm</a>
      <a href="/api/public/pages/${slug}/html/about" class="custom-nav-link ${activeTab === 'about' ? 'active active-text-color' : ''}">Giới thiệu</a>
    </nav>
    <div class="custom-mobile-divider"></div>
    <div class="custom-mobile-auth" id="nav-auth-section-mobile">
      <a href="/api/public/pages/${slug}/html/login" class="custom-btn-login">Đăng nhập</a>
      <a href="/api/public/pages/${slug}/html/register" class="custom-btn-register theme-btn-bg">Đăng ký</a>
    </div>
  </div>
</header>
<script>
  (function() {
    const btn = document.getElementById('mobile-menu-btn');
    const panel = document.getElementById('mobile-nav-panel');
    const hamburger = document.getElementById('hamburger-icon');
    const closeIcon = document.getElementById('close-icon');
    
    if (btn && panel) {
      btn.addEventListener('click', function() {
        panel.classList.toggle('show');
        if (hamburger && closeIcon) {
          hamburger.classList.toggle('hidden');
          closeIcon.classList.toggle('hidden');
        }
      });
    }
    
    // Auth sync
    const name = localStorage.getItem('customerName');
    const authSecDesktop = document.getElementById('nav-auth-section-desktop');
    const authSecMobile = document.getElementById('nav-auth-section-mobile');
    
    function updateAuthUI(container) {
      if (!container) return;
      if (name) {
        container.innerHTML = \`
          <span class="text-xs font-semibold \${container.id.includes('mobile') ? 'py-2' : ''} ${isDark ? 'text-slate-400' : 'text-slate-650'}">Xin chào, <strong class="active-text-color">\${name}</strong></span>
          <button onclick="localStorage.removeItem('customerName'); localStorage.removeItem('customerEmail'); window.location.reload();" class="text-xs ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-350' : 'bg-slate-100 hover:bg-slate-200 text-slate-750'} px-3 py-1.5 rounded-lg font-bold transition \${container.id.includes('mobile') ? 'w-full py-2.5 mt-2' : 'ml-2'}">Đăng xuất</button>
        \`;
      }
    }
    updateAuthUI(authSecDesktop);
    updateAuthUI(authSecMobile);
  })();
</script>
`;

  let resultHtml = html;
  if (headInject) {
    if (resultHtml.includes('</head>')) {
      resultHtml = resultHtml.replace('</head>', `${headInject}</head>`);
    } else {
      resultHtml = headInject + resultHtml;
    }
  }

  if (resultHtml.includes('<body class="')) {
    const idx = resultHtml.indexOf('<body class="');
    const bodyTagCloseIdx = resultHtml.indexOf('>', idx);
    if (bodyTagCloseIdx !== -1) {
      resultHtml = resultHtml.substring(0, bodyTagCloseIdx + 1) + navbarHtml + resultHtml.substring(bodyTagCloseIdx + 1);
    }
  } else if (resultHtml.includes('<body>')) {
    resultHtml = resultHtml.replace('<body>', `<body>${navbarHtml}`);
  } else {
    resultHtml = navbarHtml + resultHtml;
  }

  const scrollScript = `
<script>
  (function() {
    function initScrollAnimations() {
      const sections = document.querySelectorAll('section');
      sections.forEach(sec => {
        if (!sec.classList.contains('animate-scroll-up')) {
          sec.classList.add('animate-scroll-up');
        }
      });

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.05,
        rootMargin: '0px 0px -30px 0px'
      });

      sections.forEach(sec => {
        observer.observe(sec);
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initScrollAnimations);
    } else {
      initScrollAnimations();
    }
  })();
</script>
`;

  const referralWidget = `
<!-- Referral Loop Widget (Footer Banner & Exit-Intent Popup) -->
<div id="referral-footer-banner" style="background: linear-gradient(135deg, #f25c22, #ffa37b); color: white; padding: 14px; text-align: center; font-size: 13.5px; font-weight: bold; position: relative; z-index: 999; box-shadow: 0 -4px 15px rgba(242,92,34,0.15);">
  🎁 Bạn muốn nhận E-book & Quà tặng miễn phí? Đăng ký giới thiệu và chia sẻ trang này để tích lũy điểm đổi quà ngay! 
  <a href="/public/portal" style="color: white; text-decoration: underline; margin-left: 8px; font-weight: 800; border-bottom: 2px solid white; padding-bottom: 1px;">Tham gia ngay →</a>
</div>

<!-- Exit-Intent Referral Modal -->
<div id="exit-intent-referral-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000000; align-items: center; justify-content: center; padding: 16px; font-family: system-ui, -apple-system, sans-serif;">
  <div style="background: white; border-radius: 20px; padding: 30px; max-width: 450px; width: 100%; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); position: relative; border: 1px solid #ffd8c7;">
    <button id="close-exit-modal-btn" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 24px; cursor: pointer; color: #9ca3af; line-height: 1;">&times;</button>
    <div style="font-size: 40px; margin-bottom: 12px;">🎁</div>
    <h3 style="font-size: 18px; font-weight: 850; color: #1e293b; margin-bottom: 8px;">Đừng đi tay trắng!</h3>
    <p style="font-size: 13.5px; color: #64748b; margin-bottom: 20px; line-height: 1.5;">Chia sẻ trang này cho bạn bè để tích điểm quy đổi **E-book hoặc Quà tặng miễn phí** từ chúng tôi.</p>
    <a href="/public/portal" style="display: block; background: linear-gradient(135deg, #f25c22, #ff7e40); color: white; text-align: center; padding: 12px; border-radius: 12px; font-weight: bold; text-decoration: none; font-size: 14px; box-shadow: 0 4px 10px rgba(242, 92, 34, 0.3); transition: all 0.2s;">
      Nhận Quà Tặng & Link Chia Sẻ →
    </a>
  </div>
</div>

<script>
  (function() {
    const modal = document.getElementById('exit-intent-referral-modal');
    const closeBtn = document.getElementById('close-exit-modal-btn');
    
    if (modal && closeBtn) {
      let shown = false;
      
      function onMouseOut(e) {
        if (e.clientY < 20 && !shown) {
          const dismissed = localStorage.getItem('exit_referral_dismissed');
          if (!dismissed) {
            modal.style.display = 'flex';
            shown = true;
          }
        }
      }
      
      document.addEventListener('mouseout', onMouseOut);
      
      closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
        localStorage.setItem('exit_referral_dismissed', 'true');
      });
    }
  })();
</script>
`;

  if (resultHtml.includes('</body>')) {
    resultHtml = resultHtml.replace('</body>', `${referralWidget}\n${scrollScript}\n</body>`);
  } else {
    resultHtml = resultHtml + '\n' + referralWidget + '\n' + scrollScript;
  }

  return resultHtml;
}

function renderPage(slug: string, workspaceName: string, title: string, contentHtml: string, activeTab: string, theme = 'ocean-breeze', brandConfig: any = null): string {
  let activeColorClass = 'text-[#f25c22]';
  let btnColorClass = 'bg-[#f25c22] hover:bg-[#d94d1a]';
  let hoverTextClass = 'hover:text-[#f25c22]';
  let themeNameClass = 'theme-orange';

  if (theme === 'saleticket-theme') {
    activeColorClass = 'text-sky-600';
    btnColorClass = 'bg-sky-600 hover:bg-sky-700';
    hoverTextClass = 'hover:text-sky-600';
    themeNameClass = 'theme-sky';
  } else if (theme === 'education-theme') {
    activeColorClass = 'text-[#f05123]';
    btnColorClass = 'bg-[#f05123] hover:bg-[#d94416]';
    hoverTextClass = 'hover:text-[#f05123]';
    themeNameClass = 'theme-red';
  }

  const brandTitleText = brandConfig?.brandTitle || workspaceName;
  const brandLogoHtml = brandConfig?.logoUrl 
    ? `<img src="${brandConfig.logoUrl}" alt="${brandTitleText}" />`
    : `<span class="active-text-color">${brandTitleText}</span>`;

  const logoLinkHtml = `
    <a href="/api/public/pages/${slug}/html" class="custom-nav-logo">
      ${brandLogoHtml}
    </a>
  `;

  const fontName = brandConfig?.fontFamily || 'Plus Jakarta Sans';
  const formattedFont = fontName.replace(/\s+/g, '+');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${brandTitleText}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${formattedFont}:ital,wght@0,300..900;1,300..900&display=swap" rel="stylesheet">
  <style>
    body, button, input, select, textarea { font-family: '${fontName}', system-ui, -apple-system, sans-serif !important; background-color: #f8fafc; color: #0f172a; scroll-behavior: smooth; }
    
    /* Scroll entrance animation */
    .animate-scroll-up {
      opacity: 0;
      transform: translateY(30px);
      transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .animate-scroll-up.is-visible {
      opacity: 1;
      transform: translateY(0);
    }

    /* Vanilla CSS Fallback for Navigation Header */
    .custom-navbar {
      position: sticky;
      top: 0;
      z-index: 50;
      width: 100%;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transition: all 0.3s ease;
    }
    .custom-navbar.navbar-light {
      background-color: rgba(255, 255, 255, 0.85);
      border-bottom: 1px solid rgba(226, 232, 240, 0.8);
      color: #1e293b;
    }
    .custom-navbar.navbar-dark {
      background-color: rgba(15, 23, 42, 0.85);
      border-bottom: 1px solid rgba(51, 65, 85, 0.5);
      color: #f1f5f9;
    }
    .custom-nav-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .custom-nav-logo {
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      font-weight: 950;
      font-size: 20px;
      letter-spacing: -0.5px;
      color: inherit;
    }
    .custom-nav-logo img {
      height: 36px;
      max-width: 200px;
      object-fit: contain;
    }
    .custom-nav-menu {
      display: none;
      gap: 24px;
      align-items: center;
    }
    @media (min-width: 768px) {
      .custom-nav-menu {
        display: flex;
      }
    }
    .custom-nav-link {
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      transition: color 0.2s ease;
    }
    .navbar-light .custom-nav-link {
      color: #475569;
    }
    .navbar-light .custom-nav-link:hover {
      color: #f25c22;
    }
    .navbar-dark .custom-nav-link {
      color: #cbd5e1;
    }
    .navbar-dark .custom-nav-link:hover {
      color: #f25c22;
    }
    .navbar-light .custom-nav-link.active {
      color: #f25c22;
    }
    .navbar-dark .custom-nav-link.active {
      color: #f25c22;
    }
    
    .custom-nav-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .custom-auth-section {
      display: none;
      align-items: center;
      gap: 12px;
    }
    @media (min-width: 768px) {
      .custom-auth-section {
        display: flex;
      }
    }
    .custom-btn-login {
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      padding: 6px 12px;
      transition: color 0.2s ease;
    }
    .navbar-light .custom-btn-login {
      color: #475569;
    }
    .navbar-light .custom-btn-login:hover {
      color: #0f172a;
    }
    .navbar-dark .custom-btn-login {
      color: #94a3b8;
    }
    .navbar-dark .custom-btn-login:hover {
      color: #f8fafc;
    }
    
    .custom-btn-register {
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 12px;
      color: #ffffff !important;
      transition: all 0.2s ease;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .custom-btn-register:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    
    .custom-hamburger {
      background: none;
      border: none;
      padding: 8px;
      cursor: pointer;
      border-radius: 8px;
      transition: background-color 0.2s;
      color: inherit;
    }
    @media (min-width: 768px) {
      .custom-hamburger {
        display: none;
      }
    }
    .navbar-light .custom-hamburger:hover {
      background-color: rgba(0,0,0,0.05);
    }
    .navbar-dark .custom-hamburger:hover {
      background-color: rgba(255,255,255,0.05);
    }
    .custom-hamburger svg {
      width: 24px;
      height: 24px;
      stroke: currentColor;
    }
    
    .custom-mobile-panel {
      display: none;
      flex-direction: column;
      gap: 16px;
      padding: 16px 24px;
      transition: all 0.3s ease;
    }
    .navbar-light .custom-mobile-panel {
      background-color: rgba(255, 255, 255, 0.98);
      border-top: 1px solid rgba(226, 232, 240, 0.5);
    }
    .navbar-dark .custom-mobile-panel {
      background-color: rgba(15, 23, 42, 0.98);
      border-top: 1px solid rgba(51, 65, 85, 0.3);
    }
    @media (min-width: 768px) {
      .custom-mobile-panel {
        display: none !important;
      }
    }
    .custom-mobile-panel.show {
      display: flex;
    }
    .custom-mobile-panel nav {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .custom-mobile-panel .custom-nav-link {
      padding: 8px 0;
    }
    .custom-mobile-divider {
      height: 1px;
      width: 100%;
    }
    .navbar-light .custom-mobile-divider {
      background-color: rgba(226, 232, 240, 0.8);
    }
    .navbar-dark .custom-mobile-divider {
      background-color: rgba(51, 65, 85, 0.5);
    }
    .custom-mobile-auth {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .custom-mobile-auth .custom-btn-login,
    .custom-mobile-auth .custom-btn-register {
      text-align: center;
      width: 100%;
      box-sizing: border-box;
    }

    /* Theme color rules */
    .theme-orange .active-text-color { color: #f25c22 !important; }
    .theme-orange .custom-nav-link:hover { color: #f25c22 !important; }
    .theme-orange .theme-btn-bg { background-color: #f25c22 !important; }
    .theme-orange .theme-btn-bg:hover { background-color: #d94d1a !important; }
    
    .theme-sky .active-text-color { color: #0284c7 !important; }
    .theme-sky .custom-nav-link:hover { color: #0284c7 !important; }
    .theme-sky .theme-btn-bg { background-color: #0284c7 !important; }
    .theme-sky .theme-btn-bg:hover { background-color: #0369a1 !important; }
    
    .theme-red .active-text-color { color: #f05123 !important; }
    .theme-red .custom-nav-link:hover { color: #f05123 !important; }
    .theme-red .theme-btn-bg { background-color: #f05123 !important; }
    .theme-red .theme-btn-bg:hover { background-color: #d94416 !important; }

    /* Enforce solid black text on light backgrounds for blog post / products subpages */
    main p, 
    main li, 
    main label, 
    article.prose p, 
    article.prose li,
    article.prose strong,
    main .faq-answer,
    main .testimonial-quote {
      color: #000000 !important;
    }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen flex flex-col justify-between">
  <div>
    <header class="custom-navbar navbar-light ${themeNameClass} transition-all duration-300">
      <div class="custom-nav-container">
        ${logoLinkHtml}
        
        <!-- Desktop navigation menu -->
        <nav class="custom-nav-menu">
          <a href="/api/public/pages/${slug}/html" class="custom-nav-link ${activeTab === 'home' ? 'active active-text-color' : ''}">Trang chủ</a>
          <a href="/api/public/pages/${slug}/html/blog" class="custom-nav-link ${activeTab === 'blog' ? 'active active-text-color' : ''}">Blog</a>
          <a href="/api/public/pages/${slug}/html/products" class="custom-nav-link ${activeTab === 'products' ? 'active active-text-color' : ''}">Sản phẩm</a>
          <a href="/api/public/pages/${slug}/html/about" class="custom-nav-link ${activeTab === 'about' ? 'active active-text-color' : ''}">Giới thiệu</a>
        </nav>
        
        <div class="custom-nav-right">
          <!-- Desktop Auth links (hidden on mobile) -->
          <div class="custom-auth-section" id="nav-auth-section-desktop">
            <a href="/api/public/pages/${slug}/html/login" class="custom-btn-login">Đăng nhập</a>
            <a href="/api/public/pages/${slug}/html/register" class="custom-btn-register theme-btn-bg">Đăng ký</a>
          </div>
          
          <!-- Mobile Menu Button (Hamburger) -->
          <button id="mobile-menu-btn" class="custom-hamburger" aria-label="Toggle Menu">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path id="hamburger-icon" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
              <path id="close-icon" class="hidden" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Mobile Navigation Panel (Dropdown/Drawer) -->
      <div id="mobile-nav-panel" class="custom-mobile-panel">
        <nav>
          <a href="/api/public/pages/${slug}/html" class="custom-nav-link ${activeTab === 'home' ? 'active active-text-color' : ''}">Trang chủ</a>
          <a href="/api/public/pages/${slug}/html/blog" class="custom-nav-link ${activeTab === 'blog' ? 'active active-text-color' : ''}">Blog</a>
          <a href="/api/public/pages/${slug}/html/products" class="custom-nav-link ${activeTab === 'products' ? 'active active-text-color' : ''}">Sản phẩm</a>
          <a href="/api/public/pages/${slug}/html/about" class="custom-nav-link ${activeTab === 'about' ? 'active active-text-color' : ''}">Giới thiệu</a>
        </nav>
        <div class="custom-mobile-divider"></div>
        <div class="custom-mobile-auth" id="nav-auth-section-mobile">
          <a href="/api/public/pages/${slug}/html/login" class="custom-btn-login">Đăng nhập</a>
          <a href="/api/public/pages/${slug}/html/register" class="custom-btn-register theme-btn-bg">Đăng ký</a>
        </div>
      </div>
    </header>

    <main class="py-12">
      ${contentHtml}
    </main>
  </div>

  <footer class="py-10 px-6 bg-slate-900 text-slate-400 text-center border-t border-slate-800">
    <div class="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
      <h4 class="text-white font-bold text-base">${brandTitleText}</h4>
      <p class="text-xs">© ${new Date().getFullYear()} ${brandTitleText}. Bảo lưu mọi quyền.</p>
    </div>
  </footer>

  <script>
    (function() {
      const btn = document.getElementById('mobile-menu-btn');
      const panel = document.getElementById('mobile-nav-panel');
      const hamburger = document.getElementById('hamburger-icon');
      const closeIcon = document.getElementById('close-icon');
      
      if (btn && panel) {
        btn.addEventListener('click', function() {
          panel.classList.toggle('show');
          if (hamburger && closeIcon) {
            hamburger.classList.toggle('hidden');
            closeIcon.classList.toggle('hidden');
          }
        });
      }
      
      // Auth sync
      const name = localStorage.getItem('customerName');
      const authSecDesktop = document.getElementById('nav-auth-section-desktop');
      const authSecMobile = document.getElementById('nav-auth-section-mobile');
      
      function updateAuthUI(container) {
        if (!container) return;
        if (name) {
          container.innerHTML = \`
            <span class="text-xs font-semibold \\\${container.id.includes('mobile') ? 'py-2' : ''} text-slate-650">Xin chào, <strong class="active-text-color">\\\${name}</strong></span>
            <button onclick="localStorage.removeItem('customerName'); localStorage.removeItem('customerEmail'); window.location.reload();" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-750 px-3 py-1.5 rounded-lg font-bold transition \\\${container.id.includes('mobile') ? 'w-full py-2.5 mt-2' : 'ml-2'}">Đăng xuất</button>
          \`;
        }
      }
      updateAuthUI(authSecDesktop);
      updateAuthUI(authSecMobile);
    })();

    (function() {
      function initScrollAnimations() {
        const sections = document.querySelectorAll('section');
        sections.forEach(sec => {
          if (!sec.classList.contains('animate-scroll-up')) {
            sec.classList.add('animate-scroll-up');
          }
        });

        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        }, {
          threshold: 0.05,
          rootMargin: '0px 0px -30px 0px'
        });

        sections.forEach(sec => {
          observer.observe(sec);
        });
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScrollAnimations);
      } else {
        initScrollAnimations();
      }
    })();
  </script>
</body>
</html>`;
}

// Public Customer Auth APIs
router.post('/auth/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, company, workspaceId } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Địa chỉ Email là bắt buộc' });
      return;
    }
    const wsId = parseInt(workspaceId as string);
    if (isNaN(wsId)) {
      res.status(400).json({ error: 'Workspace ID không hợp lệ' });
      return;
    }

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
          workspaceId: wsId,
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
          workspaceId: wsId,
        },
      });
    }

    await checkAndApplyReferral(customer.id, req);

    res.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi đăng ký tài khoản' });
  }
});

router.post('/auth/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, workspaceId } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Địa chỉ Email là bắt buộc' });
      return;
    }
    const wsId = parseInt(workspaceId as string);
    if (isNaN(wsId)) {
      res.status(400).json({ error: 'Workspace ID không hợp lệ' });
      return;
    }

    const customer = await prisma.customer.findFirst({
      where: { email: email.toLowerCase(), workspaceId: wsId },
    });

    if (!customer) {
      res.status(404).json({ error: 'Không tìm thấy thông tin khách hàng với email này trong hệ thống' });
      return;
    }

    res.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi đăng nhập' });
  }
});
// Subpages handlers
router.get('/pages/:slug/html/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = req.params.slug as string;
    const page = await prisma.landingPage.findFirst({
      where: { slug }
    });
    if (!page) {
      res.status(404).send('<h1>404 - Không tìm thấy trang</h1>');
      return;
    }

    let workspaceName = 'Trang chủ';
    if (page.workspaceId) {
      const ws = await prisma.workspace.findUnique({ where: { id: page.workspaceId } });
      if (ws) workspaceName = ws.name;
    }

    let theme = 'ocean-breeze';
    let brandConfig: any = null;
    try {
      if (page.layoutJson) {
        const layout = JSON.parse(page.layoutJson as string);
        if (layout.theme) {
          theme = layout.theme;
        }
        if (layout.brandConfig) {
          brandConfig = layout.brandConfig;
        }
      }
    } catch (e) {
      // Ignore
    }

    const products = await prisma.product.findMany({
      where: { workspaceId: page.workspaceId },
      orderBy: { createdAt: 'desc' }
    });

    const isFallbackMode = products.length === 0;
    const displayProducts = isFallbackMode
      ? getDynamicFallbackProducts(page.title, theme)
      : products;

    const productCards = displayProducts.map((p: any) => {
      let img = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=650&auto=format&fit=crop&q=80';
      const idVal = typeof p.id === 'number' ? p.id : (p.idNum || 9901);
      
      const lowerName = p.name.toLowerCase();
      if (lowerName.includes('mật ong') || lowerName.includes('honey') || lowerName.includes('ong')) {
        const honeyImgs = [
          'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=650&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=650&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=650&auto=format&fit=crop&q=80'
        ];
        img = honeyImgs[idVal % honeyImgs.length];
      } else if (theme === 'sale-theme') {
        const foodImgs = [
          'https://images.unsplash.com/photo-1534080391025-09795d197360?w=650&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=650&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=650&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1534482421-64566f976cfa?w=650&auto=format&fit=crop&q=80'
        ];
        img = foodImgs[idVal % foodImgs.length];
      } else if (theme === 'education-theme') {
        const eduImgs = [
          'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=650&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=650&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=650&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=650&auto=format&fit=crop&q=80'
        ];
        img = eduImgs[idVal % eduImgs.length];
      } else if (theme === 'saleticket-theme') {
        const travelImgs = [
          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=650&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=650&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=650&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?w=650&auto=format&fit=crop&q=80'
        ];
        img = travelImgs[idVal % travelImgs.length];
      }

      let btnBg = 'bg-[#f25c22] hover:bg-[#d94d1a]';
      let textAccent = 'text-[#f25c22]';
      if (theme === 'saleticket-theme') {
        btnBg = 'bg-sky-600 hover:bg-sky-700';
        textAccent = 'text-sky-600';
      } else if (theme === 'education-theme') {
        btnBg = 'bg-[#f05123] hover:bg-[#d94416]';
        textAccent = 'text-[#f05123]';
      }

      return `
      <div class="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md hover:-translate-y-1 transition duration-300">
        <img src="${img}" alt="${p.name}" class="h-48 w-full object-cover border-b border-slate-100" />
        <div class="p-6 flex-1 flex flex-col justify-between">
          <div class="space-y-2">
            <h3 class="font-extrabold text-slate-900 text-lg line-clamp-1">${p.name}</h3>
            <p class="text-slate-500 text-xs line-clamp-2">${p.description || 'Không có mô tả chi tiết cho sản phẩm này.'}</p>
          </div>
          <div class="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
            <span class="${textAccent} font-black text-base">${p.price.toLocaleString('vi-VN')} ${p.currency}</span>
            <a href="/api/public/pages/${slug}/html/products/${p.id}" class="px-4 py-2 ${btnBg} text-white rounded-lg text-xs font-bold transition shadow-sm">Xem chi tiết</a>
          </div>
        </div>
      </div>
      `;
    }).join('');

    const contentHtml = `
      <div class="max-w-6xl mx-auto px-6">
        <div class="text-center max-w-xl mx-auto mb-10">
          <h2 class="text-3xl font-black text-slate-900">Danh Mục Sản Phẩm</h2>
          <p class="text-sm text-slate-500 mt-2">Khám phá các sản phẩm và dịch vụ nổi bật hàng đầu được tuyển chọn.</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          ${productCards}
        </div>
      </div>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderPage(slug, workspaceName, 'Sản phẩm', contentHtml, 'products', theme, brandConfig));
  } catch (error: any) {
    res.status(500).send('<h1>Lỗi hệ thống</h1>');
  }
});

router.get('/pages/:slug/html/products/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = req.params.slug as string;
    const productIdStr = req.params.id as string;
    const isFallback = productIdStr.startsWith('fallback-');
    
    const page = await prisma.landingPage.findFirst({
      where: { slug }
    });
    if (!page) {
      res.status(404).send('<h1>404 - Không tìm thấy trang</h1>');
      return;
    }

    let theme = 'ocean-breeze';
    let brandConfig: any = null;
    try {
      if (page.layoutJson) {
        const layout = JSON.parse(page.layoutJson as string);
        if (layout.theme) {
          theme = layout.theme;
        }
        if (layout.brandConfig) {
          brandConfig = layout.brandConfig;
        }
      }
    } catch (e) {
      // Ignore
    }

    let product: any = null;
    if (isFallback) {
      const fallbackList = getDynamicFallbackProducts(page.title, theme);
      product = fallbackList.find(p => p.id === productIdStr);
    } else {
      const productId = parseInt(productIdStr);
      if (!isNaN(productId)) {
        product = await prisma.product.findFirst({
          where: { id: productId, workspaceId: page.workspaceId }
        });
      }
    }

    if (!product) {
      res.status(404).send('<h1>404 - Không tìm thấy sản phẩm</h1>');
      return;
    }

    let workspaceName = 'Trang chủ';
    if (page.workspaceId) {
      const ws = await prisma.workspace.findUnique({ where: { id: page.workspaceId } });
      if (ws) workspaceName = ws.name;
    }

    const placeholders = [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&auto=format&fit=crop&q=80'
    ];
    
    const idVal = typeof product.id === 'number' ? product.id : (product.idNum || 9901);
    let img = placeholders[idVal % placeholders.length];
    
    const lowerName = product.name.toLowerCase();
    if (lowerName.includes('mật ong') || lowerName.includes('honey') || lowerName.includes('ong')) {
      const honeyImgs = [
        'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=800&auto=format&fit=crop&q=80'
      ];
      img = honeyImgs[idVal % honeyImgs.length];
    } else if (theme === 'sale-theme') {
      const foodImgs = [
        'https://images.unsplash.com/photo-1534080391025-09795d197360?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1534482421-64566f976cfa?w=800&auto=format&fit=crop&q=80'
      ];
      img = foodImgs[idVal % foodImgs.length];
    } else if (theme === 'education-theme') {
      const eduImgs = [
        'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80'
      ];
      img = eduImgs[idVal % eduImgs.length];
    } else if (theme === 'saleticket-theme') {
      const travelImgs = [
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?w=800&auto=format&fit=crop&q=80'
      ];
      img = travelImgs[idVal % travelImgs.length];
    }

    let btnBg = 'bg-[#f25c22] hover:bg-[#d94d1a] focus:border-[#f25c22]';
    let textAccent = 'text-[#f25c22]';
    let inputFocus = 'focus:border-[#f25c22]';
    if (theme === 'saleticket-theme') {
      btnBg = 'bg-sky-600 hover:bg-sky-700 focus:border-sky-500';
      textAccent = 'text-sky-600';
      inputFocus = 'focus:border-sky-500';
    } else if (theme === 'education-theme') {
      btnBg = 'bg-[#f05123] hover:bg-[#d94416] focus:border-[#f05123]';
      textAccent = 'text-[#f05123]';
      inputFocus = 'focus:border-[#f05123]';
    }

    const contentHtml = `
      <div class="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12">
        <div>
          <img src="${img}" alt="${product.name}" class="rounded-2xl border border-slate-200/60 shadow-sm w-full h-[350px] object-cover" />
          <div class="mt-6 space-y-4">
            <h2 class="text-2xl font-black text-slate-900">${product.name}</h2>
            <p class="text-slate-600 text-sm leading-relaxed">${product.description || 'Không có mô tả chi tiết cho sản phẩm này.'}</p>
            <div class="text-2xl font-black ${textAccent} pt-2">${product.price.toLocaleString('vi-VN')} ${product.currency}</div>
          </div>
        </div>
        
        <div class="bg-white border border-slate-200/60 rounded-2xl p-8 shadow-sm">
          <h3 class="text-lg font-bold text-slate-900 mb-2">Thanh toán đặt mua</h3>
          <p class="text-slate-400 text-xs mb-6">Nhập thông tin thanh toán để tiếp nhận đơn hàng nhanh.</p>
          
          <form id="public-checkout-form" class="space-y-4">
            <input type="hidden" id="checkout-product-id" value="${product.id}" />
            <div>
              <label class="block text-xs font-semibold text-slate-500 mb-1">Họ và Tên</label>
              <input type="text" id="checkout-name" required class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 text-sm focus:outline-none ${inputFocus}" placeholder="Nguyễn Văn A" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-500 mb-1">Địa chỉ Email</label>
              <input type="email" id="checkout-email" required class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 text-sm focus:outline-none ${inputFocus}" placeholder="name@email.com" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-500 mb-1">Số điện thoại</label>
              <input type="tel" id="checkout-phone" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 text-sm focus:outline-none ${inputFocus}" placeholder="0987654321" />
            </div>
            
            <div class="space-y-2 pt-2">
              <label class="block text-xs font-semibold text-slate-500">Phương thức thanh toán</label>
              <div class="grid grid-cols-2 gap-3">
                <label class="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:border-slate-350">
                  <input type="radio" name="paymentGateway" value="PAYOS" checked class="${textAccent} focus:ring-0" />
                  <span class="text-xs font-bold text-slate-700">Chuyển khoản QR</span>
                </label>
                <label class="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:border-slate-350">
                  <input type="radio" name="paymentGateway" value="STRIPE" class="${textAccent} focus:ring-0" />
                  <span class="text-xs font-bold text-slate-700">Thẻ Quốc Tế</span>
                </label>
              </div>
            </div>
            
            <button type="submit" id="checkout-submit-btn" class="w-full py-3 ${btnBg} text-white font-bold rounded-lg transition duration-200 mt-4 shadow-md">
              Tiến hành thanh toán
            </button>
          </form>
          
          <p id="checkout-error-msg" class="text-center mt-4 text-sm text-red-500 hidden"></p>
        </div>
      </div>

      <script>
        (function() {
          const name = localStorage.getItem('customerName');
          const email = localStorage.getItem('customerEmail');
          if (name) document.getElementById('checkout-name').value = name;
          if (email) document.getElementById('checkout-email').value = email;
        })();

        document.getElementById('public-checkout-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          const productId = document.getElementById('checkout-product-id').value;
          const name = document.getElementById('checkout-name').value;
          const email = document.getElementById('checkout-email').value;
          const phone = document.getElementById('checkout-phone').value;
          const gateway = document.querySelector('input[name="paymentGateway"]:checked').value;
          const errorEl = document.getElementById('checkout-error-msg');
          const submitBtn = document.getElementById('checkout-submit-btn');

          submitBtn.disabled = true;
          submitBtn.innerText = 'Đang xử lý...';
          errorEl.classList.add('hidden');

          try {
            const res = await fetch('/api/public/checkout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productId: parseInt(productId),
                customerName: name,
                customerEmail: email,
                customerPhone: phone,
                paymentMethod: gateway,
                returnUrl: window.location.origin + '/checkout/success',
                cancelUrl: window.location.href
              })
            });
            
            const data = await res.json();
            if (res.ok && data.checkoutUrl) {
              window.location.href = data.checkoutUrl;
            } else {
              errorEl.innerText = data.error || 'Lỗi khi khởi tạo thanh toán.';
              errorEl.classList.remove('hidden');
            }
          } catch (err) {
            errorEl.innerText = 'Lỗi kết nối máy chủ.';
            errorEl.classList.remove('hidden');
          } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Tiến hành thanh toán';
          }
        });
      </script>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderPage(slug, workspaceName, product.name, contentHtml, 'products', theme, brandConfig));
  } catch (error: any) {
    res.status(500).send('<h1>Lỗi hệ thống</h1>');
  }
});

router.get('/pages/:slug/html/about', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = req.params.slug as string;
    const page = await prisma.landingPage.findFirst({
      where: { slug }
    });
    if (!page) {
      res.status(404).send('<h1>404 - Không tìm thấy trang</h1>');
      return;
    }

    let workspaceName = 'Trang chủ';
    if (page.workspaceId) {
      const ws = await prisma.workspace.findUnique({ where: { id: page.workspaceId } });
      if (ws) workspaceName = ws.name;
    }

    let theme = 'ocean-breeze';
    let brandConfig: any = null;
    try {
      if (page.layoutJson) {
        const layout = JSON.parse(page.layoutJson as string);
        if (layout.theme) {
          theme = layout.theme;
        }
        if (layout.brandConfig) {
          brandConfig = layout.brandConfig;
        }
      }
    } catch (e) {
      // Ignore
    }

    let textAccent = 'text-[#f25c22]';
    let bgAccent = 'bg-[#f25c22]/10';
    if (theme === 'saleticket-theme') {
      textAccent = 'text-sky-600';
      bgAccent = 'bg-sky-600/10';
    } else if (theme === 'education-theme') {
      textAccent = 'text-[#f05123]';
      bgAccent = 'bg-[#f05123]/10';
    }

    const contentHtml = `
      <div class="max-w-3xl mx-auto bg-white border border-slate-200/60 rounded-2xl p-8 md:p-12 shadow-sm text-center space-y-6">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full ${bgAccent} ${textAccent} text-3xl font-bold">🏢</div>
        <h2 class="text-3xl font-black text-slate-900">Về Chúng Tôi</h2>
        <p class="text-slate-600 font-medium leading-relaxed">
          Chào mừng bạn đến với <strong>${workspaceName}</strong>. Chúng tôi tự hào là đơn vị tiên phong cung cấp các giải pháp chất lượng vượt trội nhằm mang lại sự hài lòng tối đa cho khách hàng. Với đội ngũ chuyên gia tận tâm và không ngừng sáng tạo, chúng tôi cam kết đồng hành cùng sự phát triển bền vững của bạn.
        </p>
        <div class="grid grid-cols-3 gap-6 pt-6 border-t border-slate-100 text-center">
          <div>
            <h4 class="text-2xl font-black ${textAccent}">100%</h4>
            <p class="text-xs text-slate-400 mt-1 uppercase font-bold tracking-wider">Tận Tâm</p>
          </div>
          <div>
            <h4 class="text-2xl font-black ${textAccent}">24/7</h4>
            <p class="text-xs text-slate-400 mt-1 uppercase font-bold tracking-wider">Hỗ Trợ</p>
          </div>
          <div>
            <h4 class="text-2xl font-black ${textAccent}">Vượt Trội</h4>
            <p class="text-xs text-slate-400 mt-1 uppercase font-bold tracking-wider">Chất Lượng</p>
          </div>
        </div>
      </div>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderPage(slug, workspaceName, 'Giới thiệu', contentHtml, 'about', theme, brandConfig));
  } catch (error: any) {
    res.status(500).send('<h1>Lỗi hệ thống</h1>');
  }
});

router.get('/pages/:slug/html/blog', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = req.params.slug as string;
    const page = await prisma.landingPage.findFirst({
      where: { slug }
    });
    if (!page) {
      res.status(404).send('<h1>404 - Không tìm thấy trang</h1>');
      return;
    }

    let workspaceName = 'Trang chủ';
    if (page.workspaceId) {
      const ws = await prisma.workspace.findUnique({ where: { id: page.workspaceId } });
      if (ws) workspaceName = ws.name;
    }

    let theme = 'ocean-breeze';
    let brandConfig: any = null;
    try {
      if (page.layoutJson) {
        const layout = JSON.parse(page.layoutJson as string);
        if (layout.theme) {
          theme = layout.theme;
        }
        if (layout.brandConfig) {
          brandConfig = layout.brandConfig;
        }
      }
    } catch (e) {
      // Ignore
    }

    let textAccent = 'text-[#f25c22]';
    let textHoverAccent = 'hover:text-[#f25c22]';
    let bgAccent = 'bg-[#f25c22]/10';
    if (theme === 'saleticket-theme') {
      textAccent = 'text-sky-600';
      textHoverAccent = 'hover:text-sky-600';
      bgAccent = 'bg-sky-600/10';
    } else if (theme === 'education-theme') {
      textAccent = 'text-[#f05123]';
      textHoverAccent = 'hover:text-[#f05123]';
      bgAccent = 'bg-[#f05123]/10';
    }

    // Query published blog posts
    const posts = await prisma.blogPost.findMany({
      where: { workspaceId: page.workspaceId || 0, published: true },
      orderBy: { publishedAt: 'desc' }
    });

    let postsHtml = '';
    if (posts.length === 0) {
      postsHtml = `
        <div class="col-span-full text-center py-16 bg-white border border-slate-200/60 rounded-2xl p-8 flex flex-col items-center shadow-sm">
          <h4 class="text-slate-800 font-bold mb-1 text-base">Chưa có bài viết nào</h4>
          <p class="text-slate-500 text-xs">Hãy đón chờ những bài viết blog chất lượng cao chuẩn bị ra mắt.</p>
        </div>
      `;
    } else {
      postsHtml = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto px-6">
          ${posts.map(post => `
            <div class="bg-white border border-slate-200/60 rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition duration-300">
              <div class="p-6 space-y-3 text-left">
                <div class="flex justify-between items-center gap-2">
                  <span class="bg-slate-50 text-slate-500 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ring-1 ring-slate-100">
                    Bài viết
                  </span>
                  <span class="text-[10px] text-slate-400 font-bold">${post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('vi-VN') : new Date(post.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
                <h3 class="font-extrabold text-slate-850 text-base line-clamp-2 ${textHoverAccent} transition cursor-pointer">
                  <a href="/api/public/blog/posts/${post.slug}/html">${post.title}</a>
                </h3>
                <p class="text-slate-500 text-xs leading-relaxed line-clamp-3">
                  ${post.summary || 'Không có mô tả tóm tắt.'}
                </p>
                ${post.tags ? `
                  <div class="flex flex-wrap gap-1.5 pt-1">
                    ${post.tags.split(',').map(tag => `<span class="bg-[#fff4ef] text-[#f25c22] text-[10px] px-2.5 py-0.5 rounded-lg border border-[#ffd8c7] font-extrabold">#${tag.trim()}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
              <div class="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                <a href="/api/public/blog/posts/${post.slug}/html" class="text-xs font-bold ${textAccent} hover:underline flex items-center gap-1">
                  Đọc tiếp →
                </a>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    const contentHtml = `
      <div class="space-y-8">
        <div class="text-center max-w-2xl mx-auto space-y-3">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full ${bgAccent} ${textAccent} text-3xl font-bold">📰</div>
          <h2 class="text-3xl font-black text-slate-900 uppercase tracking-tight">Blog Tin Tức</h2>
          <p class="text-slate-500 text-sm leading-relaxed">
            Nơi chia sẻ các bài viết phân tích, cẩm nang và tin tức hữu ích giúp thúc đẩy tăng trưởng và lưu lượng truy cập tự nhiên.
          </p>
        </div>
        ${postsHtml}
      </div>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderPage(slug, workspaceName, 'Blog Tin Tức', contentHtml, 'blog', theme, brandConfig));
  } catch (error: any) {
    res.status(500).send('<h1>Lỗi hệ thống</h1>');
  }
});

router.get('/pages/:slug/html/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = req.params.slug as string;
    const page = await prisma.landingPage.findFirst({
      where: { slug }
    });
    if (!page) {
      res.status(404).send('<h1>404 - Không tìm thấy trang</h1>');
      return;
    }

    let workspaceName = 'Trang chủ';
    if (page.workspaceId) {
      const ws = await prisma.workspace.findUnique({ where: { id: page.workspaceId } });
      if (ws) workspaceName = ws.name;
    }

    let theme = 'ocean-breeze';
    let brandConfig: any = null;
    try {
      if (page.layoutJson) {
        const layout = JSON.parse(page.layoutJson as string);
        if (layout.theme) {
          theme = layout.theme;
        }
        if (layout.brandConfig) {
          brandConfig = layout.brandConfig;
        }
      }
    } catch (e) {
      // Ignore
    }

    let btnBg = 'bg-[#f25c22] hover:bg-[#d94d1a]';
    let textAccent = 'text-[#f25c22]';
    let inputFocus = 'focus:border-[#f25c22] focus:ring-2 focus:ring-[#f25c22]/20';
    if (theme === 'saleticket-theme') {
      btnBg = 'bg-sky-600 hover:bg-sky-700';
      textAccent = 'text-sky-600';
      inputFocus = 'focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20';
    } else if (theme === 'education-theme') {
      btnBg = 'bg-[#f05123] hover:bg-[#d94416]';
      textAccent = 'text-[#f05123]';
      inputFocus = 'focus:border-[#f05123] focus:ring-2 focus:ring-[#f05123]/20';
    }

    const contentHtml = `
      <div class="max-w-md mx-auto bg-white border border-slate-200/60 rounded-2xl p-8 shadow-sm">
        <h3 class="text-2xl font-black text-slate-900 text-center mb-2">Đăng nhập cổng khách hàng</h3>
        <p class="text-slate-400 text-xs text-center mb-6">Nhập email của bạn để đồng bộ tài khoản.</p>
        
        <form id="public-login-form" class="space-y-4">
          <input type="hidden" id="login-ws-id" value="${page.workspaceId || 0}" />
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1">Địa chỉ Email</label>
            <input type="email" id="login-email" required class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 text-sm focus:outline-none ${inputFocus}" placeholder="name@email.com" />
          </div>
          <button type="submit" id="login-submit-btn" class="w-full py-3 ${btnBg} text-white font-bold rounded-lg transition duration-200 shadow-md">
            Đăng nhập
          </button>
        </form>
        <p id="login-error-msg" class="text-center mt-4 text-xs text-red-500 hidden"></p>
        <div class="text-center mt-4 text-xs text-slate-500">
          Chưa có tài khoản? <a href="/api/public/pages/${slug}/html/register" class="${textAccent} font-bold hover:underline">Đăng ký ngay</a>
        </div>
      </div>

      <script>
        document.getElementById('public-login-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          const email = document.getElementById('login-email').value;
          const wsId = document.getElementById('login-ws-id').value;
          const errorEl = document.getElementById('login-error-msg');
          const submitBtn = document.getElementById('login-submit-btn');

          submitBtn.disabled = true;
          submitBtn.innerText = 'Đang đăng nhập...';
          errorEl.classList.add('hidden');

          try {
            const res = await fetch('/api/public/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, workspaceId: parseInt(wsId) })
            });
            const result = await res.json();
            if (res.ok && result.success) {
              localStorage.setItem('customerName', result.customer.name);
              localStorage.setItem('customerEmail', result.customer.email);
              window.location.href = '/api/public/pages/${slug}/html';
            } else {
              errorEl.innerText = result.error || 'Đăng nhập thất bại.';
              errorEl.classList.remove('hidden');
            }
          } catch (err) {
            errorEl.innerText = 'Lỗi kết nối máy chủ.';
            errorEl.classList.remove('hidden');
          } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Đăng nhập';
          }
        });
      </script>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderPage(slug, workspaceName, 'Đăng nhập', contentHtml, 'auth', theme, brandConfig));
  } catch (error: any) {
    res.status(500).send('<h1>Lỗi hệ thống</h1>');
  }
});

router.get('/pages/:slug/html/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = req.params.slug as string;
    const page = await prisma.landingPage.findFirst({
      where: { slug }
    });
    if (!page) {
      res.status(404).send('<h1>404 - Không tìm thấy trang</h1>');
      return;
    }

    let workspaceName = 'Trang chủ';
    if (page.workspaceId) {
      const ws = await prisma.workspace.findUnique({ where: { id: page.workspaceId } });
      if (ws) workspaceName = ws.name;
    }

    let theme = 'ocean-breeze';
    let brandConfig: any = null;
    try {
      if (page.layoutJson) {
        const layout = JSON.parse(page.layoutJson as string);
        if (layout.theme) {
          theme = layout.theme;
        }
        if (layout.brandConfig) {
          brandConfig = layout.brandConfig;
        }
      }
    } catch (e) {
      // Ignore
    }

    let btnBg = 'bg-[#f25c22] hover:bg-[#d94d1a]';
    let textAccent = 'text-[#f25c22]';
    let inputFocus = 'focus:border-[#f25c22] focus:ring-2 focus:ring-[#f25c22]/20';
    if (theme === 'saleticket-theme') {
      btnBg = 'bg-sky-600 hover:bg-sky-700';
      textAccent = 'text-sky-600';
      inputFocus = 'focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20';
    } else if (theme === 'education-theme') {
      btnBg = 'bg-[#f05123] hover:bg-[#d94416]';
      textAccent = 'text-[#f05123]';
      inputFocus = 'focus:border-[#f05123] focus:ring-2 focus:ring-[#f05123]/20';
    }

    const contentHtml = `
      <div class="max-w-md mx-auto bg-white border border-slate-200/60 rounded-2xl p-8 shadow-sm">
        <h3 class="text-2xl font-black text-slate-900 text-center mb-2">Đăng ký tài khoản</h3>
        <p class="text-slate-400 text-xs text-center mb-6">Đăng ký để xem thông tin sản phẩm và quản lý đơn hàng.</p>
        
        <form id="public-register-form" class="space-y-4">
          <input type="hidden" id="register-ws-id" value="${page.workspaceId || 0}" />
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1">Họ và Tên</label>
            <input type="text" id="register-name" required class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 text-sm focus:outline-none ${inputFocus}" placeholder="Nguyễn Văn A" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1">Địa chỉ Email</label>
            <input type="email" id="register-email" required class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 text-sm focus:outline-none ${inputFocus}" placeholder="name@email.com" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1">Số điện thoại</label>
            <input type="tel" id="register-phone" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 text-sm focus:outline-none ${inputFocus}" placeholder="0987654321" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1">Công ty / Tổ chức</label>
            <input type="text" id="register-company" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 text-sm focus:outline-none ${inputFocus}" placeholder="Tên công ty của bạn" />
          </div>
          <button type="submit" id="register-submit-btn" class="w-full py-3 ${btnBg} text-white font-bold rounded-lg transition duration-200 shadow-md">
            Tạo tài khoản
          </button>
        </form>
        <p id="register-error-msg" class="text-center mt-4 text-xs text-red-500 hidden"></p>
        <div class="text-center mt-4 text-xs text-slate-500">
          Đã có tài khoản? <a href="/api/public/pages/${slug}/html/login" class="${textAccent} font-bold hover:underline">Đăng nhập</a>
        </div>
      </div>

      <script>
        document.getElementById('public-register-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          const name = document.getElementById('register-name').value;
          const email = document.getElementById('register-email').value;
          const phone = document.getElementById('register-phone').value;
          const company = document.getElementById('register-company').value;
          const wsId = document.getElementById('register-ws-id').value;
          const errorEl = document.getElementById('register-error-msg');
          const submitBtn = document.getElementById('register-submit-btn');

          submitBtn.disabled = true;
          submitBtn.innerText = 'Đang đăng ký...';
          errorEl.classList.add('hidden');

          try {
            const res = await fetch('/api/public/auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, email, phone, company, workspaceId: parseInt(wsId) })
            });
            const result = await res.json();
            if (res.ok && result.success) {
              localStorage.setItem('customerName', result.customer.name);
              localStorage.setItem('customerEmail', result.customer.email);
              window.location.href = '/api/public/pages/${slug}/html';
            } else {
              errorEl.innerText = result.error || 'Đăng ký thất bại.';
              errorEl.classList.remove('hidden');
            }
          } catch (err) {
            errorEl.innerText = 'Lỗi kết nối máy chủ.';
            errorEl.classList.remove('hidden');
          } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Tạo tài khoản';
          }
        });
      </script>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderPage(slug, workspaceName, 'Đăng ký', contentHtml, 'auth', theme, brandConfig));
  } catch (error: any) {
    res.status(500).send('<h1>Lỗi hệ thống</h1>');
  }
});

// Public TikTok Shop Webhook Endpoint
router.post('/tiktokshop/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['x-tts-signature'] as string;
    const body = req.body;

    console.log(`[TikTokShopWebhook] Nhận tín hiệu Webhook: event_type=${body?.type || 'unknown'}`);

    // Verify webhook signature (optional placeholder for real verification)
    const appSecret = process.env.TIKTOK_SHOP_APP_SECRET;
    if (signature && appSecret) {
      const crypto = await import('crypto');
      const calculatedSign = crypto
        .createHmac('sha256', appSecret)
        .update(JSON.stringify(body))
        .digest('hex');
      
      if (signature !== calculatedSign) {
        console.warn('[TikTokShopWebhook] Chữ ký Webhook không hợp lệ.');
        res.status(400).json({ error: 'Chữ ký không hợp lệ' });
        return;
      }
    }

    const eventData = body?.data;
    if (!eventData) {
      res.json({ success: true, message: 'Nhận gói tin ping/test thành công.' });
      return;
    }

    // Extract Order details
    const shopId = body.shop_id || eventData.shop_id || 'tiktok_shop_id';
    const orderId = eventData.order_id || `TT-${Date.now()}`;
    const buyerEmail = (eventData.buyer_email || `buyer-${Date.now()}@tiktok.betraffic.com`).toLowerCase();
    const buyerName = eventData.buyer_name || 'TikTok Shop Buyer';
    const buyerPhone = eventData.buyer_phone || '';
    const totalAmount = eventData.total_amount ? parseFloat(eventData.total_amount) : 0;

    // Find the workspace associated with this TikTok Shop
    const connection = await prisma.socialConnection.findFirst({
      where: { platform: 'tiktokshop', pageId: shopId, status: 'CONNECTED' }
    });

    if (!connection || !connection.workspaceId) {
      console.warn(`[TikTokShopWebhook] Không tìm thấy liên kết Zalo/TikTok Shop cho Shop ID: ${shopId}`);
      res.status(404).json({ error: 'Không tìm thấy liên kết Shop trong hệ thống' });
      return;
    }

    const workspaceId = connection.workspaceId;

    // 1. Upsert Customer in CRM
    let customer = await prisma.customer.findUnique({
      where: { email: buyerEmail }
    });

    if (customer) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          name: buyerName,
          phone: buyerPhone || customer.phone,
          workspaceId
        }
      });
    } else {
      customer = await prisma.customer.create({
        data: {
          name: buyerName,
          email: buyerEmail,
          phone: buyerPhone || null,
          status: 'ACTIVE',
          workspaceId
        }
      });
    }

    await checkAndApplyReferral(customer.id, req);

    // 2. Create Order
    const existingOrder = await prisma.order.findUnique({
      where: { orderNumber: orderId }
    });

    if (!existingOrder) {
      await prisma.order.create({
        data: {
          orderNumber: orderId,
          customerId: customer.id,
          totalAmount,
          status: 'PAID',
          paymentMethod: 'TIKTOKSHOP',
          source: 'TIKTOKSHOP',
          workspaceId
        }
      });
      console.log(`[TikTokShopWebhook] Đã tạo đơn hàng thành công cho khách hàng CRM: ${buyerEmail}`);
    }

    res.json({ success: true, orderId });
  } catch (error: any) {
    console.error('[TikTokShopWebhook Error]:', error);
    res.status(500).json({ error: error.message || 'Lỗi xử lý webhook' });
  }
});

// Public Zalo OA Webhook Endpoint
router.post('/zalo/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;
    console.log(`[ZaloWebhook] Nhận tín hiệu Webhook: event_name=${body?.event_name || 'unknown'}`);
    
    // Zalo webhook validation or ping event
    if (body?.event_name === 'ping') {
      res.json({ success: true, message: 'pong' });
      return;
    }

    // Handle user sending text message
    if (body?.event_name === 'user_send_text') {
      const oaId = body.oa_id || body.recipient?.id;
      const senderId = body.sender?.id;
      const messageText = body.message?.text;

      if (!oaId || !senderId || !messageText) {
        res.status(400).json({ error: 'Thiếu thông tin người gửi, người nhận hoặc nội dung' });
        return;
      }

      // 1. Tìm SocialConnection của Zalo OA để xác định workspaceId và accessToken
      const connection = await prisma.socialConnection.findFirst({
        where: { platform: 'zalo', pageId: oaId, status: 'CONNECTED' }
      });

      if (!connection) {
        console.warn(`[ZaloWebhook] Không tìm thấy liên kết Zalo OA hoạt động cho OA ID: ${oaId}`);
        res.status(404).json({ error: 'Không tìm thấy liên kết Zalo OA' });
        return;
      }

      const workspaceId = connection.workspaceId;
      if (!workspaceId) {
        res.status(400).json({ error: 'Không tìm thấy Workspace ID cho liên kết' });
        return;
      }

      // 2. Tìm hoặc tạo Customer liên kết với Zalo User ID này
      let customer = await prisma.customer.findFirst({
        where: { zaloUserId: senderId, workspaceId }
      });

      if (!customer) {
        // Tạo mock email duy nhất để không vi phạm ràng buộc unique
        const mockEmail = `zalo-user-${senderId}@zalo.betraffic.com`;
        customer = await prisma.customer.create({
          data: {
            name: `Khách hàng Zalo (${senderId.slice(-6)})`,
            email: mockEmail,
            zaloUserId: senderId,
            status: 'NEW',
            workspaceId,
            lastContactAt: new Date()
          }
        });
      } else {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { lastContactAt: new Date() }
        });
      }

      // 3. Tìm hoặc tạo ChatSession cho Customer này trong workspace
      let session = await prisma.chatSession.findFirst({
        where: { customerId: customer.id, workspaceId },
        orderBy: { createdAt: 'desc' }
      });

      if (!session) {
        session = await prisma.chatSession.create({
          data: {
            workspaceId,
            customerId: customer.id
          }
        });
      }

      // 4. Gọi hàm handleVisitorMessage trong cskhService để lưu tin nhắn và gọi AI phản hồi
      const { handleVisitorMessage } = require('../services/cskhService');
      const result = await handleVisitorMessage(
        workspaceId,
        session.id,
        messageText,
        'Zalo_Webhook',
        'Zalo_Bot'
      );

      // 5. Gửi lại phản hồi của AI cho Zalo User qua API OA
      if (result.reply && connection.accessToken) {
        console.log(`[ZaloWebhook] Đang gửi phản hồi AI tới Zalo User ${senderId}: "${result.reply.slice(0, 50)}..."`);
        const zaloRes = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
          method: 'POST',
          headers: {
            access_token: connection.accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            recipient: {
              user_id: senderId
            },
            message: {
              text: result.reply
            }
          })
        });

        const zaloData = await zaloRes.json() as any;
        if (zaloData.error !== 0 && zaloData.error !== undefined) {
          console.error(`[ZaloWebhook] Gửi tin nhắn phản hồi Zalo thất bại:`, zaloData.message || `Code ${zaloData.error}`);
        } else {
          console.log(`[ZaloWebhook] Đã gửi phản hồi Zalo thành công.`);
        }
      }
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('[ZaloWebhook Error]:', error);
    res.status(500).json({ error: error.message || 'Lỗi xử lý webhook' });
  }
});

// Polling status endpoint for client checkout updates
router.get('/orders/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const orderNumber = req.query.orderNumber as string;
    if (!orderNumber) {
      res.status(400).json({ error: 'Thiếu orderNumber' });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: { status: true }
    });

    if (!order) {
      res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
      return;
    }

    res.json({ status: order.status });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi kiểm tra trạng thái đơn hàng' });
  }
});

// Render local VietQR Payment Instruction Page
router.get('/checkout/vietqr', async (req: Request, res: Response): Promise<void> => {
  try {
    const orderNumber = req.query.orderNumber as string;
    if (!orderNumber) {
      res.status(400).send('<h1>Thiếu thông tin mã đơn hàng</h1>');
      return;
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        customer: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!order || !order.workspaceId) {
      res.status(404).send('<h1>Không tìm thấy đơn hàng</h1>');
      return;
    }

    const config = await prisma.paymentConfig.findUnique({
      where: { workspaceId: order.workspaceId }
    });

    if (!config || !config.sepayAccountNumber || !config.sepayBankCode) {
      res.status(400).send('<h1>Cửa hàng chưa cấu hình thông tin ngân hàng SePay</h1>');
      return;
    }

    const product = order.items[0]?.product;
    const productName = product ? product.name : 'Sản phẩm kỹ thuật số';
    const amount = order.totalAmount;
    const acc = config.sepayAccountNumber;
    const bank = config.sepayBankCode;
    const accName = config.sepayAccountName || 'Chủ tài khoản';
    
    // Generate VietQR URL through SePay QR API
    const qrUrl = `https://qr.sepay.vn/img?acc=${acc}&bank=${bank}&amount=${Math.round(amount)}&des=${orderNumber}&template=compact`;

    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thanh toán đơn hàng ${orderNumber}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: radial-gradient(circle at top right, rgba(242, 92, 34, 0.08), transparent 40%),
                  radial-gradient(circle at bottom left, rgba(251, 111, 29, 0.05), transparent 40%),
                  #0f172a;
    }
  </style>
</head>
<body class="text-slate-200 min-h-screen flex items-center justify-center p-4">
  <div class="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
    <!-- Top indicator line -->
    <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#f25c22] to-amber-500"></div>

    <div class="text-center space-y-2 mb-6">
      <div class="text-[#f25c22] font-black text-xl tracking-tight">Growth OS</div>
      <h1 class="text-white font-extrabold text-lg">Cổng Thanh Toán VietQR</h1>
      <p class="text-slate-400 text-xs">Quét mã QR bằng ứng dụng Ngân hàng để thanh toán tự động</p>
    </div>

    <!-- Status indicator (PENDING) -->
    <div id="payment-status-box" class="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-5 mb-5 flex flex-col items-center justify-center relative">
      <!-- Dynamic QR Code Image -->
      <div class="relative bg-white p-3 rounded-2xl shadow-inner border border-slate-100 flex items-center justify-center w-52 h-52 mb-4">
        <img src="${qrUrl}" alt="Mã VietQR Thanh Toán" class="w-full h-full object-contain" />
        <div id="status-overlay" class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center opacity-0 pointer-events-none transition-all duration-300">
          <span class="text-emerald-500 text-4xl mb-2">✓</span>
          <span class="text-white font-bold text-sm">Thanh toán thành công!</span>
        </div>
      </div>

      <!-- Transfer details -->
      <div class="w-full space-y-2.5 text-xs">
        <div class="flex justify-between border-b border-slate-800/50 pb-2 text-slate-400">
          <span>Sản phẩm</span>
          <span class="font-bold text-white max-w-[200px] truncate" title="${productName}">${productName}</span>
        </div>
        <div class="flex justify-between border-b border-slate-800/50 pb-2 text-slate-400">
          <span>Ngân hàng</span>
          <span class="font-bold text-white uppercase">${bank}</span>
        </div>
        <div class="flex justify-between border-b border-slate-800/50 pb-2 text-slate-400">
          <span>Số tài khoản</span>
          <span class="font-bold text-white font-mono tracking-wider flex items-center gap-1">
            ${acc}
            <button onclick="navigator.clipboard.writeText('${acc}'); alert('Đã sao chép số tài khoản');" class="text-xs text-[#f25c22] hover:underline hover:opacity-85 font-semibold">Copy</button>
          </span>
        </div>
        <div class="flex justify-between border-b border-slate-800/50 pb-2 text-slate-400">
          <span>Tên thụ hưởng</span>
          <span class="font-bold text-white uppercase">${accName}</span>
        </div>
        <div class="flex justify-between border-b border-slate-800/50 pb-2 text-slate-400">
          <span>Số tiền chuyển</span>
          <span class="font-black text-[#f25c22] text-sm">${amount.toLocaleString('vi-VN')} VND</span>
        </div>
        <div class="flex justify-between border-b border-slate-800/50 pb-2 text-slate-400 bg-orange-500/10 p-2 rounded-lg border border-orange-500/20">
          <span class="text-orange-400 font-semibold">Nội dung chuyển khoản</span>
          <span class="font-black text-orange-400 font-mono tracking-widest flex items-center gap-2">
            ${orderNumber}
            <button onclick="navigator.clipboard.writeText('${orderNumber}'); alert('Đã sao chép nội dung chuyển khoản');" class="text-xs text-orange-300 hover:underline hover:opacity-85 font-bold">Copy</button>
          </span>
        </div>
      </div>
    </div>

    <!-- Alert / Status message -->
    <div id="helper-text" class="text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span>
        <span>Đang chờ bạn chuyển khoản...</span>
      </div>
      <p class="text-[10px] leading-relaxed text-slate-600 max-w-[300px]">Hệ thống sẽ tự nhận diện giao dịch và chuyển hướng sau khi nhận được tiền (thông thường từ 10s - 30s sau khi chuyển khoản).</p>
    </div>
  </div>

  <script>
    const orderNumber = '${orderNumber}';
    let checkInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/public/orders/status?orderNumber=' + orderNumber);
        const data = await res.json();
        if (data.status === 'PAID') {
          clearInterval(checkInterval);
          
          document.getElementById('status-overlay').classList.remove('opacity-0', 'pointer-events-none');
          document.getElementById('helper-text').innerHTML = \`
            <div class="text-emerald-400 font-bold text-sm flex items-center gap-1.5 justify-center">
              <span>✓ Đã thanh toán đơn hàng thành công!</span>
            </div>
            <p class="text-[10px] text-slate-500">Đang chuẩn bị chuyển hướng bạn về trang chủ...</p>
          \`;
          
          setTimeout(() => {
            window.location.href = '/checkout/success?orderNumber=' + orderNumber;
          }, 3000);
        }
      } catch (err) {
        console.error('Lỗi kiểm tra trạng thái đơn hàng:', err);
      }
    }, 3000);
  </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error: any) {
    res.status(500).send('<h1>Lỗi hệ thống khi khởi tạo cổng thanh toán</h1>');
  }
});

// Route to serve widget.js static file dynamically
router.get('/cskh/widget.js', (req: Request, res: Response) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../public/widget.js');
    if (!fs.existsSync(filePath)) {
      res.status(404).send('// Widget JS not found');
      return;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.send(content);
  } catch (error: any) {
    res.status(500).send('// Error loading widget JS');
  }
});

// Route to get chat widget configuration
router.get('/cskh/widget-config', async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaceId = parseInt(req.query.workspaceId as string, 10);
    if (isNaN(workspaceId)) {
      res.status(400).json({ error: 'workspaceId là bắt buộc và phải là số.' });
      return;
    }

    const config = await prisma.cskhConfig.findUnique({
      where: { workspaceId },
    });

    if (!config) {
      res.json({
        themeColor: '#6366f1',
        themeColor2: '#06b6d4',
        title: 'Hỗ Trợ Khách Hàng AI',
        welcomeMessage: 'Chào bạn! Mình là trợ lý ảo hỗ trợ trực tuyến. Mình có thể giúp gì cho bạn hôm nay?',
        avatarUrl: '',
        botName: 'AI',
        liveChatEnabled: false,
        aiChatbotEnabled: false,
      });
      return;
    }

    let settings = {
      themeColor: '#6366f1',
      themeColor2: '#06b6d4',
      title: 'Hỗ Trợ Khách Hàng AI',
      welcomeMessage: 'Chào bạn! Mình là trợ lý ảo hỗ trợ trực tuyến. Mình có thể giúp gì cho bạn hôm nay?',
      avatarUrl: '',
      botName: 'AI',
    };

    if (config.widgetSettings) {
      try {
        settings = { ...settings, ...JSON.parse(config.widgetSettings) };
      } catch (e) {
        // use defaults
      }
    }

    res.json({
      ...settings,
      liveChatEnabled: config.liveChatEnabled,
      aiChatbotEnabled: config.aiChatbotEnabled,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy cấu hình widget' });
  }
});

// Script delivery route for Lead Capture Popups: GET /api/public/popups/script/:workspaceId
router.get('/popups/script/:workspaceId', async (req: Request, res: Response): Promise<void> => {
  const workspaceId = parseInt(req.params.workspaceId as string);
  if (isNaN(workspaceId)) {
    res.status(400).send('/* Invalid Workspace ID */');
    return;
  }

  try {
    const activePopups = await prisma.popupWidget.findMany({
      where: { workspaceId, isActive: true }
    });

    const host = process.env.NEXT_PUBLIC_API_URL 
      ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '') 
      : (typeof window !== 'undefined' ? window.location.origin.replace(':3000', ':4000') : 'http://localhost:4000');

    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
(function() {
  const workspaceId = ${workspaceId};
  const activePopups = ${JSON.stringify(activePopups)};
  const backendUrl = "${host}";
  
  if (!activePopups || activePopups.length === 0) return;
  
  const shownPopups = new Set();
  
  function createModal(popup) {
    if (shownPopups.has(popup.id)) return;
    shownPopups.add(popup.id);
    
    const fields = popup.formFields.split(',');
    const hasName = fields.includes('name');
    const hasPhone = fields.includes('phone');
    
    const modalId = 'growth-os-popup-' + popup.id;
    if (document.getElementById(modalId)) return;
    
    const backdrop = document.createElement('div');
    backdrop.id = modalId;
    backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);z-index:999999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.3s ease;font-family:system-ui, -apple-system, sans-serif;';
    
    const modal = document.createElement('div');
    modal.style.cssText = 'background:#fff;border-radius:24px;width:100%;max-width:440px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);overflow:hidden;transform:scale(0.95);transition:transform 0.3s ease;border:1px solid rgba(226,232,240,0.8);position:relative;margin:16px;';
    
    const banner = document.createElement('div');
    banner.style.cssText = 'height:8px;background:' + (popup.themeColor || '#f25c22') + ';';
    modal.appendChild(banner);
    
    const content = document.createElement('div');
    content.style.cssText = 'padding:32px;';
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&#x2715;';
    closeBtn.style.cssText = 'position:absolute;top:16px;right:16px;background:none;border:none;font-size:16px;cursor:pointer;color:#94a3b8;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:background 0.2s;';
    closeBtn.onmouseover = () => closeBtn.style.background = '#f1f5f9';
    closeBtn.onmouseout = () => closeBtn.style.background = 'none';
    closeBtn.onclick = () => {
      backdrop.style.opacity = '0';
      modal.style.transform = 'scale(0.95)';
      setTimeout(() => backdrop.remove(), 300);
    };
    modal.appendChild(closeBtn);
    
    const title = document.createElement('h3');
    title.innerText = popup.title;
    title.style.cssText = 'margin:0 0 8px 0;font-size:20px;font-weight:850;color:#1e293b;line-height:1.3;';
    content.appendChild(title);
    
    const desc = document.createElement('p');
    desc.innerText = popup.description;
    desc.style.cssText = 'margin:0 0 24px 0;font-size:13px;color:#64748b;line-height:1.6;';
    content.appendChild(desc);
    
    const form = document.createElement('form');
    form.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
    
    let nameInput;
    if (hasName) {
      nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = 'Họ và tên';
      nameInput.required = true;
      nameInput.style.cssText = 'padding:12px 16px;border-radius:12px;border:1px solid #cbd5e1;font-size:13px;outline:none;transition:border-color 0.2s;';
      nameInput.onfocus = () => nameInput.style.borderColor = popup.themeColor;
      nameInput.onblur = () => nameInput.style.borderColor = '#cbd5e1';
      form.appendChild(nameInput);
    }
    
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.placeholder = 'Địa chỉ email';
    emailInput.required = true;
    emailInput.style.cssText = 'padding:12px 16px;border-radius:12px;border:1px solid #cbd5e1;font-size:13px;outline:none;transition:border-color 0.2s;';
    emailInput.onfocus = () => emailInput.style.borderColor = popup.themeColor;
    emailInput.onblur = () => emailInput.style.borderColor = '#cbd5e1';
    form.appendChild(emailInput);
    
    let phoneInput;
    if (hasPhone) {
      phoneInput = document.createElement('input');
      phoneInput.type = 'tel';
      phoneInput.placeholder = 'Số điện thoại';
      phoneInput.required = true;
      phoneInput.style.cssText = 'padding:12px 16px;border-radius:12px;border:1px solid #cbd5e1;font-size:13px;outline:none;transition:border-color 0.2s;';
      phoneInput.onfocus = () => phoneInput.style.borderColor = popup.themeColor;
      phoneInput.onblur = () => phoneInput.style.borderColor = '#cbd5e1';
      form.appendChild(phoneInput);
    }
    
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.innerText = popup.buttonText || 'Đăng ký';
    submitBtn.style.cssText = 'padding:14px;border-radius:12px;border:none;background:' + (popup.themeColor || '#f25c22') + ';color:#fff;font-weight:700;font-size:14px;cursor:pointer;transition:brightness 0.2s;margin-top:8px;';
    submitBtn.onmouseover = () => submitBtn.style.filter = 'brightness(0.9)';
    submitBtn.onmouseout = () => submitBtn.style.filter = 'none';
    form.appendChild(submitBtn);
    
    form.onsubmit = (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      submitBtn.innerText = 'Đang gửi...';
      
      const payload = {
        workspaceId: workspaceId,
        popupId: popup.id,
        email: emailInput.value,
        name: hasName ? nameInput.value : '',
        phone: hasPhone ? phoneInput.value : '',
      };
      
      fetch(backendUrl + '/api/public/popups/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        content.innerHTML = '<div style="text-align:center;padding:16px 0;"><div style="font-size:48px;margin-bottom:16px;">🎉</div><h3 style="margin:0 0 8px 0;font-size:20px;font-weight:800;color:#1e293b;">Cảm ơn bạn!</h3><p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">Đăng ký thông tin thành công.</p></div>';
        setTimeout(() => {
          backdrop.style.opacity = '0';
          modal.style.transform = 'scale(0.95)';
          setTimeout(() => backdrop.remove(), 300);
        }, 3000);
      })
      .catch(err => {
        console.error('Error submitting lead:', err);
        submitBtn.disabled = false;
        submitBtn.innerText = popup.buttonText || 'Đăng ký';
        alert('Có lỗi xảy ra, vui lòng thử lại sau.');
      });
    };
    
    content.appendChild(form);
    modal.appendChild(content);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    
    setTimeout(() => {
      backdrop.style.opacity = '1';
      modal.style.transform = 'scale(1)';
    }, 50);
  }
  
  activePopups.forEach(popup => {
    if (popup.type === 'DELAY') {
      setTimeout(() => createModal(popup), (popup.delaySeconds || 5) * 1000);
    } else if (popup.type === 'SCROLL') {
      const onScroll = () => {
        const docEl = document.documentElement;
        const scrollPercent = (docEl.scrollTop / (docEl.scrollHeight - docEl.clientHeight)) * 100;
        if (scrollPercent >= (popup.scrollDepth || 50)) {
          createModal(popup);
          window.removeEventListener('scroll', onScroll);
        }
      };
      window.addEventListener('scroll', onScroll);
    } else if (popup.type === 'EXIT_INTENT') {
      const onMouseOut = (e) => {
        if (e.clientY < 15) {
          createModal(popup);
          document.removeEventListener('mouseout', onMouseOut);
        }
      };
      document.addEventListener('mouseout', onMouseOut);
    }
  });
})();
    `);
  } catch (error: any) {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`/* Error loading Popups: ${error.message} */`);
  }
});

// Lead Submission endpoint for Popups: POST /api/public/popups/submit
router.post('/popups/submit', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, popupId, email, name, phone } = req.body;
  if (!email || !workspaceId) {
    res.status(400).json({ error: 'Email và Workspace ID là bắt buộc' });
    return;
  }
  try {
    const wsId = parseInt(workspaceId);
    
    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: { email: email.toLowerCase(), workspaceId: wsId }
    });
    
    const popup = await prisma.popupWidget.findUnique({
      where: { id: parseInt(popupId) }
    });
    
    const sourceName = popup ? `Lead Popup: ${popup.name}` : 'Lead Capture Popup';
    
    if (customer) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          name: name || customer.name,
          phone: phone || customer.phone,
          trafficSource: sourceName,
        }
      });
    } else {
      customer = await prisma.customer.create({
        data: {
          name: name || email.split('@')[0],
          email: email.toLowerCase(),
          phone: phone || null,
          status: 'NEW',
          workspaceId: wsId,
          trafficSource: sourceName,
        }
      });
    }

    await checkAndApplyReferral(customer.id, req);
    
    res.json({ success: true, message: 'Đăng ký thành công!' });
  } catch (error: any) {
    console.error('[POST /public/popups/submit]', error);
    res.status(500).json({ error: error.message || 'Lỗi máy chủ' });
  }
});

export default router;

