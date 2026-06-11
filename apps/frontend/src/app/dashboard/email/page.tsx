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
  htmlContent: 'Xin chào bạn,\n\nChúng tôi liên hệ để chia sẻ thông tin hữu ích và các bản cập nhật mới nhất từ hệ thống của chúng tôi.\n\nChúc bạn một ngày tốt lành!',
  recipients: '',
  scheduledAt: '',
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatContentToHtml(text: string): string {
  if (!text) return '';
  const paragraphs = text
    .split(/\n\n+/)
    .map(p => `<p style="margin: 0 0 12px 0; line-height: 1.6;">${p.replace(/\n/g, '<br />')}</p>`)
    .join('');

  return `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333333; max-width: 600px; margin: 0 auto; line-height: 1.6; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">${paragraphs}</div>`;
}

function formatHtmlToContent(html: string): string {
  if (!html) return '';
  
  // If it doesn't look like HTML (no tags), return it as is
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return html;
  }
  
  // Clean up track_open tag
  let clean = html.replace(/\{track_open\}|{{track_open}}/g, '');
  
  if (typeof window !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(clean, 'text/html');
      const container = doc.querySelector('div[style*="font-family"]');
      const root = container || doc.body;
      
      let text = '';
      const traverse = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.nodeValue;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tagName = el.tagName.toLowerCase();
          
          if (tagName === 'br') {
            text += '\n';
            return;
          }
          
          for (let i = 0; i < el.childNodes.length; i++) {
            traverse(el.childNodes[i]);
          }
          
          if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            text += '\n\n';
          }
        }
      };
      
      traverse(root);
      return text.replace(/\n{3,}/g, '\n\n').trim();
    } catch (e) {
      console.error('Error parsing HTML to text', e);
    }
  }
  
  // Fallback regex if window is undefined
  let text = clean;
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n\n');
  text = text.replace(/<[^>]+>/g, '');
  
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
    
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export default function EmailCampaignsPage() {
  const { t } = useLocale();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

  // AI Assistant states
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiUrl, setAiUrl] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [aiInfoTip, setAiInfoTip] = useState('');

  // Inline CRM selector collapse state
  const [showInlineSelector, setShowInlineSelector] = useState(false);

  const fetchCustomers = async () => {
    try {
      const res = await apiJson<{ data: any[] }>('/customers?limit=500');
      setCustomers(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const openCustomerModal = () => {
    fetchCustomers();
    const existing = form.recipients
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    setSelectedEmails(existing);
    setIsCustomerModalOpen(true);
  };

  const handleToggleEmail = (email: string) => {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const handleSelectAll = () => {
    const filteredCustomers = customers.filter(
      (c) =>
        (c.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (c.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );
    const filteredEmails = filteredCustomers.map((c) => c.email).filter(Boolean);
    setSelectedEmails((prev) => {
      const union = new Set([...prev, ...filteredEmails]);
      return Array.from(union);
    });
  };

  const handleDeselectAll = () => {
    const filteredCustomers = customers.filter(
      (c) =>
        (c.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (c.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );
    const filteredEmails = filteredCustomers.map((c) => c.email).filter(Boolean);
    setSelectedEmails((prev) => prev.filter((e) => !filteredEmails.includes(e)));
  };

  const handleApplyCustomers = () => {
    setForm((prev) => ({
      ...prev,
      recipients: selectedEmails.join(', '),
    }));
    setIsCustomerModalOpen(false);
  };

  const getEmailsFromRecipients = (recipientsStr: string): string[] => {
    if (!recipientsStr) return [];
    return recipientsStr
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  };

  const toggleRecipientEmail = (email: string) => {
    if (!email) return;
    const emailLower = email.toLowerCase().trim();
    const currentEmails = getEmailsFromRecipients(form.recipients);
    let newEmails: string[];
    if (currentEmails.includes(emailLower)) {
      newEmails = currentEmails.filter((e) => e !== emailLower);
    } else {
      newEmails = [...currentEmails, emailLower];
    }
    setForm((prev) => ({
      ...prev,
      recipients: newEmails.join(', '),
    }));
  };

  const handleSelectAllInline = () => {
    const filteredCustomers = customers.filter(
      (c) =>
        (c.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (c.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );
    const filteredEmails = filteredCustomers
      .map((c) => c.email?.toLowerCase().trim())
      .filter(Boolean) as string[];
      
    const currentEmails = getEmailsFromRecipients(form.recipients);
    const union = new Set([...currentEmails, ...filteredEmails]);
    
    setForm((prev) => ({
      ...prev,
      recipients: Array.from(union).join(', '),
    }));
  };

  const handleDeselectAllInline = () => {
    const filteredCustomers = customers.filter(
      (c) =>
        (c.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (c.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );
    const filteredEmails = filteredCustomers
      .map((c) => c.email?.toLowerCase().trim())
      .filter(Boolean) as string[];
      
    const currentEmails = getEmailsFromRecipients(form.recipients);
    const remaining = currentEmails.filter((e) => !filteredEmails.includes(e));
    
    setForm((prev) => ({
      ...prev,
      recipients: remaining.join(', '),
    }));
  };

  const insertPlaceholder = (ph: string) => {
    setForm((prev) => ({
      ...prev,
      htmlContent: prev.htmlContent + ph,
    }));
  };

  const handleGenerateAi = async () => {
    if (!aiUrl.trim()) {
      setError(t('Vui lòng nhập URL đích để AI phân tích.'));
      return;
    }
    setGenerating(true);
    setError('');
    setAiInfoTip('');
    try {
      const data = await apiJson<{
        title: string;
        content: string;
        imageUrl: string | null;
        isDemo: boolean;
      }>('/templates/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urlTarget: aiUrl.trim(),
          aiPrompt: aiPrompt.trim(),
          generateImage: false,
        }),
      });

      let formattedContent = data.content;
      if (formattedContent.includes('{url}')) {
        formattedContent = formattedContent.replace(/\{url\}/g, aiUrl.trim());
      }

      setForm((prev) => ({
        ...prev,
        name: data.title || prev.name,
        subject: data.title || prev.subject,
        htmlContent: formattedContent || prev.htmlContent,
      }));

      if (data.isDemo) {
        setAiInfoTip(t('Đang chạy ở chế độ Demo (chưa cấu hình OpenAI API Key). Thêm OPENAI_API_KEY ở file .env để chạy thực tế.'));
      } else {
        setAiInfoTip(t('AI đã tự động viết tiêu đề và nội dung email thành công dựa trên phân tích URL đích.'));
      }
      setShowAiPanel(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Lỗi gọi AI'));
    } finally {
      setGenerating(false);
    }
  };

  const load = () =>
    apiJson<Campaign[]>('/email-campaigns')
      .then(setCampaigns)
      .catch((e) => setError(e instanceof Error ? e.message : t('Lỗi tải danh sách')));

  useEffect(() => {
    load();
    fetchCustomers();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowAiPanel(false);
    setAiUrl('');
    setAiPrompt('');
    setAiInfoTip('');
  };

  const startEdit = (c: Campaign) => {
    if (c.status === 'SENT') return;
    setEditingId(c.id);
    const cleanHtml = c.htmlContent.replace(/\{track_open\}/g, '').trim();
    const cleanContent = formatHtmlToContent(cleanHtml);
    setForm({
      name: c.name,
      subject: c.subject,
      htmlContent: cleanContent,
      recipients: c.recipients,
      scheduledAt: toDatetimeLocal(c.scheduledAt),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const htmlBody = formatContentToHtml(form.htmlContent);
    const finalHtml = htmlBody.includes('{track_open}')
      ? htmlBody
      : htmlBody + '\n{track_open}';
    const payload = {
      ...form,
      htmlContent: finalHtml,
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
        description={t('Quản lý, soạn thảo, hẹn giờ gửi chiến dịch và đo lường tỷ lệ tương tác của người nhận.')}
      />

      {error && <div className="alert-error text-sm">{error}</div>}
      {success && <div className="alert-info text-sm">{success}</div>}

      {/* Help Banner */}
      <div className="bg-brand/5 border border-brand/10 rounded-2xl p-5 shadow-sm">
        <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse" />
          {t('Hướng dẫn soạn thảo & Gửi chiến dịch')}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-650 leading-relaxed">
          <div>
            <p className="font-bold text-slate-700 mb-1">1. Địa chỉ nhận:</p>
            <p>Chọn từ danh sách khách hàng bên dưới hoặc nhập thủ công ngăn cách bằng dấu phẩy. Ví dụ: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-750 font-semibold">khach1@gmail.com, khach2@gmail.com</code></p>
          </div>
          <div>
            <p className="font-bold text-slate-700 mb-1">2. Cá nhân hóa email:</p>
            <p className="flex items-center flex-wrap gap-1 mb-1.5">
              Click vào nút
              <button
                type="button"
                className="bg-brand text-white text-[10px] px-2.5 py-0.5 rounded font-bold hover:bg-brand-hover transition-colors cursor-pointer shadow-sm"
                title={t('Click để chèn thẻ cá nhân hóa email')}
                onClick={() => insertPlaceholder('{email}')}
              >
                {t('Cá nhân hóa Email')}
              </button>
              để tự động hiển thị email người nhận khi gửi.
            </p>
          </div>
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

            {aiInfoTip && <div className="alert-info text-[11px] font-bold py-2">{aiInfoTip}</div>}

            {/* AI Assistant Panel */}
            {!editingId && (
              <div className="bg-orange-50/40 rounded-xl p-3 border border-brand/15 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-brand flex items-center gap-1.5">
                    ✨ {t('Trợ lý AI tự viết Email')}
                  </span>
                  <button
                    type="button"
                    className="text-[10px] font-extrabold bg-white text-brand border border-brand/35 px-2 py-0.5 rounded shadow-sm cursor-pointer hover:bg-orange-50 transition-colors"
                    onClick={() => setShowAiPanel(!showAiPanel)}
                  >
                    {showAiPanel ? t('Đóng AI Panel') : t('Mở AI Panel')}
                  </button>
                </div>

                {showAiPanel && (
                  <div className="mt-3 pt-3 border-t border-brand/10 space-y-3">
                    <div>
                      <label className="block font-bold text-slate-500 uppercase mb-1 text-[10px]">{t('URL trang đích để AI phân tích *')}</label>
                      <input
                        className="input text-xs w-full py-1.5 bg-white"
                        type="url"
                        placeholder="https://your-site.com/landing-page"
                        value={aiUrl}
                        onChange={(e) => setAiUrl(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label className="block font-bold text-slate-500 uppercase mb-1 text-[10px]">{t('Chủ đề hoặc Yêu cầu viết Email')}</label>
                      <textarea
                        className="input text-xs w-full py-1.5 bg-white min-h-[55px]"
                        placeholder={t('Ví dụ: Viết thư mời dùng thử gói Pro, nhấn mạnh lợi ích và ưu đãi giảm giá...')}
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      className="w-full py-2 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition-colors text-xs shadow-sm cursor-pointer disabled:opacity-50"
                      disabled={generating}
                      onClick={handleGenerateAi}
                    >
                      {generating ? t('AI đang viết thư...') : t('Tạo nội dung thư bằng AI')}
                    </button>
                  </div>
                )}
              </div>
            )}
            
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
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">{t('Danh sách Email nhận (cách nhau bởi dấu phẩy) *')}</label>
                <button
                  type="button"
                  onClick={openCustomerModal}
                  className="text-xs text-brand hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  {t('Xem danh sách lớn')}
                </button>
              </div>
              <input
                className="input w-full text-xs"
                placeholder="customer1@gmail.com, customer2@yahoo.com"
                value={form.recipients}
                onChange={(e) => setForm({ ...form, recipients: e.target.value })}
                required
              />
              
              {/* Inline Quick CRM Selection */}
              <div className="mt-2 border border-slate-100 rounded-lg p-2.5 bg-slate-50/50">
                <div 
                  className="flex items-center justify-between gap-2 cursor-pointer select-none"
                  onClick={() => setShowInlineSelector(!showInlineSelector)}
                >
                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    👥 {t('Chọn nhanh từ Khách hàng')} {showInlineSelector ? '▲' : '▼'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {t('Đang chọn')}: <strong className="text-brand">{getEmailsFromRecipients(form.recipients).length}</strong>
                  </span>
                </div>
                
                {showInlineSelector && (
                  <div className="mt-2.5 space-y-2">
                    <input
                      type="text"
                      placeholder={t('Tìm nhanh khách hàng...')}
                      className="input w-full text-[11px] py-1 px-2 mb-2 bg-white"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    
                    <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1 custom-scrollbar text-xs bg-white border border-slate-100 rounded-md p-1.5">
                      {customers.length === 0 ? (
                        <p className="text-center text-[10px] text-slate-400 py-3">{t('Đang tải danh sách...')}</p>
                      ) : (
                        (() => {
                          const filtered = customers.filter(
                            (c) =>
                              (c.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                              (c.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
                          );
                          if (filtered.length === 0) {
                            return <p className="text-center text-[10px] text-slate-400 py-3">{t('Không tìm thấy')}</p>;
                          }
                          
                          const selectedEmailsSet = new Set(getEmailsFromRecipients(form.recipients));
                          
                          return filtered.map((c) => {
                            const hasEmail = c.email && c.email.trim();
                            if (!hasEmail) return null;
                            const emailLower = c.email.toLowerCase().trim();
                            const isChecked = selectedEmailsSet.has(emailLower);
                            
                            return (
                              <label key={c.id} className="flex items-center gap-2 p-1 rounded hover:bg-slate-50 cursor-pointer transition-colors text-[11px]">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-350 text-brand focus:ring-brand h-3.5 w-3.5 cursor-pointer"
                                  checked={isChecked}
                                  onChange={() => toggleRecipientEmail(c.email)}
                                />
                                <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
                                  <span className="font-semibold text-slate-700 truncate max-w-[120px]">{c.name || 'Khách hàng'}</span>
                                  <span className="text-slate-400 text-[10px] truncate">{c.email}</span>
                                </div>
                              </label>
                            );
                          });
                        })()
                      )}
                    </div>
                    
                    <div className="flex justify-between gap-2 mt-1.5 text-[10px] font-bold border-t pt-1.5 border-slate-100">
                      <button
                        type="button"
                        className="text-brand hover:underline cursor-pointer"
                        onClick={handleSelectAllInline}
                      >
                        {t('Chọn tất cả kết quả')}
                      </button>
                      <button
                        type="button"
                        className="text-slate-500 hover:underline cursor-pointer"
                        onClick={handleDeselectAllInline}
                      >
                        {t('Bỏ chọn tất cả')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">{t('Nội dung Email *')}</label>
                <div className="flex bg-slate-100 rounded-lg p-0.5 text-[10px]">
                  <button
                    type="button"
                    className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                      activeTab === 'edit' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-800'
                    }`}
                    onClick={() => setActiveTab('edit')}
                  >
                    {t('Soạn thảo')}
                  </button>
                  <button
                    type="button"
                    className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                      activeTab === 'preview' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-800'
                    }`}
                    onClick={() => setActiveTab('preview')}
                  >
                    {t('Xem trước')}
                  </button>
                </div>
              </div>
              {activeTab === 'edit' ? (
                <textarea
                  className="input w-full min-h-[180px] text-xs p-3 bg-slate-50 focus:bg-white"
                  placeholder={t('Viết nội dung thư tại đây. Ví dụ: Chào {email},')}
                  value={form.htmlContent}
                  onChange={(e) => setForm({ ...form, htmlContent: e.target.value })}
                  required
                />
              ) : (
                <div 
                  className="w-full min-h-[180px] p-0 bg-slate-50 border border-slate-200 rounded-lg overflow-y-auto max-h-[300px] text-xs"
                  dangerouslySetInnerHTML={{
                    __html: formatContentToHtml(form.htmlContent).replace(/\{email\}/g, 'customer@example.com')
                  }}
                />
              )}
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

      {/* Customer Selection Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            <button 
              type="button"
              onClick={() => setIsCustomerModalOpen(false)}
              className="absolute top-4 right-4 text-xs font-semibold hover:text-gray-700 text-gray-400"
            >
              Đóng
            </button>
            <h2 className="text-lg font-bold text-slate-800 mb-2">
              {t('Chọn Email khách hàng')}
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              {t('Tích chọn các khách hàng để gửi chiến dịch email marketing.')}
            </p>

            <input
              type="text"
              className="input w-full text-xs mb-3"
              placeholder={t('Tìm kiếm tên hoặc email...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div className="flex justify-between gap-2 mb-3 text-xs">
              <button
                type="button"
                className="text-brand hover:underline font-bold"
                onClick={handleSelectAll}
              >
                {t('Chọn tất cả kết quả')}
              </button>
              <button
                type="button"
                className="text-slate-500 hover:underline font-bold"
                onClick={handleDeselectAll}
              >
                {t('Bỏ chọn tất cả')}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[150px] border border-slate-100 rounded-lg p-2 space-y-2 max-h-[300px]">
              {customers.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">{t('Đang tải danh sách khách hàng...')}</p>
              ) : (
                (() => {
                  const filtered = customers.filter(
                    (c) =>
                      (c.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                      (c.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
                  );
                  if (filtered.length === 0) {
                    return <p className="text-center text-xs text-slate-400 py-8">{t('Không tìm thấy khách hàng nào.')}</p>;
                  }
                  return filtered.map((c) => (
                    <label key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-xs transition-colors">
                      <input
                        type="checkbox"
                        className="rounded border-slate-350 text-brand focus:ring-brand"
                        checked={selectedEmails.includes(c.email)}
                        onChange={() => handleToggleEmail(c.email)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{c.name || 'Khách hàng ẩn danh'}</p>
                        <p className="text-slate-400 truncate text-[10px]">{c.email}</p>
                      </div>
                      {c.status && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-slate-100 text-slate-500">
                          {c.status}
                        </span>
                      )}
                    </label>
                  ));
                })()
              )}
            </div>

            <div className="border-t pt-4 mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                {t('Đã chọn')}: <strong className="text-brand">{selectedEmails.length}</strong> email
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-650 hover:bg-slate-50 text-xs font-bold rounded-lg transition-colors"
                >
                  {t('Hủy')}
                </button>
                <button
                  type="button"
                  onClick={handleApplyCustomers}
                  className="px-5 py-2 bg-brand text-white hover:bg-brand-hover text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  {t('Áp dụng')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
