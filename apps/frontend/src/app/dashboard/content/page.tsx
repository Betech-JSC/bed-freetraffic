'use client';

import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { apiFetch, apiJson } from '@/lib/api';
import { useLocale } from '@/context/LocaleContext';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function ContentEditorPage() {
  const { t } = useLocale();
  const [templates, setTemplates] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [taskId, setTaskId] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // AI Assistant states
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiUrl, setAiUrl] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenImage, setAiGenImage] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiInfoTip, setAiInfoTip] = useState('');
  const [customImagePrompt, setCustomImagePrompt] = useState('');
  const [imageGenerating, setImageGenerating] = useState(false);
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(true);

  // Phase 3 states
  const [aiContentType, setAiContentType] = useState<'legacy' | 'blog' | 'facebook' | 'video_script'>('facebook');
  const [aiResult, setAiResult] = useState<any>(null);
  const [activeVariationTab, setActiveVariationTab] = useState<'short' | 'curious' | 'cta'>('short');

  const handleGenerateCustomImage = async () => {
    if (!customImagePrompt.trim()) return;

    setImageGenerating(true);
    setError('');
    try {
      const res = await apiJson<{ imageUrl: string | null }>('/templates/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: customImagePrompt.trim() })
      });

      if (res.imageUrl) {
        setImagePreview(res.imageUrl);
        setImageFile(null);
        setSuccess(t('Tạo ảnh minh họa bằng AI thành công!'));
      } else {
        throw new Error(t('Không thể sinh ảnh minh họa.'));
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t('Lỗi khi tạo ảnh bằng AI.'));
    } finally {
      setImageGenerating(false);
    }
  };

  const fetchData = async () => {
    setError('');
    try {
      const [tplData, taskData] = await Promise.all([
        apiJson<any[]>('/templates'),
        apiJson<any[]>('/automation/tasks'),
      ]);
      setTemplates(Array.isArray(tplData) ? tplData : []);
      setTasks(Array.isArray(taskData) ? taskData : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không tải được dữ liệu'));
      setTemplates([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError(t('Kích thước ảnh quá lớn. Vui lòng tải lên ảnh dưới 10MB.'));
        e.target.value = '';
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setTaskId('');
    setImageFile(null);
    setImagePreview(null);
    setEditingId(null);
    setShowModal(false);
    setShowAiPanel(false);
    setAiUrl('');
    setAiPrompt('');
    setAiGenImage(false);
    setAiInfoTip('');
    setCustomImagePrompt('');
    setImageGenerating(false);
    setAiContentType('facebook');
    setAiResult(null);
    setActiveVariationTab('short');
    setUseKnowledgeBase(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const formData = new FormData();
    formData.append('title', title);
    formData.append('content', content);
    if (taskId) formData.append('taskId', taskId);
    
    if (imageFile) {
      formData.append('image', imageFile);
    } else if (imagePreview && imagePreview.startsWith('http')) {
      // If AI generated a remote image and user didn't overwrite with manual file upload
      formData.append('imageUrlRemote', imagePreview);
    }

    const path = editingId ? `/templates/${editingId}` : '/templates';
    
    try {
      if (imagePreview && imagePreview.startsWith('http') && !imageFile) {
        try {
          const response = await fetch(imagePreview);
          const blob = await response.blob();
          const file = new File([blob], 'ai-image.jpg', { type: 'image/jpeg' });
          formData.append('image', file);
        } catch {
          // ignore if failed to fetch
        }
      }

      const method = editingId ? 'PUT' : 'POST';
      const res = await apiFetch(path, { method, body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `${t('Lỗi lưu')} (${res.status})`);
      }
      resetForm();
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không lưu được nội dung'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (tpl: any) => {
    setEditingId(tpl.id);
    setTitle(tpl.title);
    setContent(tpl.content);
    setTaskId(tpl.taskId?.toString() || '');
    setImagePreview(tpl.imageUrl ? `${tpl.imageUrl}` : null);
    setImageFile(null);
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    setError('');
    setSuccess('');
    try {
      const res = await apiFetch(`/templates/${deleteConfirmId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(t('Không xóa được'));
      await fetchData();
      setSuccess(t('Đã xóa nội dung mẫu thành công.'));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không xóa được'));
    } finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const handleToggleActive = async (tpl: any) => {
    const formData = new FormData();
    formData.append('isActive', (!tpl.isActive).toString());
    try {
      const res = await apiFetch(`/templates/${tpl.id}`, { method: 'PUT', body: formData });
      if (!res.ok) throw new Error(t('Không cập nhật được'));
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không cập nhật được'));
    }
  };

  const insertPlaceholder = (ph: string) => {
    setContent((prev) => prev + ph);
  };

  // AI Content Generator fetch handler
  const handleGenerateAi = async () => {
    if (!aiUrl.trim()) {
      setError(t('Vui lòng nhập URL đích để AI phân tích.'));
      return;
    }
    setGenerating(true);
    setError('');
    setAiInfoTip('');
    setAiResult(null);
    try {
      const data = await apiJson<any>('/templates/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urlTarget: aiUrl.trim(),
          aiPrompt: aiPrompt.trim(),
          generateImage: false,
          contentType: aiContentType === 'legacy' ? undefined : aiContentType,
          useKnowledgeBase,
        }),
      });

      // Save the structured result
      setAiResult(data);

      // Populate default fields
      setTitle(data.title || '');
      setContent(data.content || '');
      if (data.imageUrl) {
        setImagePreview(data.imageUrl);
        setImageFile(null);
      }
      
      if (data.isDemo) {
        setAiInfoTip(t('Đang chạy ở chế độ Demo (chưa cấu hình OpenAI API Key). Thêm OPENAI_API_KEY ở file .env để chạy thực tế.'));
      } else {
        setAiInfoTip(t('AI đã phân tích website và đề xuất nội dung thành công. Xem bảng kết quả bên dưới để áp dụng bản nháp!'));
      }
      setShowAiPanel(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Lỗi gọi AI'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8 page-container">
      <PageHeader
        title="Content Editor"
        description={t('Soạn thảo các bài viết mẫu (Mẫu nội dung) để xoay vòng đăng bài kéo Traffic tự động.')}
        actions={
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="btn-primary flex items-center gap-1"
          >
            {t('Tạo nội dung')}
          </button>
        }
      />
      
      {/* Guide Banner */}
      <div className="bg-brand/5 border border-brand/10 rounded-2xl p-5 shadow-sm">
        <h4 className="font-bold text-slate-800 text-sm mb-2.5 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse" />
          {t('Hướng dẫn xoay vòng nội dung bài viết')}
        </h4>
        <div className="text-xs text-slate-650 leading-relaxed space-y-2">
          <p>
            {t('Các bài viết mẫu ở trạng thái Hoạt động sẽ được Bot tự động lựa chọn ngẫu nhiên để đăng bài kéo traffic. Khi soạn thảo, bạn có thể bấm vào các nút bên dưới để chèn thẻ cá nhân hóa:')}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className="bg-brand text-white px-2.5 py-0.5 rounded text-[10px] font-bold transition-all hover:bg-brand-hover shadow-sm cursor-pointer"
              title={t('Click để chèn {url}')}
              onClick={() => insertPlaceholder('{url}')}
            >
              {t('Chèn link kéo Traffic')}
            </button>
            <button
              type="button"
              className="bg-brand text-white px-2.5 py-0.5 rounded text-[10px] font-bold transition-all hover:bg-brand-hover shadow-sm cursor-pointer"
              title={t('Click để chèn {name}')}
              onClick={() => insertPlaceholder('{name}')}
            >
              {t('Chèn Tên Bot')}
            </button>
            <button
              type="button"
              className="bg-brand text-white px-2.5 py-0.5 rounded text-[10px] font-bold transition-all hover:bg-brand-hover shadow-sm cursor-pointer"
              title={t('Click để chèn {date}')}
              onClick={() => insertPlaceholder('{date}')}
            >
              {t('Chèn Ngày')}
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.length === 0 && !loading && (
          <div className="col-span-full bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center shadow-sm">
            <h3 className="text-base font-bold text-slate-800">{t('Chưa có bài viết mẫu nào')}</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-normal">
              {t('Soạn thảo bài viết mẫu đầu tiên hoặc sử dụng trợ lý viết bài AI để Bot bắt đầu có dữ liệu hoạt động.')}
            </p>
            <button
              type="button"
              className="btn-primary text-xs mt-4"
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
            >
              {t('Tạo nội dung ngay')}
            </button>
          </div>
        )}

        {templates.map((tpl) => (
          <div
            key={tpl.id}
            className={`bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${
              !tpl.isActive ? 'opacity-65 bg-slate-50/50' : ''
            }`}
          >
            <div>
              {/* Image Preview Area */}
              {tpl.imageUrl ? (
                <div className="h-40 bg-slate-100 overflow-hidden relative border-b border-slate-100">
                  <img
                    src={tpl.imageUrl.startsWith('http') ? tpl.imageUrl : `${tpl.imageUrl}`}
                    alt={tpl.title}
                    className="w-full h-full object-cover"
                  />
                  {!tpl.isActive && (
                    <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px] flex items-center justify-center">
                      <span className="text-[10px] font-black tracking-widest text-white uppercase bg-slate-850 px-2 py-0.5 rounded shadow">{t('Đã tắt')}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-24 bg-gradient-to-br from-brand/5 to-purple-50/20 border-b border-slate-100 flex items-center justify-center relative">
                  {!tpl.isActive && (
                    <span className="absolute text-[8px] font-black tracking-wider text-slate-400 uppercase bg-slate-100 border px-1.5 py-0.5 rounded shadow-sm">{t('Đã tắt')}</span>
                  )}
                </div>
              )}

              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-slate-900 text-sm line-clamp-1" title={tpl.title}>
                    {tpl.title}
                  </h3>
                  <span className={`shrink-0 px-2.5 py-0.5 border rounded-lg text-[9px] font-extrabold uppercase tracking-wider ${
                    tpl.isActive ? 'bg-orange-50 text-brand border-brand/20' : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}>
                    {tpl.isActive ? t('Hoạt động') : t('Tạm tắt')}
                  </span>
                </div>

                <p className="text-xs text-slate-500 line-clamp-4 leading-relaxed whitespace-pre-wrap">{tpl.content}</p>
              </div>
            </div>

            <div className="p-4 pt-0 space-y-3">
              {tpl.task && (
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span>{t('Gắn riêng:')}</span>
                  <span className="font-bold text-slate-500 bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded">{tpl.task.name}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleEdit(tpl)}
                  className="flex-1 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 active:scale-95 hover:border-slate-300 transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  ✏️ {t('Sửa')}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleActive(tpl)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1 ${
                    tpl.isActive 
                      ? 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100/60' 
                      : 'border-brand/20 text-brand bg-brand/5 hover:bg-brand/10'
                  }`}
                >
                  {tpl.isActive ? `⏸️ ${t('Tạm dừng')}` : `▶️ ${t('Bật chạy')}`}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(tpl.id)}
                  className="py-1.5 px-3 rounded-lg border border-red-200 text-xs font-bold text-red-650 bg-red-50 hover:bg-red-100/60 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                  title={t('Xóa')}
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Editor Modal */}
      {showModal && (
        <div className="modal-overlay animate-fade-in" onClick={resetForm}>
          <div className="modal-panel !max-w-5xl w-full max-h-[92vh] overflow-y-auto custom-scrollbar space-y-4" style={{ maxWidth: '1024px' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
              <h3 className="text-base font-black text-brand uppercase tracking-wider flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {editingId ? t('Chỉnh sửa nội dung mẫu') : t('Soạn nội dung mẫu mới')}
              </h3>
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-150 cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {aiInfoTip && <div className="alert-info text-[11px] font-bold py-2 px-3 rounded-xl bg-orange-50/50 text-brand border border-orange-200/40">{aiInfoTip}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Cột trái (7/12): Form soạn thảo chính */}
              <div className="lg:col-span-7">
                <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold text-slate-700">
                  {/* Title */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">{t('Tiêu đề bài đăng mẫu *')}</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="input text-xs w-full py-2.5 px-3.5 bg-slate-50 border border-slate-250 focus:bg-white focus:border-orange-500 rounded-xl transition"
                      placeholder={t('VD: Cập nhật xu hướng marketing mới nhất')}
                    />
                  </div>

                  {/* Content */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">{t('Nội dung mẫu bài đăng *')}</label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="bg-slate-100 hover:bg-slate-200 border px-2 py-0.5 rounded font-mono text-[9px] font-black cursor-pointer transition text-slate-600"
                          onClick={() => insertPlaceholder('{url}')}
                        >
                          + url
                        </button>
                        <button
                          type="button"
                          className="bg-slate-100 hover:bg-slate-200 border px-2 py-0.5 rounded font-mono text-[9px] font-black cursor-pointer transition text-slate-600"
                          onClick={() => insertPlaceholder('{name}')}
                        >
                          + name
                        </button>
                        <button
                          type="button"
                          className="bg-slate-100 hover:bg-slate-200 border px-2 py-0.5 rounded font-mono text-[9px] font-black cursor-pointer transition text-slate-600"
                          onClick={() => insertPlaceholder('{date}')}
                        >
                          + date
                        </button>
                      </div>
                    </div>
                    <textarea
                      required
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={12} // Tăng lên 12 dòng để cực kỳ rộng rãi và dễ viết
                      className="input text-xs w-full py-3 px-3.5 leading-relaxed bg-slate-50 border border-slate-250 focus:bg-white focus:border-orange-500 rounded-xl transition font-sans"
                      placeholder={t(`VD:\nGiảm giá sâu 50% hôm nay!\n\nChi tiết xem tại: {url}\n\nNgày đăng: {date}`)}
                    />
                  </div>

                  {/* Link to specific bot */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">{t('Gắn riêng cho Bot (Không bắt buộc)')}</label>
                    <select
                      value={taskId}
                      onChange={(e) => setTaskId(e.target.value)}
                      className="input text-xs font-semibold w-full py-2.5 px-3 bg-slate-50 border border-slate-250 focus:bg-white focus:border-orange-500 rounded-xl transition"
                    >
                      <option value="">{t('Dùng chung cho tất cả các Bot')}</option>
                      {tasks.map((tk: any) => (
                        <option key={tk.id} value={tk.id}>Bot: {tk.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Form Action Buttons */}
                  <div className="flex gap-2.5 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="btn-secondary flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      {t('Hủy')}
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn-primary flex-1 py-2.5 text-xs font-bold bg-orange-500 text-white rounded-xl transition cursor-pointer"
                    >
                      {saving ? t('Đang lưu...') : editingId ? t('Lưu cập nhật') : t('Tạo nội dung')}
                    </button>
                  </div>
                </form>
              </div>

              {/* Cột phải (5/12): Media, AI Assistant, Live Preview */}
              <div className="lg:col-span-5 space-y-4 lg:border-l lg:border-slate-100 lg:pl-6">
                
                {/* AI Assistant Toggle Button & Panel */}
                {!editingId && (
                  <div className="bg-orange-50/20 rounded-2xl p-4 border border-orange-500/10 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-orange-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {t('Trợ lý viết bài thông minh AI')}
                      </span>
                      <button
                        type="button"
                        className="text-[10px] font-extrabold bg-white text-orange-600 border border-orange-500/30 hover:border-orange-500 px-2.5 py-1.5 rounded-lg shadow-sm cursor-pointer hover:bg-orange-50/50 transition-colors"
                        onClick={() => setShowAiPanel(!showAiPanel)}
                      >
                        {showAiPanel ? t('Đóng AI Panel') : t('Mở AI Panel')}
                      </button>
                    </div>

                    {showAiPanel && (
                      <div className="pt-3 border-t border-orange-500/10 space-y-3 text-[11px] animate-in slide-in-from-top-1 duration-150">
                        <div>
                          <label className="block font-bold text-slate-500 uppercase mb-1">{t('URL trang đích phân tích *')}</label>
                          <input
                            className="input text-xs w-full py-2 px-3 bg-white border border-slate-200 rounded-xl focus:border-orange-500 focus:outline-none transition"
                            type="url"
                            placeholder="https://your-site.com/products-a"
                            value={aiUrl}
                            onChange={(e) => setAiUrl(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-500 uppercase mb-1">{t('Loại nội dung AI cần viết *')}</label>
                          <select
                            className="input text-xs w-full py-2 px-2.5 bg-white border border-slate-200 rounded-xl focus:border-orange-500 focus:outline-none transition font-semibold"
                            value={aiContentType}
                            onChange={(e) => setAiContentType(e.target.value as any)}
                          >
                            <option value="facebook">{t('Caption Facebook (3 biến thể)')}</option>
                            <option value="blog">{t('Bài viết Blog chuẩn SEO (HTML)')}</option>
                            <option value="video_script">{t('Kịch bản Video ngắn')}</option>
                            <option value="legacy">{t('Mặc định (Bài đăng mạng xã hội)')}</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block font-bold text-slate-500 uppercase mb-1">{t('Yêu cầu/Định hướng viết bài (tùy chọn)')}</label>
                          <input
                            className="input text-xs w-full py-2 px-3 bg-white border border-slate-200 rounded-xl focus:border-orange-500 focus:outline-none transition"
                            placeholder={t('Ví dụ: Giọng văn hài hước hóm hỉnh, nhiều hashtag...')}
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                          />
                        </div>

                        <button
                          type="button"
                          className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition duration-200 text-xs shadow-sm cursor-pointer disabled:opacity-50"
                          disabled={generating}
                          onClick={handleGenerateAi}
                        >
                          {generating ? t('Đang phân tích và viết bài...') : t('Viết bài bằng AI ngay')}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {aiResult && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1">✨ {t('Kết quả sinh nội dung AI')}</span>
                      <button
                        type="button"
                        onClick={() => setAiResult(null)}
                        className="text-[10px] text-red-500 font-bold hover:underline"
                      >
                        {t('Xóa kết quả')}
                      </button>
                    </h4>

                    {/* If Facebook Variations */}
                    {aiResult.variations && (
                      <div className="space-y-3">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('Chọn một trong 3 biến thể Facebook dưới đây:')}</p>
                        <div className="flex border-b border-slate-200">
                          {(['short', 'curious', 'cta'] as const).map((tab) => {
                            const labels = { short: t('Ngắn gọn'), curious: t('Gây tò mò'), cta: t('Kêu gọi hành động') };
                            return (
                              <button
                                key={tab}
                                type="button"
                                className={`py-1.5 px-3 font-bold text-[11px] transition-all ${
                                  activeVariationTab === tab ? 'border-b-2 border-orange-500 text-orange-600' : 'text-slate-500 hover:text-slate-800'
                                }`}
                                onClick={() => setActiveVariationTab(tab)}
                              >
                                {labels[tab]}
                              </button>
                            );
                          })}
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs min-h-[80px] whitespace-pre-wrap leading-relaxed max-h-[160px] overflow-y-auto custom-scrollbar">
                          {aiResult.variations[activeVariationTab]}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setContent(aiResult.variations[activeVariationTab]);
                            if (aiResult.title) setTitle(aiResult.title);
                            setSuccess(t('Đã áp dụng biến thể vào khung soạn thảo!'));
                          }}
                          className="w-full py-2 text-xs font-bold bg-white border border-orange-300 hover:bg-orange-50/50 text-orange-600 rounded-xl transition"
                        >
                          {t('Áp dụng biến thể này')}
                        </button>
                      </div>
                    )}

                    {/* If Video Script */}
                    {aiResult.script && (
                      <div className="space-y-3">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('Kịch bản video ngắn phân mảnh:')}</p>
                        <div className="space-y-2 text-xs max-h-[180px] overflow-y-auto custom-scrollbar">
                          <div className="bg-white border rounded-lg p-2.5">
                            <span className="font-extrabold text-brand uppercase text-[9px] tracking-wide block mb-1">🎬 Hook (3s):</span>
                            <p className="italic text-slate-700">{aiResult.script.hook}</p>
                          </div>
                          <div className="bg-white border rounded-lg p-2.5">
                            <span className="font-extrabold text-brand uppercase text-[9px] tracking-wide block mb-1">📝 Body (45s):</span>
                            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{aiResult.script.body}</p>
                          </div>
                          <div className="bg-white border rounded-lg p-2.5">
                            <span className="font-extrabold text-brand uppercase text-[9px] tracking-wide block mb-1">📣 CTA (12s):</span>
                            <p className="italic text-slate-700">{aiResult.script.cta}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const fullScript = `[HOOK (3s)]\n${aiResult.script.hook}\n\n[BODY (45s)]\n${aiResult.script.body}\n\n[CTA (12s)]\n${aiResult.script.cta}`;
                            setContent(fullScript);
                            if (aiResult.title) setTitle(aiResult.title);
                            setSuccess(t('Đã áp dụng kịch bản video vào khung soạn thảo!'));
                          }}
                          className="w-full py-2 text-xs font-bold bg-white border border-orange-300 hover:bg-orange-50/50 text-orange-600 rounded-xl transition"
                        >
                          {t('Áp dụng kịch bản này')}
                        </button>
                      </div>
                    )}

                    {/* If Blog SEO */}
                    {aiResult.slug && (
                      <div className="space-y-3">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('Bài Blog chuẩn SEO:')}</p>
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500">Slug:</span>
                            <code className="bg-white border px-1.5 py-0.5 rounded text-[10px] text-slate-700 font-semibold ml-2 break-all">{aiResult.slug}</code>
                          </div>
                          <div className="bg-white border rounded-lg p-2.5">
                            <span className="font-extrabold text-slate-550 uppercase text-[9px] tracking-wide block mb-1">Meta Description:</span>
                            <p className="text-slate-700 leading-normal">{aiResult.metaDescription}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setContent(aiResult.content);
                            if (aiResult.title) setTitle(aiResult.title);
                            setSuccess(t('Đã áp dụng nội dung HTML Blog vào khung soạn thảo!'));
                          }}
                          className="w-full py-2 text-xs font-bold bg-white border border-orange-300 hover:bg-orange-50/50 text-orange-600 rounded-xl transition"
                        >
                          {t('Áp dụng nội dung Blog')}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Image Upload & AI Generation Area */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">{t('Hình ảnh đi kèm')}</label>
                  <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/30 space-y-3">
                    {/* Drag-drop or Preview box */}
                    <div className="border border-dashed border-slate-200 bg-white rounded-xl p-3 text-center hover:border-orange-500/50 transition-colors">
                      {imagePreview ? (
                        <div className="relative group">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="max-h-36 max-w-full w-auto h-auto mx-auto rounded-lg shadow-sm object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setImageFile(null);
                              setImagePreview(null);
                            }}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold hover:bg-red-600 shadow cursor-pointer animate-in fade-in transition"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer block py-2">
                          <p className="text-[11px] text-slate-650 font-bold hover:text-orange-500 transition">{t('Kéo thả hoặc Click chọn ảnh')}</p>
                          <p className="text-[9px] text-slate-400 mt-1">{t('Hỗ trợ JPG, PNG, GIF, WebP (Tối đa 10MB)')}</p>
                          <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                        </label>
                      )}
                    </div>

                    {/* AI Image Generator Box */}
                    <div className="pt-2.5 border-t border-slate-100 space-y-2">
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{t('Hoặc tạo ảnh minh họa bằng AI')}</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customImagePrompt}
                          onChange={(e) => setCustomImagePrompt(e.target.value)}
                          placeholder={t('Nhập mô tả hình ảnh muốn vẽ...')}
                          className="input text-xs w-full py-2 px-3 bg-white border border-slate-200 rounded-xl focus:border-orange-500 focus:outline-none flex-1"
                          disabled={imageGenerating}
                        />
                        <button
                          type="button"
                          onClick={handleGenerateCustomImage}
                          disabled={imageGenerating || !customImagePrompt.trim()}
                          className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-orange-50/50 border border-orange-500/35 text-orange-600 font-bold text-[11px] transition-all disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer shrink-0"
                        >
                          {imageGenerating ? (
                            <>
                              <span className="w-3.5 h-3.5 border border-brand border-t-transparent rounded-full animate-spin"></span>
                              {t('Đang tạo...')}
                            </>
                          ) : (
                            t('Tạo ảnh')
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Preview block */}
                {(title || content) && (
                  <div className="bg-white border border-orange-500/10 rounded-2xl p-4 shadow-sm">
                    <p className="text-[9px] font-bold text-orange-600 uppercase tracking-wider mb-2">{t('Xem trước bài đăng')}</p>
                    <div className="bg-slate-50/50 rounded-xl p-3.5 border border-slate-200/50 text-xs">
                      <p className="font-bold text-slate-800 mb-1.5">{title || t('(Chưa có tiêu đề)')}</p>
                      <p className="text-slate-600 whitespace-pre-wrap leading-relaxed text-[11px]">
                        {content
                          .replace(/\{url\}/g, 'https://free-traffic-site.com')
                          .replace(/\{name\}/g, 'Tên Chiến Dịch')
                          .replace(/\{date\}/g, new Date().toLocaleDateString('vi-VN'))}
                      </p>
                      {imagePreview && (
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="mt-3 rounded-lg max-h-32 max-w-full w-auto h-auto mx-auto block object-contain shadow-sm"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={deleteConfirmId !== null}
        title={t('Xóa nội dung mẫu')}
        description={t('Bạn có chắc chắn muốn xóa mẫu nội dung này? Hành động này sẽ gỡ bỏ vĩnh viễn bài đăng ra khỏi danh sách xoay vòng.')}
        highlight={templates.find((t) => t.id === deleteConfirmId)?.title}
        confirmLabel={t('Xóa nội dung')}
        cancelLabel={t('Hủy')}
        variant="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
