'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';

type LandingPage = {
  id: number;
  slug: string;
  title: string;
  layoutJson: string;
  htmlContent: string;
  cssContent: string | null;
  status: string;
  fbPixelId: string | null;
  googleTagId: string | null;
  createdAt: string;
};

export default function LandingPagesDashboard() {
  const { t } = useLocale();
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editing configuration modal states
  const [showConfigId, setShowConfigId] = useState<number | null>(null);
  const [configForm, setConfigForm] = useState({
    title: '',
    slug: '',
    fbPixelId: '',
    googleTagId: '',
    status: 'DRAFT',
  });

  // Creation dialog states
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    slug: '',
  });

  const loadPages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiJson<LandingPage[]>('/landing-pages');
      setPages(Array.isArray(data) ? data : []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách trang đích.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title || !createForm.slug) {
      setError('Vui lòng nhập đầy đủ tiêu đề và đường dẫn.');
      return;
    }
    try {
      await apiJson('/landing-pages', {
        method: 'POST',
        body: JSON.stringify({
          ...createForm,
          layoutJson: '{}',
          htmlContent: '<h1>Chào mừng đến với trang đích mới</h1><p>Vui lòng mở trình thiết kế để tùy chỉnh nội dung này.</p>',
          cssContent: '',
          status: 'DRAFT',
        }),
      });
      setSuccess('Đã tạo trang đích thành công.');
      setShowCreate(false);
      setCreateForm({ title: '', slug: '' });
      loadPages();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo trang đích.');
    }
  };

  const openConfig = (page: LandingPage) => {
    setShowConfigId(page.id);
    setConfigForm({
      title: page.title,
      slug: page.slug,
      fbPixelId: page.fbPixelId || '',
      googleTagId: page.googleTagId || '',
      status: page.status,
    });
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showConfigId) return;
    try {
      await apiJson(`/landing-pages/${showConfigId}`, {
        method: 'PUT',
        body: JSON.stringify(configForm),
      });
      setSuccess('Đã cập nhật cấu hình trang đích.');
      setShowConfigId(null);
      loadPages();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật cấu hình.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa trang đích này không? Dữ liệu thiết kế sẽ mất hoàn toàn.')) return;
    try {
      await apiJson(`/landing-pages/${id}`, { method: 'DELETE' });
      setSuccess('Đã xóa trang đích thành công.');
      loadPages();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa trang đích.');
    }
  };

  // Autogenerate slug for new page
  useEffect(() => {
    if (createForm.title) {
      const slugified = createForm.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      setCreateForm((prev) => ({ ...prev, slug: slugified }));
    }
  }, [createForm.title]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Quản lý Landing Pages" description="Thiết kế và chèn mã tracking pixel đo lường phễu chuyển đổi chiến dịch tiếp thị." />
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-[#f25c22] hover:bg-[#d94d1a] text-white rounded-lg transition duration-200 shadow-md font-semibold text-sm flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Tạo trang đích
        </button>
      </div>

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm flex justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="hover:text-white">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="hover:text-white">✕</button>
        </div>
      )}

      {/* Creation Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Tạo Landing Page mới</h3>
            
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Tiêu đề trang</label>
              <input
                type="text"
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                placeholder="Ví dụ: Landing Page Quà Tặng 8/3"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f25c22] transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Đường dẫn trang (URL Slug)</label>
              <input
                type="text"
                value={createForm.slug}
                onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                placeholder="qua-tang-8-3"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f25c22] transition"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-sm transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#f25c22] hover:bg-[#d94d1a] text-white rounded-lg text-sm font-semibold transition"
              >
                Tạo trang
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Configuration Modal */}
      {showConfigId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveConfig} className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Cấu hình Landing Page</h3>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Tiêu đề</label>
              <input
                type="text"
                value={configForm.title}
                onChange={(e) => setConfigForm({ ...configForm, title: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f25c22] transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Đường dẫn URL Slug</label>
              <input
                type="text"
                value={configForm.slug}
                onChange={(e) => setConfigForm({ ...configForm, slug: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f25c22] transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Facebook Pixel ID</label>
              <input
                type="text"
                value={configForm.fbPixelId}
                onChange={(e) => setConfigForm({ ...configForm, fbPixelId: e.target.value })}
                placeholder="10029302928392"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f25c22] transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Google Analytics / Tag ID</label>
              <input
                type="text"
                value={configForm.googleTagId}
                onChange={(e) => setConfigForm({ ...configForm, googleTagId: e.target.value })}
                placeholder="G-XXXXXX hoặc GTM-XXXX"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f25c22] transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Trạng thái xuất bản</label>
              <select
                value={configForm.status}
                onChange={(e) => setConfigForm({ ...configForm, status: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f25c22] transition"
              >
                <option value="DRAFT">Draft (Nháp - Chưa công khai)</option>
                <option value="PUBLISHED">Published (Công khai ngoài web)</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfigId(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-sm transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#f25c22] hover:bg-[#d94d1a] text-white rounded-lg text-sm font-semibold transition"
              >
                Cập nhật
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f25c22]"></div>
          </div>
        ) : pages.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-slate-900 border border-slate-800 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h4 className="text-white font-medium mb-1">Chưa có Landing Page nào</h4>
            <p className="text-slate-400 text-sm mb-4">Hãy bắt đầu tạo Landing Page đầu tiên của bạn để chuyển đổi traffic thành lead.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-[#f25c22]/10 hover:bg-[#f25c22]/20 border border-[#f25c22]/30 text-[#f25c22] rounded-lg transition text-sm font-semibold"
            >
              Tạo trang ngay
            </button>
          </div>
        ) : (
          pages.map((page) => (
            <div key={page.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg hover:border-slate-700 transition flex flex-col justify-between">
              <div className="p-5 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${page.status === 'PUBLISHED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                    {page.status === 'PUBLISHED' ? 'Công khai' : 'Nháp'}
                  </span>
                  <span className="text-xs text-slate-500">{new Date(page.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
                <h4 className="font-bold text-white text-base line-clamp-2">{page.title}</h4>
                
                <div className="space-y-1 pt-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Slug:</span>
                    <span className="text-slate-300 font-mono">/p/{page.slug}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">FB Pixel:</span>
                    <span className="text-slate-300">{page.fbPixelId ? '🟢 ' + page.fbPixelId : '🔴 Chưa cấu hình'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Google Tag:</span>
                    <span className="text-slate-300">{page.googleTagId ? '🟢 ' + page.googleTagId : '🔴 Chưa cấu hình'}</span>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-850 flex justify-between items-center gap-3">
                <div className="flex gap-1.5">
                  <a
                    href={`/dashboard/landing/${page.id}/builder`}
                    className="text-xs bg-[#f25c22]/10 hover:bg-[#f25c22]/20 border border-[#f25c22]/30 text-[#f25c22] px-2.5 py-1.5 rounded font-semibold transition"
                  >
                    Thiết kế
                  </a>
                  <a
                    href={`/api/public/pages/${page.slug}/html`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs border border-slate-800 hover:bg-slate-900 text-slate-400 px-2.5 py-1.5 rounded transition"
                  >
                    Xem
                  </a>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => openConfig(page)}
                    className="text-slate-400 hover:text-white p-1"
                    title="Cài đặt SEO & Pixel"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(page.id)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                    title="Xóa"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
