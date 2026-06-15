'use client';

import React, { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';

type PopupWidget = {
  id: number;
  name: string;
  type: string; // "EXIT_INTENT" | "DELAY" | "SCROLL"
  delaySeconds: number;
  scrollDepth: number;
  title: string;
  description: string;
  buttonText: string;
  formFields: string; // "email", "email,name", "email,name,phone"
  themeColor: string;
  isActive: boolean;
  createdAt: string;
};

const SWATCHES = ['#e85d26', '#38bdf8', '#34d399', '#a855f7', '#f59e0b', '#64748b'];

export default function PopupsPage() {
  const { t } = useLocale();
  const [popups, setPopups] = useState<PopupWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingPopup, setEditingPopup] = useState<PopupWidget | null>(null);
  const [showScriptPopup, setShowScriptPopup] = useState<PopupWidget | null>(null);
  const [copied, setCopied] = useState(false);

  // Form states
  const [form, setForm] = useState({
    name: '',
    type: 'DELAY', // "EXIT_INTENT" | "DELAY" | "SCROLL"
    delaySeconds: 5,
    scrollDepth: 50,
    title: '',
    description: '',
    buttonText: 'Đăng ký',
    hasName: false,
    hasPhone: false,
    themeColor: '#e85d26',
    isActive: true,
  });

  const [workspaceId, setWorkspaceId] = useState('0');

  useEffect(() => {
    const savedId = localStorage.getItem('workspaceId');
    if (savedId) {
      setWorkspaceId(savedId);
    }
  }, []);

  const loadPopups = async () => {
    try {
      setLoading(true);
      const data = await apiJson<PopupWidget[]>('/popups');
      setPopups(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải cấu hình popups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPopups();
  }, []);

  const handleOpenCreate = () => {
    setEditingPopup(null);
    setForm({
      name: '',
      type: 'DELAY',
      delaySeconds: 5,
      scrollDepth: 50,
      title: '',
      description: '',
      buttonText: 'Đăng ký',
      hasName: false,
      hasPhone: false,
      themeColor: '#e85d26',
      isActive: true,
    });
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const handleOpenEdit = (popup: PopupWidget) => {
    setEditingPopup(popup);
    const fields = popup.formFields.split(',');
    setForm({
      name: popup.name,
      type: popup.type,
      delaySeconds: popup.delaySeconds,
      scrollDepth: popup.scrollDepth,
      title: popup.title,
      description: popup.description,
      buttonText: popup.buttonText,
      hasName: fields.includes('name'),
      hasPhone: fields.includes('phone'),
      themeColor: popup.themeColor,
      isActive: popup.isActive,
    });
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.title || !form.description) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    setModalLoading(true);
    setError('');
    
    // Construct formFields csv
    const fieldsArr = ['email'];
    if (form.hasName) fieldsArr.push('name');
    if (form.hasPhone) fieldsArr.push('phone');
    const formFields = fieldsArr.join(',');

    try {
      const payload = {
        name: form.name,
        type: form.type,
        delaySeconds: form.type === 'DELAY' ? Number(form.delaySeconds) : undefined,
        scrollDepth: form.type === 'SCROLL' ? Number(form.scrollDepth) : undefined,
        title: form.title,
        description: form.description,
        buttonText: form.buttonText,
        formFields,
        themeColor: form.themeColor,
        isActive: form.isActive,
      };

      if (editingPopup) {
        await apiJson(`/popups/${editingPopup.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setSuccess('Cập nhật cấu hình Popup thành công');
      } else {
        await apiJson('/popups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setSuccess('Tạo cấu hình Popup mới thành công');
      }
      setShowModal(false);
      loadPopups();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu cấu hình');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa Popup widget này không?')) return;
    try {
      await apiJson(`/popups/${id}`, { method: 'DELETE' });
      setSuccess('Đã xóa Popup thành công');
      loadPopups();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa popup');
    }
  };

  const toggleActive = async (popup: PopupWidget) => {
    try {
      await apiJson(`/popups/${popup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !popup.isActive }),
      });
      setSuccess(`Đã ${!popup.isActive ? 'kích hoạt' : 'tạm ngưng'} Popup thành công`);
      loadPopups();
    } catch (err: any) {
      setError(err.message || 'Lỗi thay đổi trạng thái hoạt động');
    }
  };

  const getEmbedScript = (wsId: string) => {
    const host = process.env.NEXT_PUBLIC_API_URL 
      ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '') 
      : (typeof window !== 'undefined' ? window.location.origin.replace(':3000', ':4000') : 'http://localhost:4000');
    return `<script src="${host}/api/public/popups/script/${wsId}" defer></script>`;
  };

  const handleCopyScript = (wsId: string) => {
    const script = getEmbedScript(wsId);
    navigator.clipboard.writeText(script).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="space-y-8 page-container">
      <div className="flex justify-between items-center">
        <PageHeader
          title={t('Lead Capture Popups')}
          description={t('Tạo các form đăng ký nổi thu hút khách hàng (exit-intent, trì hoãn thời gian hoặc chiều sâu cuộn trang) và nhúng vào website.')}
        />
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-[#f25c22] hover:bg-[#d94d1a] text-white rounded-lg transition duration-200 shadow-md font-semibold text-sm flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {t('Tạo Popup mới')}
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

      {/* Popups List Card */}
      <div className="card overflow-hidden shadow-sm border border-slate-100">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-extrabold text-slate-850 text-sm">{t('Danh sách Popup chiến dịch')}</h3>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm font-semibold">
              Đang tải danh sách popup...
            </div>
          ) : popups.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-sm">
              {t('Chưa có popup nào được tạo. Hãy nhấn nút phía trên để thiết lập Popup đầu tiên!')}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-4">{t('Tên Popup')}</th>
                  <th className="p-4">{t('Trực quan hiển thị')}</th>
                  <th className="p-4">{t('Hình thức kích hoạt')}</th>
                  <th className="p-4">{t('Thu thập trường')}</th>
                  <th className="p-4 text-center">{t('Trạng thái')}</th>
                  <th className="p-4 text-right">{t('Thao tác')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {popups.map((popup) => {
                  let triggerText = '';
                  if (popup.type === 'DELAY') triggerText = `Chờ ${popup.delaySeconds} giây`;
                  else if (popup.type === 'SCROLL') triggerText = `Cuộn xuống ${popup.scrollDepth}%`;
                  else if (popup.type === 'EXIT_INTENT') triggerText = 'Khi di chuột rời đi (Exit Intent)';

                  return (
                    <tr key={popup.id} className="hover:bg-slate-50/45 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-800 text-sm mb-0.5">{popup.name}</div>
                        <div className="text-slate-450 text-[10px]">
                          Tạo ngày: {new Date(popup.createdAt).toLocaleDateString('vi-VN')}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-slate-200" style={{ backgroundColor: popup.themeColor }} />
                          <span className="font-medium text-slate-700 truncate max-w-[150px]">{popup.title}</span>
                        </div>
                      </td>
                      <td className="p-4 font-semibold text-slate-700">{triggerText}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {popup.formFields.split(',').map((f, i) => (
                            <span key={i} className="bg-slate-100 text-slate-600 text-[9px] px-1.5 py-0.5 rounded font-bold capitalize">
                              {f === 'name' ? 'họ tên' : f === 'phone' ? 'sđt' : f}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleActive(popup)}
                          className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[9px] cursor-pointer transition-all border ${
                            popup.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100/50'
                              : 'bg-slate-50 text-slate-500 border-slate-150 hover:bg-slate-100'
                          }`}
                        >
                          {popup.isActive ? 'Hoạt động' : 'Tạm ngưng'}
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex gap-1.5 justify-end items-center">
                          <button
                            type="button"
                            onClick={() => setShowScriptPopup(popup)}
                            className="text-[11px] font-bold text-slate-500 hover:text-slate-850 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                            {t('Nhúng')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(popup)}
                            className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
                            title={t('Chỉnh sửa')}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(popup.id)}
                            className="p-1.5 bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            title={t('Xóa popup')}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Editor Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg flex flex-col shadow-2xl border border-slate-100 overflow-hidden transform transition-all scale-100">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-orange-50/50 to-amber-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white bg-brand shadow-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">{editingPopup ? t('Chỉnh sửa Popup') : t('Tạo Popup mới')}</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">{t('Thiết lập cấu hình nội dung và điều kiện hiển thị của form nổi.')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 transition-colors flex items-center justify-center text-slate-400 hover:text-slate-600 font-bold cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {error && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">{error}</div>}

              <div className="space-y-1">
                <label className="label text-xs font-bold text-slate-500">{t('Tên gợi nhớ chiến dịch popup')} <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="Ví dụ: Ưu đãi Đăng ký Zalo"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  disabled={modalLoading}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="label text-xs font-bold text-slate-500">{t('Cách kích hoạt hiển thị')}</label>
                  <select
                    className="input text-xs"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    disabled={modalLoading}
                  >
                    <option value="DELAY">{t('Thời gian chờ (Delay)')}</option>
                    <option value="SCROLL">{t('Độ sâu cuộn trang')}</option>
                    <option value="EXIT_INTENT">{t('Chuột rời trang (Exit Intent)')}</option>
                  </select>
                </div>

                {form.type === 'DELAY' && (
                  <div className="space-y-1">
                    <label className="label text-xs font-bold text-slate-500">{t('Thời gian chờ hiển thị (giây)')}</label>
                    <input
                      type="number"
                      className="input text-xs"
                      min={1}
                      max={300}
                      value={form.delaySeconds}
                      onChange={(e) => setForm({ ...form, delaySeconds: Number(e.target.value) })}
                      disabled={modalLoading}
                    />
                  </div>
                )}

                {form.type === 'SCROLL' && (
                  <div className="space-y-1">
                    <label className="label text-xs font-bold text-slate-500">{t('Độ sâu cuộn trang tối thiểu (%)')}</label>
                    <input
                      type="number"
                      className="input text-xs"
                      min={10}
                      max={100}
                      value={form.scrollDepth}
                      onChange={(e) => setForm({ ...form, scrollDepth: Number(e.target.value) })}
                      disabled={modalLoading}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="label text-xs font-bold text-slate-500">{t('Tiêu đề chính của Popup')} <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="Ví dụ: Đăng ký nhận mã giảm giá 10%!"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  disabled={modalLoading}
                />
              </div>

              <div className="space-y-1">
                <label className="label text-xs font-bold text-slate-500">{t('Nội dung mô tả chi tiết')} <span className="text-red-500">*</span></label>
                <textarea
                  className="input text-xs"
                  placeholder="Nhập lời khuyên hoặc mô tả quà tặng, lợi ích khi đăng ký..."
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                  disabled={modalLoading}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="label text-xs font-bold text-slate-500">{t('Chữ hiển thị trên nút gửi')}</label>
                  <input
                    type="text"
                    className="input text-xs"
                    placeholder="Đăng ký"
                    value={form.buttonText}
                    onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
                    disabled={modalLoading}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="label text-xs font-bold text-slate-500 block">{t('Màu sắc chủ đạo')}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="w-10 h-10 border border-slate-200 rounded-xl cursor-pointer p-0 overflow-hidden shrink-0"
                      value={form.themeColor}
                      onChange={(e) => setForm({ ...form, themeColor: e.target.value })}
                      disabled={modalLoading}
                    />
                    <div className="flex gap-1.5">
                      {SWATCHES.map((swatch) => (
                        <button
                          key={swatch}
                          type="button"
                          onClick={() => setForm({ ...form, themeColor: swatch })}
                          className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${
                            form.themeColor === swatch ? 'scale-110 border-slate-800' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: swatch }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="label text-xs font-bold text-slate-500 block">{t('Thông tin thu thập từ khách hàng')}</label>
                <div className="flex gap-6 items-center select-none text-xs font-medium text-slate-600">
                  <label className="flex items-center gap-1.5 opacity-60">
                    <input type="checkbox" checked disabled className="h-4 w-4 rounded text-brand focus:ring-brand/35 cursor-default" />
                    <span>Email (bắt buộc)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.hasName}
                      onChange={(e) => setForm({ ...form, hasName: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/35 cursor-pointer"
                      disabled={modalLoading}
                    />
                    <span>Họ và tên</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.hasPhone}
                      onChange={(e) => setForm({ ...form, hasPhone: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/35 cursor-pointer"
                      disabled={modalLoading}
                    />
                    <span>Số điện thoại</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2 select-none text-xs font-semibold text-slate-650 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/35 cursor-pointer"
                  disabled={modalLoading}
                />
                <label htmlFor="isActive" className="cursor-pointer">{t('Kích hoạt hoạt động cho Popup này ngay lập tức')}</label>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary text-xs px-4 py-2 cursor-pointer"
                  disabled={modalLoading}
                >
                  {t('Hủy bỏ')}
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs px-5 py-2 cursor-pointer"
                  disabled={modalLoading}
                >
                  {modalLoading ? t('Đang lưu...') : t('Lưu Popup')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Embed Script Drawer Modal */}
      {showScriptPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg flex flex-col shadow-2xl border border-slate-100 overflow-hidden transform transition-all scale-100">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-orange-50/50 to-amber-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white bg-brand shadow-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">{t('Lấy mã nhúng Popup')}</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">{t('Nhúng mã script này vào đầu trang HTML của bạn để kích hoạt tự động.')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScriptPopup(null)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 transition-colors flex items-center justify-center text-slate-400 hover:text-slate-600 font-bold cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                {t('Hãy sao chép mã script bên dưới và dán vào phần')} <code>&lt;head&gt;</code> {t('hoặc ngay trước thẻ')} <code>&lt;/body&gt;</code> {t('của trang web bán hàng hoặc trang landing page của bạn.')}
              </p>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl relative">
                <div className="text-[11px] font-mono text-slate-600 break-all select-all font-semibold leading-relaxed pr-12">
                  {getEmbedScript(workspaceId)}
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyScript(workspaceId)}
                  className={`absolute right-3 top-3 p-1.5 rounded-lg border transition-all cursor-pointer ${
                    copied
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-250'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                  title={t('Sao chép mã nhúng')}
                >
                  {copied ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  )}
                </button>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowScriptPopup(null)}
                  className="btn-primary text-xs px-5 py-2 cursor-pointer"
                >
                  {t('Hoàn tất')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
