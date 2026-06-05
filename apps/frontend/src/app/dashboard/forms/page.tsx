'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';

type CustomForm = {
  id: number;
  name: string;
  fieldsJson: string;
  landingPageId: number | null;
  landingPage?: { title: string; slug: string } | null;
  createdAt: string;
};

type FormSubmission = {
  id: number;
  formId: number;
  dataJson: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export default function FormsManagementPage() {
  const { t } = useLocale();
  const [forms, setForms] = useState<CustomForm[]>([]);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dialog creation/editing states
  const [showEditor, setShowEditor] = useState(false);
  const [editingFormId, setEditingFormId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [fields, setFields] = useState<Array<{ name: string; label: string; required: boolean }>>([
    { name: 'name', label: 'Họ và Tên', required: true },
    { name: 'email', label: 'Địa chỉ Email', required: true },
    { name: 'phone', label: 'Số điện thoại', required: false },
  ]);

  const loadForms = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiJson<CustomForm[]>('/forms');
      setForms(Array.isArray(data) ? data : []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách form.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  const loadSubmissions = async (formId: number) => {
    try {
      setSubLoading(true);
      setSelectedFormId(formId);
      const data = await apiJson<FormSubmission[]>(`/forms/${formId}/submissions`);
      setSubmissions(Array.isArray(data) ? data : []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách đăng ký.');
    } finally {
      setSubLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingFormId(null);
    setFormName('');
    setFields([
      { name: 'name', label: 'Họ và Tên', required: true },
      { name: 'email', label: 'Địa chỉ Email', required: true },
      { name: 'phone', label: 'Số điện thoại', required: false },
    ]);
    setShowEditor(true);
  };

  const handleOpenEdit = (form: CustomForm) => {
    setEditingFormId(form.id);
    setFormName(form.name);
    try {
      setFields(JSON.parse(form.fieldsJson));
    } catch {
      setFields([]);
    }
    setShowEditor(true);
  };

  const handleAddField = () => {
    setFields([...fields, { name: '', label: '', required: false }]);
  };

  const handleRemoveField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, key: 'name' | 'label' | 'required', val: any) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: val };
    setFields(updated);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) {
      setError('Vui lòng điền tên biểu mẫu.');
      return;
    }

    // Validate field definitions
    for (const f of fields) {
      if (!f.name || !f.label) {
        setError('Tất cả các trường phải có Tên mã hóa và Nhãn hiển thị.');
        return;
      }
    }

    const payload = {
      name: formName,
      fieldsJson: JSON.stringify(fields),
    };

    try {
      if (editingFormId) {
        await apiJson(`/forms/${editingFormId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setSuccess('Cập nhật biểu mẫu thành công.');
      } else {
        await apiJson('/forms', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess('Tạo biểu mẫu mới thành công.');
      }
      setShowEditor(false);
      loadForms();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu biểu mẫu.');
    }
  };

  const handleDeleteForm = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa biểu mẫu này? Toàn bộ lead đăng ký từ biểu mẫu này sẽ bị xóa khỏi lịch sử submission.')) return;
    try {
      await apiJson(`/forms/${id}`, { method: 'DELETE' });
      setSuccess('Đã xóa biểu mẫu thành công.');
      if (selectedFormId === id) {
        setSelectedFormId(null);
        setSubmissions([]);
      }
      loadForms();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa biểu mẫu.');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Quản lý Custom Forms" description="Tự định nghĩa các biểu mẫu thu thập dữ liệu Lead để nhúng vào Landing Page." />
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-[#f25c22] hover:bg-[#d94d1a] text-white rounded-lg transition duration-200 shadow-md font-semibold text-sm flex items-center gap-2"
        >
          Tạo form mới
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

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveForm} className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-lg space-y-4 shadow-2xl overflow-y-auto max-h-[85vh]">
            <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
              {editingFormId ? 'Chỉnh sửa Form' : 'Tạo Form mới'}
            </h3>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Tên biểu mẫu</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ví dụ: Form Đăng Ký Tư Vấn Landing Page 8/3"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f25c22] transition"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cấu trúc các trường (Fields)</label>
                <button
                  type="button"
                  onClick={handleAddField}
                  className="text-xs text-[#f25c22] hover:underline"
                >
                  + Thêm trường
                </button>
              </div>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {fields.map((field, index) => (
                  <div key={index} className="flex items-center gap-2 bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <div className="grid grid-cols-2 gap-2 flex-1">
                      <input
                        type="text"
                        placeholder="Tên trường (ko dấu: email, phone)"
                        value={field.name}
                        onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white"
                      />
                      <input
                        type="text"
                        placeholder="Nhãn hiển thị (Tên hiển thị)"
                        value={field.label}
                        onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="checkbox"
                        id={`req-${index}`}
                        checked={field.required}
                        onChange={(e) => handleFieldChange(index, 'required', e.target.checked)}
                        className="h-3 w-3 accent-[#f25c22]"
                      />
                      <label htmlFor={`req-${index}`} className="text-[10px] text-slate-400 select-none cursor-pointer">Bắt buộc</label>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveField(index)}
                      className="text-slate-400 hover:text-rose-400 text-xs font-semibold px-2 py-1 bg-slate-800 rounded hover:bg-slate-750 transition"
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-sm transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#f25c22] hover:bg-[#d94d1a] text-white rounded-lg text-sm font-semibold transition"
              >
                Lưu lại
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid: Form List (Left) and Submissions (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form List */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-850 rounded-xl p-5 space-y-4 shadow-md">
          <h3 className="font-bold text-white text-sm uppercase tracking-wider border-b border-slate-800 pb-2">Danh sách biểu mẫu</h3>
          
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-[#f25c22]"></div>
            </div>
          ) : forms.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-6">Chưa có biểu mẫu nào.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {forms.map(form => (
                <div
                  key={form.id}
                  onClick={() => loadSubmissions(form.id)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition flex flex-col justify-between gap-2 ${selectedFormId === form.id ? 'bg-[#f25c22]/10 border-[#f25c22] text-white' : 'bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-400'}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-white text-xs line-clamp-1">{form.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">ID: {form.id}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Trang đích: {form.landingPage ? `${form.landingPage.title} (/p/${form.landingPage.slug})` : 'Chưa liên kết'}
                  </span>
                  
                  <div className="flex justify-end gap-2 border-t border-slate-900 pt-2 mt-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenEdit(form); }}
                      className="text-slate-500 hover:text-white text-xs"
                    >
                      Sửa cấu trúc
                    </button>
                    <span className="text-slate-700">|</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteForm(form.id); }}
                      className="text-slate-500 hover:text-rose-400 text-xs"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submissions Detail */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-850 rounded-xl p-5 space-y-4 shadow-md min-h-[400px] flex flex-col">
          <h3 className="font-bold text-white text-sm uppercase tracking-wider border-b border-slate-800 pb-2">
            {selectedFormId ? `Dữ liệu đăng ký (Form ID: ${selectedFormId})` : 'Thông tin đăng ký của khách'}
          </h3>

          {!selectedFormId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
              <p className="text-xs">Vui lòng chọn một biểu mẫu ở danh sách bên trái để xem dữ liệu lead.</p>
            </div>
          ) : subLoading ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f25c22]"></div>
            </div>
          ) : submissions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
              <p className="text-xs">Chưa có ai điền thông tin đăng ký vào biểu mẫu này.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Thời gian</th>
                    <th className="py-2.5 px-3">Dữ liệu đăng ký</th>
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3">User Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {submissions.map(sub => {
                    let fieldsData = {};
                    try {
                      fieldsData = JSON.parse(sub.dataJson);
                    } catch {
                      // fallback
                    }
                    return (
                      <tr key={sub.id} className="hover:bg-slate-950/40 text-slate-300">
                        <td className="py-3 px-3 whitespace-nowrap text-slate-500">
                          {new Date(sub.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-3">
                          <div className="space-y-1">
                            {Object.entries(fieldsData).map(([k, v]) => (
                              <div key={k} className="flex gap-2">
                                <span className="font-semibold text-slate-400 capitalize">{k}:</span>
                                <span>{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                          {sub.ipAddress || '—'}
                        </td>
                        <td className="py-3 px-3 text-[10px] text-slate-500 truncate max-w-[200px]" title={sub.userAgent || ''}>
                          {sub.userAgent || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
