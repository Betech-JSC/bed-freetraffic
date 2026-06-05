'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch, apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { useLocale } from '@/context/LocaleContext';

export default function CampaignsPage() {
  const { t } = useLocale();
  const [keywords, setKeywords] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    keyword: '',
    url: '',
    currentPosition: '',
    searchVolume: '',
    channelId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setFetchError('');
    try {
      const [kwData, chData] = await Promise.all([apiJson<any[]>('/keywords'), apiJson<any[]>('/channels')]);
      setKeywords(kwData);
      setChannels(chData);
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : t('Không tải được dữ liệu'));
      setKeywords([]);
      setChannels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiJson('/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      setIsModalOpen(false);
      setFormData({ keyword: '', url: '', currentPosition: '', searchVolume: '', channelId: '' });
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('Xóa từ khóa này khỏi hệ thống?'))) return;
    try {
      await apiFetch(`/keywords/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const top3 = keywords.filter((k) => k.currentPosition && k.currentPosition <= 3).length;
  const top10 = keywords.filter((k) => k.currentPosition && k.currentPosition > 3 && k.currentPosition <= 10).length;
  const outside = keywords.filter((k) => !k.currentPosition || k.currentPosition > 10).length;

  return (
    <div className="page-container">
      <PageHeader
        title={t('Campaigns & Từ khóa')}
        description={t('Theo dõi thứ hạng SEO và gắn từ khóa với nguồn traffic.')}
        actions={
          <button type="button" onClick={() => setIsModalOpen(true)} className="btn-primary">
            {t('Thêm từ khóa')}
          </button>
        }
      />

      {fetchError && <div className="alert-error">{fetchError}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard label={t('Tổng từ khóa')} value={keywords.length} accent="brand" />
        <StatCard label="Top 1–3" value={top3} accent="emerald" />
        <StatCard label="Top 4–10" value={top10} accent="blue" />
        <StatCard label={t('Ngoài top 10')} value={outside} accent="slate" />
      </div>

      <div className="table-wrap">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="table-modern w-full">
            <thead>
              <tr>
                <th>{t('Từ khóa')}</th>
                <th>URL</th>
                <th>{t('Thứ hạng')}</th>
                <th>Volume</th>
                <th>{t('Kênh')}</th>
                <th className="text-right">{t('Thao tác')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <div className="inline-block w-8 h-8 border-2 border-brand/30 border-t-brand rounded-full animate-spin mb-3" />
                    <p>{t('Đang tải...')}</p>
                  </td>
                </tr>
              ) : keywords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <p className="text-slate-500 font-medium">{t('Chưa có từ khóa')}</p>
                    <button type="button" onClick={() => setIsModalOpen(true)} className="btn-primary mt-4">
                      {t('Thêm từ khóa đầu tiên')}
                    </button>
                  </td>
                </tr>
              ) : (
                keywords.map((kw) => (
                  <tr key={kw.id}>
                    <td className="font-semibold text-slate-900">{kw.keyword}</td>
                    <td className="text-slate-500 max-w-[200px] truncate">{kw.url || '—'}</td>
                    <td>
                      {kw.currentPosition ? (
                        <span
                          className={
                            kw.currentPosition <= 3
                              ? 'badge-success'
                              : kw.currentPosition <= 10
                                ? 'badge-brand'
                                : 'badge-neutral'
                          }
                        >
                          Top {kw.currentPosition}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="font-medium tabular-nums">{kw.searchVolume?.toLocaleString() || '—'}</td>
                    <td>{kw.channel ? <span className="badge-neutral">{kw.channel.name}</span> : '—'}</td>
                    <td className="text-right">
                      <button type="button" onClick={() => handleDelete(kw.id)} className="btn-danger-ghost">
                        {t('Xóa')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-panel max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-slate-900 mb-6">{t('Thêm từ khóa SEO')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">{t('Từ khóa *')}</label>
                <input
                  required
                  type="text"
                  className="input"
                  placeholder={t('VD: thiết kế web giá rẻ')}
                  value={formData.keyword}
                  onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                />
              </div>
              <div>
                <label className="label">{t('URL (tùy chọn)')}</label>
                <input
                  type="url"
                  className="input"
                  placeholder="https://..."
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('Thứ hạng')}</label>
                  <input
                    type="number"
                    min={1}
                    className="input"
                    value={formData.currentPosition}
                    onChange={(e) => setFormData({ ...formData, currentPosition: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Search volume</label>
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={formData.searchVolume}
                    onChange={(e) => setFormData({ ...formData, searchVolume: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label">{t('Kênh')}</label>
                <select
                  className="input"
                  value={formData.channelId}
                  onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
                >
                  <option value="">{t('— Không chọn —')}</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">
                  {t('Hủy')}
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
                  {isSubmitting ? t('Đang lưu...') : t('Lưu')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
