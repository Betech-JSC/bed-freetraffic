'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiJson } from '@/lib/api';

type CustomFormOption = {
  id: number;
  name: string;
};

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
};

type PageBlock = {
  id: string;
  type: 'hero' | 'features' | 'form' | 'pricing' | 'footer';
  title: string;
  subtitle?: string;
  buttonText?: string;
  backgroundColor?: string;
  textColor?: string;
  items?: string[]; // For features list
  formId?: string; // For lead capturing forms
  priceVal?: string; // For pricing
};

const DEFAULT_BLOCKS: PageBlock[] = [
  {
    id: 'block-1',
    type: 'hero',
    title: 'Tăng Trưởng Doanh Thu Bứt Phá Với Growth OS',
    subtitle: 'Hệ thống tự động hóa Marketing kéo traffic tự nhiên và chuyển đổi khách hàng khép kín.',
    buttonText: 'Trải nghiệm miễn phí',
    backgroundColor: '#0f172a',
    textColor: '#ffffff',
  },
  {
    id: 'block-2',
    type: 'features',
    title: 'Những Lợi Ích Vượt Trội Của Hệ Thống',
    items: [
      'Tự động viết bài viết chuẩn SEO bằng AI Copilot',
      'Đăng bài tự động đa kênh Facebook, Zalo, YouTube',
      'Quét & audit onpage phát hiện lỗi kỹ thuật seo tự động',
      'Hàng đợi gửi Drip Email tự động nuôi dưỡng leads 24/7',
    ],
    backgroundColor: '#0b0f19',
    textColor: '#94a3b8',
  },
];

export default function LandingPageBuilder() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [page, setPage] = useState<LandingPage | null>(null);
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [forms, setForms] = useState<CustomFormOption[]>([]);
  
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const pageData = await apiJson<LandingPage>(`/landing-pages/${id}`);
      setPage(pageData);
      
      // Parse layoutJson or fall back to defaults
      let parsedBlocks = DEFAULT_BLOCKS;
      if (pageData.layoutJson && pageData.layoutJson !== '{}') {
        try {
          parsedBlocks = JSON.parse(pageData.layoutJson);
        } catch (e) {
          // Keep defaults
        }
      }
      setBlocks(parsedBlocks);

      // Load Custom Forms of this workspace to link
      const formsData = await apiJson<CustomFormOption[]>('/forms');
      setForms(Array.isArray(formsData) ? formsData : []);

      setError('');
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu trang đích.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Generate public HTML code based on layout blocks
  const compileHtml = (blocksList: PageBlock[]): string => {
    let html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page?.title || 'Landing Page'}</title>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background-color: #030712; color: #f3f4f6; }
  </style>
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen">`;

    for (const block of blocksList) {
      if (block.type === 'hero') {
        html += `
  <section class="py-24 px-6 text-center" style="background-color: ${block.backgroundColor || '#0f172a'}; color: ${block.textColor || '#ffffff'};">
    <div class="max-w-4xl mx-auto space-y-6">
      <h1 class="text-4xl md:text-6xl font-extrabold tracking-tight">${block.title}</h1>
      <p class="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">${block.subtitle || ''}</p>
      <div class="pt-4">
        <a href="#register-form" class="inline-block px-8 py-4 bg-[#f25c22] hover:bg-[#d94d1a] text-white font-bold rounded-lg transition duration-200 shadow-lg transform hover:-translate-y-1">
          ${block.buttonText || 'Bắt đầu ngay'}
        </a>
      </div>
    </div>
  </section>`;
      } else if (block.type === 'features') {
        html += `
  <section class="py-20 px-6 bg-gray-900" style="background-color: ${block.backgroundColor || '#111827'}; color: ${block.textColor || '#94a3b8'};">
    <div class="max-w-5xl mx-auto">
      <h2 class="text-3xl font-bold text-center text-white mb-12">${block.title}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        ${(block.items || []).map(item => `
        <div class="flex items-start gap-3 bg-gray-800/40 p-5 rounded-lg border border-gray-850">
          <svg class="h-6 w-6 text-[#f25c22] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <p class="text-gray-200 font-medium">${item}</p>
        </div>`).join('')}
      </div>
    </div>
  </section>`;
      } else if (block.type === 'form') {
        html += `
  <section id="register-form" class="py-20 px-6 bg-gray-950">
    <div class="max-w-md mx-auto bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-xl">
      <h3 class="text-2xl font-bold text-white text-center mb-6">${block.title}</h3>
      <p class="text-gray-400 text-sm text-center mb-6">${block.subtitle || 'Vui lòng điền thông tin để tiếp tục'}</p>
      
      <form id="public-lead-form" class="space-y-4">
        <input type="hidden" name="formId" id="form-id-holder" value="${block.formId || ''}" />
        <div>
          <label class="block text-xs font-semibold text-gray-400 mb-1">Họ và Tên</label>
          <input type="text" id="lead-name" required class="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#f25c22]" placeholder="Nguyễn Văn A" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-400 mb-1">Địa chỉ Email</label>
          <input type="email" id="lead-email" required class="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#f25c22]" placeholder="name@email.com" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-400 mb-1">Số điện thoại</label>
          <input type="tel" id="lead-phone" class="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#f25c22]" placeholder="0987654321" />
        </div>
        <button type="submit" id="lead-submit-btn" class="w-full py-3 bg-[#f25c22] hover:bg-[#d94d1a] text-white font-bold rounded-lg transition duration-200 mt-2 shadow-md">
          Gửi thông tin đăng ký
        </button>
      </form>
      
      <p id="form-message" class="text-center mt-4 text-sm hidden"></p>
    </div>

    <script>
      document.getElementById('public-lead-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const formId = document.getElementById('form-id-holder').value;
        const name = document.getElementById('lead-name').value;
        const email = document.getElementById('lead-email').value;
        const phone = document.getElementById('lead-phone').value;
        const msgText = document.getElementById('form-message');
        const submitBtn = document.getElementById('lead-submit-btn');

        if (!formId) {
          msgText.className = 'text-center mt-4 text-sm text-red-500 block';
          msgText.innerText = 'Lỗi: Chưa liên kết Custom Form với khối này.';
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = 'Đang gửi...';

        try {
          const res = await fetch('/api/public/forms/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              formId: parseInt(formId),
              data: { name, email, phone }
            })
          });
          const result = await res.json();
          if (res.ok && result.success) {
            msgText.className = 'text-center mt-4 text-sm text-green-500 block';
            msgText.innerText = 'Đăng ký thành công! Cảm ơn bạn đã quan tâm.';
            document.getElementById('public-lead-form').reset();
            // Fire conversion tracking event
            if (window.fbq) { window.fbq('track', 'Lead'); }
          } else {
            msgText.className = 'text-center mt-4 text-sm text-red-500 block';
            msgText.innerText = result.error || 'Có lỗi xảy ra khi đăng ký.';
          }
        } catch (err) {
          msgText.className = 'text-center mt-4 text-sm text-red-500 block';
          msgText.innerText = 'Lỗi kết nối máy chủ.';
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Gửi thông tin đăng ký';
        }
      });
    </script>
  </section>`;
      }
    }

    html += `
  <footer class="py-10 text-center text-sm text-gray-500 border-t border-gray-900 bg-gray-950">
    <p>© ${new Date().getFullYear()} ${page?.title || 'Growth OS'}. Bản quyền thuộc về hệ thống Be Traffic.</p>
  </footer>
</body>
</html>`;
    return html;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const compiledHtml = compileHtml(blocks);
      await apiJson(`/landing-pages/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: page?.title,
          slug: page?.slug,
          layoutJson: JSON.stringify(blocks),
          htmlContent: compiledHtml,
          status: page?.status,
        }),
      });
      setSuccess('Đã lưu thiết kế trang đích thành công.');
      setError('');
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu thiết kế.');
    } finally {
      setSaving(false);
    }
  };

  const addBlock = (type: 'hero' | 'features' | 'form') => {
    let newBlock: PageBlock;
    if (type === 'hero') {
      newBlock = {
        id: `block-${Date.now()}`,
        type: 'hero',
        title: 'Khám Phá Giải Pháp Của Chúng Tôi',
        subtitle: 'Mô tả ngắn gọn giá trị cốt lõi giải pháp của bạn.',
        buttonText: 'Tìm hiểu ngay',
        backgroundColor: '#0f172a',
        textColor: '#ffffff',
      };
    } else if (type === 'features') {
      newBlock = {
        id: `block-${Date.now()}`,
        type: 'features',
        title: 'Tính Năng Độc Đáo',
        items: ['Tính năng 1', 'Tính năng 2', 'Tính năng 3'],
        backgroundColor: '#111827',
        textColor: '#94a3b8',
      };
    } else {
      newBlock = {
        id: `block-${Date.now()}`,
        type: 'form',
        title: 'Đăng Ký Nhận Tư Vấn Miễn Phí',
        subtitle: 'Chúng tôi sẽ gọi lại hỗ trợ bạn trong vòng 10 phút.',
        backgroundColor: '#030712',
        textColor: '#ffffff',
        formId: forms[0]?.id ? String(forms[0].id) : '',
      };
    }
    setBlocks([...blocks, newBlock]);
  };

  const deleteBlock = (blockId: string) => {
    setBlocks(blocks.filter(b => b.id !== blockId));
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  };

  const updateBlock = (updated: PageBlock) => {
    setBlocks(blocks.map(b => (b.id === updated.id ? updated : b)));
  };

  const selectedBlock = blocks.find(b => b.id === selectedBlockId);

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      {/* Sidebar - Controls */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div className="p-5 space-y-6 overflow-y-auto">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-white text-base">Trình Thiết Kế</h3>
              <p className="text-slate-400 text-xs truncate max-w-[150px]">{page?.title || 'Loading...'}</p>
            </div>
            <button onClick={() => router.push('/dashboard/landing')} className="text-slate-400 hover:text-white text-xs font-semibold">
              Quay lại
            </button>
          </div>

          {/* Add Blocks */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Thêm khối mới</label>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => addBlock('hero')} className="bg-slate-950 border border-slate-800 hover:border-[#f25c22] rounded p-2 text-center text-xs transition">
                Banner
              </button>
              <button onClick={() => addBlock('features')} className="bg-slate-950 border border-slate-800 hover:border-[#f25c22] rounded p-2 text-center text-xs transition">
                Lợi ích
              </button>
              <button onClick={() => addBlock('form')} className="bg-slate-950 border border-slate-800 hover:border-[#f25c22] rounded p-2 text-center text-xs transition">
                Biểu mẫu
              </button>
            </div>
          </div>

          {/* Block List / Navigation */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Cấu trúc trang</label>
            {blocks.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-4">Trang chưa có khối nào.</p>
            ) : (
              <div className="space-y-1.5">
                {blocks.map((block, index) => (
                  <div
                    key={block.id}
                    onClick={() => setSelectedBlockId(block.id)}
                    className={`flex justify-between items-center px-3 py-2 rounded-lg border cursor-pointer transition ${selectedBlockId === block.id ? 'bg-[#f25c22]/10 border-[#f25c22] text-white' : 'bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-400'}`}
                  >
                    <span className="text-xs font-medium capitalize">
                      {index + 1}. Khối {block.type}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
                      className="text-slate-600 hover:text-rose-400 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Properties Panel of Selected Block */}
          {selectedBlock && (
            <div className="border-t border-slate-800 pt-5 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#f25c22]">Cấu hình Khối</h4>
              
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Tiêu đề chính</label>
                <input
                  type="text"
                  value={selectedBlock.title}
                  onChange={(e) => updateBlock({ ...selectedBlock, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#f25c22]"
                />
              </div>

              {selectedBlock.type === 'hero' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Mô tả phụ</label>
                    <textarea
                      value={selectedBlock.subtitle || ''}
                      onChange={(e) => updateBlock({ ...selectedBlock, subtitle: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#f25c22]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Nút bấm hành động</label>
                    <input
                      type="text"
                      value={selectedBlock.buttonText || ''}
                      onChange={(e) => updateBlock({ ...selectedBlock, buttonText: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                </>
              )}

              {selectedBlock.type === 'form' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Mô tả phụ</label>
                    <input
                      type="text"
                      value={selectedBlock.subtitle || ''}
                      onChange={(e) => updateBlock({ ...selectedBlock, subtitle: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Liên kết Custom Form</label>
                    <select
                      value={selectedBlock.formId || ''}
                      onChange={(e) => updateBlock({ ...selectedBlock, formId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="">-- Chọn form thu lead --</option>
                      {forms.map(f => (
                        <option key={f.id} value={String(f.id)}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {selectedBlock.type === 'features' && (
                <div className="space-y-2">
                  <label className="text-[11px] text-slate-400">Các mục lợi ích</label>
                  {(selectedBlock.items || []).map((item, idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={item}
                      onChange={(e) => {
                        const newItems = [...(selectedBlock.items || [])];
                        newItems[idx] = e.target.value;
                        updateBlock({ ...selectedBlock, items: newItems });
                      }}
                      className="w-full bg-slate-950 border border-slate-855 rounded px-2.5 py-1 text-xs text-white"
                    />
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500">Màu nền</label>
                  <input
                    type="color"
                    value={selectedBlock.backgroundColor || '#0f172a'}
                    onChange={(e) => updateBlock({ ...selectedBlock, backgroundColor: e.target.value })}
                    className="w-full bg-transparent border-0 h-8 cursor-pointer rounded"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500">Màu chữ</label>
                  <input
                    type="color"
                    value={selectedBlock.textColor || '#ffffff'}
                    onChange={(e) => updateBlock({ ...selectedBlock, textColor: e.target.value })}
                    className="w-full bg-transparent border-0 h-8 cursor-pointer rounded"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Save Bar */}
        <div className="p-4 bg-slate-950 border-t border-slate-850 flex justify-between gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 bg-[#f25c22] hover:bg-[#d94d1a] disabled:bg-slate-800 text-white font-semibold rounded-lg text-sm transition shadow-md flex justify-center items-center gap-2"
          >
            {saving ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
            ) : 'Lưu thiết kế'}
          </button>
        </div>
      </div>

      {/* Main Canvas - Preview */}
      <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden relative">
        {/* Top bar info */}
        <div className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex justify-between items-center shrink-0">
          <h4 className="font-bold text-white text-sm flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            Giao diện trực quan (Visual Canvas Preview)
          </h4>
          <span className="text-xs text-slate-400">Click chọn khối ở sidebar bên trái để chỉnh sửa nội dung.</span>
        </div>

        {/* Display messages */}
        <div className="absolute top-16 left-6 right-6 z-10 space-y-2">
          {success && (
            <div className="p-3.5 bg-emerald-500/90 text-white font-medium rounded-lg text-xs flex justify-between shadow-lg">
              <span>{success}</span>
              <button onClick={() => setSuccess('')}>✕</button>
            </div>
          )}
          {error && (
            <div className="p-3.5 bg-rose-500/90 text-white font-medium rounded-lg text-xs flex justify-between shadow-lg">
              <span>{error}</span>
              <button onClick={() => setError('')}>✕</button>
            </div>
          )}
        </div>

        {/* Render Canvas */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f25c22]"></div>
            </div>
          ) : blocks.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl py-16 text-slate-500 text-sm">
              <p>Chưa có thành phần nào trên trang.</p>
              <p className="text-xs text-slate-600 mt-1">Sử dụng nút Thêm khối ở sidebar để bắt đầu.</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto border border-slate-850 rounded-xl overflow-hidden shadow-2xl">
              {blocks.map((block) => (
                <div
                  key={block.id}
                  onClick={() => setSelectedBlockId(block.id)}
                  style={{ backgroundColor: block.backgroundColor, color: block.textColor }}
                  className={`relative p-10 cursor-pointer group border-2 ${selectedBlockId === block.id ? 'border-[#f25c22]' : 'border-transparent hover:border-slate-800'}`}
                >
                  {/* Edit label overlay */}
                  <span className="absolute top-2 right-2 text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition">
                    Click to edit
                  </span>

                  {block.type === 'hero' && (
                    <div className="text-center space-y-4">
                      <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">{block.title}</h1>
                      <p className="text-sm md:text-base text-slate-300 max-w-xl mx-auto">{block.subtitle}</p>
                      <button className="px-6 py-2.5 bg-[#f25c22] text-white text-xs font-bold rounded-lg mt-2">
                        {block.buttonText || 'Bấm đăng ký'}
                      </button>
                    </div>
                  )}

                  {block.type === 'features' && (
                    <div className="space-y-6">
                      <h2 className="text-xl font-bold text-white text-center">{block.title}</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(block.items || []).map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-slate-950/40 p-3.5 rounded border border-slate-850">
                            <span className="text-[#f25c22] text-sm">✓</span>
                            <span className="text-xs font-medium text-slate-200">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {block.type === 'form' && (
                    <div className="max-w-xs mx-auto bg-slate-950/80 border border-slate-850 rounded-lg p-6 space-y-4">
                      <h3 className="font-bold text-sm text-center text-white">{block.title}</h3>
                      <p className="text-[10px] text-slate-400 text-center">{block.subtitle}</p>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 font-semibold uppercase">Họ và Tên</label>
                          <input disabled placeholder="Nguyễn Văn A" className="w-full bg-slate-900 border border-slate-850 rounded px-2.5 py-1.5 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 font-semibold uppercase">Email</label>
                          <input disabled placeholder="name@email.com" className="w-full bg-slate-900 border border-slate-850 rounded px-2.5 py-1.5 text-xs" />
                        </div>
                      </div>
                      <button disabled className="w-full py-2 bg-[#f25c22] text-white font-bold text-xs rounded transition mt-1">
                        Đăng ký (Demo Form)
                      </button>
                      <p className="text-[10px] text-center text-[#f25c22] font-semibold">
                        Form ID: {block.formId || 'Chưa liên kết'}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
