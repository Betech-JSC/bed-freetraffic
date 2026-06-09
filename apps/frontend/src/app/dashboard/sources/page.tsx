'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { apiJson } from '@/lib/api';
import { useLocale } from '@/context/LocaleContext';

type Channel = {
  id: number;
  name: string;
  type: string;
  url?: string;
  status: string;
};

export default function SourcesPage() {
  const { t } = useLocale();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', type: 'SEO', url: '', status: 'ACTIVE' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [utmTargetChannel, setUtmTargetChannel] = useState<Channel | null>(null);
  const [utmUrl, setUtmUrl] = useState('');

  const generateUtmLink = (targetUrl: string, channel: Channel | null) => {
    if (!targetUrl.trim() || !channel) return '';
    if (!targetUrl.trim()) return '';
    try {
      const urlObj = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
      const mediumMap: Record<string, string> = {
        SEO: 'organic',
        Social: 'social',
        Email: 'email',
        Referral: 'referral',
        Video: 'video'
      };
      const utmSource = encodeURIComponent(channel.name.toLowerCase().replace(/\s+/g, '_'));
      const utmMedium = encodeURIComponent(mediumMap[channel.type] || 'referral');
      
      urlObj.searchParams.set('utm_source', utmSource);
      urlObj.searchParams.set('utm_medium', utmMedium);
      urlObj.searchParams.set('utm_campaign', 'free_traffic');
      
      return urlObj.toString();
    } catch {
      return '';
    }
  };

  const generatedLink = generateUtmLink(utmUrl, utmTargetChannel);

  const openCreate = () => {
    setEditingId(null);
    setFormData({ name: '', type: 'SEO', url: '', status: 'ACTIVE' });
    setIsModalOpen(true);
  };

  const openEdit = (channel: Channel) => {
    setEditingId(channel.id);
    setFormData({
      name: channel.name,
      type: channel.type,
      url: channel.url || '',
      status: channel.status || 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const fetchChannels = useCallback(async () => {
    setError('');
    try {
      const data = await apiJson<Channel[]>('/channels');
      setChannels(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không tải được danh sách kênh'));
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    setTimeout(() => {
      fetchChannels();
    }, 0);
  }, [fetchChannels]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      if (editingId) {
        await apiJson(`/channels/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        await apiJson('/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', type: 'SEO', url: '', status: 'ACTIVE' });
      await fetchChannels();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không lưu được kênh'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('Bạn có chắc chắn muốn xóa kênh này?'))) return;
    setError('');
    try {
      await apiJson(`/channels/${id}`, { method: 'DELETE' });
      await fetchChannels();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không xóa được kênh'));
    }
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'SEO': return 'SEO';
      case 'Social': return 'SOC';
      case 'Email': return 'EML';
      case 'Referral': return 'REF';
      default: return 'WEB';
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        title={t('Nguồn traffic')}
        description={t('Quản lý các kênh thu hút người dùng tự nhiên (Free Traffic).')}
        actions={
          <button type="button" onClick={openCreate} className="btn-primary">
            {t('Thêm kênh')}
          </button>
        }
      />
  
      {/* Quick Help Banner */}
      <div className="bg-brand/5 border border-brand/10 rounded-xl p-4 mb-6 flex items-start gap-3">
        <div>
          <h4 className="font-bold text-slate-800 text-sm">{t('Nguồn Traffic là gì?')}</h4>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {t('Đây là nơi bạn khai báo các kênh truyền thông của mình (như Fanpage, Group, Kênh Youtube, Blog SEO).')}{' '}
            {t('Hãy dùng công cụ')} <strong>&ldquo;{t('Tạo Link UTM')}&rdquo;</strong> {t('trên mỗi kênh để tạo đường link có chứa mã theo dõi.')}{' '}
            {t('Khi chia sẻ link đó, hệ thống sẽ biết chính xác khách truy cập đến từ kênh nào để báo cáo hiệu quả chiến dịch!')}
          </p>
        </div>
      </div>

      {error && <p className="alert-error text-sm">{error}</p>}

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-brand/20 shadow-sm flex items-center gap-4">
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase">{t('Tổng số kênh')}</div>
            <div className="text-2xl font-extrabold text-gray-900">{channels.length}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-brand/20 shadow-sm flex items-center gap-4">
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase">{t('Đang hoạt động')}</div>
            <div className="text-2xl font-extrabold text-gray-900">{channels.filter(c => c.status === 'ACTIVE').length}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-brand/20 shadow-sm flex items-center gap-4">
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase">{t('Mục tiêu')}</div>
            <div className="text-2xl font-extrabold text-gray-900">50,000 / th</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-brand/20 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="p-5">{t('Tên kênh')}</th>
                <th className="p-5">{t('Phân loại')}</th>
                <th className="p-5">{t('Đường dẫn / Nguồn')}</th>
                <th className="p-5">{t('Trạng thái')}</th>
                <th className="p-5 text-right">{t('Hành động')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">{t('Đang tải dữ liệu...')}</td>
                </tr>
              ) : channels.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">{t('Chưa có kênh traffic nào. Bấm "Thêm kênh mới" để bắt đầu!')}</td>
                </tr>
              ) : (
                channels.map(channel => (
                  <tr key={channel.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-5 font-bold text-gray-900 flex items-center gap-3">
                      <span className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-xs font-semibold">{getSourceIcon(channel.type)}</span>
                      {channel.name}
                    </td>
                    <td className="p-5">
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded text-xs font-bold">{t(channel.type)}</span>
                    </td>
                    <td className="p-5 text-sm text-gray-500 max-w-xs truncate">
                      {channel.url || t('Không có link')}
                    </td>
                    <td className="p-5">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${channel.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {t(channel.status)}
                      </span>
                    </td>
                     <td className="p-5 text-right space-x-3">
                      <button
                        type="button"
                        onClick={() => {
                          setUtmTargetChannel(channel);
                          setUtmUrl('');
                        }}
                        className="text-brand hover:underline font-bold text-sm transition-colors"
                      >
                        {t('Tạo Link UTM')}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(channel)}
                        className="text-gray-400 hover:text-brand font-bold text-sm transition-colors"
                      >
                        {t('Sửa')}
                      </button>
                      <button onClick={() => handleDelete(channel.id)} className="text-gray-400 hover:text-red-500 font-bold text-sm transition-colors">{t('Xóa')}</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Thêm Kênh */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-xs font-semibold hover:text-gray-700 text-gray-500"
            >
              Đóng
            </button>
            <h2 className="text-xl font-bold text-brand mb-6">
              {editingId ? t('Sửa nguồn traffic') : t('Thêm nguồn traffic')}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('Tên kênh (VD: Fanpage Meme)')}</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('Phân loại (Loại Traffic)')}</label>
                <select 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all outline-none font-medium"
                >
                  <option value="SEO">SEO ({t('Tìm kiếm tự nhiên')})</option>
                  <option value="Social">Social Media (Facebook, TikTok...)</option>
                  <option value="Email">Email Marketing</option>
                  <option value="Referral">Referral / Backlinks</option>
                  <option value="Video">Video / YouTube</option>
                </select>
              </div>
              {editingId && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('Trạng thái')}</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all outline-none font-medium"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('Đường dẫn (URL) - Tùy chọn')}</label>
                <input 
                  type="url" 
                  value={formData.url}
                  onChange={e => setFormData({...formData, url: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all outline-none text-sm"
                  placeholder="https://facebook.com/fanpage"
                />
              </div>
              
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t('Hủy')}
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-brand text-white font-bold rounded-lg hover:bg-brand-hover transition-colors shadow-sm disabled:opacity-70"
                >
                  {isSubmitting ? t('Đang lưu...') : editingId ? t('Cập nhật') : t('Lưu kênh')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* UTM Generator Modal */}
      {utmTargetChannel && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setUtmTargetChannel(null)}
              className="absolute top-4 right-4 text-xs font-semibold hover:text-gray-700 text-gray-500"
            >
              Đóng
            </button>
            <h2 className="text-xl font-bold text-brand mb-4">
              {t('Tạo Link Tiếp Thị (UTM)')}
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              {t('Tạo link chứa mã theo dõi chiến dịch cho kênh:')} <strong>{utmTargetChannel.name}</strong> ({t(utmTargetChannel.type)})
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('Nhập URL trang web đích cần quảng bá')}</label>
                <input 
                  type="url" 
                  value={utmUrl}
                  onChange={e => setUtmUrl(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all outline-none text-sm"
                  placeholder="https://website-cua-ban.com/san-pham-a"
                />
              </div>

              {generatedLink && (
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('Đường link tiếp thị đã được tạo')}</label>
                  <textarea 
                    readOnly
                    value={generatedLink}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-600 focus:outline-none min-h-[80px]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedLink);
                      alert(t('Đã sao chép link tiếp thị vào Clipboard!'));
                    }}
                    className="w-full py-2.5 bg-brand text-white text-xs font-bold rounded-lg hover:bg-brand-hover transition-colors"
                  >
                    {t('Sao chép đường dẫn')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
