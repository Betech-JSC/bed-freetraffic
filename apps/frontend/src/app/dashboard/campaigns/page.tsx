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

  // Bulk Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importGroupId, setImportGroupId] = useState('');
  const [groups, setGroups] = useState<any[]>([]);
  const [importTab, setImportTab] = useState<'text' | 'file'>('text');

  const fetchData = async () => {
    setFetchError('');
    try {
      const [kwData, chData, gpData] = await Promise.all([
        apiJson<any[]>('/keywords'),
        apiJson<any[]>('/channels'),
        apiJson<any[]>('/keywords/groups').catch(() => []),
      ]);
      setKeywords(kwData);
      setChannels(chData);
      setGroups(gpData);
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : t('Không tải được dữ liệu'));
      setKeywords([]);
      setChannels([]);
      setGroups([]);
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

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const parsedKeywords: { keyword: string; searchVolume?: number; url?: string }[] = [];
      const lines = importText.split('\n');
      
      for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        const parts = line.split(',');
        const keyword = parts[0]?.trim();
        if (!keyword) continue;

        const searchVolume = parts[1] ? parseInt(parts[1].trim()) : undefined;
        const url = parts[2] ? parts[2].trim() : undefined;

        parsedKeywords.push({
          keyword,
          searchVolume: isNaN(searchVolume as any) ? undefined : searchVolume,
          url,
        });
      }

      if (parsedKeywords.length === 0) {
        alert(t('Không tìm thấy từ khóa hợp lệ để import'));
        setIsSubmitting(false);
        return;
      }

      await apiJson('/keywords/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: parsedKeywords,
          groupId: importGroupId ? parseInt(importGroupId) : undefined,
        }),
      });

      setIsImportModalOpen(false);
      setImportText('');
      setImportGroupId('');
      fetchData();
    } catch (err) {
      console.error(err);
      alert(t('Import từ khóa thất bại'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const lines = text.split('\n');
      let parsed = '';
      for (const line of lines) {
        if (line.trim()) {
          parsed += line.trim() + '\n';
        }
      }
      setImportText(parsed);
      setImportTab('text');
    };
    reader.readAsText(file);
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
          <div className="flex gap-2">
            <button type="button" onClick={() => setIsImportModalOpen(true)} className="btn-secondary">
              {t('Import từ khóa')}
            </button>
            <button type="button" onClick={() => setIsModalOpen(true)} className="btn-primary">
              {t('Thêm từ khóa')}
            </button>
          </div>
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
                    <div className="flex justify-center gap-3 mt-4">
                      <button type="button" onClick={() => setIsImportModalOpen(true)} className="btn-secondary">
                        {t('Import từ khóa')}
                      </button>
                      <button type="button" onClick={() => setIsModalOpen(true)} className="btn-primary">
                        {t('Thêm từ khóa')}
                      </button>
                    </div>
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

      {isImportModalOpen && (
        <div className="modal-overlay" onClick={() => setIsImportModalOpen(false)}>
          <div className="modal-panel max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-slate-900 mb-4">{t('Import Từ khóa Hàng loạt')}</h2>

            <div className="flex border-b border-slate-200 mb-4">
              <button
                type="button"
                className={`py-2 px-4 font-semibold text-sm ${importTab === 'text' ? 'border-b-2 border-brand text-brand' : 'text-slate-500'}`}
                onClick={() => setImportTab('text')}
              >
                {t('Dán văn bản')}
              </button>
              <button
                type="button"
                className={`py-2 px-4 font-semibold text-sm ${importTab === 'file' ? 'border-b-2 border-brand text-brand' : 'text-slate-500'}`}
                onClick={() => setImportTab('file')}
              >
                {t('Tải tệp CSV')}
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              {importTab === 'text' ? (
                <div>
                  <label className="label">{t('Danh sách từ khóa')}</label>
                  <textarea
                    required
                    className="input min-h-[150px] font-mono text-sm"
                    placeholder="từ khóa 1, volume, url&#10;từ khóa 2, volume&#10;từ khóa 3"
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    {t('Định dạng: từ_khóa, volume, url (mỗi từ khóa trên một dòng. Volume & URL tùy chọn).')}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="label">{t('Chọn tệp CSV')}</label>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="input"
                    onChange={handleCsvFile}
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    {t('Chọn tệp CSV hoặc TXT chứa danh sách từ khóa tương tự định dạng trên.')}
                  </p>
                </div>
              )}

              <div>
                <label className="label">{t('Nhóm từ khóa (tùy chọn)')}</label>
                <select
                  className="input"
                  value={importGroupId}
                  onChange={(e) => setImportGroupId(e.target.value)}
                >
                  <option value="">{t('— Không chọn nhóm —')}</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g._count?.keywords || 0} KWs)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsImportModalOpen(false)} className="btn-secondary flex-1">
                  {t('Hủy')}
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
                  {isSubmitting ? t('Đang import...') : t('Bắt đầu Import')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
