'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl, apiJson } from '@/lib/api';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Business info, 2: Goals, 3: Processing, 4: Results
  const [companyName, setCompanyName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [onboardingGoals, setOnboardingGoals] = useState<string[]>([]);
  
  // Processing steps states
  const [currentProgressText, setCurrentProgressText] = useState('Đang khởi tạo cấu hình...');
  const [progressPercent, setProgressPercent] = useState(10);
  
  // Result States
  const [aiReport, setAiReport] = useState('');
  const [auditScore, setAuditScore] = useState<number | null>(null);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const goals = [
    {
      id: 'AUTOMATE_SOCIAL',
      icon: '💬',
      title: 'Tự động hóa Mạng xã hội',
      desc: 'AI tự động đăng bài đa kênh (Zalo, Facebook, YouTube), quét và hút Lead chất lượng từ các Group Facebook theo thời gian thực.',
      color: 'from-orange-500 to-amber-500'
    },
    {
      id: 'CSKH',
      icon: '🤖',
      title: 'Chăm sóc khách hàng tự động',
      desc: 'Tích hợp AI Chatbot trả lời tin nhắn tự động 24/7 trên Zalo OA, Facebook Fanpage và Live Chat Widget.',
      color: 'from-blue-500 to-indigo-500'
    },
    {
      id: 'EMAIL_DRIP',
      icon: '📧',
      title: 'Email Marketing RAG thông minh',
      desc: 'Tự động kích hoạt chuỗi email bám đuổi chào mừng khách hàng mới, cá nhân hóa nội dung email động dựa trên RAG.',
      color: 'from-purple-500 to-pink-500'
    },
    {
      id: 'SEO_TRAFFIC',
      icon: '🚀',
      title: 'Tối ưu hóa SEO & Kéo Traffic',
      desc: 'Phân tích nhanh lỗi kỹ thuật SEO, nghiên cứu từ khóa, tối ưu bài viết chuẩn SEO để thu hút traffic tự nhiên.',
      color: 'from-emerald-500 to-teal-500'
    }
  ];

  // Skip or mock company option
  const handleSkipBusinessInfo = () => {
    setCompanyName('Thương hiệu của tôi');
    setWebsiteUrl('');
    setStep(2);
  };

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError('Vui lòng nhập tên công ty hoặc thương hiệu của bạn.');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleSelectGoal = (goalId: string) => {
    setOnboardingGoals(prev => 
      prev.includes(goalId) 
        ? prev.filter(id => id !== goalId) 
        : [...prev, goalId]
    );
  };

  const handleStartOnboarding = async () => {
    if (onboardingGoals.length === 0) return;
    setStep(3);
    setLoading(true);

    // Dynamic text sequence during analysis
    const texts = [
      { text: 'Đang lưu cấu hình thông tin doanh nghiệp...', duration: 1500, pct: 25 },
      { text: 'Đang khởi chạy robot phân tích SEO kỹ thuật website...', duration: 2500, pct: 50 },
      { text: 'Đang phân tích cấu trúc trang, thẻ meta và tốc độ tải trang...', duration: 2500, pct: 75 },
      { text: 'Đang kết hợp AI đề xuất lộ trình tăng trưởng lưu lượng truy cập...', duration: 3000, pct: 95 }
    ];

    let currentIdx = 0;
    const progressInterval = setInterval(() => {
      if (currentIdx < texts.length) {
        setCurrentProgressText(texts[currentIdx].text);
        setProgressPercent(texts[currentIdx].pct);
        currentIdx++;
      }
    }, 2000);

    try {
      const res = await apiJson<any>('/workspaces/onboard', {
        method: 'POST',
        body: JSON.stringify({
          companyName,
          websiteUrl: websiteUrl || null,
          onboardingGoal: onboardingGoals.join(',')
        })
      });

      clearInterval(progressInterval);
      setProgressPercent(100);
      setCurrentProgressText('Lập chiến lược thành công!');

      // Set results
      setAiReport(res.aiAuditReport || '');
      setAuditScore(res.auditScore);

      // Display results page after 1s
      setTimeout(() => {
        setStep(4);
        setLoading(false);
      }, 1000);

    } catch (err: any) {
      clearInterval(progressInterval);
      setLoading(false);
      setError(err.message || 'Lỗi xảy ra trong quá trình thiết lập Onboarding.');
      setStep(1); // Back to start
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans relative overflow-hidden">
      {/* Dynamic background shapes */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-brand/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-400/10 rounded-full blur-[120px] translate-x-1/2 translate-y-1/2" />

      <div className="w-full max-w-4xl bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 sm:p-10 shadow-2xl transition-all relative z-10">
        
        {/* Progress Bar Header */}
        {step < 4 && (
          <div className="w-full bg-slate-100 h-1.5 rounded-full mb-8 overflow-hidden flex">
            <div 
              className="bg-brand h-full transition-all duration-500 ease-out"
              style={{ width: `${step === 1 ? 33 : step === 2 ? 66 : 95}%` }}
            />
          </div>
        )}

        {/* STEP 1: BUSINESS INFO */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2 text-center max-w-lg mx-auto">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Hãy kể một chút về doanh nghiệp của bạn
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm">
                Chúng tôi sẽ dùng thông tin này để quét nhanh SEO kỹ thuật website và lập kế hoạch Marketing AI phù hợp nhất.
              </p>
            </div>

            {error && (
              <div className="alert-error text-xs sm:text-sm py-3">
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleNextStep1} className="space-y-5 max-w-md mx-auto pt-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Tên thương hiệu / Công ty</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="input px-4 py-3 text-sm bg-white"
                  placeholder="Ví dụ: Công ty Thiết kế nội thất DecorPlus"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Link Website của bạn (Nếu có)</label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="input px-4 py-3 text-sm bg-white"
                  placeholder="https://company.com"
                />
                <p className="text-[10px] text-slate-400 mt-1">Hệ thống sẽ chạy robot SEO Audit trực tuyến cho website này.</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleSkipBusinessInfo}
                  className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl transition-all"
                >
                  Tôi chưa có Website / Công ty
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-brand hover:bg-brand-hover text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-[0.98]"
                >
                  Tiếp tục
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: GOAL SELECTION */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-2 text-center max-w-lg mx-auto">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Mục tiêu nào bạn muốn tập trung hàng đầu?
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm">
                Chúng tôi sẽ tối ưu hóa giao diện cấu hình và đưa các trợ lý AI tương ứng vào giải quyết công việc ngay ngày đầu tiên.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-4">
              {goals.map((g) => {
                const isSelected = onboardingGoals.includes(g.id);
                return (
                  <div
                    key={g.id}
                    onClick={() => handleSelectGoal(g.id)}
                    className={`border rounded-2xl p-5 cursor-pointer transition-all duration-300 relative overflow-hidden flex gap-4 ${
                      isSelected
                        ? 'border-brand bg-orange-50/10 shadow-lg ring-2 ring-brand/10'
                        : 'border-slate-200/80 hover:border-brand/40 bg-white'
                    }`}
                  >
                    <div className="text-3xl shrink-0 select-none">{g.icon}</div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-slate-800 text-sm">{g.title}</h4>
                      <p className="text-slate-500 text-[11px] leading-relaxed font-medium">{g.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-8 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl transition-all"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={handleStartOnboarding}
                disabled={onboardingGoals.length === 0}
                className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-55 disabled:pointer-events-none"
              >
                Khởi chạy AI lập chiến lược
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: LOADING AUDIT & AI STRATEGY */}
        {step === 3 && (
          <div className="py-12 flex flex-col items-center justify-center space-y-6 max-w-md mx-auto">
            {/* Stunning Pulse Loader */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-brand/20 animate-ping" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-brand to-orange-500 flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            </div>

            <div className="space-y-2 text-center w-full">
              <h3 className="font-extrabold text-slate-900 text-lg">Đang tính toán chiến lược tăng trưởng...</h3>
              <p className="text-slate-500 text-xs font-semibold animate-pulse">{currentProgressText}</p>
            </div>

            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden relative">
              <div 
                className="bg-brand h-full transition-all duration-300" 
                style={{ width: `${progressPercent}%` }} 
              />
            </div>
            <span className="text-xs font-bold text-slate-400 font-mono">{progressPercent}%</span>
          </div>
        )}

        {/* STEP 4: PRESENTING AUDIT SCORE AND AI REPORT */}
        {step === 4 && (
          <div className="space-y-8 animate-[fadeIn_0.5s_ease-out]">
            <div className="text-center space-y-2 border-b border-slate-100 pb-5">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto border border-green-200">
                ✓
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Chiến lược tăng trưởng AI của bạn đã sẵn sàng!
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm">
                Chúng tôi đã phân tích tình hình kinh doanh của bạn và đề xuất các hành động thiết thực dưới đây để kéo traffic và tìm kiếm khách hàng.
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              
              {/* Left Column: SEO Score Card (if audit was completed) */}
              <div className="lg:col-span-1 space-y-5">
                <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[280px]">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-brand/20 rounded-full blur-2xl" />
                  
                  <div className="space-y-1">
                    <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">KẾT QUẢ SEO AUDIT</span>
                    <h3 className="text-base font-extrabold text-white truncate">{websiteUrl ? new URL(websiteUrl).hostname : 'Chưa nhập Web'}</h3>
                  </div>

                  {auditScore !== null ? (
                    <div className="my-6 text-center">
                      <div className="text-5xl font-black text-brand tracking-tight font-mono">{auditScore}</div>
                      <p className="text-[11px] text-slate-400 mt-2 font-medium">
                        {auditScore >= 80 ? '🟢 Website của bạn tối ưu rất tốt' : auditScore >= 50 ? '🟡 Website ở mức trung bình, cần tối ưu thêm' : '🔴 Điểm SEO thấp, cần sửa lỗi gấp'}
                      </p>
                    </div>
                  ) : (
                    <div className="my-6 text-center text-slate-400 space-y-2">
                      <div className="text-3xl">✨</div>
                      <p className="text-[11px] leading-relaxed">Không chạy Audit Website. Chiến lược sẽ tập trung xây dựng phễu trang đích Landing Page mới trên Be Traffic.</p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-400 leading-relaxed">
                    Bạn có thể kiểm tra chi tiết lỗi và cách khắc phục trong tab <b>SEO & Audit</b> ở Dashboard chính.
                  </div>
                </div>

                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 space-y-3">
                  <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Mục tiêu được ưu tiên</h4>
                  {onboardingGoals.map(goalId => {
                    const goal = goals.find(g => g.id === goalId);
                    if (!goal) return null;
                    return (
                      <div key={goal.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-2xl select-none">{goal.icon}</span>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{goal.title}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Be Traffic AI OS</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: AI Markdown Strategy report */}
              <div className="lg:col-span-2 bg-slate-50 border border-slate-150 rounded-3xl p-6 sm:p-8 overflow-y-auto max-h-[450px] custom-scrollbar shadow-inner">
                <div className="prose prose-slate prose-sm max-w-none text-slate-700 leading-relaxed font-medium space-y-4">
                  {/* Render the strategy report beautifully */}
                  {aiReport.split('\n').map((line, idx) => {
                    const cleanLine = line.trim();
                    if (cleanLine.startsWith('# ')) {
                      return <h1 key={idx} className="text-xl font-black text-slate-900 border-b border-slate-200 pb-2 mt-4">{cleanLine.slice(2)}</h1>;
                    }
                    if (cleanLine.startsWith('## ')) {
                      return <h2 key={idx} className="text-base font-extrabold text-slate-800 mt-6 mb-2 flex items-center gap-2">🎯 {cleanLine.slice(3)}</h2>;
                    }
                    if (cleanLine.startsWith('### ')) {
                      return <h3 key={idx} className="text-sm font-extrabold text-slate-700 mt-4 mb-1">{cleanLine.slice(4)}</h3>;
                    }
                    if (cleanLine.startsWith('- ') || cleanLine.startsWith('* ')) {
                      return <li key={idx} className="text-xs text-slate-650 ml-4 list-disc pl-1">{line.slice(2)}</li>;
                    }
                    if (cleanLine.startsWith('**') && cleanLine.endsWith('**')) {
                      return <p key={idx} className="text-xs font-bold text-slate-800 mt-2">{cleanLine.slice(2, -2)}</p>;
                    }
                    if (!cleanLine) {
                      return <div key={idx} className="h-2" />;
                    }
                    return <p key={idx} className="text-xs text-slate-650 leading-relaxed">{line}</p>;
                  })}
                </div>
              </div>

            </div>

            <div className="pt-6 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => {
                  router.push('/dashboard');
                  router.refresh();
                }}
                className="px-8 py-3.5 bg-brand hover:bg-brand-hover text-white font-black text-sm rounded-xl shadow-lg shadow-brand/20 transition-all hover:scale-105 active:scale-95 cursor-pointer inline-flex items-center gap-2"
              >
                Vào Dashboard quản trị
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
