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
    try {
      const data = await apiJson<{
        title: string;
        content: string;
        imageUrl: string | null;
        isDemo: boolean;
      }>('/templates/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urlTarget: aiUrl.trim(),
          aiPrompt: aiPrompt.trim(),
          generateImage: aiGenImage,
        }),
      });

      setTitle(data.title);
      setContent(data.content);
      if (data.imageUrl) {
        setImagePreview(data.imageUrl);
        setImageFile(null);
      }
      
      if (data.isDemo) {
        setAiInfoTip(t('Đang chạy ở chế độ Demo (chưa cấu hình OpenAI API Key). Thêm OPENAI_API_KEY ở file .env để chạy thực tế.'));
      } else {
        setAiInfoTip(t('AI đã tạo bài viết và hình ảnh thành công dựa trên phân tích URL đích.'));
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
        description={t('FR-09 — Soạn thảo các bài viết mẫu (Mẫu nội dung) để xoay vòng đăng bài kéo Traffic tự động.')}
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
      <div className="bg-brand/5 border border-brand/10 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
        <div>
          <h4 className="font-bold text-slate-800 text-sm">{t('Hướng dẫn xoay vòng nội dung bài viết')}</h4>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {t('Các mẫu bài viết bật **Active (Bật)** sẽ được Bot tự động lựa chọn ngẫu nhiên để đăng bài kéo traffic. Khi soạn thảo, bạn có thể bấm vào biến động để chèn nhanh:')}{' '}
            <button
              type="button"
              className="mx-1 bg-brand/10 border border-brand/20 px-1.5 py-0.5 rounded text-brand font-mono text-[10px] font-bold transition-all hover:bg-brand/20 hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
              title={t('Click để chèn {url}')}
              onClick={() => insertPlaceholder('{url}')}
            >
              {'{url}'}
            </button>
            {t('(link trang đích kéo traffic),')}{' '}
            <button
              type="button"
              className="mx-1 bg-brand/10 border border-brand/20 px-1.5 py-0.5 rounded text-brand font-mono text-[10px] font-bold transition-all hover:bg-brand/20 hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
              title={t('Click để chèn {name}')}
              onClick={() => insertPlaceholder('{name}')}
            >
              {'{name}'}
            </button>
            {t('(tên của Bot đang chạy), hoặc')}{' '}
            <button
              type="button"
              className="mx-1 bg-brand/10 border border-brand/20 px-1.5 py-0.5 rounded text-brand font-mono text-[10px] font-bold transition-all hover:bg-brand/20 hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
              title={t('Click để chèn {date}')}
              onClick={() => insertPlaceholder('{date}')}
            >
              {'{date}'}
            </button>
            {t('(ngày hiện tại).')}
          </p>
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
                  <span className={`shrink-0 px-2 py-0.5 border rounded text-[9px] font-extrabold uppercase tracking-wider ${
                    tpl.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-450 border-slate-200'
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
                  <span className="font-bold text-slate-650 bg-slate-50 border px-1.5 py-0.5 rounded">{tpl.task.name}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleEdit(tpl)}
                  className="flex-1 text-center py-1.5 text-xs font-bold text-brand bg-brand/5 border border-brand/10 rounded-lg hover:bg-brand/10 transition-colors cursor-pointer active:scale-95"
                >
                  {t('Sửa')}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleActive(tpl)}
                  className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer active:scale-95 ${
                    tpl.isActive 
                      ? 'text-orange-600 bg-orange-50 border-orange-100 hover:bg-orange-100' 
                      : 'text-green-600 bg-green-50 border-green-100 hover:bg-green-100'
                  }`}
                >
                  {tpl.isActive ? t('Tạm dừng') : t('Bật chạy')}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(tpl.id)}
                  className="flex-1 text-center py-1.5 text-xs font-bold text-red-650 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors cursor-pointer active:scale-95"
                >
                  {t('Xóa')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Editor Modal */}
      {showModal && (
        <div className="modal-overlay animate-fade-in" onClick={resetForm}>
          <div className="modal-panel max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2.5 border-b">
              <h3 className="text-base font-black text-brand uppercase tracking-wider">
                {editingId ? t('Chỉnh sửa nội dung mẫu') : t('Soạn nội dung mẫu mới')}
              </h3>
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">X</button>
            </div>

            {aiInfoTip && <div className="alert-info text-[11px] font-bold py-2">{aiInfoTip}</div>}

            {/* AI Assistant Toggle Button */}
            {!editingId && (
              <div className="bg-gradient-to-r from-purple-500/10 to-brand/10 rounded-xl p-3 border border-brand/20">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-brand flex items-center gap-1.5">
                    {t('Trợ lý viết bài thông minh AI (GPT)')}
                  </span>
                  <button
                    type="button"
                    className="text-[10px] font-extrabold bg-brand text-white px-2.5 py-1 rounded shadow-sm cursor-pointer hover:bg-brand-hover transition-colors"
                    onClick={() => setShowAiPanel(!showAiPanel)}
                  >
                    {showAiPanel ? t('Đóng AI Panel') : t('Mở AI Panel')}
                  </button>
                </div>

                {showAiPanel && (
                  <div className="mt-3.5 pt-3 border-t border-brand/10 space-y-3 text-[11px]">
                    <div>
                      <label className="block font-bold text-slate-500 uppercase mb-1">{t('URL trang đích phân tích *')}</label>
                      <input
                        className="input text-xs w-full py-1.5"
                        type="url"
                        placeholder="https://your-site.com/products-a"
                        value={aiUrl}
                        onChange={(e) => setAiUrl(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label className="block font-bold text-slate-500 uppercase mb-1">{t('Yêu cầu/Định hướng viết bài (tùy chọn)')}</label>
                      <input
                        className="input text-xs w-full py-1.5"
                        placeholder={t('Ví dụ: Giọng văn hài hước hóm hỉnh, nhiều hashtag...')}
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                      />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={aiGenImage}
                        onChange={(e) => setAiGenImage(e.target.checked)}
                        className="rounded border-slate-350 text-brand focus:ring-brand"
                      />
                      <span className="font-bold text-slate-650">{t('Tự động sinh ảnh minh họa bằng AI (DALL-E)')}</span>
                    </label>

                    <button
                      type="button"
                      className="btn-primary w-full py-2 text-xs"
                      disabled={generating}
                      onClick={handleGenerateAi}
                    >
                      {generating ? t('Đang phân tích và viết bài...') : t('Viết bài bằng AI ngay')}
                    </button>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold text-slate-700">
              {/* Title */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Tiêu đề bài đăng mẫu *')}</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input text-xs w-full py-2"
                  placeholder={t('VD: Cập nhật xu hướng marketing mới nhất')}
                />
              </div>

              {/* Content */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">{t('Nội dung mẫu bài đăng *')}</label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="bg-slate-100 hover:bg-slate-200 border px-1 rounded font-mono text-[9px] font-black cursor-pointer"
                      onClick={() => insertPlaceholder('{url}')}
                    >
                      + url
                    </button>
                    <button
                      type="button"
                      className="bg-slate-100 hover:bg-slate-200 border px-1 rounded font-mono text-[9px] font-black cursor-pointer"
                      onClick={() => insertPlaceholder('{name}')}
                    >
                      + name
                    </button>
                    <button
                      type="button"
                      className="bg-slate-100 hover:bg-slate-200 border px-1 rounded font-mono text-[9px] font-black cursor-pointer"
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
                  rows={5}
                  className="input text-xs w-full py-2 leading-relaxed"
                  placeholder={t(`VD:\nGiảm giá sâu 50% hôm nay!\n\nChi tiết xem tại: {url}\n\nNgày đăng: {date}`)}
                />
              </div>

              {/* Image Upload Area */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Hình ảnh đi kèm')}</label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 text-center hover:border-brand/40 transition-colors">
                  {imagePreview ? (
                    <div className="relative">
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
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold hover:bg-red-650 shadow cursor-pointer"
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block py-2">
                      <p className="text-[11px] text-slate-500 font-bold">{t('Kéo thả hoặc Click chọn ảnh')}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">{t('Hỗ trợ JPG, PNG, GIF, WebP (Tối đa 10MB)')}</p>
                      <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                    </label>
                  )}
                </div>
              </div>

              {/* Link to specific bot */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Gắn riêng cho Bot (Không bắt buộc)')}</label>
                <select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  className="input text-xs font-semibold w-full py-2 bg-white"
                >
                  <option value="">{t('Dùng chung cho tất cả các Bot')}</option>
                  {tasks.map((tk: any) => (
                    <option key={tk.id} value={tk.id}>Bot: {tk.name}</option>
                  ))}
                </select>
              </div>

              {/* Live Preview block */}
              {(title || content) && (
                <div className="bg-slate-50 border rounded-xl p-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">{t('Xem trước bài đăng')}</p>
                  <div className="bg-white rounded-lg p-3 shadow-sm border text-xs">
                    <p className="font-bold text-slate-900 mb-1.5">{title || t('(Chưa có tiêu đề)')}</p>
                    <p className="text-slate-650 whitespace-pre-wrap leading-normal">
                      {content
                        .replace(/\{url\}/g, 'https://free-traffic-site.com')
                        .replace(/\{name\}/g, 'Tên Chiến Dịch')
                        .replace(/\{date\}/g, new Date().toLocaleDateString('vi-VN'))}
                    </p>
                    {imagePreview && (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="mt-3 rounded-lg max-h-32 max-w-full w-auto h-auto mx-auto block object-contain"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Form Buttons */}
              <div className="flex gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-secondary flex-1 py-2 text-xs"
                >
                  {t('Hủy')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1 py-2 text-xs"
                >
                  {saving ? t('Đang lưu...') : editingId ? t('Lưu cập nhật') : t('Tạo nội dung')}
                </button>
              </div>
            </form>
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
