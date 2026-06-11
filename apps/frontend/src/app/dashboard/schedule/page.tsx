'use client';

import { useEffect, useState } from 'react';
import { apiFetch, apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';
import { useLocale } from '@/context/LocaleContext';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type ChannelResult = { platform: string; success: boolean; message: string; at: string };

type Schedule = {
  id: number;
  title: string;
  content: string;
  platforms: string;
  scheduledAt: string;
  repeatRule?: string | null;
  repeatUntil?: string | null;
  cronExpression?: string | null;
  abTestId?: number | null;
  status: string;
  imageUrl?: string | null;
  urlTarget?: string | null;
  recipients?: string | null;
  errorMessage?: string | null;
  channelResults?: string | null;
  overlayText?: string | null;
  overlayWatermark?: string | null;
  overlayPosition?: string | null;
  overlayFontSize?: number | null;
};

type AbTestOption = { id: number; name: string };

type ChannelStatus = Record<string, { connected: boolean; label: string }>;

const PLATFORM_OPTIONS = [
  { id: 'facebook', label: 'Facebook', desc: 'Đăng Fanpage (đã kết nối Cài đặt)' },
  { id: 'email', label: 'Email (Gmail/SMTP)', desc: 'Gửi qua SMTP trong Cài đặt' },
  { id: 'zalo', label: 'Zalo OA', desc: 'Đăng bài Official Account' },
  { id: 'youtube', label: 'YouTube', desc: 'Hướng dẫn mô tả / đăng tay (FT-CHAN-06)' },
  { id: 'community', label: 'Forum / Community', desc: 'Hướng dẫn đăng tay (FT-CHAN-07)' },
] as const;

function parseChannelResults(raw: string | null | undefined): ChannelResult[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as ChannelResult[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function statusBadge(status: string): string {
  if (status === 'PUBLISHED') return 'badge-success';
  if (status === 'PARTIAL') return 'badge-warning';
  if (status === 'FAILED') return 'text-red-600 font-semibold';
  if (status === 'SENDING') return 'badge-brand';
  if (status === 'PENDING') return 'badge-neutral';
  return 'badge';
}

export default function ScheduleBotPage() {
  const { t, locale } = useLocale();
  const [items, setItems] = useState<Schedule[]>([]);
  const [channels, setChannels] = useState<ChannelStatus | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [urlTarget, setUrlTarget] = useState('');
  const [recipients, setRecipients] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [repeatRule, setRepeatRule] = useState('');
  const [cronExpression, setCronExpression] = useState('');
  const [repeatUntil, setRepeatUntil] = useState('');
  const [abTestId, setAbTestId] = useState('');
  const [abTests, setAbTests] = useState<AbTestOption[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [platforms, setPlatforms] = useState<string[]>(['facebook']);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [overlayText, setOverlayText] = useState('');
  const [overlayWatermark, setOverlayWatermark] = useState('');
  const [overlayPosition, setOverlayPosition] = useState('bottom-right');
  const [overlayFontSize, setOverlayFontSize] = useState('32');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [smartGoldenHour, setSmartGoldenHour] = useState(false);
  const [fetchingGoldenHour, setFetchingGoldenHour] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [autopilot, setAutopilot] = useState(false);

  const handleSmartGoldenHour = async (checked: boolean) => {
    setSmartGoldenHour(checked);
    if (!checked) return;

    setFetchingGoldenHour(true);
    try {
      const res = await apiJson<{ recommendedHours: number[]; isFallback: boolean; message: string }>('/schedules/golden-hour');
      if (res && res.recommendedHours && res.recommendedHours.length > 0) {
        const hour = res.recommendedHours[0];
        setGoldenHour(hour);
        setSuccess(`${t('Đã tự điền giờ vàng tối ưu:')} ${hour}:00. (${res.message})`);
      }
    } catch (err: any) {
      setError(err?.message || t('Lỗi khi tải giờ vàng đề xuất'));
    } finally {
      setFetchingGoldenHour(false);
    }
  };

  const platformLabel = (raw: string): string => {
    return raw
      .split(',')
      .map((p) => t(PLATFORM_OPTIONS.find((o) => o.id === p.trim())?.label || p.trim()))
      .join(', ');
  };

  const statusLabel = (status: string): string => {
    const map: Record<string, string> = {
      PENDING: t('Chờ gửi'),
      SENDING: t('Đang gửi'),
      PUBLISHED: t('Đã gửi'),
      PARTIAL: t('Một phần'),
      FAILED: t('Lỗi'),
    };
    return map[status] || status;
  };

  const setGoldenHour = (hour: number) => {
    const d = new Date();
    if (d.getHours() >= hour) {
      d.setDate(d.getDate() + 1);
    }
    d.setHours(hour, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setScheduledAt(formatted);
  };

  function toDatetimeLocal(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const load = async () => {
    try {
      const [list, ch, testsData, templatesData] = await Promise.all([
        apiJson<Schedule[]>('/schedules'),
        apiJson<ChannelStatus>('/schedules/channels-status'),
        apiJson<AbTestOption[]>('/abtests/running').catch(() => []),
        apiJson<any[]>('/templates').catch(() => []),
      ]);
      setItems(list);
      setChannels(ch);
      setAbTests(testsData);
      setTemplates(templatesData);
      setError('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không tải được dữ liệu'));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const togglePlatform = (id: string) => {
    setPlatforms((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setUrlTarget('');
    setRecipients('');
    setScheduledAt('');
    setRepeatRule('');
    setCronExpression('');
    setRepeatUntil('');
    setAbTestId('');
    setPlatforms(['facebook']);
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setSmartGoldenHour(false);
    setAutopilot(false);
    setOverlayText('');
    setOverlayWatermark('');
    setOverlayPosition('bottom-right');
    setOverlayFontSize('32');
  };

  const startEdit = (item: Schedule) => {
    if (!['PENDING', 'FAILED'].includes(item.status)) return;
    setEditingId(item.id);
    setTitle(item.title);
    setContent(item.content);
    setUrlTarget(item.urlTarget || '');
    setRecipients(item.recipients || '');
    setScheduledAt(toDatetimeLocal(item.scheduledAt));
    setRepeatRule(item.repeatRule || '');
    setCronExpression(item.cronExpression || '');
    setRepeatUntil(item.repeatUntil ? toDatetimeLocal(item.repeatUntil) : '');
    setAbTestId(item.abTestId ? String(item.abTestId) : '');
    setPlatforms(
      item.platforms
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    );
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(item.imageUrl || null);
    setSmartGoldenHour(false);
    setAutopilot(false);
    setOverlayText(item.overlayText || '');
    setOverlayWatermark(item.overlayWatermark || '');
    setOverlayPosition(item.overlayPosition || 'bottom-right');
    setOverlayFontSize(item.overlayFontSize ? String(item.overlayFontSize) : '32');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(URL.createObjectURL(file));
  };

  const submit = async (e: React.FormEvent) => {
    await handleSubmit(e, false);
  };

  const handleSubmit = async (e: React.FormEvent, asDraft: boolean = false) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');

    if (platforms.length === 0) {
      setError(t('Chọn ít nhất một kênh'));
      return;
    }
    if (platforms.includes('email') && !recipients.trim()) {
      setError(t('Nhập email người nhận khi chọn kênh Email'));
      return;
    }

    const disconnected = platforms.filter((p) => channels && !channels[p]?.connected);
    if (disconnected.length > 0) {
      setError(`${t('Chưa kết nối:')} ${disconnected.join(', ')} — ${t('vào Cài đặt trước khi hẹn giờ.')}`);
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        title,
        content,
        platforms: platforms.join(','),
        scheduledAt: autopilot ? undefined : scheduledAt,
        autopilot: autopilot || undefined,
        urlTarget: urlTarget.trim() || undefined,
        recipients: platforms.includes('email') ? recipients.trim() : undefined,
        repeatRule: repeatRule || null,
        cronExpression: repeatRule === 'cron' ? cronExpression.trim() : null,
        repeatUntil: repeatUntil || null,
        abTestId: abTestId ? parseInt(abTestId, 10) : null,
        status: asDraft ? 'DRAFT' : 'PENDING',
        overlayText: overlayText.trim() || undefined,
        overlayWatermark: overlayWatermark.trim() || undefined,
        overlayPosition: overlayPosition || undefined,
        overlayFontSize: overlayFontSize ? parseInt(overlayFontSize, 10) : undefined,
      };

      if (!imageFile && imagePreview) {
        payload.imageUrl = imagePreview;
      }

      if (editingId) {
        if (imageFile) {
          setError(t('Sửa lịch chưa hỗ trợ đổi ảnh — xóa lịch và tạo mới nếu cần ảnh khác.'));
          return;
        }
        await apiJson(`/schedules/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setSuccess(asDraft ? t('Đã lưu lịch ở trạng thái nháp.') : t('Đã cập nhật lịch hẹn giờ.'));
      } else if (imageFile) {
        const fd = new FormData();
        fd.append('title', payload.title);
        fd.append('content', payload.content);
        fd.append('platforms', payload.platforms);
        if (payload.scheduledAt) {
          fd.append('scheduledAt', payload.scheduledAt);
        }
        if (payload.autopilot) {
          fd.append('autopilot', 'true');
        }
        fd.append('status', payload.status);
        if (payload.urlTarget) fd.append('urlTarget', payload.urlTarget);
        if (payload.recipients) fd.append('recipients', payload.recipients);
        if (payload.repeatRule) fd.append('repeatRule', payload.repeatRule);
        if (payload.cronExpression) fd.append('cronExpression', payload.cronExpression);
        if (payload.repeatUntil) fd.append('repeatUntil', payload.repeatUntil);
        if (payload.abTestId) fd.append('abTestId', String(payload.abTestId));
        if (payload.overlayText) fd.append('overlayText', payload.overlayText);
        if (payload.overlayWatermark) fd.append('overlayWatermark', payload.overlayWatermark);
        if (payload.overlayPosition) fd.append('overlayPosition', payload.overlayPosition);
        if (payload.overlayFontSize) fd.append('overlayFontSize', String(payload.overlayFontSize));
        fd.append('image', imageFile);

        const res = await apiFetch('/schedules', { method: 'POST', body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error || `Lỗi (${res.status})`);
        setSuccess(asDraft ? t('Đã tạo bản nháp thành công.') : t('Đã tạo lịch hẹn giờ. Bot sẽ gửi khi đến giờ.'));
      } else {
        await apiJson('/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setSuccess(asDraft ? t('Đã tạo bản nháp thành công.') : t('Đã tạo lịch hẹn giờ. Bot sẽ gửi khi đến giờ.'));
      }

      resetForm();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Không lưu được lịch'));
    } finally {
      setSubmitting(false);
    }
  };

  const sendNow = async (id: number) => {
    setSendingId(id);
    setError('');
    setSuccess('');
    try {
      const r = await apiJson<{ status: string; channelResults: ChannelResult[] }>(
        `/schedules/${id}/send-now`,
        { method: 'POST' }
      );
      setSuccess(`${t('Gửi xong — trạng thái:')} ${statusLabel(r.status)}`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Gửi thất bại'));
    } finally {
      setSendingId(null);
    }
  };

  const remove = (id: number) => {
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    setError('');
    setSuccess('');
    try {
      await apiJson(`/schedules/${deleteConfirmId}`, { method: 'DELETE' });
      await load();
      setSuccess(t('Đã xóa lịch đăng bài thành công.'));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không xóa được'));
    } finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const handleUpdateScheduleTime = async (id: number, newTime: string) => {
    try {
      setError('');
      setSuccess('');
      await apiJson(`/schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: newTime }),
      });
      setSuccess(t('Đã di chuyển lịch đăng bài thành công.'));
      await load();
    } catch (err: any) {
      setError(err.message || t('Không cập nhật được lịch'));
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        title={t('Bot hẹn giờ')}
        description={t('FR-02 — Hẹn giờ, lặp ngày/tuần, gắn A/B test khi publish (tự chọn biến thể + track click).')}
        actions={
          <Link href="/dashboard/automation" className="btn-secondary text-sm">
            {t('→ Bot Automation')}
          </Link>
        }
      />

      <div className="alert-info text-sm">
        <strong>Deploy:</strong> {t('User tắt máy vẫn gửi được khi backend chạy trên server 24/7. Local chỉ gửi khi')}{' '}
        <code className="text-xs bg-white/60 px-1 rounded">npm run dev</code> {t('đang bật.')}
      </div>

      {channels && (
        <div className="flex flex-wrap gap-2">
          {PLATFORM_OPTIONS.map((p) => {
            const c = channels[p.id];
            const isManual = p.id === 'youtube' || p.id === 'community';
            return (
              <span
                key={p.id}
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  isManual
                    ? 'bg-blue-50 text-blue-700'
                    : c?.connected
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                {t(p.label)}: {isManual ? t('Đăng tay') : c?.connected ? t('Đã kết nối') : t('Chưa kết nối')}
              </span>
            );
          })}
          <Link href="/dashboard/settings" className="text-xs text-brand font-semibold self-center">
            {t('Cài đặt kết nối')}
          </Link>
        </div>
      )}

      {error && <p className="alert-error text-sm">{error}</p>}
      {success && <p className="alert-info text-sm">{success}</p>}

      <form onSubmit={submit} className="card p-6 lg:p-8 space-y-8">
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{t('1. Nội dung')}</h3>
            {templates.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-semibold">{t('Import từ Content Editor:')}</span>
                <select
                  className="input py-1.5 px-3 text-xs bg-slate-50 border-slate-200 focus:border-brand font-semibold max-w-[240px] cursor-pointer"
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    const selected = templates.find((t) => String(t.id) === id);
                    if (selected) {
                      setTitle(selected.title);
                      setContent(selected.content);
                      if (selected.imageUrl) {
                        setImagePreview(selected.imageUrl);
                        setImageFile(null);
                      } else {
                        setImagePreview(null);
                        setImageFile(null);
                      }
                      setSuccess(t('Đã import bài viết mẫu thành công.'));
                    }
                    e.target.value = ""; // Reset
                  }}
                >
                  <option value="">-- {t('Chọn bài viết mẫu')} --</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <input
            className="input w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('Tiêu đề *')}
            required
          />
          <textarea
            className="input w-full min-h-[120px]"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('Nội dung — {url}, {name}, {date}')}
            required
          />
          <input
            className="input w-full"
            type="url"
            value={urlTarget}
            onChange={(e) => setUrlTarget(e.target.value)}
            placeholder={t('URL đích (tùy chọn)')}
          />
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{t('2. Ảnh (tùy chọn)')}</h3>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
            {imagePreview ? (
              <div className="relative inline-block">
                <img src={imagePreview} alt="" className="max-h-40 rounded-lg mx-auto" />
                <button
                  type="button"
                  className="absolute top-2 right-2 bg-red-500 text-white rounded px-2 py-1 text-xs font-semibold"
                  onClick={() => {
                    setImageFile(null);
                    if (imagePreview) URL.revokeObjectURL(imagePreview);
                    setImagePreview(null);
                  }}
                >
                  Xóa
                </button>
              </div>
            ) : (
              <label className="cursor-pointer block text-sm text-slate-600">
                {t('Chọn ảnh')}
                <input type="file" accept="image/*" className="hidden" onChange={onImageChange} />
              </label>
            )}
          </div>

          {imagePreview && (
            <div className="mt-4 p-5 bg-slate-50/50 rounded-xl border border-slate-100 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                ✨ {t('Cấu hình đóng dấu ảnh (Watermark / Text Overlay)')}
              </h4>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    {t('Chữ đóng dấu')}
                  </label>
                  <input
                    className="input w-full text-sm bg-white"
                    value={overlayText}
                    onChange={(e) => setOverlayText(e.target.value)}
                    placeholder={t('Ví dụ: © Betech JSC')}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    {t('Đường dẫn logo đóng dấu')}
                  </label>
                  <input
                    className="input w-full text-sm bg-white"
                    value={overlayWatermark}
                    onChange={(e) => setOverlayWatermark(e.target.value)}
                    placeholder={t('Ví dụ: /uploads/logo.png')}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    {t('Vị trí đóng dấu')}
                  </label>
                  <select
                    className="input w-full text-sm bg-white"
                    value={overlayPosition}
                    onChange={(e) => setOverlayPosition(e.target.value)}
                  >
                    <option value="bottom-right">{t('Góc dưới bên phải')}</option>
                    <option value="bottom-left">{t('Góc dưới bên trái')}</option>
                    <option value="top-right">{t('Góc trên bên phải')}</option>
                    <option value="top-left">{t('Góc trên bên trái')}</option>
                    <option value="center">{t('Chính giữa')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    {t('Kích thước chữ')}
                  </label>
                  <select
                    className="input w-full text-sm bg-white"
                    value={overlayFontSize}
                    onChange={(e) => setOverlayFontSize(e.target.value)}
                  >
                    <option value="16">{t('Nhỏ (16px)')}</option>
                    <option value="32">{t('Trung bình (32px)')}</option>
                    <option value="64">{t('Lớn (64px)')}</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{t('3. Thời gian & lặp')}</h3>
          <div className="flex flex-col gap-2 max-w-md">
            <input
              className="input w-full disabled:bg-slate-50 disabled:text-slate-400 font-medium"
              type="datetime-local"
              value={autopilot ? '' : scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required={!autopilot}
              disabled={autopilot}
            />
            {!editingId && (
              <div className="flex flex-col gap-1 mt-1 p-3 bg-brand/5 border border-brand/10 rounded-xl">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autopilot"
                    checked={autopilot}
                    onChange={(e) => {
                      setAutopilot(e.target.checked);
                      if (e.target.checked) {
                        setSmartGoldenHour(false);
                      }
                    }}
                    className="w-4 h-4 accent-brand border-slate-300 rounded cursor-pointer"
                  />
                  <label htmlFor="autopilot" className="text-xs text-brand font-bold cursor-pointer flex items-center gap-1.5 select-none">
                    🚀 {t('autopilotMode')}
                  </label>
                </div>
                {autopilot && (
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    {t('autopilotDesc')}
                  </p>
                )}
              </div>
            )}
            {!autopilot && (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="smartGoldenHour"
                  checked={smartGoldenHour}
                  onChange={(e) => handleSmartGoldenHour(e.target.checked)}
                  className="w-4 h-4 accent-brand border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="smartGoldenHour" className="text-xs text-slate-600 font-semibold cursor-pointer flex items-center gap-1.5 select-none">
                  {t('smartGoldenHour')}
                  {fetchingGoldenHour && (
                    <span className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin inline-block" />
                  )}
                </label>
              </div>
            )}
            {!autopilot && (
              <div className="flex gap-1.5 flex-wrap items-center mt-1">
                <span className="text-xs text-slate-500 font-semibold mr-1">{t('Khung giờ vàng:')}</span>
                {[
                  { label: '09:00', hour: 9 },
                  { label: '12:00', hour: 12 },
                  { label: '15:00', hour: 15 },
                  { label: '20:00', hour: 20 },
                ].map((g) => (
                  <button
                    key={g.hour}
                    type="button"
                    onClick={() => setGoldenHour(g.hour)}
                    className="px-2 py-0.5 bg-brand/5 hover:bg-brand/10 text-brand text-xs font-semibold rounded border border-brand/10 transition-colors"
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid sm:grid-cols-3 gap-3 max-w-2xl">
            <select className="input" value={repeatRule} onChange={(e) => setRepeatRule(e.target.value)}>
              <option value="">{t('Không lặp')}</option>
              <option value="daily">{t('Lặp mỗi ngày')}</option>
              <option value="weekly">{t('Lặp mỗi tuần')}</option>
              <option value="cron">{t('Biểu thức Cron')}</option>
            </select>
            <input
              className="input sm:col-span-2"
              type="datetime-local"
              value={repeatUntil}
              onChange={(e) => setRepeatUntil(e.target.value)}
              placeholder={t('Kết thúc lặp (tùy chọn)')}
              disabled={!repeatRule}
              title={t('Dừng lặp sau thời điểm này')}
            />
          </div>
          {repeatRule === 'cron' && (
            <div className="grid gap-2 max-w-2xl">
              <label className="text-xs font-semibold text-slate-700 block">{t('Cấu hình biểu thức Cron')}</label>
              <input
                className="input w-full"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                placeholder={t('Ví dụ: 0 9 * * 1,5 (9h sáng Thứ 2 và Thứ 5)')}
                required={repeatRule === 'cron'}
              />
              <span className="text-[10px] text-slate-500 block -mt-1">
                {t('Phút Giờ Ngày-trong-tháng Tháng Ngày-trong-tuần. Ví dụ:')} <code>*/5 * * * *</code> {t('(5 phút/lần).')}
              </span>
            </div>
          )}
          {repeatRule && (
            <p className="text-xs text-slate-500">
              {t('Sau khi gửi thành công (toàn bộ hoặc một phần), lịch tự chuyển sang lần tiếp theo.')}
            </p>
          )}
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{t('3b. A/B test (tùy chọn)')}</h3>
          <select className="input max-w-md" value={abTestId} onChange={(e) => setAbTestId(e.target.value)}>
            <option value="">{t('Không dùng A/B — gửi nội dung form')}</option>
            {abTests.map((abTest) => (
              <option key={abTest.id} value={abTest.id}>
                {abTest.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            {t('Khi gửi: chọn ngẫu nhiên mẫu A hoặc B, ghi impression; link đích được bọc track click (FR-08).')}
          </p>
          {abTests.length === 0 && (
            <Link href="/dashboard/abtests" className="text-xs text-brand font-semibold">
              {t('Tạo A/B test đang RUNNING →')}
            </Link>
          )}
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{t('4. Kênh')}</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            {PLATFORM_OPTIONS.map((p) => {
              const on = platforms.includes(p.id);
              const connected = channels?.[p.id]?.connected;
              const isManual = p.id === 'youtube' || p.id === 'community';
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlatform(p.id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    on ? 'border-brand bg-brand/5' : 'border-slate-200'
                  }`}
                >
                  <span className={`text-sm font-bold ${on ? 'text-brand' : 'text-slate-800'}`}>{t(p.label)}</span>
                  <p className="text-xs text-slate-500 mt-1">{t(p.desc)}</p>
                  {isManual ? (
                    <p className="text-xs text-blue-600 mt-1">{t('Đăng tay')}</p>
                  ) : !connected ? (
                    <p className="text-xs text-amber-600 mt-1">{t('Chưa kết nối')}</p>
                  ) : (
                    <p className="text-xs text-emerald-600 mt-1">{t('Đã kết nối')}</p>
                  )}
                </button>
              );
            })}
          </div>
          {platforms.includes('email') && (
            <input
              className="input w-full"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="email1@gmail.com, email2@..."
              required
            />
          )}
        </section>

        <div className="flex gap-3 border-t border-slate-100 pt-4">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? t('Đang lưu...') : editingId ? t('Lưu thay đổi') : t('Tạo lịch hẹn giờ')}
          </button>
          {!editingId && (
            <button
              type="button"
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all border border-slate-200/50"
              disabled={submitting}
              onClick={(e) => handleSubmit(e, true)}
            >
              {t('Lưu bản nháp')}
            </button>
          )}
          {editingId && (
            <button type="button" className="btn-secondary" onClick={resetForm}>
              {t('Hủy sửa')}
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={resetForm}>
            {t('Xóa form')}
          </button>
        </div>
      </form>

      {/* Mode Switch Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-3 mb-6">
        <button
          type="button"
          onClick={() => setViewMode('list')}
          className={`px-4 py-2 font-semibold text-sm rounded-lg transition-all ${
            viewMode === 'list' ? 'bg-brand text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {t('Danh sách lịch đã tạo')}
        </button>
        <button
          type="button"
          onClick={() => setViewMode('calendar')}
          className={`px-4 py-2 font-semibold text-sm rounded-lg transition-all ${
            viewMode === 'calendar' ? 'bg-brand text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {t('Lịch biểu tháng')}
        </button>
      </div>

      {viewMode === 'calendar' ? (
        <CalendarView
          items={items}
          startEdit={startEdit}
          sendNow={sendNow}
          remove={remove}
          onUpdateScheduleTime={handleUpdateScheduleTime}
        />
      ) : (
        <div className="table-wrap">
          <h3 className="text-lg font-bold text-slate-900 p-4 border-b">{t('Lịch đã tạo')}</h3>
          <table className="table-modern">
            <thead>
              <tr>
                <th>{t('Tiêu đề')}</th>
                <th>{t('Kênh')}</th>
                <th>{t('Giờ gửi')}</th>
                <th>{t('Lặp')}</th>
                <th>{t('Trạng thái')}</th>
                <th>{t('Chi tiết kênh')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    {t('Chưa có lịch. Tạo ở form trên hoặc dùng「Gửi thử」sau khi lưu.')}
                  </td>
                </tr>
              )}
              {items.map((i) => {
                const chResults = parseChannelResults(i.channelResults);
                return (
                  <tr key={i.id}>
                    <td className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{i.title}</span>
                        {(i.overlayText || i.overlayWatermark) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100" title={`${i.overlayText || ''} ${i.overlayWatermark || ''}`}>
                            ✨ Overlay
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-sm">{platformLabel(i.platforms)}</td>
                    <td className="whitespace-nowrap text-sm">
                      {new Date(i.scheduledAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}
                    </td>
                    <td className="text-xs text-slate-500">
                      {i.repeatRule === 'daily'
                        ? t('Hàng ngày')
                        : i.repeatRule === 'weekly'
                          ? t('Hàng tuần')
                          : i.repeatRule === 'cron'
                            ? `Cron: ${i.cronExpression || ''}`
                            : '—'}
                      {i.abTestId ? ` · A/B #${i.abTestId}` : ''}
                    </td>
                    <td>
                      <span className={statusBadge(i.status)}>{statusLabel(i.status)}</span>
                    </td>
                    <td className="text-xs text-slate-500 max-w-[280px]">
                      {chResults.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {chResults.map((r, idx) => (
                            <div key={`${r.platform}-${idx}`} className="flex items-center gap-1.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold capitalize ${
                                r.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {r.platform}
                              </span>
                              <span className="text-[10px] text-slate-600 truncate max-w-[200px]" title={r.message}>
                                {r.success ? t('Thành công') : r.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        i.errorMessage ? (
                          <span className="text-red-600 font-medium">{i.errorMessage}</span>
                        ) : '—'
                      )}
                    </td>
                    <td className="space-x-2 whitespace-nowrap">
                      {(i.status === 'PENDING' || i.status === 'FAILED' || i.status === 'DRAFT') && (
                        <button
                          type="button"
                          className="text-xs text-slate-600 hover:underline"
                          onClick={() => startEdit(i)}
                        >
                          {t('Sửa')}
                        </button>
                      )}
                      {(i.status === 'PENDING' || i.status === 'FAILED' || i.status === 'PARTIAL' || i.status === 'DRAFT') && (
                        <button
                          type="button"
                          className="text-xs text-brand font-semibold hover:underline"
                          disabled={sendingId === i.id}
                          onClick={() => sendNow(i.id)}
                        >
                          {sendingId === i.id ? t('Đang gửi...') : t('Gửi thử / gửi ngay')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-xs text-red-500 hover:underline"
                        onClick={() => remove(i.id)}
                      >
                        {t('Xóa')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={deleteConfirmId !== null}
        title={t('Xóa lịch hẹn giờ')}
        description={t('Bạn có chắc chắn muốn xóa lịch đăng bài này? Hành động này sẽ loại bỏ hoàn toàn lịch ra khỏi hệ thống.')}
        highlight={items.find((item) => item.id === deleteConfirmId)?.title}
        confirmLabel={t('Xóa lịch')}
        cancelLabel={t('Hủy')}
        variant="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}

function CalendarView({
  items,
  startEdit,
  sendNow,
  remove,
  onUpdateScheduleTime
}: {
  items: Schedule[];
  startEdit: (i: Schedule) => void;
  sendNow: (id: number) => void;
  remove: (id: number) => void;
  onUpdateScheduleTime: (id: number, newTime: string) => Promise<void>;
}) {
  const { t, locale } = useLocale();
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: { day: number; isCurrentMonth: boolean; date: Date }[] = [];
  const prevMonthDays = new Date(year, month, 0).getDate();
  
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    days.push({ day: prevMonthDays - i, isCurrentMonth: false, date: new Date(year, month - 1, prevMonthDays - i) });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) });
  }
  const totalSlots = 42;
  const nextMonthPadding = totalSlots - days.length;
  for (let i = 1; i <= nextMonthPadding; i++) {
    days.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
  }

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const formatDateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const schedulesByDay: Record<string, Schedule[]> = {};
  items.forEach(item => {
    const d = new Date(item.scheduledAt);
    const key = formatDateKey(d);
    if (!schedulesByDay[key]) schedulesByDay[key] = [];
    schedulesByDay[key].push(item);
  });

  const MONTH_NAMES_VI = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];

  const MONTH_NAMES_EN = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthNames = locale === 'vi' ? MONTH_NAMES_VI : MONTH_NAMES_EN;
  const headerText = locale === 'vi' ? `${monthNames[month]} Năm ${year}` : `${monthNames[month]} ${year}`;

  const handleDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData('text/plain', String(id));
  };

  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData('text/plain'));
    if (isNaN(id)) return;

    const originalSchedule = items.find(item => item.id === id);
    if (!originalSchedule) return;

    const originalTime = new Date(originalSchedule.scheduledAt);
    const newDate = new Date(targetDate);
    newDate.setHours(originalTime.getHours());
    newDate.setMinutes(originalTime.getMinutes());
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);

    void onUpdateScheduleTime(id, newDate.toISOString());
  };

  return (
    <div className="card p-4 space-y-4">
      <div className="flex justify-between items-center pb-2 border-b">
        <h4 className="font-bold text-slate-800 text-lg">
          {headerText}
        </h4>
        <div className="flex gap-2">
          <button type="button" onClick={prevMonth} className="btn-secondary py-1 px-3 text-xs">&larr; {t('Tháng trước')}</button>
          <button type="button" onClick={nextMonth} className="btn-secondary py-1 px-3 text-xs">{t('Tháng sau')} &rarr;</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-500 uppercase tracking-wider py-1 border-b">
        <div>{t('Chủ Nhật')}</div>
        <div>{t('Thứ Hai')}</div>
        <div>{t('Thứ Ba')}</div>
        <div>{t('Thứ Tư')}</div>
        <div>{t('Thứ Năm')}</div>
        <div>{t('Thứ Sáu')}</div>
        <div>{t('Thứ Bảy')}</div>
      </div>

      <div className="grid grid-cols-7 gap-1 bg-slate-100 rounded-lg p-0.5 min-h-[400px]">
        {days.map((dObj, idx) => {
          const key = formatDateKey(dObj.date);
          const daySchedules = schedulesByDay[key] || [];
          const isToday = formatDateKey(new Date()) === key;

          return (
            <div
              key={idx}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, dObj.date)}
              className={`bg-white p-2 rounded min-h-[90px] flex flex-col justify-between transition-colors border ${
                dObj.isCurrentMonth ? 'text-slate-800' : 'text-slate-300 bg-slate-50/50'
              } ${isToday ? 'border-brand ring-1 ring-brand/20' : 'border-slate-100'} hover:bg-orange-500/5`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${isToday ? 'bg-brand text-white' : ''}`}>
                  {dObj.day}
                </span>
                {daySchedules.length > 0 && (
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.5 rounded-full">
                    {daySchedules.length} {t('bài')}
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-1 overflow-y-auto max-h-[70px] custom-scrollbar pr-0.5">
                {daySchedules.map(s => {
                  let badgeColor = 'bg-slate-100 text-slate-700';
                  if (s.status === 'PUBLISHED') badgeColor = 'bg-green-50 text-green-700 border-green-200 border';
                  if (s.status === 'FAILED') badgeColor = 'bg-red-50 text-red-700 border-red-200 border';
                  if (s.status === 'DRAFT') badgeColor = 'bg-purple-50 text-purple-700 border-purple-200 border';
                  
                  const isDraggable = ['PENDING', 'FAILED', 'DRAFT'].includes(s.status);

                  return (
                    <div
                      key={s.id}
                      onClick={() => isDraggable && startEdit(s)}
                      draggable={isDraggable}
                      onDragStart={(e) => isDraggable && handleDragStart(e, s.id)}
                      className={`text-[10px] p-1 rounded font-medium cursor-pointer transition-all hover:scale-[1.02] ${badgeColor} flex justify-between items-center group ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      title={`${s.title} (${new Date(s.scheduledAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})`}
                    >
                      <span className="truncate flex-1">
                        {new Date(s.scheduledAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {s.title}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(s.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 ml-1 text-red-500 hover:text-red-700 font-bold px-0.5 text-xs transition-opacity"
                        title={t('Xóa')}
                      >
                        X
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
