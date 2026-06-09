'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiJson, apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';
import Link from 'next/link';

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
  enableMessengerChat: boolean;
  createdAt: string;
};

export default function LandingPagesDashboard() {
  const { t } = useLocale();
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Social connections for sharing
  const [fbConnections, setFbConnections] = useState<any[]>([]);

  // Share modal states
  const [sharePageId, setSharePageId] = useState<number | null>(null);
  const [sharePageTitle, setSharePageTitle] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [selectedFbPages, setSelectedFbPages] = useState<number[]>([]);
  const [sharing, setSharing] = useState(false);

  // Editing configuration modal states
  const [showConfigId, setShowConfigId] = useState<number | null>(null);
  const [configForm, setConfigForm] = useState({
    title: '',
    slug: '',
    fbPixelId: '',
    googleTagId: '',
    status: 'DRAFT',
    enableMessengerChat: false,
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

  const loadFbConnections = useCallback(async () => {
    try {
      const data = await apiJson<any[]>('/social');
      setFbConnections(data.filter((c: any) => c.platform === 'facebook' && c.status === 'CONNECTED'));
    } catch {
      setFbConnections([]);
    }
  }, []);

  useEffect(() => {
    loadPages();
    loadFbConnections();
  }, [loadPages, loadFbConnections]);

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
          enableMessengerChat: false,
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
      enableMessengerChat: page.enableMessengerChat || false,
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

  const openShareModal = (page: LandingPage) => {
    setSharePageId(page.id);
    setSharePageTitle(page.title);
    setShareMessage(`Khám phá ngay Landing Page tuyệt đẹp của chúng tôi: "${page.title}"! 🚀 `);
    setSelectedFbPages([]);
    setError('');
    setSuccess('');
  };

  const toggleFbPageSelect = (connId: number) => {
    setSelectedFbPages(prev =>
      prev.includes(connId) ? prev.filter(id => id !== connId) : [...prev, connId]
    );
  };

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sharePageId) return;
    if (selectedFbPages.length === 0) {
      setError('Vui lòng chọn ít nhất một Fanpage để chia sẻ.');
      return;
    }
    setSharing(true);
    setError('');
    setSuccess('');
    try {
      const res = await apiFetch(`/landing-pages/${sharePageId}/share-facebook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionIds: selectedFbPages,
          message: shareMessage
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi hệ thống khi chia sẻ');
      }
      
      const failures = data.results?.filter((r: any) => !r.success) || [];
      if (failures.length === 0) {
        setSuccess(`Đã chia sẻ thành công lên các trang: ${data.results.map((r: any) => r.pageName).join(', ')}.`);
        setSharePageId(null);
      } else {
        const errorMsgs = failures.map((f: any) => `${f.pageName}: ${f.message}`).join(' | ');
        setError(`Chia sẻ hoàn tất có lỗi: ${errorMsgs}`);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi thực hiện chia sẻ.');
    } finally {
      setSharing(false);
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
        <PageHeader title="Quản lý Landing Pages" description="Thiết kế, chia sẻ Fanpage và nhúng Messenger Chat Widget tự động trả lời bằng AI Chatbot." />
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-[#f25c22] hover:bg-[#d94d1a] text-white rounded-lg transition duration-200 shadow-md font-semibold text-sm flex items-center gap-2"
        >
          Tạo trang đích
        </button>
      </div>

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-lg text-sm flex justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="hover:text-slate-800 text-xs font-semibold">Đóng</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-lg text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="hover:text-slate-800 text-xs font-semibold">Đóng</button>
        </div>
      )}

      {/* Creation Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="card p-6 w-full max-w-md space-y-4 shadow-2xl relative overflow-hidden bg-white rounded-2xl border border-slate-100">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand to-orange-500"></div>
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Tạo Landing Page mới</h3>
            
            <div className="space-y-1">
              <label className="label">Tiêu đề trang</label>
              <input
                type="text"
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                placeholder="Ví dụ: Landing Page Quà Tặng 8/3"
                className="input"
              />
            </div>

            <div className="space-y-1">
              <label className="label">Đường dẫn trang (URL Slug)</label>
              <input
                type="text"
                value={createForm.slug}
                onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                placeholder="qua-tang-8-3"
                className="input"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="btn-secondary px-4 py-1.5 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="btn-primary px-4 py-1.5 text-sm"
              >
                Tạo trang
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Configuration Modal */}
      {showConfigId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveConfig} className="card p-6 w-full max-w-md space-y-4 shadow-2xl relative overflow-hidden bg-white rounded-2xl border border-slate-100">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand to-orange-500"></div>
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Cấu hình Landing Page</h3>

            <div className="space-y-1">
              <label className="label">Tiêu đề</label>
              <input
                type="text"
                value={configForm.title}
                onChange={(e) => setConfigForm({ ...configForm, title: e.target.value })}
                className="input"
              />
            </div>

            <div className="space-y-1">
              <label className="label">Đường dẫn URL Slug</label>
              <input
                type="text"
                value={configForm.slug}
                onChange={(e) => setConfigForm({ ...configForm, slug: e.target.value })}
                className="input"
              />
            </div>

            <div className="space-y-1">
              <label className="label">Facebook Pixel ID</label>
              <input
                type="text"
                value={configForm.fbPixelId}
                onChange={(e) => setConfigForm({ ...configForm, fbPixelId: e.target.value })}
                placeholder="10029302928392"
                className="input"
              />
            </div>

            <div className="space-y-1">
              <label className="label">Google Analytics / Tag ID</label>
              <input
                type="text"
                value={configForm.googleTagId}
                onChange={(e) => setConfigForm({ ...configForm, googleTagId: e.target.value })}
                placeholder="G-XXXXXX hoặc GTM-XXXX"
                className="input"
              />
            </div>

            <div className="space-y-1">
              <label className="label">Trạng thái xuất bản</label>
              <select
                value={configForm.status}
                onChange={(e) => setConfigForm({ ...configForm, status: e.target.value })}
                className="input font-semibold"
              >
                <option value="DRAFT">Draft (Nháp - Chưa công khai)</option>
                <option value="PUBLISHED">Published (Công khai ngoài web)</option>
              </select>
            </div>

            {/* Messenger Chat Toggle */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-800">Nhúng khung chat Messenger</label>
                <span className="text-[10px] text-slate-400 font-normal">Sử dụng SDK tự động hiển thị chat widget của Facebook Page.</span>
              </div>
              <input
                type="checkbox"
                checked={configForm.enableMessengerChat}
                onChange={(e) => setConfigForm({ ...configForm, enableMessengerChat: e.target.checked })}
                className="rounded border-slate-350 text-brand focus:ring-brand w-4 h-4 cursor-pointer"
              />
            </div>

            {configForm.enableMessengerChat && (
              <div className="bg-amber-50 border border-amber-100 text-amber-850 p-2.5 rounded-xl text-[10px] font-normal leading-relaxed">
                <strong>💡 Lưu ý cấu hình từ Meta:</strong> Bạn cần thêm tên miền (ví dụ tên miền web hoặc localhost) vào phần <strong>Allowed Domains (Tên miền được cấp phép)</strong> trong mục cài đặt Facebook Page của bạn thì widget mới hiển thị được.
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfigId(null)}
                className="btn-secondary px-4 py-1.5 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="btn-primary px-4 py-1.5 text-sm"
              >
                Cập nhật
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Share Modal */}
      {sharePageId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleShareSubmit} className="card p-6 w-full max-w-md space-y-4 shadow-2xl relative overflow-hidden bg-white rounded-2xl border border-slate-100">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">f</span>
              Chia sẻ nhanh lên Facebook Page
            </h3>

            <div className="text-xs text-slate-500">
              Đăng ngay Landing Page <strong>{sharePageTitle}</strong> kèm link UTM theo dõi lên các Fanpage đã chọn.
            </div>

            <div className="space-y-1">
              <label className="label">Nội dung bài viết (Caption)</label>
              <textarea
                value={shareMessage}
                onChange={(e) => setShareMessage(e.target.value)}
                placeholder="Nhập trạng thái chia sẻ..."
                rows={4}
                className="input w-full p-2.5 text-xs focus:ring-blue-100 focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Chọn các trang nhận bài đăng</label>
              {fbConnections.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <span className="text-[11px] text-slate-400 block font-normal">Chưa có Fanpage Facebook nào được liên kết.</span>
                  <Link href="/dashboard/settings" className="text-xs text-brand font-bold hover:underline block mt-1">
                    Kết nối Fanpage ngay
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2.5 bg-slate-50 custom-scrollbar font-medium">
                  {fbConnections.map((conn) => {
                    const isSelected = selectedFbPages.includes(conn.id);
                    return (
                      <label key={conn.id} className="flex items-center gap-2.5 cursor-pointer py-1 px-1.5 hover:bg-slate-100 rounded transition-colors text-[11px] text-slate-700">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleFbPageSelect(conn.id)}
                          className="rounded border-slate-350 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span className="truncate font-bold text-slate-800">{conn.pageName}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSharePageId(null)}
                className="btn-secondary px-4 py-1.5 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={sharing || selectedFbPages.length === 0}
                className="btn-primary px-4 py-1.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm border border-transparent transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #1877F2 0%, #0c5dc7 100%)' }}
              >
                {sharing ? 'Đang chia sẻ...' : 'Chia sẻ ngay'}
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
          <div className="col-span-full text-center py-16 card p-8 flex flex-col items-center bg-white border border-slate-100 rounded-2xl">
            <h4 className="text-slate-800 font-bold mb-1 text-base">Chưa có Landing Page nào</h4>
            <p className="text-slate-500 text-xs mb-4">Hãy bắt đầu tạo Landing Page đầu tiên của bạn để chuyển đổi traffic thành lead.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-[#f25c22]/10 hover:bg-[#f25c22]/20 border border-[#f25c22]/30 text-[#f25c22] rounded-lg transition text-xs font-semibold"
            >
              Tạo trang ngay
            </button>
          </div>
        ) : (
          pages.map((page) => (
            <div key={page.id} className="card card-hover overflow-hidden flex flex-col justify-between bg-white rounded-2xl border border-slate-150 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="p-5 space-y-3">
                <div className="flex justify-between items-center gap-2">
                  <span className={`px-2.5 py-0.5 text-[10px] rounded-full font-bold uppercase tracking-wider ${page.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/10'}`}>
                    {page.status === 'PUBLISHED' ? 'Công khai' : 'Nháp'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">{new Date(page.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
                <h4 className="font-bold text-slate-850 text-base line-clamp-2">{page.title}</h4>
                
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-medium">Slug:</span>
                    <span className="text-slate-700 font-mono font-semibold">/p/{page.slug}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-medium">FB Pixel:</span>
                    <span className="text-slate-700 font-semibold">{page.fbPixelId ? page.fbPixelId : 'Chưa cấu hình'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-medium">Messenger Chat:</span>
                    <span className={`font-semibold ${page.enableMessengerChat ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {page.enableMessengerChat ? 'Đã nhúng' : 'Tắt'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3.5 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-3">
                <div className="flex justify-between items-center w-full gap-2">
                  <div className="flex gap-1.5">
                    <a
                      href={`/dashboard/landing/${page.id}/builder`}
                      className="text-xs bg-[#f25c22]/10 hover:bg-[#f25c22]/20 border border-[#f25c22]/30 text-[#f25c22] px-2.5 py-1.5 rounded font-bold transition-all"
                    >
                      Thiết kế
                    </a>
                    <a
                      href={`/api/public/pages/${page.slug}/html${page.status !== 'PUBLISHED' ? '?preview=true' : ''}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs border border-slate-200 hover:bg-slate-50 text-slate-500 px-2.5 py-1.5 rounded font-semibold transition"
                    >
                      Xem
                    </a>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openConfig(page)}
                      className="text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 px-2.5 py-1.5 rounded font-bold transition-all"
                      title="Cài đặt SEO & Pixel"
                    >
                      Cấu hình
                    </button>
                    <button
                      onClick={() => handleDelete(page.id)}
                      className="text-xs text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 px-2.5 py-1.5 rounded font-bold transition-all"
                      title="Xóa"
                    >
                      Xóa
                    </button>
                  </div>
                </div>

                {/* Quick Share Action Row */}
                {page.status === 'PUBLISHED' && (
                  <button
                    onClick={() => openShareModal(page)}
                    className="w-full text-center text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 py-2 rounded-xl transition-all border border-blue-100 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span className="text-[10px] w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold font-mono">f</span>
                    Chia sẻ nhanh lên Facebook Page
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
