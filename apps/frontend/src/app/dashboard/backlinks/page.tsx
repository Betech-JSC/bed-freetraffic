'use client';

import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Cell
} from 'recharts';

type Link = {
  id: number;
  sourceUrl: string;
  targetUrl: string;
  domainAuthority: number | null;
  linkType: string;
  status: string;
  discoveredAt?: string;
};

export default function BacklinksPage() {
  const [links, setLinks] = useState<Link[]>([]);
  const { t } = useLocale();
  const [form, setForm] = useState({
    sourceUrl: '',
    targetUrl: '',
    domainAuthority: '',
    linkType: 'inbound',
    status: 'active',
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Single Discover states
  const [discoverTarget, setDiscoverTarget] = useState('');
  const [discoverScan, setDiscoverScan] = useState('');
  const [discovering, setDiscovering] = useState(false);
  
  // Bulk Scan states
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkTarget, setBulkTarget] = useState('');
  const [bulkUrlsText, setBulkUrlsText] = useState('');
  const [bulkScanning, setBulkScanning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    total: number;
    current: number;
    logs: { url: string; status: 'success' | 'failed'; message: string }[];
  } | null>(null);

  // Filters & Sorting states
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterDa, setFilterDa] = useState('all');
  const [sortBy, setSortBy] = useState('date'); // date | da | sourceUrl
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = () =>
    apiJson<Link[]>('/backlinks')
      .then(setLinks)
      .catch((e) => setError(e instanceof Error ? e.message : 'Lỗi tải'));

  useEffect(() => {
    load();
    fetch('/api/health')
      .then((r) => r.json())
      .then((h: { apiVersion?: string; features?: string[] }) => {
        if (!h.features?.includes('backlinks-scan')) {
          setError(
            `Backend chưa cập nhật (thiếu quét backlink). Tắt terminal backend cũ, chạy lại: npm run dev -w apps/backend. Cần apiVersion có backlinks-scan (hiện: ${h.apiVersion ?? 'không rõ'}).`
          );
        }
      })
      .catch(() => {
        setError('Không kết nối được API (:4000). Chạy: npm run dev -w apps/backend');
      });
  }, []);

  const resetForm = () => {
    setForm({ sourceUrl: '', targetUrl: '', domainAuthority: '', linkType: 'inbound', status: 'active' });
    setEditingId(null);
  };

  const startEdit = (l: Link) => {
    setEditingId(l.id);
    setForm({
      sourceUrl: l.sourceUrl,
      targetUrl: l.targetUrl,
      domainAuthority: l.domainAuthority?.toString() ?? '',
      linkType: l.linkType,
      status: l.status,
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = {
      ...form,
      domainAuthority: form.domainAuthority ? parseInt(form.domainAuthority, 10) : null,
    };
    try {
      if (editingId) {
        await apiJson(`/backlinks/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setSuccess('Đã cập nhật thông tin backlink.');
      } else {
        await apiJson('/backlinks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setSuccess('Đã thêm backlink mới.');
      }
      resetForm();
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không lưu được');
    }
  };

  const discover = async (e: React.FormEvent) => {
    e.preventDefault();
    setDiscovering(true);
    setError('');
    setSuccess('');
    try {
      const target = discoverTarget.trim();
      const scan = discoverScan.trim();
      const qs = new URLSearchParams({ targetUrl: target });
      if (scan) qs.set('scanUrl', scan);
      const r = await apiJson<{ message: string; created: number; discovered: number }>(
        `/backlinks/scan?${qs.toString()}`
      );
      setSuccess(r.message);
      setDiscoverTarget('');
      setDiscoverScan('');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Quét thất bại');
    } finally {
      setDiscovering(false);
    }
  };

  // Bulk scan logic (Frontend queue executor)
  const executeBulkScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = bulkTarget.trim();
    if (!target) {
      setError('Vui lòng nhập URL site của bạn.');
      return;
    }
    const urls = bulkUrlsText
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (urls.length === 0) {
      setError('Vui lòng nhập ít nhất một URL nguồn.');
      return;
    }

    setBulkScanning(true);
    setError('');
    setSuccess('');
    setBulkProgress({ total: urls.length, current: 0, logs: [] });

    for (let i = 0; i < urls.length; i++) {
      const scanUrl = urls[i];
      setBulkProgress((prev) => prev ? { ...prev, current: i + 1 } : null);
      try {
        const qs = new URLSearchParams({ targetUrl: target, scanUrl });
        const r = await apiJson<{ message: string; created: number; discovered: number }>(
          `/backlinks/scan?${qs.toString()}`
        );
        setBulkProgress((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            logs: [
              ...prev.logs,
              {
                url: scanUrl,
                status: 'success',
                message: `Phát hiện: ${r.discovered} links (Thêm mới: ${r.created})`,
              },
            ],
          };
        });
      } catch (err: unknown) {
        setBulkProgress((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            logs: [
              ...prev.logs,
              {
                url: scanUrl,
                status: 'failed',
                message: err instanceof Error ? err.message : 'Lỗi cào quét',
              },
            ],
          };
        });
      }
      // Quick list reload after each scan completes to show real-time changes
      load();
    }

    setBulkScanning(false);
    setSuccess(`Đã quét xong danh sách ${urls.length} trang nguồn.`);
  };

  const remove = async (id: number) => {
    if (!confirm('Xóa backlink này?')) return;
    try {
      await apiJson(`/backlinks/${id}`, { method: 'DELETE' });
      if (editingId === id) resetForm();
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không xóa được');
    }
  };

  // Compute stats
  const totalBacklinks = links.length;
  const activeBacklinks = links.filter((l) => l.status === 'active').length;
  const lostBacklinks = links.filter((l) => l.status === 'lost').length;
  const pendingBacklinks = links.filter((l) => l.status === 'pending').length;

  const daLinks = links.filter((l) => l.domainAuthority !== null);
  const avgDa =
    daLinks.length > 0
      ? Math.round(daLinks.reduce((sum, l) => sum + (l.domainAuthority || 0), 0) / daLinks.length)
      : '—';

  // Chart Data preparation
  const daRangesData = [
    { name: 'Yếu (<30)', count: links.filter((l) => l.domainAuthority !== null && l.domainAuthority < 30).length, color: '#f43f5e' },
    { name: 'Trung bình (30-49)', count: links.filter((l) => l.domainAuthority !== null && l.domainAuthority >= 30 && l.domainAuthority < 50).length, color: '#f59e0b' },
    { name: 'Khá (50-69)', count: links.filter((l) => l.domainAuthority !== null && l.domainAuthority >= 50 && l.domainAuthority < 70).length, color: '#3b82f6' },
    { name: 'Mạnh (>=70)', count: links.filter((l) => l.domainAuthority !== null && l.domainAuthority >= 70).length, color: '#10b981' },
    { name: 'Không rõ', count: links.filter((l) => l.domainAuthority === null).length, color: '#64748b' },
  ];

  // Filtering Logic
  const filteredLinks = links
    .filter((l) => {
      const matchSearch =
        l.sourceUrl.toLowerCase().includes(search.toLowerCase()) ||
        l.targetUrl.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || l.status.toLowerCase() === filterStatus.toLowerCase();
      const matchType = filterType === 'all' || l.linkType.toLowerCase() === filterType.toLowerCase();
      
      let matchDa = true;
      if (filterDa === 'high') matchDa = l.domainAuthority !== null && l.domainAuthority >= 70;
      else if (filterDa === 'mid') matchDa = l.domainAuthority !== null && l.domainAuthority >= 40 && l.domainAuthority < 70;
      else if (filterDa === 'low') matchDa = l.domainAuthority !== null && l.domainAuthority < 40;
      else if (filterDa === 'unknown') matchDa = l.domainAuthority === null;

      return matchSearch && matchStatus && matchType && matchDa;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'da') {
        const daA = a.domainAuthority ?? -1;
        const daB = b.domainAuthority ?? -1;
        comparison = daA - daB;
      } else if (sortBy === 'source') {
        comparison = a.sourceUrl.localeCompare(b.sourceUrl);
      } else {
        // date
        const dateA = a.discoveredAt ? new Date(a.discoveredAt).getTime() : 0;
        const dateB = b.discoveredAt ? new Date(b.discoveredAt).getTime() : 0;
        comparison = dateA - dateB;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  // Export CSV Helper
  const handleExportCsv = () => {
    const headers = ['URL Nguon', 'URL Dich', 'Loai Lien Ket', 'Domain Authority (DA)', 'Trang Thai', 'Ngay Phat Hien'];
    const rows = filteredLinks.map((l) => [
      l.sourceUrl,
      l.targetUrl,
      l.linkType,
      l.domainAuthority?.toString() ?? 'N/A',
      l.status,
      l.discoveredAt ? new Date(l.discoveredAt).toLocaleDateString('vi-VN') : '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Backlink_Profile_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'lost':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getDaBadge = (da: number | null) => {
    if (da === null) return 'bg-slate-50 text-slate-400 border-slate-200';
    if (da >= 70) return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-extrabold shadow-sm';
    if (da >= 40) return 'bg-blue-50 text-blue-700 border-blue-200 font-bold';
    return 'bg-slate-50 text-slate-600 border-slate-250';
  };

  return (
    <div className="space-y-8 page-container">
      <PageHeader
        title={t('backlinkTitle')}
        description={t('backlinkDesc')}
        actions={
          <button
            type="button"
            onClick={async () => {
              setError('');
              setSuccess('');
              try {
                const res = await apiJson<{ message: string }>('/backlinks/audit-now', { method: 'POST' });
                setSuccess(res.message);
              } catch (e: any) {
                setError(e.message || 'Không thể bắt đầu quét');
              }
            }}
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            {t('auditNow')}
          </button>
        }
      />

      {error && <div className="alert-error text-sm">{error}</div>}
      {success && <div className="alert-info text-sm">{success}</div>}

      {/* Onboarding Guide Banner */}
      <div className="bg-brand/5 border border-brand/10 rounded-2xl p-4 flex items-start gap-3 shadow-sm transition-all duration-300 hover:shadow-md">
        <div>
          <h4 className="font-bold text-slate-800 text-sm">Hướng dẫn Quản lý Liên kết (Backlink Profile)</h4>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Backlink (liên kết từ bên ngoài trỏ về) giúp nâng cao thứ hạng từ khóa trên Google. Bạn có thể sử dụng
            chức năng **Quét tự động** hoặc **Quét hàng loạt** để hệ thống truy cập trang nguồn và phân tích thẻ HTML tìm link trỏ về trang của bạn, hoặc tự khai báo thủ công để quản lý tập trung.
          </p>
        </div>
      </div>

      {/* Summary Stats & Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Metric Cards Column */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-white p-5 rounded-2xl border border-brand/15 shadow-sm flex items-center gap-4 hover:border-brand/35 transition-all">
            <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center text-xs font-bold uppercase">LNK</div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tổng số Backlinks</div>
              <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{totalBacklinks}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {activeBacklinks} hoạt động · {lostBacklinks} mất · {pendingBacklinks} chờ duyệt
              </div>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-2xl border border-brand/15 shadow-sm flex items-center gap-4 hover:border-brand/35 transition-all">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold uppercase">DA</div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">DA Trung bình</div>
              <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{avgDa} <span className="text-xs text-gray-400 font-normal">/ 100</span></div>
              <div className="text-[10px] text-gray-400 mt-0.5">Độ uy tín tên miền theo chỉ số Moz</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-brand/15 shadow-sm flex items-center gap-4 hover:border-brand/35 transition-all">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold uppercase">CTR</div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tỷ lệ Link hoạt động</div>
              <div className="text-2xl font-extrabold text-gray-900 mt-0.5">
                {totalBacklinks > 0 ? Math.round((activeBacklinks / totalBacklinks) * 100) : 0}%
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">Tối ưu hóa chất lượng xây dựng link</div>
            </div>
          </div>
        </div>

        {/* Recharts Chart Card */}
        <div className="lg:col-span-2 card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Phân bố sức mạnh liên kết (Domain Authority Distribution)</h3>
            <p className="text-xs text-slate-400 mt-0.5">Đo lường số lượng backlink theo nhóm uy tín của tên miền nguồn.</p>
          </div>
          <div className="w-full h-40 mt-4">
            {totalBacklinks === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Không có dữ liệu biểu đồ</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={daRangesData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <ChartTooltip formatter={(value) => [`${value} backlinks`, 'Số lượng']} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {daRangesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Action Forms Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left column (Auto/Bulk Scanner) - 3/5 cols */}
        <div className="lg:col-span-3 card p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                <span>{isBulkMode ? 'Quét liên kết hàng loạt (Bulk Scan)' : 'Cào quét tự động đơn lẻ (Auto Scanner)'}</span>
              </h3>
              <button
                type="button"
                className="text-xs font-bold text-brand hover:underline px-2 py-1 rounded bg-brand/5 border border-brand/10 transition-colors"
                onClick={() => setIsBulkMode(!isBulkMode)}
              >
                {isBulkMode ? 'Chuyển sang Quét đơn lẻ' : 'Chuyển sang Quét hàng loạt'}
              </button>
            </div>

            {!isBulkMode ? (
              /* Single Scan Form */
              <form onSubmit={discover} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">URL trang nhận link (Target URL - của bạn) *</label>
                  <input
                    className="input w-full text-xs"
                    type="url"
                    placeholder="Ví dụ: https://website-cua-ban.com"
                    value={discoverTarget}
                    onChange={(e) => setDiscoverTarget(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">URL bài viết đối tác/diễn đàn (để trống = tự quét target)</label>
                  <input
                    className="input w-full text-xs"
                    type="url"
                    placeholder="Ví dụ: https://partner-blog.com/tin-tuc-a"
                    value={discoverScan}
                    onChange={(e) => setDiscoverScan(e.target.value)}
                  />
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  * Bot sẽ quét nội dung trang và thêm tự động vào danh sách nếu có backlink trỏ về site của bạn.
                </p>
                <button type="submit" className="btn-primary w-full py-2 text-xs" disabled={discovering}>
                  {discovering ? 'Đang cào quét...' : 'Bắt đầu quét đơn lẻ'}
                </button>
              </form>
            ) : (
              /* Bulk Scan Form */
              <form onSubmit={executeBulkScan} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">URL trang nhận link (Target URL) *</label>
                  <input
                    className="input w-full text-xs"
                    type="url"
                    placeholder="Ví dụ: https://website-cua-ban.com"
                    value={bulkTarget}
                    onChange={(e) => setBulkTarget(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Danh sách trang nguồn quét (Mỗi trang một dòng) *</label>
                  <textarea
                    className="input w-full min-h-[100px] text-xs font-mono p-2"
                    placeholder="https://site-dien-dan-a.com/bai-viet-1&#10;https://partner-blog.com/tin-tuc-3"
                    value={bulkUrlsText}
                    onChange={(e) => setBulkUrlsText(e.target.value)}
                    disabled={bulkScanning}
                    required
                  />
                </div>

                {bulkProgress && (
                  <div className="bg-slate-50 border rounded-xl p-3 space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-600">
                      <span>Tiến trình quét: {bulkProgress.current} / {bulkProgress.total} trang</span>
                      <span>{Math.round((bulkProgress.current / bulkProgress.total) * 100)}%</span>
                    </div>
                    {/* Progress bar line */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-brand h-full transition-all duration-300"
                        style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                      />
                    </div>
                    {/* Tiny Console log */}
                    <div className="text-[10px] max-h-24 overflow-y-auto font-mono text-slate-500 space-y-1 bg-white border p-2 rounded custom-scrollbar">
                      {bulkProgress.logs.length === 0 && <span className="text-slate-450 italic">Đang chờ quét...</span>}
                      {bulkProgress.logs.map((log, idx) => (
                        <div key={idx} className={log.status === 'success' ? 'text-green-600' : 'text-red-500'}>
                          [{log.status === 'success' ? 'OK' : 'LOI'}] {log.url.length > 30 ? log.url.substring(0, 30) + '...' : log.url} : {log.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button type="submit" className="btn-primary w-full py-2 text-xs" disabled={bulkScanning}>
                  {bulkScanning ? 'Đang quét hàng loạt...' : 'Bắt đầu quét hàng loạt'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right column (Manual Create / Edit) - 2/5 cols */}
        <form onSubmit={submit} className="lg:col-span-2 card p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-black text-slate-800 text-sm border-b pb-3 mb-4">
              {editingId ? 'Sửa thông tin Backlink' : 'Khai báo thủ công'}
            </h3>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">URL nguồn (Nơi đặt link) *</label>
              <input
                className="input w-full text-xs"
                type="url"
                placeholder="https://partner.com"
                value={form.sourceUrl}
                onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">URL đích (Trang nhận link) *</label>
              <input
                className="input w-full text-xs"
                type="url"
                placeholder="https://your-site.com/target"
                value={form.targetUrl}
                onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Chỉ số DA (1 - 100)</label>
                <input
                  className="input w-full text-xs"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="DA"
                  value={form.domainAuthority}
                  onChange={(e) => setForm({ ...form, domainAuthority: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Loại liên kết</label>
                <select
                  className="input w-full text-xs font-semibold"
                  value={form.linkType}
                  onChange={(e) => setForm({ ...form, linkType: e.target.value })}
                >
                  <option value="inbound">Inbound (Trỏ vào)</option>
                  <option value="outbound">Outbound (Trỏ ra)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Trạng thái liên kết</label>
              <select
                className="input w-full text-xs font-semibold"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">Hoạt động (Active)</option>
                <option value="lost">Bị mất (Lost)</option>
                <option value="pending">Chờ kiểm duyệt (Pending)</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t mt-4">
            <button type="submit" className="btn-primary flex-1 py-2 text-xs">
              {editingId ? 'Lưu cập nhật' : 'Lưu thủ công'}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary py-2 px-3 text-xs" onClick={resetForm}>
                Hủy
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Filter and Search Bar Row */}
      <div className="card p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-50/50">
        <div className="flex flex-wrap gap-2.5 items-center w-full md:w-auto">
          <input
            className="input text-xs w-full md:w-56"
            placeholder="Tìm kiếm URL nguồn/đích..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          
          <select
            className="input text-xs font-semibold py-1.5"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Lọc theo trạng thái"
          >
            <option value="all">Mọi trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="lost">Bị mất</option>
            <option value="pending">Đang chờ</option>
          </select>

          <select
            className="input text-xs font-semibold py-1.5"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label="Lọc theo loại liên kết"
          >
            <option value="all">Mọi loại link</option>
            <option value="inbound">Inbound (Trỏ vào)</option>
            <option value="outbound">Outbound (Trỏ ra)</option>
          </select>

          <select
            className="input text-xs font-semibold py-1.5"
            value={filterDa}
            onChange={(e) => setFilterDa(e.target.value)}
            aria-label="Lọc theo chỉ số DA"
          >
            <option value="all">Mọi độ uy tín (DA)</option>
            <option value="high">Mạnh (DA &gt;= 70)</option>
            <option value="mid">Trung bình (DA 40-69)</option>
            <option value="low">Yếu (DA &lt; 40)</option>
            <option value="unknown">Chưa có DA</option>
          </select>
        </div>

        <div className="flex gap-2 items-center w-full md:w-auto justify-end">
          <select
            className="input text-xs font-semibold py-1.5"
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              setSortBy(field);
              setSortOrder(order as 'asc' | 'desc');
            }}
            aria-label="Sắp xếp cột"
          >
            <option value="date-desc">Mới nhất trước</option>
            <option value="date-asc">Cũ nhất trước</option>
            <option value="da-desc">Độ uy tín cao trước</option>
            <option value="da-asc">Độ uy tín thấp trước</option>
            <option value="source-asc">Tên miền A-Z</option>
          </select>

          <button
            type="button"
            className="btn-secondary py-1.5 px-3 text-xs font-black flex items-center gap-1 shrink-0 border-slate-200"
            onClick={handleExportCsv}
            disabled={filteredLinks.length === 0}
          >
            Xuất CSV
          </button>
        </div>
      </div>

      {/* Backlinks Table */}
      <div className="table-wrap">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-sm font-bold text-slate-800">
            Hồ sơ liên kết ({filteredLinks.length} / {links.length} links)
          </h3>
        </div>
        <table className="table-modern">
          <thead>
            <tr>
              <th>URL Nguồn</th>
              <th>URL Đích</th>
              <th>Phân loại</th>
              <th>Độ uy tín (DA)</th>
              <th>Trạng thái</th>
              <th className="text-right" />
            </tr>
          </thead>
          <tbody>
            {filteredLinks.length === 0 && (
              <tr>
                <td colSpan={6} className="p-12 text-center text-slate-400 text-xs">
                  Không tìm thấy backlink nào khớp với điều kiện lọc.
                </td>
              </tr>
            )}
            {filteredLinks.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50/40 transition-colors">
                <td className="max-w-[240px] truncate font-medium text-slate-800" title={l.sourceUrl}>
                  <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-brand hover:underline">
                    {l.sourceUrl}
                  </a>
                </td>
                <td className="max-w-[240px] truncate text-slate-500" title={l.targetUrl}>
                  <a href={l.targetUrl} target="_blank" rel="noopener noreferrer" className="hover:text-brand hover:underline">
                    {l.targetUrl}
                  </a>
                </td>
                <td className="text-xs font-semibold capitalize text-slate-650">{l.linkType}</td>
                <td>
                  <span className={`px-2 py-0.5 border text-[10px] rounded-md ${getDaBadge(l.domainAuthority)}`}>
                    {l.domainAuthority != null ? `DA: ${l.domainAuthority}` : 'Chưa quét'}
                  </span>
                </td>
                <td>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold border uppercase tracking-wider ${getStatusBadge(l.status)}`}>
                    {l.status === 'active' ? 'Hoạt động' : l.status === 'lost' ? 'Bị mất' : 'Chờ duyệt'}
                  </span>
                </td>
                <td className="space-x-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    className="text-xs font-bold text-slate-600 hover:text-brand hover:underline"
                    onClick={async () => {
                      try {
                        const r = await apiJson<{ message: string }>(`/backlinks/${l.id}/estimate-da`, {
                          method: 'POST',
                        });
                        setSuccess(r.message);
                        load();
                      } catch (e: unknown) {
                        setError(e instanceof Error ? e.message : 'Lỗi ước lượng DA');
                      }
                    }}
                    title="Ước tính chỉ số DA tên miền"
                  >
                    Check DA
                  </button>
                  <button type="button" className="text-xs font-bold text-brand hover:underline" onClick={() => startEdit(l)}>
                    Sửa
                  </button>
                  <button type="button" className="text-xs font-bold text-red-500 hover:underline" onClick={() => remove(l.id)}>
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
