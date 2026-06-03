import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { discoverBacklinksFromUrl } from '../services/backlinkDiscover';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';
import { auditAllBacklinks } from '../workers/backlinkAuditorEngine';
import { fetchMozMetrics } from '../services/mozService';

/** Đăng ký thêm ở index.ts để tránh 404 khi process backend cũ / mount router lỗi */
export async function discoverBacklinksHandler(req: AuthRequest, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown> | undefined;
  const q = req.query as Record<string, string | undefined>;
  const targetUrl = String(body?.targetUrl ?? q.targetUrl ?? '').trim();
  const scanUrlRaw = body?.scanUrl ?? q.scanUrl;
  const scanUrl = scanUrlRaw != null && String(scanUrlRaw).trim() ? String(scanUrlRaw).trim() : undefined;

  if (!targetUrl) {
    res.status(400).json({ error: 'targetUrl (URL site của bạn) là bắt buộc' });
    return;
  }
  try {
    const result = await discoverBacklinksFromUrl(targetUrl, scanUrl, req.workspaceId);
    res.json({
      message: `Quét xong: ${result.discovered} liên kết ngoài, thêm mới ${result.created}`,
      ...result,
    });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Quét thất bại' });
  }
}

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const links = await prisma.backlink.findMany({
    where: { workspaceId: req.workspaceId },
    orderBy: { discoveredAt: 'desc' }
  });
  res.json(links);
});

router.post('/audit-now', requireWrite, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    void auditAllBacklinks();
    res.json({ message: 'Đã kích hoạt quét kiểm tra chất lượng backlink tự động.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** Fallback POST discover (cùng handler; route chính: GET/POST /api/backlinks/scan ở index.ts) */
router.post('/discover', requireWrite, discoverBacklinksHandler);

function isDiscoverRequest(body: Record<string, unknown> | undefined): boolean {
  if (!body) return false;
  if (body.action === 'discover') return true;
  const target = String(body.targetUrl ?? '').trim();
  const source = String(body.sourceUrl ?? '').trim();
  return Boolean(target) && !source;
}

router.post('/', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  if (isDiscoverRequest(req.body as Record<string, unknown>)) {
    await discoverBacklinksHandler(req, res);
    return;
  }

  const { sourceUrl, targetUrl, domainAuthority, linkType, status } = req.body;
  if (!sourceUrl || !targetUrl) {
    res.status(400).json({ error: 'sourceUrl và targetUrl là bắt buộc' });
    return;
  }
  const link = await prisma.backlink.create({
    data: {
      sourceUrl,
      targetUrl,
      domainAuthority: domainAuthority ? parseInt(domainAuthority) : null,
      linkType: linkType || 'inbound',
      status: status || 'active',
      workspaceId: req.workspaceId,
    },
  });
  res.status(201).json(link);
});

router.patch('/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const existing = await prisma.backlink.findFirst({
    where: { id, workspaceId: req.workspaceId }
  });
  if (!existing) {
    res.status(404).json({ error: 'Không tìm thấy backlink' });
    return;
  }
  const link = await prisma.backlink.update({ where: { id }, data: req.body });
  res.json(link);
});

router.post('/:id/estimate-da', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const link = await prisma.backlink.findFirst({
    where: { id, workspaceId: req.workspaceId }
  });
  if (!link) {
    res.status(404).json({ error: 'Không tìm thấy' });
    return;
  }

  let host = 'unknown';
  try {
    host = new URL(link.sourceUrl).hostname;
  } catch {
    // Fallback: strip protocols and grab first section before slash
    const stripped = link.sourceUrl.replace(/^(https?:\/\/)?(www\.)?/, '');
    host = stripped.split('/')[0] || 'unknown';
  }
  const tld = host.split('.').pop()?.toLowerCase() || '';

  let domainAuthority = ['edu', 'gov'].includes(tld) ? 48 : ['org'].includes(tld) ? 35 : 28;
  let pageAuthority: number | null = null;
  let estimated = true;
  let message = 'DA ước lượng theo TLD — thêm MOZ_ACCESS_ID + MOZ_SECRET_KEY cho DA chính xác.';

  const mozConfigured = !!(process.env.MOZ_ACCESS_ID && process.env.MOZ_SECRET_KEY);
  if (mozConfigured) {
    const realMetrics = await fetchMozMetrics(link.sourceUrl, link.workspaceId || (req as any).workspaceId);
    if (realMetrics) {
      domainAuthority = realMetrics.domainAuthority;
      pageAuthority = realMetrics.pageAuthority;
      estimated = false;
      message = 'Đã cập nhật chỉ số DA & PA thực tế từ Moz API.';
    } else {
      domainAuthority = Math.min(60, domainAuthority + 5);
      message = 'Lỗi truy vấn Moz API, sử dụng DA ước lượng.';
    }
  }

  const updated = await prisma.backlink.update({
    where: { id },
    data: { domainAuthority, pageAuthority },
  });
  res.json({
    link: updated,
    estimated,
    message,
  });
});

router.delete('/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const existing = await prisma.backlink.findFirst({
    where: { id, workspaceId: req.workspaceId }
  });
  if (!existing) {
    res.status(404).json({ error: 'Không tìm thấy backlink' });
    return;
  }
  await prisma.backlink.delete({ where: { id } });
  res.status(204).send();
});

export default router;
