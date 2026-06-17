'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';
import { apiFetch, apiJson } from '@/lib/api';

interface Connection {
  id: number;
  platform: string;
  pageName: string | null;
  pageId: string | null;
  status: string;
}

interface CopilotPlanItem {
  day: string;
  title: string;
  content: string;
  platform: string; // 'facebook', 'email', 'zalo'
  suggestedTime: string; // '09:00', '12:00', '20:00'
  scheduledAt?: string; // 'YYYY-MM-DDTHH:MM' format for datetime-local input
  imageUrl?: string | null;
  imagePrompt?: string;
}

const TONE_OPTIONS = [
  { value: 'Chuyên nghiệp', label: 'Chuyên nghiệp' },
  { value: 'Hài hước', label: 'Hài hước' },
  { value: 'Thuyết phục', label: 'Thuyết phục' },
  { value: 'Thân thiện', label: 'Thân thiện' },
  { value: 'Trang trọng', label: 'Trang trọng' },
];

const SUGGESTIONS = [
  {
    topic: 'Giảm giá 50% Bộ Sưu Tập Thời Trang Hè',
    industry: 'Thời trang & Bán lẻ',
    tone: 'Thuyết phục'
  },
  {
    topic: 'Khai trương Chi Nhánh Cafe Đặc Sản Mới',
    industry: 'F&B (Ẩm thực)',
    tone: 'Thân thiện'
  },
  {
    topic: 'Giải pháp Hosting Cloud Tốc Độ Cao cho Doanh Nghiệp',
    industry: 'Công nghệ thông tin',
    tone: 'Chuyên nghiệp'
  }
];

export default function CopilotPage() {
  const { t } = useLocale();
  const [topic, setTopic] = useState('');
  const [industry, setIndustry] = useState('');
  const [tone, setTone] = useState('Chuyên nghiệp');
  const [postCount, setPostCount] = useState(5);
  const [urlTarget, setUrlTarget] = useState('');
  const [recipients, setRecipients] = useState('');
  const [viewType, setViewType] = useState<'timeline' | 'grid'>('timeline');
  const [startDate, setStartDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [plan, setPlan] = useState<CopilotPlanItem[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [aiGenImage, setAiGenImage] = useState(false);
  const [imageLoadingIndex, setImageLoadingIndex] = useState<number | null>(null);
  const [autoWatermark, setAutoWatermark] = useState(false);
  const [watermarkText, setWatermarkText] = useState('');
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(true);

  const [connections, setConnections] = useState<Connection[]>([]);
  const [publishingIndex, setPublishingIndex] = useState<number | null>(null);
  const [selectedConnId, setSelectedConnId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch('/social')
      .then(res => {
        if (res.ok) return res.json();
        return [];
      })
      .then(data => {
        setConnections(data.filter((c: any) => c.status === 'CONNECTED'));
      })
      .catch(err => console.error('Lỗi khi tải danh sách liên kết:', err));
  }, []);

  const handlePublishNow = async (index: number, connectionId: number) => {
    const item = plan[index];
    setPublishingIndex(index);
    setSelectedConnId(connectionId);
    setMessage(null);

    const platform = item.platform.toLowerCase();
    
    try {
      const res = await apiJson<{ success: boolean; message: string }>('/social/publish-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          connectionId,
          title: item.title,
          content: item.content,
          imageUrl: item.imageUrl || null,
          urlTarget: urlTarget.trim() || undefined,
        }),
      });

      if (res.success) {
        setMessage({
          type: 'success',
          text: `Đăng lên ${platform === 'facebook' ? 'Fanpage' : 'Zalo OA'} thành công!`,
        });
      } else {
        throw new Error(res.message || 'Đăng bài thất bại.');
      }
    } catch (err: any) {
      console.error(err);
      setMessage({
        type: 'error',
        text: err?.message || 'Có lỗi xảy ra khi đăng bài nhanh.',
      });
    } finally {
      setPublishingIndex(null);
      setSelectedConnId(null);
    }
  };

  const handleCardChange = React.useCallback((index: number, field: keyof CopilotPlanItem, value: any) => {
    setPlan(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const handleGenerateCardImage = React.useCallback(async (index: number) => {
    const item = plan[index];
    const promptText = (item.imagePrompt || '').trim() || item.title;
    if (!promptText.trim()) return;

    setImageLoadingIndex(index);
    setMessage(null);

    try {
      const res = await apiJson<{ imageUrl: string | null }>('/templates/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText })
      });

      if (res.imageUrl) {
        handleCardChange(index, 'imageUrl', res.imageUrl);
      } else {
        throw new Error('Không thể sinh ảnh minh họa.');
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err?.message || 'Lỗi khi tạo ảnh với AI.' });
    } finally {
      setImageLoadingIndex(null);
    }
  }, [plan, handleCardChange]);

  // Helper to calculate datetime string for a card
  const calculateCardDate = (baseDateStr: string, dayIndex: number, suggestedTime: string): string => {
    const baseDate = new Date(baseDateStr);
    if (isNaN(baseDate.getTime())) return '';

    const targetDate = new Date(baseDate);
    targetDate.setDate(baseDate.getDate() + dayIndex);

    const [hours, minutes] = (suggestedTime || '09:00').split(':').map(Number);
    targetDate.setHours(hours || 9, minutes || 0, 0, 0);

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}T${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}`;
  };

  // Update dates for all cards when Start Date changes
  const handleStartDateChange = (newDateStr: string) => {
    setStartDate(newDateStr);
    if (plan.length === 0) return;

    setPlan(prev =>
      prev.map((item, idx) => ({
        ...item,
        scheduledAt: calculateCardDate(newDateStr, idx, item.suggestedTime)
      }))
    );
  };

  const applySuggestion = (sug: typeof SUGGESTIONS[0]) => {
    setTopic(sug.topic);
    setIndustry(sug.industry);
    setTone(sug.tone);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !industry.trim()) return;

    setLoading(true);
    setMessage(null);
    setPlan([]);

    try {
      const res = await apiJson<{ plan: CopilotPlanItem[]; isDemo: boolean }>('/templates/copilot-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          industry: industry.trim(),
          tone,
          postCount,
          generateImage: aiGenImage,
          useKnowledgeBase
        })
      });

      // Pre-fill initial schedule times
      const planWithDates = res.plan.map((item, idx) => ({
        ...item,
        scheduledAt: calculateCardDate(startDate, idx, item.suggestedTime)
      }));

      setPlan(planWithDates);
      setIsDemo(res.isDemo);
      if (res.isDemo) {
        setMessage({
          type: 'success',
          text: 'Đang chạy ở chế độ DEMO do chưa cấu hình OPENAI_API_KEY ở backend. Hệ thống đã tự tạo chuỗi bài đăng mẫu để bạn kiểm thử.'
        });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err?.message || 'Có lỗi xảy ra khi tạo kế hoạch bài viết.' });
    } finally {
      setLoading(false);
    }
  };



  const handleSaveTemplates = async () => {
    if (plan.length === 0) return;
    setSaveLoading(true);
    setMessage(null);

    try {
      await apiJson('/templates/copilot-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      setMessage({ type: 'success', text: t('planSaved') });
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err?.message || 'Không thể lưu các mẫu bài viết.' });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleAutoSchedule = async () => {
    if (plan.length === 0) return;
    setScheduleLoading(true);
    setMessage(null);

    try {
      // Kiểm tra xem kế hoạch có bài viết qua email không, nếu có thì bắt buộc phải nhập danh sách người nhận
      const hasEmailPost = plan.some(item => item.platform === 'email');
      if (hasEmailPost && !recipients.trim()) {
        throw new Error('Hệ thống phát hiện có bài viết lên lịch qua kênh Email. Vui lòng nhập Danh sách Email Người nhận ở ô "Người nhận Email" bên dưới khung thiết lập lên lịch bên trái (ví dụ: khachhang1@gmail.com, khachhang2@gmail.com).');
      }

      for (let i = 0; i < plan.length; i++) {
        const item = plan[i];
        
        if (!item.scheduledAt) {
          throw new Error(`Vui lòng chọn ngày giờ lên lịch cho ${item.day}`);
        }

        const targetDate = new Date(item.scheduledAt);
        if (isNaN(targetDate.getTime())) {
          throw new Error(`Ngày giờ lên lịch cho ${item.day} không hợp lệ`);
        }

        const body: Record<string, any> = {
          title: item.title,
          content: item.content,
          platforms: item.platform || 'facebook',
          scheduledAt: targetDate.toISOString(),
          urlTarget: urlTarget.trim() || null,
          imageUrl: item.imageUrl || null,
          status: 'PENDING'
        };

        if (autoWatermark && watermarkText.trim()) {
          body.overlayText = watermarkText.trim();
          body.overlayPosition = 'bottom-right';
          body.overlayFontSize = 32;
        }

        if (item.platform === 'email') {
          body.recipients = recipients.trim() || null;
        }

        await apiJson('/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }

      setMessage({ type: 'success', text: t('planScheduled') });
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err?.message || 'Có lỗi xảy ra khi lên lịch đăng bài.' });
    } finally {
      setScheduleLoading(false);
    }
  };

  const renderPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'facebook':
        return (
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-1 rounded uppercase">[FB]</span>
        );
      case 'email':
        return (
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-1 rounded uppercase">[Email]</span>
        );
      case 'zalo':
        return (
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-1 rounded uppercase">[Zalo]</span>
        );
      default:
        return (
          <span className="text-xs font-bold text-slate-400 bg-slate-50 px-1 rounded uppercase">[Platform]</span>
        );
    }
  };

  return (
    <div className="space-y-8 page-container text-slate-800 max-w-7xl mx-auto">
      {/* Upper Title Section (Light Orange-White Theme) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50/70 via-white to-orange-50/30 border border-slate-200/80 p-6 md:p-8 shadow-sm">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-brand/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 bg-brand/5 rounded-full blur-3xl" />
        <div className="relative z-10 text-slate-800">
          <PageHeader
            title={t('copilot')}
            description={t('copilotDesc')}
          />
        </div>
      </div>

      {/* Suggestion Chips */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Gợi ý nhanh chủ đề mẫu:</p>
        <div className="flex flex-wrap gap-3">
          {SUGGESTIONS.map((sug, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applySuggestion(sug)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/60 hover:border-brand/40 text-xs text-slate-700 hover:text-brand transition-all hover:scale-[1.02] shadow-sm"
            >
              <span className="font-semibold truncate max-w-[240px] md:max-w-xs">{sug.topic}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-start gap-3 shadow-md animate-in fade-in duration-200 ${
            message.type === 'success'
              ? 'bg-orange-50 border-brand/20 text-brand'
              : 'bg-slate-50 border-slate-200 text-red-600 font-semibold'
          }`}
        >
          <div className="font-semibold leading-relaxed">{message.text}</div>
        </div>
      )}

      {/* Workspace Plan Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Control Card (Orange Accent & White Theme) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand"></span>
            </span>
            Cấu hình kế hoạch
          </h2>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {t('topic')} <span className="text-brand">*</span>
              </label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="Ví dụ: Giảm giá 50% thời trang hè"
                required
                disabled={loading}
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-brand focus:ring-1 focus:ring-brand/40 transition-all shadow-inner"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {t('industry')} <span className="text-brand">*</span>
              </label>
              <input
                type="text"
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                placeholder="Ví dụ: Thời trang, F&B, Công nghệ"
                required
                disabled={loading}
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-brand focus:ring-1 focus:ring-brand/40 transition-all shadow-inner"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {t('tone')}
                </label>
                <select
                  value={tone}
                  onChange={e => setTone(e.target.value)}
                  disabled={loading}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-brand transition-all cursor-pointer"
                >
                  {TONE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className="text-slate-800 bg-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {t('postCount')}
                </label>
                <select
                  value={postCount}
                  onChange={e => setPostCount(Number(e.target.value))}
                  disabled={loading}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-brand transition-all cursor-pointer"
                >
                  <option value={3} className="text-slate-800 bg-white">3 ngày / 3 bài</option>
                  <option value={5} className="text-slate-800 bg-white">5 ngày / 5 bài</option>
                  <option value={7} className="text-slate-800 bg-white">7 ngày / 7 bài</option>
                </select>
              </div>
            </div>

            <div className="border-t border-slate-100 my-4 pt-4 space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                Thiết lập Lên lịch
              </h3>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">
                  Link đích bài viết (URL Target)
                </label>
                <input
                  type="url"
                  value={urlTarget}
                  onChange={e => setUrlTarget(e.target.value)}
                  placeholder="https://yourstore.com/deal"
                  disabled={loading}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-brand transition-all shadow-inner"
                />
              </div>

              {plan.some(p => p.platform === 'email') && (
                <div className="space-y-1.5 animate-in slide-in-from-top-1">
                  <label className="text-xs font-medium text-slate-600">
                    Người nhận Email (Ngăn cách bởi dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={recipients}
                    onChange={e => setRecipients(e.target.value)}
                    placeholder="khach1@domain.com, khach2@..."
                    disabled={loading}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-brand transition-all shadow-inner"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">
                  Ngày bắt đầu xuất bản
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => handleStartDateChange(e.target.value)}
                  disabled={loading}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-brand transition-all shadow-inner"
                />
              </div>

              <div className="flex items-center gap-3 py-2 bg-slate-50/60 px-3 rounded-xl border border-slate-200/50">
                <input
                  type="checkbox"
                  id="aiGenImage"
                  checked={aiGenImage}
                  onChange={e => setAiGenImage(e.target.checked)}
                  disabled={loading}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand accent-brand cursor-pointer"
                />
                <label htmlFor="aiGenImage" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  Tự động tạo ảnh minh họa
                </label>
              </div>


              <div className="space-y-2 py-2 bg-slate-50/60 px-3 rounded-xl border border-slate-200/50">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoWatermark"
                    checked={autoWatermark}
                    onChange={e => setAutoWatermark(e.target.checked)}
                    disabled={loading}
                    className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand accent-brand cursor-pointer"
                  />
                  <label htmlFor="autoWatermark" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                    {t('Tự động đóng dấu ảnh')}
                  </label>
                </div>
                {autoWatermark && (
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={e => setWatermarkText(e.target.value)}
                    placeholder={t('Chữ đóng dấu (Ví dụ: © Brand)')}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-850 focus:outline-none focus:border-brand shadow-inner animate-in slide-in-from-top-1"
                  />
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !topic.trim() || !industry.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-brand to-orange-500 text-white font-bold text-sm shadow-md hover:brightness-105 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  {t('generating')}
                </>
              ) : (
                <>
                  {t('generatePlan')}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Section Content Planner */}
        <div className="lg:col-span-8 space-y-6">
          {plan.length > 0 ? (
            <>
              {/* Batch Actions & View Switcher */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    Kế hoạch đăng bài đa kênh
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Bạn có thể điều chỉnh nội dung và ngày giờ đăng bài từng ngày trước khi kích hoạt.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  {/* View Mode Toggle */}
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setViewType('timeline')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        viewType === 'timeline'
                          ? 'bg-white text-brand shadow-sm border border-slate-200/50'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Dòng thời gian
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewType('grid')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        viewType === 'grid'
                          ? 'bg-white text-brand shadow-sm border border-slate-200/50'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Lưới Ô lịch
                    </button>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleSaveTemplates}
                      disabled={saveLoading || scheduleLoading}
                      className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {saveLoading ? 'Đang lưu... ' : ''}
                      {t('saveAsTemplate')}
                    </button>
                    <button
                      onClick={handleAutoSchedule}
                      disabled={saveLoading || scheduleLoading}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-gradient-to-r from-brand to-orange-500 hover:brightness-105 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {scheduleLoading ? 'Đang lên lịch... ' : ''}
                      {t('autoSchedule')}
                    </button>
                  </div>
                </div>
              </div>

              {/* View Rendering */}
              {viewType === 'timeline' ? (
                /* Light Vertical Timeline View */
                <div className="relative border-l-2 border-slate-200 pl-6 ml-4 space-y-6 py-1">
                  {plan.map((item, index) => {
                    const charCount = item.content.length;
                    return (
                      <div key={index} className="relative group">
                        {/* Orange Dot indicator */}
                        <span className="absolute -left-[35px] top-4 w-4 h-4 rounded-full bg-white border-2 border-brand group-hover:scale-125 transition-transform flex items-center justify-center shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                        </span>

                        {/* White Card Container */}
                        <div className="bg-white border border-slate-200/80 hover:border-slate-300 transition-all duration-300 rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="px-2.5 py-1 rounded-lg bg-brand/10 text-brand text-xs font-bold uppercase tracking-wider">
                                {item.day}
                              </span>
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/60">
                                {renderPlatformIcon(item.platform)}
                                <span className="text-xs font-bold text-slate-700 capitalize">{item.platform}</span>
                              </div>
                            </div>
                            
                            {/* Date-time picker for individual post */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Hẹn giờ:</span>
                              <input
                                type="datetime-local"
                                value={item.scheduledAt || ''}
                                onChange={e => handleCardChange(index, 'scheduledAt', e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-brand focus:bg-white transition-all shadow-inner"
                              />
                            </div>
                          </div>

                          {/* Inputs editable */}
                          <div className="space-y-3.5">
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Tiêu đề bài viết</label>
                              <input
                                type="text"
                                value={item.title}
                                onChange={e => handleCardChange(index, 'title', e.target.value)}
                                className="w-full bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-brand focus:outline-none rounded-xl px-3 py-2 text-sm font-bold text-slate-800 transition-all shadow-inner"
                              />
                            </div>

                            {/* Image Section */}
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                                Ảnh minh họa
                              </label>
                              {item.imageUrl ? (
                                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group/img max-w-sm">
                                  <img
                                    src={item.imageUrl}
                                    alt="Preview"
                                    className="w-full h-40 object-cover"
                                  />
                                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleGenerateCardImage(index)}
                                      disabled={imageLoadingIndex !== null}
                                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-xs font-bold text-slate-800 shadow transition-all flex items-center gap-1"
                                    >
                                      {imageLoadingIndex === index ? 'Đang tạo...' : 'Sinh lại ảnh'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCardChange(index, 'imageUrl', null)}
                                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow transition-all"
                                    >
                                      Xóa ảnh
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="rounded-xl border border-dashed border-slate-350 p-4 flex flex-col gap-3 bg-slate-50/50 max-w-md w-full">
                                  {imageLoadingIndex === index ? (
                                    <div className="flex flex-col items-center gap-2 py-2">
                                      <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                                      <span className="text-xs text-slate-500 font-medium">Đang tạo ảnh...</span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-2 w-full">
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          value={item.imagePrompt || ''}
                                          onChange={e => handleCardChange(index, 'imagePrompt', e.target.value)}
                                          placeholder="Mô tả hình ảnh muốn vẽ..."
                                          className="input text-xs w-full py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-brand px-3"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleGenerateCardImage(index)}
                                          className="px-4 py-1.5 rounded-lg bg-orange-50 border border-orange-200 hover:bg-orange-100 text-xs font-bold text-brand transition-all shrink-0 cursor-pointer"
                                        >
                                          Tạo ảnh
                                        </button>
                                      </div>
                                      <p className="text-[10px] text-slate-400">
                                        * Để trống sẽ vẽ theo tiêu đề bài viết.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Nội dung</label>
                                <span className="text-[10px] text-slate-400 font-mono">{charCount} ký tự</span>
                              </div>
                              <textarea
                                value={item.content}
                                onChange={e => handleCardChange(index, 'content', e.target.value)}
                                rows={4}
                                className="w-full bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-brand focus:outline-none rounded-xl px-3 py-2.5 text-sm text-slate-700 transition-all font-mono leading-relaxed resize-y shadow-inner"
                              />
                            </div>

                            {/* Publish Now Actions */}
                            {['facebook', 'zalo'].includes(item.platform.toLowerCase()) && (
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 pt-3 border-t border-slate-100">
                                <span className="text-[10px] font-bold text-slate-450 uppercase">Đăng bài một chạm:</span>
                                {connections.filter(c => c.platform === item.platform.toLowerCase()).length > 0 ? (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {connections
                                      .filter(c => c.platform === item.platform.toLowerCase())
                                      .map(conn => (
                                        <button
                                          key={conn.id}
                                          type="button"
                                          onClick={() => handlePublishNow(index, conn.id)}
                                          disabled={publishingIndex === index}
                                          className="px-2.5 py-1 rounded bg-brand/10 border border-brand/20 hover:bg-brand/20 text-brand text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                        >
                                          {publishingIndex === index && selectedConnId === conn.id ? (
                                            <>
                                              <span className="w-3 h-3 border border-brand border-t-transparent rounded-full animate-spin" />
                                              Đang đăng...
                                            </>
                                          ) : (
                                            `Đăng lên ${conn.pageName || conn.platform}`
                                          )}
                                        </button>
                                      ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-505 italic">
                                    Chưa có kết nối {item.platform === 'facebook' ? 'Fanpage' : 'Zalo OA'} hoạt động. <Link href="/dashboard/settings" className="text-brand hover:underline font-semibold">Kết nối ngay</Link>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Light Grid Calendar View */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in fade-in duration-200">
                  {plan.map((item, index) => {
                    const charCount = item.content.length;
                    return (
                      <div
                        key={index}
                        className="bg-white border border-slate-200 hover:border-slate-300 transition-all duration-300 rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-sm hover:shadow-md"
                      >
                        <div className="space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="px-2.5 py-0.5 rounded-lg bg-brand/10 text-brand text-xs font-bold uppercase tracking-wider">
                              {item.day}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {renderPlatformIcon(item.platform)}
                              <span className="text-[11px] text-slate-700 font-bold capitalize">{item.platform}</span>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={item.title}
                                onChange={e => handleCardChange(index, 'title', e.target.value)}
                                className="w-full bg-slate-50/20 border border-transparent hover:border-slate-200 focus:border-brand focus:bg-white focus:outline-none rounded-lg px-2 py-1 text-sm font-bold text-slate-800 transition-all"
                              />
                            </div>

                            {/* Image Section in Grid */}
                            <div className="space-y-1">
                              {item.imageUrl ? (
                                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group/img">
                                  <img
                                    src={item.imageUrl}
                                    alt="Preview"
                                    className="w-full h-32 object-cover"
                                  />
                                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleGenerateCardImage(index)}
                                      disabled={imageLoadingIndex !== null}
                                      className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-[10px] font-bold text-slate-850 shadow transition-all"
                                    >
                                      {imageLoadingIndex === index ? 'Đang tạo...' : 'Sinh lại'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCardChange(index, 'imageUrl', null)}
                                      className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-755 text-[10px] font-bold text-white shadow transition-all"
                                    >
                                      Xóa
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="rounded-xl border border-dashed border-slate-350 p-2.5 flex flex-col gap-2 bg-slate-50/50">
                                  {imageLoadingIndex === index ? (
                                    <div className="flex items-center justify-center gap-1.5 py-1">
                                      <div className="w-3.5 h-3.5 border border-brand border-t-transparent rounded-full animate-spin" />
                                      <span className="text-[10px] text-slate-500 font-medium">Đang tạo...</span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-1.5 w-full">
                                      <input
                                        type="text"
                                        value={item.imagePrompt || ''}
                                        onChange={e => handleCardChange(index, 'imagePrompt', e.target.value)}
                                        placeholder="Mô tả ảnh muốn vẽ..."
                                        className="input text-[11px] w-full py-1 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-brand px-2"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleGenerateCardImage(index)}
                                        className="w-full py-1 rounded-lg bg-orange-50 border border-orange-200 hover:bg-orange-100 text-[10px] font-bold text-brand transition-all cursor-pointer"
                                      >
                                        Tạo ảnh
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="space-y-1">
                              <textarea
                                value={item.content}
                                onChange={e => handleCardChange(index, 'content', e.target.value)}
                                rows={6}
                                className="w-full bg-slate-50/20 border border-transparent hover:border-slate-200 focus:border-brand focus:bg-white focus:outline-none rounded-lg px-2 py-1 text-xs text-slate-600 transition-all font-mono leading-relaxed resize-none shadow-inner"
                              />
                              <div className="text-[9px] text-right text-slate-400 font-mono">{charCount} ký tự</div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 mt-2 pt-3 border-t border-slate-100">
                          {['facebook', 'zalo'].includes(item.platform.toLowerCase()) && (
                            <div className="flex flex-col gap-1 pb-2 border-b border-slate-100/60 mb-2">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Đăng bài một chạm:</span>
                              {connections.filter(c => c.platform === item.platform.toLowerCase()).length > 0 ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {connections
                                    .filter(c => c.platform === item.platform.toLowerCase())
                                    .map(conn => (
                                      <button
                                        key={conn.id}
                                        type="button"
                                        onClick={() => handlePublishNow(index, conn.id)}
                                        disabled={publishingIndex === index}
                                        className="px-2 py-0.5 rounded bg-brand/10 border border-brand/20 hover:bg-brand/20 text-brand text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                      >
                                        {publishingIndex === index && selectedConnId === conn.id ? (
                                          <>
                                            <span className="w-2.5 h-2.5 border border-brand border-t-transparent rounded-full animate-spin" />
                                            Đang đăng...
                                          </>
                                        ) : (
                                          `Đăng lên ${conn.pageName || conn.platform}`
                                        )}
                                      </button>
                                    ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-550 italic">
                                  Chưa có kết nối {item.platform === 'facebook' ? 'Fanpage' : 'Zalo OA'} hoạt động. <Link href="/dashboard/settings" className="text-brand hover:underline font-semibold">Kết nối ngay</Link>
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Ngày giờ xuất bản:</span>
                            <input
                              type="datetime-local"
                              value={item.scheduledAt || ''}
                              onChange={e => handleCardChange(index, 'scheduledAt', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-brand focus:bg-white transition-all shadow-inner"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* Light AI Empty State */
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center border border-dashed border-slate-300 rounded-2xl p-8 text-center bg-slate-50/30 relative overflow-hidden shadow-inner">
              <div className="absolute -top-12 -left-12 w-48 h-48 bg-brand/5 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-brand/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-lg font-bold mb-5 shadow-sm text-brand animate-pulse">
                AI
              </div>

              <h3 className="text-lg font-bold text-slate-800 mb-2">Trợ lý lập kế hoạch nội dung AI</h3>
              <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
                Nhập chủ đề và ngành kinh doanh của bạn ở biểu mẫu bên trái, hoặc click chọn một gợi ý mẫu. AI sẽ tự động phân tích và sinh chuỗi bài viết tối ưu cho nhiều kênh mạng xã hội khác nhau.
              </p>

              {/* Description Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg text-left mt-2">
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    Lên kế hoạch đa kênh
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Tự động phân bổ và chuẩn bị bài đăng cho Facebook Page, Zalo OA hoặc Email.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    Đề xuất giờ vàng
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Đề xuất giờ vàng tối ưu dựa trên dữ liệu click, tương tác thực tế từ hệ thống.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
