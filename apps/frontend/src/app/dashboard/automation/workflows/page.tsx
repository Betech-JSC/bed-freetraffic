'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';

type CustomFormOption = {
  id: number;
  name: string;
};

type EmailWorkflowStep = {
  id: number;
  stepOrder: number;
  actionType: 'SEND_EMAIL' | 'WAIT';
  delaySeconds: number;
  emailSubject: string | null;
  emailBody: string | null;
};

type EmailWorkflow = {
  id: number;
  name: string;
  triggerType: string;
  triggerFormId: number | null;
  form?: CustomFormOption | null;
  isActive: boolean;
  steps: EmailWorkflowStep[];
  createdAt: string;
};

export default function EmailWorkflowsPage() {
  const [workflows, setWorkflows] = useState<EmailWorkflow[]>([]);
  const [forms, setForms] = useState<CustomFormOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Selected workflow details for the step designer panel
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [steps, setSteps] = useState<EmailWorkflowStep[]>([]);
  const [savingSteps, setSavingSteps] = useState(false);

  // Workflow CRUD modal states
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    triggerType: 'FORM_SUBMISSION',
    triggerFormId: '',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const wfData = await apiJson<EmailWorkflow[]>('/automation/workflows');
      setWorkflows(Array.isArray(wfData) ? wfData : []);
      
      const formsData = await apiJson<CustomFormOption[]>('/forms');
      setForms(Array.isArray(formsData) ? formsData : []);
      
      setError('');
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách kịch bản.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadWorkflowDetails = async (wf: EmailWorkflow) => {
    setSelectedId(wf.id);
    setSteps(wf.steps || []);
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({ name: '', triggerType: 'FORM_SUBMISSION', triggerFormId: forms[0]?.id ? String(forms[0].id) : '' });
    setShowEditor(true);
  };

  const handleSaveWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.triggerFormId) {
      setError('Vui lòng điền tên kịch bản và chọn Form kích hoạt.');
      return;
    }

    const payload = {
      name: form.name,
      triggerType: form.triggerType,
      triggerFormId: parseInt(form.triggerFormId),
    };

    try {
      if (editingId) {
        await apiJson(`/automation/workflows/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setSuccess('Đã cập nhật kịch bản thành công.');
      } else {
        await apiJson('/automation/workflows', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess('Đã tạo kịch bản Drip Email mới.');
      }
      setShowEditor(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu kịch bản.');
    }
  };

  const handleToggleActive = async (wf: EmailWorkflow) => {
    try {
      await apiJson(`/automation/workflows/${wf.id}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ isActive: !wf.isActive }),
      });
      setSuccess(`Đã ${!wf.isActive ? 'kích hoạt' : 'tạm dừng'} kịch bản.`);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Lỗi thay đổi trạng thái kịch bản.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa kịch bản tự động hóa này? Các tiến trình đang chờ gửi mail sẽ dừng lại.')) return;
    try {
      await apiJson(`/automation/workflows/${id}`, { method: 'DELETE' });
      setSuccess('Đã xóa kịch bản thành công.');
      if (selectedId === id) setSelectedId(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa kịch bản.');
    }
  };

  // STEP DESIGNER CONTROLS
  const addStep = () => {
    const newStep: EmailWorkflowStep = {
      id: Date.now(), // Temp id for UI key
      stepOrder: steps.length + 1,
      actionType: 'SEND_EMAIL',
      delaySeconds: 0,
      emailSubject: 'Email chào mừng!',
      emailBody: 'Chào {{name}},\nCảm ơn bạn đã đăng ký thông tin!',
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (index: number) => {
    const filtered = steps.filter((_, i) => i !== index);
    // Recalculate step order
    const updated = filtered.map((step, i) => ({ ...step, stepOrder: i + 1 }));
    setSteps(updated);
  };

  const handleStepChange = (index: number, key: keyof EmailWorkflowStep, val: any) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [key]: val };
    setSteps(updated);
  };

  const handleSaveSteps = async () => {
    if (!selectedId) return;
    try {
      setSavingSteps(true);
      await apiJson(`/automation/workflows/${selectedId}/steps`, {
        method: 'PUT',
        body: JSON.stringify({ steps }),
      });
      setSuccess('Lưu chuỗi các bước email tự động thành công.');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Lỗi lưu các bước của kịch bản.');
    } finally {
      setSavingSteps(false);
    }
  };

  return (
    <div className="p-6 space-y-6 page-container">
      <div className="flex justify-between items-center">
        <PageHeader title="Email Marketing Automation" description="Thiết lập các chuỗi email chăm sóc tự động (Drip) dựa trên hành động điền form." />
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-[#f25c22] hover:bg-[#d94d1a] text-white rounded-xl transition duration-200 shadow-md font-semibold text-sm flex items-center gap-2 cursor-pointer active:scale-95"
        >
          Tạo kịch bản mới
        </button>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-xl text-sm flex justify-between items-center shadow-sm animate-in fade-in-50">
          <span className="flex items-center gap-1.5 font-medium">✅ {success}</span>
          <button onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-700 text-xs font-bold transition cursor-pointer">Đóng</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-150 text-rose-850 rounded-xl text-sm flex justify-between items-center shadow-sm animate-in fade-in-50">
          <span className="flex items-center gap-1.5 font-medium">⚠️ {error}</span>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-750 text-xs font-bold transition cursor-pointer">Đóng</button>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveWorkflow} className="bg-white border border-slate-100 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">
              {editingId ? 'Sửa thông tin kịch bản' : 'Tạo kịch bản Drip Email'}
            </h3>

            <div className="space-y-1">
              <label className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tên kịch bản</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: Kịch bản Chăm Sóc Khách Đăng Ký 8/3"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]/20 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500 font-bold uppercase tracking-wider">Điều kiện kích hoạt (Trigger)</label>
              {forms.length === 0 ? (
                <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs space-y-1.5 mt-1 shadow-inner">
                  <p className="font-bold flex items-center gap-1">⚠️ Chưa có Custom Form nào!</p>
                  <p className="text-slate-650 font-medium leading-relaxed">Bạn cần tạo ít nhất một biểu mẫu tại phần <strong>Custom Forms</strong> để liên kết kích hoạt kịch bản này.</p>
                  <Link href="/dashboard/forms" onClick={() => setShowEditor(false)} className="inline-block text-[#f25c22] hover:underline font-bold mt-1">
                    Đến trang Tạo Custom Form →
                  </Link>
                </div>
              ) : (
                <select
                  value={form.triggerFormId}
                  onChange={(e) => setForm({ ...form, triggerFormId: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]/20 transition cursor-pointer"
                  required
                >
                  <option value="">-- Chọn Custom Form kích hoạt --</option>
                  {forms.map(f => (
                    <option key={f.id} value={String(f.id)}>{f.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-semibold transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={forms.length === 0}
                className="px-4 py-2 bg-[#f25c22] hover:bg-[#d94d1a] disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-sm font-semibold transition shadow-md cursor-pointer"
              >
                {editingId ? 'Cập nhật' : 'Tạo kịch bản'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid: Workflows (Left) and Timeline Steps Designer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workflows list */}
        <div className="lg:col-span-1 bg-white border border-slate-250/60 rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider border-b border-slate-100 pb-2.5">Danh sách kịch bản</h3>
          
          {loading ? (
            <div className="flex justify-center py-6 text-slate-400 text-xs">
              Đang tải kịch bản...
            </div>
          ) : workflows.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-6">Chưa có kịch bản Drip Email nào.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {workflows.map(wf => (
                <div
                  key={wf.id}
                  onClick={() => loadWorkflowDetails(wf)}
                  className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between gap-2 shadow-sm ${selectedId === wf.id ? 'bg-[#f25c22]/5 border-[#f25c22]' : 'bg-white border-slate-200/60 hover:border-slate-300'}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className={`font-bold text-xs line-clamp-1 ${selectedId === wf.id ? 'text-[#f25c22]' : 'text-slate-800'}`}>{wf.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold border ${wf.isActive ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {wf.isActive ? 'Hoạt động' : 'Tắt'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 space-y-0.5">
                    <div>Trigger: Nộp Form: <strong className="text-slate-600">{wf.form?.name || wf.triggerFormId || '—'}</strong></div>
                    <div>Số lượng email: {wf.steps?.length || 0} bước</div>
                  </div>
                  
                  <div className="flex justify-between border-t border-slate-100 pt-2 mt-1.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleToggleActive(wf); }}
                      className={`text-[11px] font-bold transition cursor-pointer ${wf.isActive ? 'text-rose-600 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                    >
                      {wf.isActive ? 'Tạm dừng' : 'Kích hoạt'}
                    </button>
                    <div className="flex gap-2 text-slate-300">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setEditingId(wf.id); setForm({ name: wf.name, triggerType: wf.triggerType, triggerFormId: String(wf.triggerFormId) }); setShowEditor(true); }}
                        className="text-slate-500 hover:text-slate-800 text-[11px] font-bold transition cursor-pointer"
                      >
                        Sửa
                      </button>
                      <span>|</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDelete(wf.id); }}
                        className="text-slate-400 hover:text-rose-600 text-[11px] font-bold transition cursor-pointer"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Steps designer (Right) */}
        <div className="lg:col-span-2 bg-white border border-slate-250/60 rounded-2xl p-5 space-y-4 shadow-sm flex flex-col min-h-[400px]">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
              {selectedId ? `Thiết kế Timeline các bước gửi mail (Kịch bản ID: ${selectedId})` : 'Timeline chuỗi tự động gửi'}
            </h3>
            {selectedId && (
              <button
                type="button"
                onClick={addStep}
                className="text-xs bg-[#f25c22]/5 hover:bg-[#f25c22]/10 border border-[#f25c22]/20 text-[#f25c22] px-3.5 py-2 rounded-xl font-bold transition shadow-sm cursor-pointer"
              >
                + Thêm email tiếp theo (Step)
              </button>
            )}
          </div>

          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
              <p className="text-xs">Chọn một kịch bản chăm sóc bên trái để cấu hình chuỗi email tự động.</p>
            </div>
          ) : steps.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
              <p className="text-xs mb-3">Kịch bản chưa được thêm email nào.</p>
              <button
                type="button"
                onClick={addStep}
                className="px-4 py-2 bg-[#f25c22] text-white rounded-xl text-xs font-semibold shadow-md cursor-pointer hover:bg-[#d94d1a]"
              >
                Thêm email đầu tiên
              </button>
            </div>
          ) : (
            <div className="flex-1 space-y-4 overflow-y-auto max-h-[50vh] pr-1">
              {steps.map((step, index) => (
                <div key={step.id} className="bg-slate-50/50 border border-slate-200/60 p-4 rounded-xl space-y-3 relative shadow-sm">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-[#f25c22]">
                      Email #{step.stepOrder} (Gửi sau khi nộp form)
                    </span>
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      className="text-slate-450 hover:text-rose-600 text-xs font-semibold transition cursor-pointer"
                    >
                      Xóa email này
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Thời gian trì hoãn</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={Math.round(step.delaySeconds / 60)}
                          onChange={(e) => handleStepChange(index, 'delaySeconds', (parseInt(e.target.value) || 0) * 60)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 text-center focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]/20"
                        />
                        <span className="text-xs text-slate-500 font-medium">phút</span>
                      </div>
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Tiêu đề thư (Subject)</label>
                      <input
                        type="text"
                        value={step.emailSubject || ''}
                        onChange={(e) => handleStepChange(index, 'emailSubject', e.target.value)}
                        placeholder="Chào mừng {{name}} đến với Be Traffic!"
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]/20 transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Nội dung thư (HTML / Text)</label>
                      <span className="text-[9px] text-slate-400 font-medium">Thay thế động: &#123;&#123;name&#125;&#125;, &#123;&#123;email&#125;&#125;</span>
                    </div>
                    <textarea
                      value={step.emailBody || ''}
                      onChange={(e) => handleStepChange(index, 'emailBody', e.target.value)}
                      rows={3}
                      className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]/20 transition"
                    />
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                <button
                  onClick={handleSaveSteps}
                  disabled={savingSteps}
                  className="px-6 py-2 bg-[#f25c22] hover:bg-[#d94d1a] disabled:bg-slate-100 disabled:text-slate-450 text-white rounded-lg text-sm font-semibold shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  {savingSteps ? 'Đang lưu...' : 'Lưu chuỗi Drip Email'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
