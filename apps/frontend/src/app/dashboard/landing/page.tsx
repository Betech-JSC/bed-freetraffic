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
          Tạo trang đích
        </button>
      </div>

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm flex justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="hover:text-white text-xs font-semibold">Đóng</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="hover:text-white text-xs font-semibold">Đóng</button>
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
                    <span className="text-slate-300">{page.fbPixelId ? page.fbPixelId : 'Chưa cấu hình'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Google Tag:</span>
                    <span className="text-slate-300">{page.googleTagId ? page.googleTagId : 'Chưa cấu hình'}</span>
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
                    href={`/api/public/pages/${page.slug}/html${page.status !== 'PUBLISHED' ? '?preview=true' : ''}`}
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
                    className="text-xs bg-slate-800 hover:bg-slate-750 text-slate-300 px-2.5 py-1.5 rounded font-semibold transition"
                    title="Cài đặt SEO & Pixel"
                  >
                    Cấu hình
                  </button>
                  <button
                    onClick={() => handleDelete(page.id)}
                    className="text-xs bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 px-2.5 py-1.5 rounded font-semibold transition"
                    title="Xóa"
                  >
                    Xóa
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
