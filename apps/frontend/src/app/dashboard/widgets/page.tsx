'use client';

import React, { useState, useEffect } from 'react';
import { apiJson, apiUrl } from '@/lib/api';
import { useLocale } from '@/context/LocaleContext';

type Question = {
  question: string;
  options: string[];
  correctIndex: number;
};

type CalcInput = {
  label: string;
  name: string;
  value: number;
};

type WidgetConfig = {
  questions?: Question[];
  inputs?: CalcInput[];
};

type MarketingWidget = {
  id: number;
  name: string;
  type: 'QUIZ' | 'CALCULATOR' | 'AI_REPORT';
  title: string;
  description: string;
  configJson: string;
  themeColor: string;
  isActive: boolean;
  createdAt: string;
};

export default function WidgetsPage() {
  const { t } = useLocale();
  const [widgets, setWidgets] = useState<MarketingWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editing/Creating modes
  const [isEditing, setIsEditing] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<MarketingWidget | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'QUIZ' | 'CALCULATOR' | 'AI_REPORT'>('QUIZ');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTheme, setFormTheme] = useState('#e85d26');
  const [formIsActive, setFormIsActive] = useState(true);

  // Dynamic config states
  const [questions, setQuestions] = useState<Question[]>([]);
  const [calcInputs, setCalcInputs] = useState<CalcInput[]>([
    { label: 'Lưu lượng truy cập mỗi tháng', name: 'traffic', value: 10000 },
    { label: 'Tỉ lệ chuyển độ (%)', name: 'convRate', value: 2 },
    { label: 'Giá trị đơn hàng (VNĐ)', name: 'orderValue', value: 250000 },
  ]);

  // AI Tool states
  const [aiTopic, setAiTopic] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const loadWidgets = async () => {
    setLoading(true);
    try {
      const data = await apiJson<MarketingWidget[]>('/widgets');
      setWidgets(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải danh sách widgets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWidgets();
  }, []);

  const handleCreateNew = () => {
    setSelectedWidget(null);
    setFormName('');
    setFormType('QUIZ');
    setFormTitle('');
    setFormDesc('');
    setFormTheme('#e85d26');
    setFormIsActive(true);
    setQuestions([
      {
        question: 'Bạn muốn tối ưu quy trình kinh doanh nào nhất?',
        options: ['Tiếp thị tự động', 'Chăm sóc khách hàng', 'Quản lý bán hàng', 'Báo cáo phân tích'],
        correctIndex: 0
      }
    ]);
    setCalcInputs([
      { label: 'Lưu lượng truy cập mỗi tháng', name: 'traffic', value: 10000 },
      { label: 'Tỉ lệ chuyển đổi (%)', name: 'convRate', value: 2 },
      { label: 'Giá trị đơn hàng (VNĐ)', name: 'orderValue', value: 250000 },
    ]);
    setIsEditing(true);
    setError('');
    setSuccess('');
  };

  const handleEdit = (widget: MarketingWidget) => {
    setSelectedWidget(widget);
    setFormName(widget.name);
    setFormType(widget.type);
    setFormTitle(widget.title);
    setFormDesc(widget.description);
    setFormTheme(widget.themeColor);
    setFormIsActive(widget.isActive);

    const config: WidgetConfig = JSON.parse(widget.configJson || '{}');
    if (widget.type === 'QUIZ') {
      setQuestions(config.questions || []);
    } else if (widget.type === 'CALCULATOR') {
      setCalcInputs(config.inputs || []);
    }

    setIsEditing(true);
    setError('');
    setSuccess('');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa widget tương tác này?')) return;
    try {
      await apiJson(`/widgets/${id}`, { method: 'DELETE' });
      setSuccess('Đã xóa widget tương tác thành công!');
      loadWidgets();
    } catch (err: any) {
      setError(err.message || 'Lỗi xóa widget');
    }
  };

  // AI Quiz generator trigger
  const handleGenerateAiQuiz = async () => {
    if (!aiTopic.trim()) return;
    setAiLoading(true);
    setError('');
    try {
      const data = await apiJson<Question[]>('/widgets/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic.trim() }),
      });
      setQuestions(data);
      setSuccess('Đã sinh bộ câu hỏi trắc nghiệm AI thành công!');
    } catch (err: any) {
      setError(err.message || 'Lỗi sinh câu hỏi bằng AI');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    setSuccess('');

    const configObj: WidgetConfig = {};
    if (formType === 'QUIZ') {
      configObj.questions = questions;
    } else if (formType === 'CALCULATOR') {
      configObj.inputs = calcInputs;
    }

    const payload = {
      name: formName,
      type: formType,
      title: formTitle,
      description: formDesc,
      themeColor: formTheme,
      configJson: JSON.stringify(configObj),
      isActive: formIsActive,
    };

    try {
      if (selectedWidget) {
        // Update
        await apiJson(`/widgets/${selectedWidget.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setSuccess('Cập nhật cấu hình widget thành công!');
      } else {
        // Create
        await apiJson('/widgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setSuccess('Đã tạo widget tương tác mới thành công!');
      }
      setIsEditing(false);
      loadWidgets();
    } catch (err: any) {
      setError(err.message || 'Lỗi lưu cấu hình widget');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper: Get script embed block
  const getEmbedScript = (id: number) => {
    const srcUrl = apiUrl(`/widgets/public/script/${id}`);
    return `<script src="${srcUrl}" defer></script>`;
  };

  const copyEmbedScript = (id: number) => {
    navigator.clipboard.writeText(getEmbedScript(id));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to update question text
  const updateQuestionText = (index: number, val: string) => {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, question: val } : q));
  };

  // Helper to update option text
  const updateOptionText = (qIndex: number, optIndex: number, val: string) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i === qIndex) {
        const options = [...q.options];
        options[optIndex] = val;
        return { ...q, options };
      }
      return q;
    }));
  };

  // Helper to update correct option index
  const updateCorrectIndex = (qIndex: number, correctIdx: number) => {
    setQuestions(prev => prev.map((q, i) => i === qIndex ? { ...q, correctIndex: correctIdx } : q));
  };

  const addQuestion = () => {
    setQuestions(prev => [
      ...prev,
      { question: 'Câu hỏi trắc nghiệm mới', options: ['Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D'], correctIndex: 0 }
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  // Helper to update calculator input attributes
  const updateCalcInput = (index: number, field: keyof CalcInput, val: any) => {
    setCalcInputs(prev => prev.map((item, i) => i === index ? { ...item, [field]: val } : item));
  };

  const addCalcInput = () => {
    setCalcInputs(prev => [...prev, { label: 'Tên thông số', name: 'param_' + prev.length, value: 10 }]);
  };

  const removeCalcInput = (index: number) => {
    setCalcInputs(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Interactive Lead Magnets</h1>
          <p className="text-gray-500 mt-1">
            Xây dựng các bộ trắc nghiệm Quiz hoặc bảng tính ROI Calculator hấp dẫn để thu hút leads và tự động đổ dữ liệu về CRM.
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={handleCreateNew}
            className="py-2.5 px-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            Tạo Widget Tương Tác
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs">
          {success}
        </div>
      )}

      {/* Editor Screen */}
      {isEditing && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 lg:p-8">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4 mb-6">
            {selectedWidget ? `Chỉnh sửa Widget: ${selectedWidget.name}` : 'Thiết lập Widget tương tác mới'}
          </h2>

          <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Form Left Columns (Core info) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tên quản trị Widget</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Quiz tuyển dụng Digital Marketer"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Loại Widget tương tác</label>
                <select
                  disabled={!!selectedWidget}
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as 'QUIZ' | 'CALCULATOR' | 'AI_REPORT')}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:bg-gray-50"
                >
                  <option value="QUIZ">Khảo sát trắc nghiệm (AI Quiz)</option>
                  <option value="CALCULATOR">Bảng tính ROI (ROI Calculator)</option>
                  <option value="AI_REPORT">Biểu mẫu nhận báo cáo tăng trưởng AI (AI Lead Magnet)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tiêu đề Widget hiển thị</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Đo mức độ hiểu biết SEO On-page của bạn"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mô tả phụ hiển thị</label>
                <textarea
                  rows={3}
                  placeholder="Mô tả tóm tắt hoặc hướng dẫn tham gia trắc nghiệm..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Màu sắc chủ đạo</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={formTheme}
                      onChange={(e) => setFormTheme(e.target.value)}
                      className="w-10 h-10 border border-gray-200 rounded-xl cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formTheme}
                      onChange={(e) => setFormTheme(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1 flex flex-col justify-end">
                  <div className="flex items-center space-x-2 pb-3">
                    <input
                      type="checkbox"
                      id="widgetActive"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                    />
                    <label htmlFor="widgetActive" className="text-xs font-semibold text-gray-700 cursor-pointer">
                      Đang kích hoạt
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Right Columns (Interactive questions builder / Inputs builder) */}
            <div className="lg:col-span-7 border-t lg:border-t-0 lg:border-l border-gray-100 lg:pl-8 pt-6 lg:pt-0 space-y-6">
              
              {/* QUIZ CONFIG */}
              {formType === 'QUIZ' && (
                <div className="space-y-6">
                  {/* AI Generation Tool */}
                  <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-3">
                    <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">🪄 Sinh câu hỏi trắc nghiệm bằng AI</h4>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      Nhập chủ đề kiến thức, AI sẽ tự động biên soạn bộ 5 câu hỏi trắc nghiệm độc quyền chuẩn ngành.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Chủ đề ví dụ: Marketing Automation hoặc Content SEO"
                        value={aiTopic}
                        onChange={(e) => setAiTopic(e.target.value)}
                        className="flex-1 px-3 py-2 bg-white border border-amber-250 rounded-xl text-xs focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={aiLoading}
                        onClick={handleGenerateAiQuiz}
                        className="py-2 px-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center space-x-1"
                      >
                        {aiLoading && (
                          <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        )}
                        <span>Biên soạn AI</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Danh sách câu hỏi trắc nghiệm</span>
                      <button
                        type="button"
                        onClick={addQuestion}
                        className="text-xs text-amber-600 hover:text-amber-700 font-semibold flex items-center space-x-1"
                      >
                        + Thêm câu hỏi
                      </button>
                    </div>

                    <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
                      {questions.map((q, qIdx) => (
                        <div key={qIdx} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3 relative group">
                          <button
                            type="button"
                            onClick={() => removeQuestion(qIdx)}
                            className="absolute top-3 right-3 text-gray-400 hover:text-rose-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>

                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Câu hỏi {qIdx + 1}</span>
                            <input
                              type="text"
                              value={q.question}
                              onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {q.options.map((opt, oIdx) => (
                              <div key={oIdx} className="space-y-1">
                                <div className="flex items-center space-x-1 justify-between">
                                  <span className="text-[9px] font-semibold text-gray-400 uppercase">Đáp án {oIdx + 1}</span>
                                  <input
                                    type="radio"
                                    name={`correct_${qIdx}`}
                                    checked={q.correctIndex === oIdx}
                                    onChange={() => updateCorrectIndex(qIdx, oIdx)}
                                    className="w-3.5 h-3.5 text-green-600 border-gray-300 focus:ring-green-500 cursor-pointer"
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => updateOptionText(qIdx, oIdx, e.target.value)}
                                  className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* CALCULATOR CONFIG */}
              {formType === 'CALCULATOR' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Các thông số nhập vào bảng tính</span>
                    <button
                      type="button"
                      onClick={addCalcInput}
                      className="text-xs text-amber-600 hover:text-amber-700 font-semibold flex items-center space-x-1"
                    >
                      + Thêm thông số
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                    {calcInputs.map((inp, idx) => (
                      <div key={idx} className="p-4 bg-gray-50 border border-gray-200 rounded-xl grid grid-cols-12 gap-3 items-end relative group">
                        <button
                          type="button"
                          onClick={() => removeCalcInput(idx)}
                          className="absolute top-2 right-2 text-gray-400 hover:text-rose-600 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>

                        <div className="col-span-5 space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Nhãn hiển thị</label>
                          <input
                            type="text"
                            value={inp.label}
                            onChange={(e) => updateCalcInput(idx, 'label', e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                          />
                        </div>

                        <div className="col-span-3 space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Mã biến số (ID)</label>
                          <input
                            type="text"
                            value={inp.name}
                            onChange={(e) => updateCalcInput(idx, 'name', e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none"
                          />
                        </div>

                        <div className="col-span-4 space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Giá trị mặc định</label>
                          <input
                            type="number"
                            value={inp.value}
                            onChange={(e) => updateCalcInput(idx, 'value', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 leading-relaxed">
                    <strong>Thông tin công thức:</strong> Bảng tính ROI Calculator mặc định tự động nhân 3 thông số này với nhau: <strong>Lưu lượng truy cập x Tỉ lệ chuyển đổi (%) x Giá trị đơn hàng</strong> để tính toán doanh thu dự kiến cho khách hàng.
                  </div>
                </div>
              )}

              {/* AI_REPORT CONFIG */}
              {formType === 'AI_REPORT' && (
                <div className="space-y-6">
                  <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl space-y-4">
                    <h4 className="text-sm font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      <span>✨ Biểu Mẫu Nhận Báo Cáo AI (AI Lead Magnet)</span>
                    </h4>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Widget này sẽ hiển thị một form thu thập thông tin bao gồm: 
                      <strong> Họ tên</strong>, <strong> Địa chỉ Email</strong>, và <strong> URL Website</strong>.
                    </p>
                    <div className="space-y-2 text-xs text-amber-700">
                      <div className="flex gap-2">
                        <span className="text-amber-500">•</span>
                        <span>Khách truy cập nhập link website của họ và bấm đăng ký.</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-amber-500">•</span>
                        <span>Hệ thống tự động phân tích website (Scrape metadata, AI SEO & Growth Audit).</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-amber-500">•</span>
                        <span>Tạo file PDF báo cáo chuyên nghiệp có gắn nhãn thương hiệu và tự động gửi qua email đính kèm cho khách.</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-amber-500">•</span>
                        <span>Thông tin khách hàng lập tức được thêm vào CRM với nguồn tag <code>LEAD_MAGNET</code>.</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <h5 className="text-xs font-bold text-slate-700">🎨 Xem trước các trường hiển thị của Form:</h5>
                    <div className="space-y-2 opacity-75 pointer-events-none">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Họ và tên của bạn</label>
                        <input type="text" placeholder="Nguyễn Văn A" className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Địa chỉ Email nhận báo cáo</label>
                        <input type="email" placeholder="name@company.com" className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">URL Website cần phân tích</label>
                        <input type="url" placeholder="https://mycompany.com" className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6 border-t border-gray-100 justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="py-2.5 px-4 bg-white border border-gray-200 text-gray-600 hover:text-gray-900 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="py-2.5 px-5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-semibold shadow-md transition-all flex items-center space-x-2"
                >
                  {actionLoading && (
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  <span>Lưu cấu hình</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Grid of Widgets */}
      {!isEditing && (
        <>
          {loading ? (
            <div className="p-12 text-center text-gray-400 animate-pulse bg-white border border-gray-100 rounded-2xl">
              Đang tải danh sách Widgets tương tác...
            </div>
          ) : widgets.length === 0 ? (
            <div className="p-12 text-center text-gray-400 bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21m0 0l-.813-5.096M9 21h3m-3 0H6m9.813-5.096a9.3 9.3 0 10-13.626 0M9 21v-3" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-800">Chưa có Widget tương tác nào</h3>
              <p className="text-xs text-gray-400 max-w-sm">Tạo bộ trắc nghiệm Quiz hoặc bảng tính doanh thu ROI để thu leads CRM.</p>
              <button
                onClick={handleCreateNew}
                className="py-2 px-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                Tạo ngay
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {widgets.map((widget) => {
                const config: WidgetConfig = JSON.parse(widget.configJson || '{}');
                const isQuiz = widget.type === 'QUIZ';
                const isCalc = widget.type === 'CALCULATOR';
                const itemsCount = isQuiz ? (config.questions?.length || 0) : (config.inputs?.length || 0);

                return (
                  <div key={widget.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex flex-col justify-between space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isQuiz 
                            ? 'bg-amber-50 text-amber-600 border border-amber-200' 
                            : isCalc
                              ? 'bg-blue-50 text-blue-600 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        }`}>
                          {isQuiz ? 'AI Quiz' : isCalc ? 'ROI Calculator' : 'AI Lead Magnet'}
                        </span>
                        
                        <div className="flex items-center space-x-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${widget.isActive ? 'bg-green-550 bg-green-500' : 'bg-gray-300'}`} />
                          <span className="text-xs text-gray-400">{widget.isActive ? 'Hoạt động' : 'Tạm dừng'}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-gray-950">{widget.name}</h3>
                        <div className="text-xs text-gray-400 font-mono">
                          Tiêu đề: {widget.title}
                        </div>
                        <div className="text-xs text-gray-400">
                          {isQuiz 
                            ? `${itemsCount} Câu hỏi trắc nghiệm` 
                            : isCalc 
                              ? `${itemsCount} Tham số đầu vào`
                              : 'Biểu mẫu phân tích website & Gửi PDF tự động'
                          }
                        </div>
                      </div>
                    </div>

                    {/* Embedding code segment */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mã nhúng nhúng (Script tag)</span>
                        <button
                          onClick={() => copyEmbedScript(widget.id)}
                          className="text-[11px] font-bold text-amber-600 hover:text-amber-700 transition-colors"
                        >
                          {copiedId === widget.id ? 'Đã sao chép!' : 'Sao chép mã'}
                        </button>
                      </div>
                      <code className="block text-[11px] font-mono text-gray-500 break-all select-all leading-snug">
                        {getEmbedScript(widget.id)}
                      </code>
                    </div>

                    {/* Action buttons footer */}
                    <div className="flex gap-2 justify-end border-t border-gray-50 pt-4">
                      <button
                        onClick={() => handleEdit(widget)}
                        className="py-1.5 px-3 border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900 rounded-lg text-xs font-semibold transition-all bg-white"
                      >
                        Thiết lập
                      </button>
                      <button
                        onClick={() => handleDelete(widget.id)}
                        className="py-1.5 px-3 border border-rose-200 hover:border-rose-300 text-rose-600 hover:text-rose-700 rounded-lg text-xs font-semibold transition-all bg-white"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
