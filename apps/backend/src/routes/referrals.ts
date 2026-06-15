import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createSmtpTransporter } from '../lib/smtp';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-free-traffic-key';

// Global memory store for customer OTPs
// In production, this can be Redis or cached. Here it is a fast memory store
const otpStore = new Map<string, { otp: string; expires: number }>();

function generateReferralCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "9D8A2B3C"
}

/**
 * Helper: Applies referral points to referrer if ref_customer_id cookie is present.
 */
export async function checkAndApplyReferral(customerId: number, req: Request) {
  try {
    const cookiesStr = req.headers.cookie || '';
    const cookies = Object.fromEntries(
      cookiesStr.split(';').map((c) => {
        const parts = c.trim().split('=');
        return [parts[0], parts.slice(1).join('=')];
      })
    );

    const referrerIdVal = cookies['ref_customer_id'];
    if (referrerIdVal) {
      const referrerId = parseInt(referrerIdVal, 10);
      if (!isNaN(referrerId)) {
        // Verify customer exists
        const customer = await prisma.customer.findUnique({ where: { id: customerId } });
        if (customer && !customer.referredById && customer.id !== referrerId) {
          // Award 100 points
          await prisma.customer.update({
            where: { id: referrerId },
            data: { pointsBalance: { increment: 100 } },
          });
          // Update customer's referredById
          await prisma.customer.update({
            where: { id: customerId },
            data: { referredById: referrerId },
          });
          console.log(`[Referral Loop] Customer ${customerId} referred by customer ${referrerId}. Awarded 100 points.`);
        }
      }
    }
  } catch (err) {
    console.error('Error applying referral:', err);
  }
}

// ==========================================
// ADMIN PORTAL ROUTES (Requires JWT auth)
// ==========================================

// GET /api/referrals/stats - Get campaign metrics
router.get('/stats', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      res.status(400).json({ error: 'Workspace ID là bắt buộc' });
      return;
    }

    // Recent referrers (customers with pointsBalance > 0 or who have referred others)
    const topReferrers = await prisma.customer.findMany({
      where: {
        workspaceId,
        OR: [
          { pointsBalance: { gt: 0 } },
          { referrals: { some: {} } }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        pointsBalance: true,
        referralCode: true,
        createdAt: true,
        _count: {
          select: { referrals: true }
        }
      },
      orderBy: {
        pointsBalance: 'desc'
      },
      take: 10
    });

    // Recent redemptions
    const recentRedemptions = await prisma.referralRedemption.findMany({
      where: {
        customer: { workspaceId }
      },
      include: {
        customer: {
          select: { name: true, email: true }
        },
        product: {
          select: { name: true, price: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    res.json({
      topReferrers,
      recentRedemptions,
      config: {
        pointsPerSignup: 100,
        pointsPerRedemption: 500
      }
    });
  } catch (err: any) {
    console.error('Failed to load referral stats:', err);
    res.status(500).json({ error: err.message || 'Lỗi tải thống kê tiếp thị lan truyền' });
  }
});

// ==========================================
// PUBLIC CUSTOMER PORTAL ROUTES
// ==========================================

// GET /api/referrals/public/ref/:code - Record referral and redirect
router.get('/public/ref/:code', async (req: Request, res: Response): Promise<void> => {
  try {
    const code = String(req.params.code).trim().toUpperCase();
    const referrer = await prisma.customer.findUnique({
      where: { referralCode: code },
    });

    // Set cookie that expires in 30 days
    if (referrer) {
      res.cookie('ref_customer_id', String(referrer.id), {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        path: '/',
      });
      console.log(`[Referral Loop] Cookie set for referrer customer ID: ${referrer.id}`);
    }

    const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(redirectUrl);
  } catch (err: any) {
    res.status(500).send('Error handling referral link redirection');
  }
});

// POST /api/referrals/public/send-otp - Sends login OTP to Customer
router.post('/public/send-otp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, workspaceId } = req.body;
    if (!email || !workspaceId) {
      res.status(400).json({ error: 'Email và Workspace ID là bắt buộc' });
      return;
    }

    const targetWorkspaceId = parseInt(String(workspaceId), 10);
    if (isNaN(targetWorkspaceId)) {
      res.status(400).json({ error: 'Workspace ID không hợp lệ' });
      return;
    }

    // Lookup or create customer
    let customer = await prisma.customer.findFirst({
      where: { email: email.toLowerCase(), workspaceId: targetWorkspaceId },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: email.split('@')[0],
          email: email.toLowerCase(),
          workspaceId: targetWorkspaceId,
          referralCode: generateReferralCode(),
          pointsBalance: 0,
        },
      });
    } else if (!customer.referralCode) {
      // Self-heal: generate code if missing
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { referralCode: generateReferralCode() },
      });
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    const key = `${email.toLowerCase()}-${targetWorkspaceId}`;
    otpStore.set(key, { otp, expires });

    console.log(`[OTP] Generated OTP for customer ${email}: ${otp}`);

    // Try sending email via workspace/global SMTP
    let emailSent = false;
    try {
      const transporter = await createSmtpTransporter(targetWorkspaceId);
      if (transporter) {
        const fromEmail = process.env.SMTP_USER || 'noreply@growthos.vn';
        await transporter.sendMail({
          from: `"Growth OS Portal" <${fromEmail}>`,
          to: email,
          subject: 'Mã xác thực OTP đăng nhập Cổng phần thưởng',
          html: `
            <div style="font-family: sans-serif; padding: 24px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; rounded: 12px;">
              <h2 style="color: #e85d26; font-size: 20px;">Xác nhận OTP đăng nhập Cổng phần thưởng</h2>
              <p>Xin chào,</p>
              <p>Mã xác thực OTP của bạn là:</p>
              <div style="font-size: 28px; font-weight: bold; background: #f9f9f9; padding: 16px; text-align: center; border-radius: 8px; letter-spacing: 4px; border: 1px solid #ddd; margin: 20px 0; color: #111;">
                ${otp}
              </div>
              <p style="font-size: 13px; color: #666;">Mã này có hiệu lực trong vòng 10 phút. Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="font-size: 11px; color: #999; text-align: center;">Được vận hành bởi Growth OS</p>
            </div>
          `,
        });
        emailSent = true;
      }
    } catch (mailErr) {
      console.error('Nodemailer send failed, using fallback console log:', mailErr);
    }

    // Development fallback response
    if (process.env.NODE_ENV !== 'production' || !emailSent) {
      res.json({
        message: 'Mã OTP đã được gửi thành công.',
        otp: process.env.NODE_ENV !== 'production' ? otp : undefined, // only leak OTP in dev mode
      });
    } else {
      res.json({ message: 'Mã OTP đã được gửi về hòm thư của bạn.' });
    }
  } catch (err: any) {
    console.error('OTP Send error:', err);
    res.status(500).json({ error: err.message || 'Lỗi gửi mã OTP' });
  }
});

// POST /api/referrals/public/verify-otp - Verify OTP and return session token
router.post('/public/verify-otp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp, workspaceId } = req.body;
    if (!email || !otp || !workspaceId) {
      res.status(400).json({ error: 'Email, OTP và Workspace ID là bắt buộc' });
      return;
    }

    const targetWorkspaceId = parseInt(String(workspaceId), 10);
    const key = `${email.toLowerCase()}-${targetWorkspaceId}`;
    const stored = otpStore.get(key);

    if (!stored) {
      res.status(400).json({ error: 'Không tìm thấy mã OTP hoặc mã đã hết hạn' });
      return;
    }

    if (Date.now() > stored.expires) {
      otpStore.delete(key);
      res.status(400).json({ error: 'Mã OTP đã hết hạn' });
      return;
    }

    if (stored.otp !== String(otp).trim()) {
      res.status(400).json({ error: 'Mã OTP không chính xác' });
      return;
    }

    // Success: delete OTP
    otpStore.delete(key);

    // Fetch customer details
    const customer = await prisma.customer.findFirst({
      where: { email: email.toLowerCase(), workspaceId: targetWorkspaceId },
    });

    if (!customer) {
      res.status(404).json({ error: 'Không tìm thấy thông tin khách hàng' });
      return;
    }

    // Create session token
    const token = jwt.sign(
      { customerId: customer.id, email: customer.email, workspaceId: customer.workspaceId, role: 'customer' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Xác thực OTP thành công',
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        pointsBalance: customer.pointsBalance,
        referralCode: customer.referralCode,
      },
    });
  } catch (err: any) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: err.message || 'Lỗi xác thực OTP' });
  }
});

// Customer Token Authentication Middleware
async function authenticateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Quyền truy cập bị từ chối. Token không tồn tại.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'customer') {
      res.status(403).json({ error: 'Token không hợp lệ cho cổng thông tin khách hàng' });
      return;
    }
    (req as any).customer = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
  }
}

// GET /api/referrals/public/portal-data - Returns point balance, referral link, products
router.get('/public/portal-data', authenticateCustomer, async (req: Request, res: Response): Promise<void> => {
  try {
    const decoded = (req as any).customer;
    const customer = await prisma.customer.findUnique({
      where: { id: decoded.customerId },
      include: {
        referrals: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
      },
    });

    if (!customer) {
      res.status(404).json({ error: 'Khách hàng không tồn tại' });
      return;
    }

    // Fetch redeemable products from same workspace
    const products = await prisma.product.findMany({
      where: { workspaceId: customer.workspaceId },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
      },
    });

    // Check existing redemptions
    const redemptions = await prisma.referralRedemption.findMany({
      where: { customerId: customer.id },
      include: {
        product: {
          select: { name: true },
        },
      },
    });

    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        pointsBalance: customer.pointsBalance,
        referralCode: customer.referralCode,
      },
      referrals: customer.referrals,
      products: products.map((p) => ({
        ...p,
        pointsRequired: 500, // flat rate of 500 points
      })),
      redemptions: redemptions.map((r) => ({
        id: r.id,
        productId: r.productId,
        productName: r.product.name,
        pointsSpent: r.pointsSpent,
        downloadToken: r.downloadToken,
        createdAt: r.createdAt,
      })),
    });
  } catch (err: any) {
    console.error('Failed to load portal data:', err);
    res.status(500).json({ error: err.message || 'Lỗi tải dữ liệu cổng phần thưởng' });
  }
});

// POST /api/referrals/public/redeem - Spends points to redeem product
router.post('/public/redeem', authenticateCustomer, async (req: Request, res: Response): Promise<void> => {
  try {
    const decoded = (req as any).customer;
    const { productId } = req.body;

    if (!productId) {
      res.status(400).json({ error: 'ID sản phẩm là bắt buộc' });
      return;
    }

    const prodId = parseInt(String(productId), 10);
    if (isNaN(prodId)) {
      res.status(400).json({ error: 'ID sản phẩm không hợp lệ' });
      return;
    }

    const customer = await prisma.customer.findUnique({
      where: { id: decoded.customerId },
    });

    if (!customer) {
      res.status(404).json({ error: 'Khách hàng không tồn tại' });
      return;
    }

    // Verify product exists and belongs to the workspace
    const product = await prisma.product.findFirst({
      where: { id: prodId, workspaceId: customer.workspaceId },
    });

    if (!product) {
      res.status(404).json({ error: 'Không tìm thấy sản phẩm trao thưởng' });
      return;
    }

    const pointsRequired = 500;
    if (customer.pointsBalance < pointsRequired) {
      res.status(400).json({ error: `Số điểm của bạn (${customer.pointsBalance}) không đủ để quy đổi sản phẩm này (cần ${pointsRequired} điểm)` });
      return;
    }

    // Create redemption and deduct points in a transaction
    const downloadToken = crypto.randomBytes(16).toString('hex');

    const [updatedCustomer, redemption] = await prisma.$transaction([
      prisma.customer.update({
        where: { id: customer.id },
        data: {
          pointsBalance: { decrement: pointsRequired },
        },
      }),
      prisma.referralRedemption.create({
        data: {
          customerId: customer.id,
          productId: product.id,
          pointsSpent: pointsRequired,
          downloadToken,
        },
      }),
    ]);

    res.json({
      message: 'Quy đổi phần thưởng thành công!',
      newPointsBalance: updatedCustomer.pointsBalance,
      redemption: {
        id: redemption.id,
        productId: redemption.productId,
        productName: product.name,
        downloadToken: redemption.downloadToken,
      },
    });
  } catch (err: any) {
    console.error('Redeem error:', err);
    res.status(500).json({ error: err.message || 'Lỗi quy đổi phần thưởng' });
  }
});

// GET /api/referrals/public/download/:token - Download redeemed lead magnet file
router.get('/public/download/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const token = String(req.params.token).trim();
    const redemption = await prisma.referralRedemption.findUnique({
      where: { downloadToken: token },
      include: {
        product: true,
      },
    });

    if (!redemption) {
      res.status(404).send('Mã tải xuống không hợp lệ hoặc đã hết hạn.');
      return;
    }

    // Send a professional mock PDF content
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="GrowthOS-${redemption.product.name.replace(/\s+/g, '-')}-LeadMagnet.txt"`);
    
    const docContent = `
=========================================
GROWTH OS LEAD MAGNET REWARD DOCUMENT
=========================================
Chúc mừng bạn đã tích lũy điểm và quy đổi thành công phần thưởng từ đối tác Growth OS!

Tài liệu: ${redemption.product.name}
Mô tả: ${redemption.product.description || 'Nội dung kiến thức chuyên sâu'}
Mã giao dịch quy đổi: ${redemption.downloadToken}
Ngày quy đổi: ${redemption.createdAt.toLocaleDateString('vi-VN')}

Nội dung phần thưởng:
Đây là tài liệu/phần mềm độc quyền được mở khóa cho bạn. Hãy sử dụng những kiến thức này để đột phá lưu lượng truy cập và tối ưu hóa hệ thống tiếp thị số của doanh nghiệp bạn.

Để được hỗ trợ thêm, vui lòng liên hệ Ban quản trị qua hệ thống Growth OS CRM.
Cảm ơn bạn đã đồng hành cùng chúng tôi!
=========================================
    `;
    res.send(docContent);
  } catch (err: any) {
    res.status(500).send('Lỗi máy chủ trong quá trình tải xuống tài liệu.');
  }
});

export default router;
