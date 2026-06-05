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
  Legend
} from 'recharts';

type Campaign = {
  id: number;
  name: string;
  subject: string;
  htmlContent: string;
  recipients: string;
  status: string;
  scheduledAt: string | null;
  sentCount: number;
  openCount: number;
  clickCount: number;
};

const emptyForm = {
  name: '',
  subject: '',
  htmlContent: '<p>Xin chào {email},</p>\n<p>Chúng tôi liên hệ để chia sẻ thông tin hữu ích.</p>\n{track_open}',
  recipients: '',
  scheduledAt: '',
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EmailCampaignsPage() {
  const { t } = useLocale();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);

  const insertPlaceholder = (ph: string) => {
    setForm((prev) => ({
      ...prev,
      htmlContent: prev.htmlContent + ph,
    }));
  };

  const load = () =>
    apiJson<Campaign[]>('/email-campaigns')
      .then(setCampaigns)
      .catch((e) => setError(e instanceof Error ? e.message : t('Lỗi tải danh sách')));

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (c: Campaign) => {
    if (c.status === 'SENT') return;
    setEditingId(c.id);
    setForm({
      name: c.name,
      subject: c.subject,
      htmlContent: c.htmlContent,
      recipients: c.recipients,
      scheduledAt: toDatetimeLocal(c.scheduledAt),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const payload = {
      ...form,
      scheduledAt: form.scheduledAt || null,
    };
    try {
      if (editingId) {
        await apiJson(`/email-campaigns/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setSuccess(t('Đã cập nhật chiến dịch thành công.'));
      } else {
        await apiJson('/email-campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setSuccess(
          form.scheduledAt
            ? t('Đã lên lịch gửi email. Hệ thống sẽ tự động quét gửi theo thời gian hẹn.')
            : t('Đã tạo bản nháp thành công. Bạn có thể bấm gửi ngay ở bảng bên dưới.')
        );
      }
      resetForm();
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không lưu được'));
    }
  };

  const send = async (id: number) => {
    setError('');
    setSuccess('');
    setSendingId(id);
    try {
      const r = await apiJson<{ message: string; sent: number; total: number }>(
        `/email-campaigns/${id}/send`,
        { method: 'POST' }
      );
      setSuccess(r.message || t('Đã gửi') + ` ${r.sent} ` + t('email thành công.'));
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Gửi email thất bại'));
      load();
    } finally {
      setSendingId(null);
    }
  };

  const remove = async (id: number) => {
    if (!confirm(t('Xóa chiến dịch này?'))) return;
    try {
      await apiJson(`/email-campaigns/${id}`, { method: 'DELETE' });
      if (editingId === id) resetForm();
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không xóa được'));
    }
  };

  // Compute metrics
  const totalCampaigns = campaigns.length;
  const sentCampaigns = campaigns.filter((c) => c.status === 'SENT').length;
  
  const totalSentCount = campaigns.reduce((sum, c) => sum + c.sentCount, 0);
  const totalOpenCount = campaigns.reduce((sum, c) => sum + c.openCount, 0);
  const totalClickCount = campaigns.reduce((sum, c) => sum + c.clickCount, 0);

  const avgOpenRate = totalSentCount > 0 ? Math.round((totalOpenCount / totalSentCount) * 100) : 0;
  const avgClickRate = totalSentCount > 0 ? Math.round((totalClickCount / totalSentCount) * 100) : 0;

  // Chart Data Preparation (Latest 5 sent campaigns)
  const chartData = campaigns
    .filter((c) => c.status === 'SENT')
    .slice(0, 5)
    .reverse()
    .map((c) => ({
      name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
      [t('Đã gửi')]: c.sentCount,
      [t('Đã mở')]: c.openCount,
      [t('Lượt click')]: c.clickCount,
    }));

  const getStatusBadgeClass = (status: string) => {
    switch (status.toUpperCase()) {
      case 'SENT':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'SCHEDULED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'FAILED':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        // DRAFT
        return 'bg-slate-50 text-slate-650 border-slate-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toUpperCase()) {
      case 'SENT':
        return t('Đã gửi');
      case 'SCHEDULED':
        return t('Đã lên lịch');
      case 'FAILED':
        return t('Thất bại');
      default:
        return t('Bản nháp');
    }
  };

  return (
    <div className="space-y-8 page-container">
      <PageHeader
        title={t('Email marketing')}
        description={t('FR-12 — Quản lý, soạn thảo, hẹn giờ gửi chiến dịch và đo lường tỷ lệ tương tác của người nhận.')}
      />

      {error && <div className="alert-error text-sm">{error}</div>}
      {success && <div className="alert-info text-sm">{success}</div>}

      {/* Help Banner */}
      <div className="bg-brand/5 border border-brand/10 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
        <div>
          <h4 className="font-bold text-slate-800 text-sm">{t('Hướng dẫn gửi chiến dịch Email')}</h4>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {t('Bạn có thể dùng dấu phẩy ( , ) để phân tách danh sách Email nhận. Trong nội dung HTML, bấm vào để chèn nhanh:')}{' '}
            <button
              type="button"
              className="mx-1 bg-brand/10 border border-brand/20 px-1.5 py-0.5 rounded text-brand font-mono text-[10px] font-bold transition-all hover:bg-brand/20 hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
              title={t('Click để chèn {email}')}
              onClick={() => insertPlaceholder('{email}')}
            >
              {'{email}'}
            </button>
            {t('để gọi địa chỉ người nhận, hoặc')}{' '}
            <button
              type="button"
              className="mx-1 bg-brand/10 border border-brand/20 px-1.5 py-0.5 rounded text-brand font-mono text-[10px] font-bold transition-all hover:bg-brand/20 hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
              title={t('Click để chèn {track_open}')}
              onClick={() => insertPlaceholder('{track_open}')}
            >
              {'{track_open}'}
            </button>
            {t('ở cuối để theo dõi lượt mở thư. (Lưu ý kết nối SMTP trong Settings).')}
          </p>
        </div>
      </div>

      {/* Metrics & Performance Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Metric Cards */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-white p-5 rounded-2xl border border-brand/15 shadow-sm flex items-center gap-4 hover:border-brand/35 transition-all">
            <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center text-xs font-bold uppercase">Mail</div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('Tổng số thư đã gửi')}</div>
              <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{totalSentCount}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{t('Từ')} {sentCampaigns} {t('chiến dịch đã chạy')}</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-brand/15 shadow-sm flex items-center gap-4 hover:border-brand/35 transition-all">
            <div className="w-11 h-11 rounded-xl bg-green-50 text-green-600 flex items-center justify-center text-xs font-bold uppercase">Open</div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('Tỷ lệ Mở thư (Open Rate)')}</div>
              <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{avgOpenRate}%</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{t('Tổng số lượt mở thư ghi nhận:')} {totalOpenCount}</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-brand/15 shadow-sm flex items-center gap-4 hover:border-brand/35 transition-all">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold uppercase">CTR</div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('Tỷ lệ Click link (CTR)')}</div>
              <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{avgClickRate}%</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{t('Tổng số nhấp liên kết:')} {totalClickCount}</div>
            </div>
          </div>
        </div>

        {/* Grouped Bar Chart */}
        <div className="lg:col-span-2 card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">{t('Hiệu suất 5 chiến dịch gần đây')}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{t('So sánh tương quan giữa số lượng gửi, lượt mở và số lần nhấp link.')}</p>
          </div>
          <div className="w-full h-40 mt-4">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">{t('Không có dữ liệu biểu đồ (chưa gửi chiến dịch nào)')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <ChartTooltip />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey={t('Đã gửi')} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey={t('Đã mở')} fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey={t('Lượt click')} fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Editor and Campaigns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Editor Form - 2/5 cols */}
        <form onSubmit={save} className="lg:col-span-2 card p-6 space-y-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-black text-slate-800 text-sm border-b pb-3 mb-4">
              {editingId ? `${t('Sửa chiến dịch')} #${editingId}` : t('Tạo chiến dịch mới')}
            </h3>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Tên chiến dịch *')}</label>
              <input
                className="input w-full text-xs"
                placeholder={t('Ví dụ: Bản tin tuần 24')}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Tiêu đề thư (Subject) *')}</label>
              <input
                className="input w-full text-xs"
                placeholder={t('Ví dụ: Bí quyết thu hút Free Traffic hiệu quả')}
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Danh sách Email nhận (cách nhau bởi dấu phẩy) *')}</label>
              <input
                className="input w-full text-xs"
                placeholder="customer1@gmail.com, customer2@yahoo.com"
                value={form.recipients}
                onChange={(e) => setForm({ ...form, recipients: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Hẹn giờ gửi (Để trống để lưu nháp)')}</label>
              <input
                className="input w-full text-xs"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Nội dung Email (HTML) *')}</label>
              <textarea
                className="input w-full min-h-[140px] text-xs font-mono p-3 bg-slate-50 focus:bg-white"
                value={form.htmlContent}
                onChange={(e) => setForm({ ...form, htmlContent: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t mt-4">
            <button type="submit" className="btn-primary flex-1 py-2 text-xs">
              {editingId ? t('Lưu thay đổi') : t('Tạo chiến dịch')}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary py-2 px-3 text-xs" onClick={resetForm}>
                {t('Hủy')}
              </button>
            )}
          </div>
        </form>

        {/* Campaigns List - 3/5 cols */}
        <div className="lg:col-span-3 card p-0 overflow-hidden flex flex-col shadow-sm table-wrap">
          <div className="p-4 border-b">
            <h3 className="text-sm font-bold text-slate-800">{t('Danh sách các chiến dịch')}</h3>
          </div>
          <table className="table-modern">
            <thead>
              <tr>
                <th>{t('Tên chiến dịch')}</th>
                <th>{t('Trạng thái')}</th>
                <th>{t('Lịch gửi')}</th>
                <th>{t('Gửi/Mở/Click')}</th>
                <th className="text-right" />
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400 text-xs">
                    {t('Chưa có chiến dịch nào được tạo. Hãy tạo mới ở khung bên trái.')}
                  </td>
                </tr>
              )}
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/40 transition-colors">
                  <td className="font-medium text-slate-800 max-w-[150px] truncate" title={c.name}>
                    {c.name}
                    <span className="block text-[10px] text-slate-450 font-normal truncate mt-0.5" title={c.subject}>
                      Suj: {c.subject}
                    </span>
                  </td>
                  <td>
                    <span className={`px-2 py-0.5 border rounded text-[9px] font-extrabold uppercase tracking-wider ${getStatusBadgeClass(c.status)}`}>
                      {getStatusText(c.status)}
                    </span>
                  </td>
                  <td className="text-xs text-slate-500 whitespace-nowrap">
                    {c.scheduledAt ? new Date(c.scheduledAt).toLocaleString('vi-VN') : t('Gửi thủ công')}
                  </td>
                  <td>
                    <div className="text-xs font-bold text-slate-700">
                      {c.sentCount} <span className="text-[10px] text-slate-400 font-normal">{t('gửi')}</span> · {c.openCount} <span className="text-[10px] text-slate-400 font-normal">{t('mở')}</span> · {c.clickCount} <span className="text-[10px] text-slate-400 font-normal">{t('click')}</span>
                    </div>
                  </td>
                  <td className="space-x-3 text-right whitespace-nowrap">
                    {c.status !== 'SENT' ? (
                      <>
                        <button
                          type="button"
                          className="text-xs font-bold text-brand hover:underline"
                          onClick={() => startEdit(c)}
                        >
                          {t('Sửa')}
                        </button>
                        <button
                          type="button"
                          className="text-xs font-bold text-emerald-600 hover:underline"
                          onClick={() => send(c.id)}
                          disabled={sendingId === c.id}
                        >
                          {sendingId === c.id ? t('Đang gửi...') : t('Gửi ngay')}
                        </button>
                        <button
                          type="button"
                          className="text-xs font-bold text-red-500 hover:underline"
                          onClick={() => remove(c.id)}
                        >
                          {t('Xóa')}
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 italic">{t('Đã hoàn tất')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
