import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';

const router = Router();

// ==========================================
// PRODUCTS ENDPOINTS
// ==========================================

// Get list of products
router.get('/products', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      where: { workspaceId: req.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(products);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy danh sách sản phẩm' });
  }
});

// Create product
router.post('/products', authenticate, requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, price, currency } = req.body;
    if (!name || price == null) {
      res.status(400).json({ error: 'Tên sản phẩm và giá là bắt buộc' });
      return;
    }

    const product = await prisma.product.create({
      data: {
        name,
        description: description || null,
        price: parseFloat(price),
        currency: currency || 'VND',
        workspaceId: req.workspaceId,
      },
    });

    res.status(201).json(product);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi tạo sản phẩm mới' });
  }
});

// Update product
router.put('/products/:id', authenticate, requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, description, price, currency } = req.body;

    const existing = await prisma.product.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
      return;
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        description: description !== undefined ? description : existing.description,
        price: price !== undefined ? parseFloat(price) : existing.price,
        currency: currency !== undefined ? currency : existing.currency,
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi cập nhật sản phẩm' });
  }
});

// Delete product
router.delete('/products/:id', authenticate, requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const existing = await prisma.product.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
      return;
    }
    await prisma.product.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi xóa sản phẩm' });
  }
});

// ==========================================
// ORDERS ENDPOINTS
// ==========================================

// Get list of orders
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orders = await prisma.order.findMany({
      where: { workspaceId: req.workspaceId },
      include: { customer: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy danh sách đơn hàng' });
  }
});

// Get order details
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const order = await prisma.order.findFirst({
      where: { id, workspaceId: req.workspaceId },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });
    if (!order) {
      res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
      return;
    }
    res.json(order);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy chi tiết đơn hàng' });
  }
});

// Create new order (e.g. initiated by Customer Checkout from Sales Page)
router.post('/', authenticate, requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { customerEmail, customerName, totalAmount, items } = req.body;
    if (!customerEmail || !totalAmount || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'customerEmail, totalAmount và danh sách items là bắt buộc' });
      return;
    }

    // 1. Find or create customer
    let customer = await prisma.customer.findUnique({
      where: { email: customerEmail.toLowerCase() },
    });

    if (customer) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          name: customerName || customer.name,
          workspaceId: req.workspaceId || customer.workspaceId,
        },
      });
    } else {
      customer = await prisma.customer.create({
        data: {
          name: customerName || customerEmail.split('@')[0],
          email: customerEmail.toLowerCase(),
          status: 'NEW',
          workspaceId: req.workspaceId,
        },
      });
    }

    // 2. Generate a unique orderNumber
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

    // 3. Create Order & OrderItems in database transaction
    const newOrder = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          totalAmount: parseFloat(totalAmount),
          status: 'PENDING',
          workspaceId: req.workspaceId || 0,
        },
      });

      for (const item of items) {
        await tx.orderItem.create({
          data: {
            orderId: createdOrder.id,
            productId: parseInt(item.productId),
            quantity: parseInt(item.quantity) || 1,
            price: parseFloat(item.price),
          },
        });
      }

      return createdOrder;
    });

    // Return the full populated order
    const populated = await prisma.order.findUnique({
      where: { id: newOrder.id },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    res.status(201).json(populated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi tạo đơn hàng' });
  }
});

export default router;
