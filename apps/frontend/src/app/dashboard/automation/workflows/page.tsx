'use client';

import { useEffect, useState, useCallback } from 'react';
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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Email Marketing Automation" description="Thiết lập các chuỗi email chăm sóc tự động (Drip) dựa trên hành động điền form." />
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-[#f25c22] hover:bg-[#d94d1a] text-white rounded-lg transition duration-200 shadow-md font-semibold text-sm flex items-center gap-2"
        >
          Tạo kịch bản mới
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
          <form onSubmit={handleSaveWorkflow} className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
              {editingId ? 'Sửa thông tin kịch bản' : 'Tạo kịch bản Drip Email'}
            </h3>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Tên kịch bản</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: Kịch bản Chăm Sóc Khách Đăng Ký 8/3"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f25c22] transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Điều kiện kích hoạt (Trigger)</label>
              <select
                value={form.triggerFormId}
                onChange={(e) => setForm({ ...form, triggerFormId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
              >
                <option value="">-- Chọn Custom Form kích hoạt --</option>
                {forms.map(f => (
                  <option key={f.id} value={String(f.id)}>{f.name}</option>
                ))}
              </select>
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
                {editingId ? 'Cập nhật' : 'Tạo kịch bản'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid: Workflows (Left) and Timeline Steps Designer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workflows list */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-850 rounded-xl p-5 space-y-4 shadow-md">
          <h3 className="font-bold text-white text-sm uppercase tracking-wider border-b border-slate-800 pb-2">Danh sách kịch bản</h3>
          
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
                  className={`p-3.5 rounded-lg border cursor-pointer transition flex flex-col justify-between gap-2 ${selectedId === wf.id ? 'bg-[#f25c22]/10 border-[#f25c22] text-white' : 'bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-400'}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-white text-xs line-clamp-1">{wf.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${wf.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                      {wf.isActive ? 'Hoạt động' : 'Tắt'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 space-y-0.5">
                    <div>Trigger: Nộp Form {wf.triggerFormId}</div>
                    <div>Số lượng email: {wf.steps?.length || 0} bước</div>
                  </div>
                  
                  <div className="flex justify-between border-t border-slate-900 pt-2 mt-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleActive(wf); }}
                      className="text-slate-500 hover:text-white text-xs font-semibold"
                    >
                      {wf.isActive ? 'Tạm dừng' : 'Kích hoạt'}
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenCreate(); setEditingId(wf.id); setForm({ name: wf.name, triggerType: wf.triggerType, triggerFormId: String(wf.triggerFormId) }); }}
                        className="text-slate-500 hover:text-white text-xs"
                      >
                        Sửa
                      </button>
                      <span className="text-slate-800">|</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(wf.id); }}
                        className="text-slate-500 hover:text-rose-400 text-xs"
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
        <div className="lg:col-span-2 bg-slate-900 border border-slate-850 rounded-xl p-5 space-y-4 shadow-md flex flex-col min-h-[400px]">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider">
              {selectedId ? `Thiết kế Timeline các bước gửi mail (Kịch bản ID: ${selectedId})` : 'Timeline chuỗi tự động gửi'}
            </h3>
            {selectedId && (
              <button
                onClick={addStep}
                className="text-xs bg-[#f25c22]/10 hover:bg-[#f25c22]/20 border border-[#f25c22]/30 text-[#f25c22] px-3 py-1.5 rounded font-bold transition"
              >
                + Thêm email tiếp theo (Step)
              </button>
            )}
          </div>

          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
              <p className="text-xs">Chọn một kịch bản chăm sóc bên trái để cấu hình chuỗi email tự động.</p>
            </div>
          ) : steps.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
              <p className="text-xs mb-3">Kịch bản chưa được thêm email nào.</p>
              <button
                onClick={addStep}
                className="px-4 py-2 bg-[#f25c22] text-white rounded-lg text-xs font-semibold shadow-md"
              >
                Thêm email đầu tiên
              </button>
            </div>
          ) : (
            <div className="flex-1 space-y-4 overflow-y-auto max-h-[50vh] pr-1">
              {steps.map((step, index) => (
                <div key={step.id} className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3 relative">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                    <span className="text-xs font-bold text-[#f25c22]">
                      Email #{step.stepOrder} (Gửi sau khi nộp form)
                    </span>
                    <button
                      onClick={() => removeStep(index)}
                      className="text-slate-650 hover:text-rose-400 text-xs font-semibold"
                    >
                      Xóa email này
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400">Thời gian trì hoãn (Wait delay)</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={Math.round(step.delaySeconds / 60)}
                          onChange={(e) => handleStepChange(index, 'delaySeconds', parseInt(e.target.value) * 60 || 0)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white text-center"
                        />
                        <span className="text-xs text-slate-500">phút</span>
                      </div>
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[10px] text-slate-400">Tiêu đề thư (Subject)</label>
                      <input
                        type="text"
                        value={step.emailSubject || ''}
                        onChange={(e) => handleStepChange(index, 'emailSubject', e.target.value)}
                        placeholder="Chào mừng {{name}} đến với Be Traffic!"
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#f25c22]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-slate-400">Nội dung thư (HTML / Text)</label>
                      <span className="text-[9px] text-slate-600">Thay thế động: &#123;&#123;name&#125;&#125;, &#123;&#123;email&#125;&#125;</span>
                    </div>
                    <textarea
                      value={step.emailBody || ''}
                      onChange={(e) => handleStepChange(index, 'emailBody', e.target.value)}
                      rows={3}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#f25c22]"
                    />
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3 shrink-0">
                <button
                  onClick={handleSaveSteps}
                  disabled={savingSteps}
                  className="px-6 py-2 bg-[#f25c22] hover:bg-[#d94d1a] disabled:bg-slate-800 text-white rounded-lg text-sm font-semibold shadow-md transition flex items-center gap-2"
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
