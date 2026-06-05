'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
  workspaceId: number | null;
};

type PageBlock = {
  id: string;
  type: 'hero' | 'features' | 'form' | 'pricing' | 'footer' | 'countdown' | 'testimonials' | 'faq';
  title: string;
  subtitle?: string;
  buttonText?: string;
  buttonLink?: string;
  imageUrl?: string;
  imageAlignment?: 'left' | 'right' | 'center';
  backgroundColor?: string;
  textColor?: string;
  items?: string[]; // For features list
  formId?: string; // For lead capturing forms
  priceVal?: string; // For pricing
  productId?: string; // For direct product checkout
  paymentMethod?: 'PAYOS' | 'STRIPE'; // Default payment gateway
  workflowId?: string; // Associated email workflow trigger
  countdownEnd?: string; // Datetime string for countdown
  reviews?: { name: string; role: string; rating: number; quote: string; avatar?: string }[]; // Testimonials list
  faqs?: { question: string; answer: string }[]; // FAQ items
  hiddenOnMobile?: boolean; // Mobile responsiveness toggle
};

const DEFAULT_BLOCKS: PageBlock[] = [
  {
    id: 'block-1',
    type: 'hero',
    title: 'Tăng Trưởng Doanh Thu Bứt Phá Với Growth OS',
    subtitle: 'Hệ thống tự động hóa Marketing kéo traffic tự nhiên và chuyển đổi khách hàng khép kín.',
    buttonText: 'Trải nghiệm miễn phí',
    buttonLink: '#register-form',
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60',
    imageAlignment: 'right',
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
  const [products, setProducts] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  
  // Tabs & Settings States
  const [activeTab, setActiveTab] = useState<'blocks' | 'seo' | 'ai'>('blocks');
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [seo, setSeo] = useState({
    title: '',
    description: '',
    ogImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60',
    keywords: ''
  });

  // AI Prompt State
  const [aiPromptInput, setAiPromptInput] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

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

      // Auto-switch workspace if there is a mismatch to load correct Forms, Products and Workflows
      if (pageData.workspaceId) {
        const currentWsId = localStorage.getItem('workspaceId');
        if (currentWsId !== String(pageData.workspaceId)) {
          localStorage.setItem('workspaceId', String(pageData.workspaceId));
          window.location.reload();
          return;
        }
      }
      
      // Parse layoutJson or fall back to defaults
      let parsedBlocks = DEFAULT_BLOCKS;
      let parsedSeo = {
        title: pageData.title || '',
        description: '',
        ogImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60',
        keywords: ''
      };

      if (pageData.layoutJson && pageData.layoutJson !== '{}') {
        try {
          const parsed = JSON.parse(pageData.layoutJson);
          if (Array.isArray(parsed)) {
            parsedBlocks = parsed;
          } else if (parsed && typeof parsed === 'object') {
            parsedBlocks = parsed.blocks || DEFAULT_BLOCKS;
            parsedSeo = { ...parsedSeo, ...(parsed.seo || {}) };
          }
        } catch (e) {
          // Keep defaults
        }
      }
      setBlocks(parsedBlocks);
      setSeo(parsedSeo);

      // Load Custom Forms of this workspace to link
      const formsData = await apiJson<CustomFormOption[]>('/forms');
      setForms(Array.isArray(formsData) ? formsData : []);

      // Load Products
      const productsData = await apiJson<any[]>('/orders/products');
      setProducts(Array.isArray(productsData) ? productsData : []);

      // Load Email Workflows
      const workflowsData = await apiJson<any[]>('/automation/workflows');
      setWorkflows(Array.isArray(workflowsData) ? workflowsData : []);

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
  const compileHtml = (blocksList: PageBlock[], seoData: typeof seo): string => {
    let html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${seoData.title || page?.title || 'Landing Page'}</title>
  <meta name="description" content="${seoData.description || ''}">
  <meta name="keywords" content="${seoData.keywords || ''}">
  <meta property="og:title" content="${seoData.title || page?.title || ''}">
  <meta property="og:description" content="${seoData.description || ''}">
  <meta property="og:image" content="${seoData.ogImage || ''}">
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background-color: #030712; color: #f3f4f6; scroll-behavior: smooth; }
    .accordion-content { max-height: 0; overflow: hidden; transition: max-height 0.25s ease-out; }
    .accordion-item.active .accordion-content { max-height: 350px; }
    .accordion-item.active .accordion-arrow { transform: rotate(180deg); }
  </style>
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen">`;

    for (const block of blocksList) {
      const isMobileHidden = block.hiddenOnMobile ? ' hidden md:block' : '';
      
      if (block.type === 'hero') {
        const hasImage = !!block.imageUrl;
        const align = block.imageAlignment || 'right';
        const bgCol = block.backgroundColor || '#0f172a';
        const txtCol = block.textColor || '#ffffff';

        if (hasImage && align !== 'center') {
          const isLeft = align === 'left';
          html += `
  <section class="py-24 px-6 relative overflow-hidden${isMobileHidden}" style="background-color: ${bgCol}; color: ${txtCol};">
    <div class="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
      <div class="space-y-6 ${isLeft ? 'md:order-2' : ''}">
        <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">${block.title}</h1>
        <p class="text-lg text-gray-300 max-w-xl leading-relaxed">${block.subtitle || ''}</p>
        <div class="pt-4">
          <a href="${block.buttonLink || '#register-form'}" class="inline-block px-8 py-4 bg-[#f25c22] hover:bg-[#d94d1a] text-white font-bold rounded-lg transition duration-200 shadow-lg transform hover:-translate-y-1">
            ${block.buttonText || 'Bắt đầu ngay'}
          </a>
        </div>
      </div>
      <div class="${isLeft ? 'md:order-1' : ''} flex justify-center">
        <img src="${block.imageUrl}" alt="${block.title}" class="rounded-2xl shadow-2xl border border-gray-800 max-h-[450px] object-cover" />
      </div>
    </div>
  </section>`;
        } else {
          html += `
  <section class="py-24 px-6 text-center relative overflow-hidden${isMobileHidden}" style="background-color: ${bgCol}; color: ${txtCol};">
    <div class="max-w-4xl mx-auto space-y-6">
      <h1 class="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">${block.title}</h1>
      <p class="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">${block.subtitle || ''}</p>
      ${hasImage ? `
      <div class="my-8 flex justify-center">
        <img src="${block.imageUrl}" alt="${block.title}" class="rounded-2xl shadow-2xl border border-gray-800 max-h-[450px] object-cover" />
      </div>` : ''}
      <div class="pt-4">
        <a href="${block.buttonLink || '#register-form'}" class="inline-block px-8 py-4 bg-[#f25c22] hover:bg-[#d94d1a] text-white font-bold rounded-lg transition duration-200 shadow-lg transform hover:-translate-y-1">
          ${block.buttonText || 'Bắt đầu ngay'}
        </a>
      </div>
    </div>
  </section>`;
        }
      } else if (block.type === 'features') {
        html += `
  <section class="py-20 px-6${isMobileHidden}" style="background-color: ${block.backgroundColor || '#111827'}; color: ${block.textColor || '#94a3b8'};">
    <div class="max-w-5xl mx-auto">
      <h2 class="text-3xl font-bold text-center text-white mb-12">${block.title}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        ${(block.items || []).map(item => `
        <div class="flex items-start gap-3 bg-gray-800/40 p-5 rounded-lg border border-gray-805">
          <span class="text-indigo-400 text-lg">✓</span>
          <p class="text-gray-200 font-medium">${item}</p>
        </div>`).join('')}
      </div>
    </div>
  </section>`;
      } else if (block.type === 'form') {
        html += `
  <section id="register-form" class="py-20 px-6${isMobileHidden}" style="background-color: ${block.backgroundColor || '#030712'};">
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
      } else if (block.type === 'pricing') {
        const isDirectCheckout = !!block.productId;
        const buttonActionHtml = isDirectCheckout 
          ? `onclick="openCheckout('${block.productId}', '${block.title}', '${block.priceVal || ''}')"` 
          : `href="${block.buttonLink || '#register-form'}"`;

        html += `
  <section class="py-20 px-6 text-center${isMobileHidden}" style="background-color: ${block.backgroundColor || '#0b0f19'}; color: ${block.textColor || '#ffffff'};">
    <div class="max-w-4xl mx-auto space-y-6">
      <h2 class="text-3xl md:text-4xl font-bold">${block.title}</h2>
      <p class="text-gray-400 text-sm max-w-2xl mx-auto">${block.subtitle || ''}</p>
      
      <div class="max-w-sm mx-auto bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-xl mt-8 relative overflow-hidden">
        <div class="absolute top-0 right-0 px-3 py-1 bg-[#f25c22] text-xs font-bold text-white uppercase rounded-bl-lg">Phổ biến</div>
        <h3 class="text-xl font-bold text-white">Gói Ưu Đãi</h3>
        <p class="text-4xl font-extrabold text-white mt-4 my-2">${block.priceVal || '499.000đ'}<span class="text-sm font-normal text-gray-500">/tháng</span></p>
        <p class="text-gray-400 text-xs mt-2">Truy cập toàn bộ tính năng tăng trưởng.</p>
        
        <ul class="text-left space-y-3 mt-6 text-sm text-gray-300">
          <li class="flex items-center gap-2">✓ Viết bài chuẩn SEO bằng AI</li>
          <li class="flex items-center gap-2">✓ Quản lý bài đăng đa kênh</li>
          <li class="flex items-center gap-2">✓ Hệ thống Drip Email tự động</li>
          <li class="flex items-center gap-2">✓ Báo cáo Analytics nâng cao</li>
        </ul>
        
        <div class="pt-6">
          <${isDirectCheckout ? 'button' : 'a'} ${buttonActionHtml} class="block w-full py-3 bg-[#f25c22] hover:bg-[#d94d1a] text-white font-bold rounded-lg text-center cursor-pointer transition duration-200">
            ${block.buttonText || 'Mua ngay'}
          </${isDirectCheckout ? 'button' : 'a'}>
        </div>
      </div>
    </div>
  </section>`;
      } else if (block.type === 'countdown') {
        html += `
  <section class="py-12 px-6 text-center${isMobileHidden}" style="background-color: ${block.backgroundColor || '#0f172a'}; color: ${block.textColor || '#ffffff'};">
    <div class="max-w-4xl mx-auto space-y-4">
      <h2 class="text-2xl md:text-3xl font-bold">${block.title}</h2>
      <p class="text-gray-300 text-sm">${block.subtitle || ''}</p>
      <div class="flex justify-center gap-4 text-white font-mono mt-6" id="timer-${block.id}">
        <div class="bg-gray-900 border border-gray-800 rounded-lg p-4 min-w-[70px]">
          <span class="text-3xl font-extrabold block text-[#f25c22]" id="days-${block.id}">00</span>
          <span class="text-xs text-gray-500 uppercase">Ngày</span>
        </div>
        <div class="bg-gray-900 border border-gray-800 rounded-lg p-4 min-w-[70px]">
          <span class="text-3xl font-extrabold block text-[#f25c22]" id="hours-${block.id}">00</span>
          <span class="text-xs text-gray-500 uppercase">Giờ</span>
        </div>
        <div class="bg-gray-900 border border-gray-800 rounded-lg p-4 min-w-[70px]">
          <span class="text-3xl font-extrabold block text-[#f25c22]" id="mins-${block.id}">00</span>
          <span class="text-xs text-gray-500 uppercase">Phút</span>
        </div>
        <div class="bg-gray-900 border border-gray-800 rounded-lg p-4 min-w-[70px]">
          <span class="text-3xl font-extrabold block text-[#f25c22]" id="secs-${block.id}">00</span>
          <span class="text-xs text-gray-500 uppercase">Giây</span>
        </div>
      </div>
    </div>
    <script>
      (function() {
        const targetDate = new Date("${block.countdownEnd || ''}").getTime();
        const daysEl = document.getElementById("days-${block.id}");
        const hoursEl = document.getElementById("hours-${block.id}");
        const minsEl = document.getElementById("mins-${block.id}");
        const secsEl = document.getElementById("secs-${block.id}");
        
        function updateTimer() {
          const now = new Date().getTime();
          const distance = targetDate - now;
          if (distance < 0) {
            clearInterval(interval);
            return;
          }
          const d = Math.floor(distance / (1000 * 60 * 60 * 24));
          const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          const s = Math.floor((distance % (1000 * 60)) / 1000);
          
          daysEl.innerText = String(d).padStart(2, '0');
          hoursEl.innerText = String(h).padStart(2, '0');
          minsEl.innerText = String(m).padStart(2, '0');
          secsEl.innerText = String(s).padStart(2, '0');
        }
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
      })();
    </script>
  </section>`;
      } else if (block.type === 'testimonials') {
        html += `
  <section class="py-20 px-6${isMobileHidden}" style="background-color: ${block.backgroundColor || '#0b0f19'}; color: ${block.textColor || '#ffffff'};">
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl font-bold text-center text-white mb-12">${block.title}</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        ${(block.reviews || []).map(r => `
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl flex flex-col justify-between">
          <div class="space-y-4">
            <div class="text-[#f25c22] text-sm">
              ${'★'.repeat(r.rating || 5)}${'☆'.repeat(5 - (r.rating || 5))}
            </div>
            <p class="text-gray-300 italic text-sm leading-relaxed">"${r.quote}"</p>
          </div>
          <div class="flex items-center gap-3 mt-6 pt-4 border-t border-gray-800">
            ${r.avatar ? `<img src="${r.avatar}" alt="${r.name}" class="w-10 h-10 rounded-full object-cover" />` : `
            <div class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center font-bold text-[#f25c22]">${r.name.charAt(0)}</div>`}
            <div>
              <h4 class="font-bold text-white text-sm">${r.name}</h4>
              <p class="text-xs text-gray-500">${r.role || ''}</p>
            </div>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </section>`;
      } else if (block.type === 'faq') {
        html += `
  <section class="py-20 px-6${isMobileHidden}" style="background-color: ${block.backgroundColor || '#030712'}; color: ${block.textColor || '#ffffff'};">
    <div class="max-w-3xl mx-auto">
      <h2 class="text-3xl font-bold text-center text-white mb-12">${block.title}</h2>
      <div class="space-y-4">
        ${(block.faqs || []).map((faq, index) => `
        <div class="bg-gray-950 border border-gray-850 rounded-lg overflow-hidden accordion-item" id="faq-${block.id}-${index}">
          <button onclick="document.getElementById('faq-${block.id}-${index}').classList.toggle('active')" class="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-gray-900/50 transition">
            <span class="font-semibold text-white text-sm">${faq.question}</span>
            <span class="text-gray-500 font-bold transition transform accordion-arrow text-xs">▼</span>
          </button>
          <div class="accordion-content border-t border-gray-900">
            <div class="px-6 py-4 text-xs md:text-sm text-gray-400 leading-relaxed">${faq.answer}</div>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </section>`;
      } else if (block.type === 'footer') {
        html += `
  <footer class="py-12 px-6 border-t border-gray-900${isMobileHidden}" style="background-color: ${block.backgroundColor || '#030712'}; color: ${block.textColor || '#6b7280'};">
    <div class="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
      <div class="text-center md:text-left">
        <h4 class="text-white font-bold text-lg">${block.title}</h4>
        <p class="text-sm mt-1">${block.subtitle || ''}</p>
      </div>
      <p class="text-xs">© ${new Date().getFullYear()} ${block.title}. Bảo lưu mọi quyền.</p>
    </div>
  </footer>`;
      }
    }

    // Append Checkout Modal if there are product checkouts
    const hasCheckout = blocksList.some(b => b.productId);
    if (hasCheckout) {
      html += `
  <!-- Checkout Popup Modal -->
  <div id="checkout-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-80 hidden">
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-8 max-w-md w-full relative">
      <button onclick="document.getElementById('checkout-modal').classList.add('hidden')" class="absolute top-4 right-4 text-gray-400 hover:text-white font-bold text-lg">&times;</button>
      <h3 class="text-2xl font-bold text-white text-center mb-2" id="modal-product-title">Thanh toán đơn hàng</h3>
      <p class="text-gray-400 text-xs text-center mb-6" id="modal-product-price">Số tiền cần thanh toán: ...</p>
      
      <form id="public-checkout-form" class="space-y-4">
        <input type="hidden" id="checkout-product-id" />
        <div>
          <label class="block text-xs font-semibold text-gray-400 mb-1">Họ và Tên</label>
          <input type="text" id="checkout-name" required class="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#f25c22]" placeholder="Nguyễn Văn A" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-400 mb-1">Địa chỉ Email</label>
          <input type="email" id="checkout-email" required class="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#f25c22]" placeholder="name@email.com" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-400 mb-1">Số điện thoại</label>
          <input type="tel" id="checkout-phone" required class="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#f25c22]" placeholder="0987654321" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-400 mb-1">Phương thức thanh toán</label>
          <select id="checkout-gateway" class="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#f25c22]">
            <option value="PAYOS">Chuyển khoản VietQR nhanh (PayOS)</option>
            <option value="STRIPE">Thanh toán Thẻ Quốc tế (Stripe)</option>
          </select>
        </div>
        <button type="submit" id="checkout-submit-btn" class="w-full py-3 bg-[#f25c22] hover:bg-[#d94d1a] text-white font-bold rounded-lg transition duration-200 mt-2 shadow-md">
          Tiến hành thanh toán
        </button>
      </form>
      <p id="checkout-error" class="text-center mt-4 text-xs text-red-500 hidden"></p>
    </div>
  </div>

  <script>
    function openCheckout(productId, productName, priceVal) {
      document.getElementById('checkout-product-id').value = productId;
      document.getElementById('modal-product-title').innerText = 'Mua ' + productName;
      document.getElementById('modal-product-price').innerText = 'Giá thanh toán: ' + priceVal;
      document.getElementById('checkout-modal').classList.remove('hidden');
    }

    document.getElementById('public-checkout-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      const productId = document.getElementById('checkout-product-id').value;
      const name = document.getElementById('checkout-name').value;
      const email = document.getElementById('checkout-email').value;
      const phone = document.getElementById('checkout-phone').value;
      const gateway = document.getElementById('checkout-gateway').value;
      const errorEl = document.getElementById('checkout-error');
      const submitBtn = document.getElementById('checkout-submit-btn');
      
      errorEl.classList.add('hidden');
      submitBtn.disabled = true;
      submitBtn.innerText = 'Đang khởi tạo đơn hàng...';
      
      try {
        const res = await fetch('/api/public/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: ${page?.workspaceId || 0},
            productId: parseInt(productId),
            customerName: name,
            customerEmail: email,
            customerPhone: phone,
            paymentMethod: gateway,
            returnUrl: window.location.origin + '/checkout/success',
            cancelUrl: window.location.href
          })
        });
        
        const data = await res.json();
        if (res.ok && data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          errorEl.innerText = data.error || 'Lỗi khi khởi tạo thanh toán.';
          errorEl.classList.remove('hidden');
        }
      } catch (err) {
        errorEl.innerText = 'Lỗi kết nối máy chủ.';
        errorEl.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Tiến hành thanh toán';
      }
    });
  </script>`;
    }

    html += `
</body>
</html>`;
    return html;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const compiledHtml = compileHtml(blocks, seo);
      
      // Update Landing Page
      await apiJson(`/landing-pages/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: page?.title,
          slug: page?.slug,
          layoutJson: JSON.stringify({ blocks, seo }),
          htmlContent: compiledHtml,
          status: page?.status,
        }),
      });

      // Use Case 2: Link Custom Form triggers to Email Workflows
      const formBlock = blocks.find(b => b.type === 'form' && b.formId && b.workflowId);
      if (formBlock && formBlock.workflowId && formBlock.formId) {
        await apiJson(`/automation/workflows/${formBlock.workflowId}`, {
          method: 'PUT',
          body: JSON.stringify({
            triggerFormId: parseInt(formBlock.formId, 10),
            triggerType: 'FORM_SUBMISSION'
          })
        });
      }

      setSuccess('Đã lưu thiết kế trang đích và đồng bộ cấu hình thành công.');
      setError('');
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu thiết kế.');
    } finally {
      setSaving(false);
    }
  };

  const addBlock = (type: PageBlock['type']) => {
    let newBlock: PageBlock;
    if (type === 'hero') {
      newBlock = {
        id: `block-${Date.now()}`,
        type: 'hero',
        title: 'Khám Phá Giải Pháp Của Chúng Tôi',
        subtitle: 'Mô tả ngắn gọn giá trị cốt lõi giải pháp của bạn.',
        buttonText: 'Tìm hiểu ngay',
        buttonLink: '#register-form',
        imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60',
        imageAlignment: 'right',
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
    } else if (type === 'form') {
      newBlock = {
        id: `block-${Date.now()}`,
        type: 'form',
        title: 'Đăng Ký Nhận Tư Vấn Miễn Phí',
        subtitle: 'Chúng tôi sẽ gọi lại hỗ trợ bạn trong vòng 10 phút.',
        backgroundColor: '#030712',
        textColor: '#ffffff',
        formId: forms[0]?.id ? String(forms[0].id) : '',
        workflowId: '',
      };
    } else if (type === 'pricing') {
      newBlock = {
        id: `block-${Date.now()}`,
        type: 'pricing',
        title: 'Gói Dịch Vụ Phù Hợp Với Bạn',
        subtitle: 'Lựa chọn gói tối ưu nhất cho hoạt động kinh doanh của bạn.',
        priceVal: '499.000đ',
        buttonText: 'Mua ngay',
        buttonLink: '#register-form',
        backgroundColor: '#0b0f19',
        textColor: '#ffffff',
        productId: '',
        paymentMethod: 'PAYOS',
      };
    } else if (type === 'countdown') {
      newBlock = {
        id: `block-${Date.now()}`,
        type: 'countdown',
        title: 'Ưu đãi kết thúc sau',
        subtitle: 'Nhanh tay đăng ký trước khi chương trình kết thúc.',
        countdownEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        backgroundColor: '#0f172a',
        textColor: '#ffffff',
      };
    } else if (type === 'testimonials') {
      newBlock = {
        id: `block-${Date.now()}`,
        type: 'testimonials',
        title: 'Khách hàng nói gì về chúng tôi',
        reviews: [
          { name: 'Nguyễn Văn A', role: 'Giám đốc Marketing', rating: 5, quote: 'Hệ thống tuyệt vời, giúp tôi tiết kiệm 50% thời gian tối ưu traffic.' },
          { name: 'Trần Thị B', role: 'Chủ shop thời trang', rating: 5, quote: 'Tính năng tạo form và CRM tự động giúp tôi không bỏ sót lead nào!' },
          { name: 'Lê Văn C', role: 'Blogger SEO', rating: 4, quote: 'AI Copilot viết bài rất chuẩn và tự nhiên, khuyên dùng cho ai làm SEO.' }
        ],
        backgroundColor: '#0b0f19',
        textColor: '#ffffff',
      };
    } else if (type === 'faq') {
      newBlock = {
        id: `block-${Date.now()}`,
        type: 'faq',
        title: 'Câu hỏi thường gặp',
        faqs: [
          { question: 'Growth OS có chạy thử miễn phí không?', answer: 'Có, bạn có thể trải nghiệm đầy đủ tính năng miễn phí trong 14 ngày đầu tiên.' },
          { question: 'Tôi có thể dùng tên miền riêng của mình không?', answer: 'Hoàn trước được. Bạn có thể cấu hình trỏ CNAME tên miền riêng về hệ thống.' },
          { question: 'Làm thế nào để kết nối VietQR thanh toán?', answer: 'Bạn chỉ cần nhập Client ID và API Key của PayOS trong mục Cài đặt Thanh toán.' }
        ],
        backgroundColor: '#030712',
        textColor: '#ffffff',
      };
    } else {
      newBlock = {
        id: `block-${Date.now()}`,
        type: 'footer',
        title: page?.title || 'Growth OS',
        subtitle: 'Bảo lưu mọi quyền.',
        backgroundColor: '#030712',
        textColor: '#6b7280',
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

  // Use Case 3: Call AI Generation Endpoint
  const handleGenerateAiLayout = async () => {
    if (!aiPromptInput.trim()) {
      setError('Vui lòng nhập mô tả (prompt) thiết kế trang.');
      return;
    }
    try {
      setAiGenerating(true);
      setError('');
      setSuccess('');
      const aiBlocks = await apiJson<PageBlock[]>('/landing-pages/generate-ai', {
        method: 'POST',
        body: JSON.stringify({ prompt: aiPromptInput })
      });
      if (Array.isArray(aiBlocks) && aiBlocks.length > 0) {
        setBlocks(aiBlocks);
        setSuccess('Đã sinh layout Landing Page bằng AI thành công! Hãy xem trước ở Canvas.');
      } else {
        throw new Error('AI phản hồi không đúng định dạng.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi gọi AI sinh trang.');
    } finally {
      setAiGenerating(false);
    }
  };

  const selectedBlock = blocks.find(b => b.id === selectedBlockId);

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[550px] bg-slate-950 text-white overflow-hidden rounded-xl border border-slate-800 shadow-2xl">
      {/* Sidebar - Controls */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Main Title & Back */}
          <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
            <div>
              <h3 className="font-bold text-white text-base">Trình Thiết Kế</h3>
              <p className="text-slate-400 text-xs truncate max-w-[120px]">{page?.title || 'Loading...'}</p>
            </div>
            <Link href="/dashboard/landing" className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-lg transition duration-200 shadow border border-slate-750 flex items-center gap-1">
              ← Quay lại
            </Link>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 shrink-0">
            <button
              onClick={() => setActiveTab('blocks')}
              className={`flex-1 py-2.5 text-center text-xs font-bold transition ${activeTab === 'blocks' ? 'border-b-2 border-[#f25c22] text-white bg-slate-950/20' : 'text-slate-400 hover:text-white'}`}
            >
              Thành phần
            </button>
            <button
              onClick={() => setActiveTab('seo')}
              className={`flex-1 py-2.5 text-center text-xs font-bold transition ${activeTab === 'seo' ? 'border-b-2 border-[#f25c22] text-white bg-slate-950/20' : 'text-slate-400 hover:text-white'}`}
            >
              SEO & Card
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 py-2.5 text-center text-xs font-bold transition ${activeTab === 'ai' ? 'border-b-2 border-[#f25c22] text-white bg-slate-950/20' : 'text-slate-400 hover:text-white'}`}
            >
              🤖 Thiết kế AI
            </button>
          </div>

          {/* Scrollable Content Pane */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {/* Tab 1: Blocks builder */}
            {activeTab === 'blocks' && (
              <>
                {/* Add Blocks */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Thêm khối mới</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => addBlock('hero')} className="bg-slate-950 border border-slate-850 hover:border-[#f25c22] rounded p-2 text-center text-xs transition">
                      Banner (Hero)
                    </button>
                    <button onClick={() => addBlock('features')} className="bg-slate-950 border border-slate-850 hover:border-[#f25c22] rounded p-2 text-center text-xs transition">
                      Lợi ích (Features)
                    </button>
                    <button onClick={() => addBlock('form')} className="bg-slate-950 border border-slate-850 hover:border-[#f25c22] rounded p-2 text-center text-xs transition">
                      Biểu mẫu (Form)
                    </button>
                    <button onClick={() => addBlock('pricing')} className="bg-slate-950 border border-slate-850 hover:border-[#f25c22] rounded p-2 text-center text-xs transition">
                      Bảng giá (Pricing)
                    </button>
                    <button onClick={() => addBlock('countdown')} className="bg-slate-950 border border-slate-850 hover:border-[#f25c22] rounded p-2 text-center text-xs transition">
                      ⏳ Đếm ngược
                    </button>
                    <button onClick={() => addBlock('testimonials')} className="bg-slate-950 border border-slate-850 hover:border-[#f25c22] rounded p-2 text-center text-xs transition">
                      ★ Đánh giá
                    </button>
                    <button onClick={() => addBlock('faq')} className="bg-slate-950 border border-slate-850 hover:border-[#f25c22] rounded p-2 text-center text-xs transition">
                      ❓ Câu hỏi FAQ
                    </button>
                    <button onClick={() => addBlock('footer')} className="bg-slate-950 border border-slate-850 hover:border-[#f25c22] rounded p-2 text-center text-xs transition">
                      Chân trang (Footer)
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
                            {index + 1}. Khối {block.type === 'countdown' ? 'Đếm ngược' : block.type === 'testimonials' ? 'Đánh giá' : block.type === 'faq' ? 'FAQ' : block.type}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
                            className="text-slate-500 hover:text-rose-400 text-xs font-semibold"
                          >
                            Xóa
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Properties Panel of Selected Block */}
                {selectedBlock && (
                  <div className="border-t border-slate-800 pt-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#f25c22]">Cấu hình Khối</h4>
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          id="block-hidden-mobile"
                          checked={!!selectedBlock.hiddenOnMobile}
                          onChange={(e) => updateBlock({ ...selectedBlock, hiddenOnMobile: e.target.checked })}
                          className="rounded border-slate-850 bg-slate-950 text-[#f25c22] focus:ring-0"
                        />
                        <label htmlFor="block-hidden-mobile" className="text-[10px] text-slate-400 font-bold uppercase cursor-pointer">Ẩn trên Mobile</label>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400">Tiêu đề</label>
                      <input
                        type="text"
                        value={selectedBlock.title}
                        onChange={(e) => updateBlock({ ...selectedBlock, title: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#f25c22]"
                      />
                    </div>

                    {/* Subtitle / Description */}
                    {(selectedBlock.type === 'hero' || selectedBlock.type === 'form' || selectedBlock.type === 'pricing' || selectedBlock.type === 'footer' || selectedBlock.type === 'countdown') && (
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-400">Mô tả phụ</label>
                        <textarea
                          value={selectedBlock.subtitle || ''}
                          onChange={(e) => updateBlock({ ...selectedBlock, subtitle: e.target.value })}
                          rows={2}
                          className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#f25c22]"
                        />
                      </div>
                    )}

                    {/* Button Text & Button Link */}
                    {(selectedBlock.type === 'hero' || selectedBlock.type === 'pricing') && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Chữ trên nút</label>
                            <input
                              type="text"
                              value={selectedBlock.buttonText || ''}
                              onChange={(e) => updateBlock({ ...selectedBlock, buttonText: e.target.value })}
                              className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#f25c22]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Đường dẫn nút</label>
                            <input
                              type="text"
                              disabled={!!selectedBlock.productId}
                              value={selectedBlock.productId ? 'Thanh toán trực tiếp' : (selectedBlock.buttonLink || '')}
                              onChange={(e) => updateBlock({ ...selectedBlock, buttonLink: e.target.value })}
                              placeholder="#register-form"
                              className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#f25c22] disabled:opacity-50"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Image URL & Alignment for Hero block */}
                    {selectedBlock.type === 'hero' && (
                      <>
                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-400">Đường dẫn hình ảnh (URL)</label>
                          <input
                            type="text"
                            value={selectedBlock.imageUrl || ''}
                            onChange={(e) => updateBlock({ ...selectedBlock, imageUrl: e.target.value })}
                            placeholder="https://example.com/image.png"
                            className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#f25c22]"
                          />
                          {/* Suggested Images */}
                          <div className="pt-1.5 space-y-1">
                            <label className="text-[9px] text-slate-500 uppercase font-semibold">Ảnh gợi ý mẫu:</label>
                            <div className="grid grid-cols-4 gap-1">
                              <button
                                type="button"
                                onClick={() => updateBlock({ ...selectedBlock, imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60' })}
                                className="h-8 bg-slate-950 border border-slate-850 hover:border-[#f25c22] rounded overflow-hidden"
                                title="SaaS Chart"
                              >
                                <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=100&auto=format&fit=crop&q=60" className="object-cover w-full h-full" alt="suggested 1" />
                              </button>
                              <button
                                type="button"
                                onClick={() => updateBlock({ ...selectedBlock, imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=60' })}
                                className="h-8 bg-slate-950 border border-slate-850 hover:border-[#f25c22] rounded overflow-hidden"
                                title="Dashboard Layout"
                              >
                                <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=100&auto=format&fit=crop&q=60" className="object-cover w-full h-full" alt="suggested 2" />
                              </button>
                              <button
                                type="button"
                                onClick={() => updateBlock({ ...selectedBlock, imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=60' })}
                                className="h-8 bg-slate-950 border border-slate-850 hover:border-[#f25c22] rounded overflow-hidden"
                                title="Team Collab"
                              >
                                <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&auto=format&fit=crop&q=60" className="object-cover w-full h-full" alt="suggested 3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => updateBlock({ ...selectedBlock, imageUrl: '' })}
                                className="h-8 bg-slate-950 border border-slate-850 hover:border-rose-500 rounded text-[9px] text-slate-500 font-semibold"
                              >
                                Xóa ảnh
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-400">Vị trí ảnh</label>
                          <select
                            value={selectedBlock.imageAlignment || 'right'}
                            onChange={(e) => updateBlock({ ...selectedBlock, imageAlignment: e.target.value as any })}
                            className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                          >
                            <option value="left">Bên trái văn bản</option>
                            <option value="right">Bên phải văn bản</option>
                            <option value="center">Ở giữa (phía dưới văn bản)</option>
                          </select>
                        </div>
                      </>
                    )}

                    {/* Pricing direct checkout link (Use Case 1) */}
                    {selectedBlock.type === 'pricing' && (
                      <>
                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-400">Giá trị hiển thị</label>
                          <input
                            type="text"
                            value={selectedBlock.priceVal || ''}
                            onChange={(e) => updateBlock({ ...selectedBlock, priceVal: e.target.value })}
                            placeholder="499.000đ"
                            className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-400">Mua nhanh & Thanh toán trực tiếp</label>
                          <select
                            value={selectedBlock.productId || ''}
                            onChange={(e) => {
                              const pId = e.target.value;
                              const prod = products.find(p => String(p.id) === pId);
                              updateBlock({
                                ...selectedBlock,
                                productId: pId,
                                priceVal: prod ? `${prod.price.toLocaleString('vi-VN')} ${prod.currency}` : selectedBlock.priceVal
                              });
                            }}
                            className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                          >
                            <option value="">-- Dùng liên kết thường (Không checkout) --</option>
                            {products.map(p => (
                              <option key={p.id} value={String(p.id)}>{p.name} ({p.price.toLocaleString('vi-VN')} {p.currency})</option>
                            ))}
                          </select>
                        </div>
                        {selectedBlock.productId && (
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Cổng thanh toán mặc định</label>
                            <select
                              value={selectedBlock.paymentMethod || 'PAYOS'}
                              onChange={(e) => updateBlock({ ...selectedBlock, paymentMethod: e.target.value as any })}
                              className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                            >
                              <option value="PAYOS">VietQR chuyển khoản nhanh (PayOS)</option>
                              <option value="STRIPE">Thẻ Quốc Tế (Stripe)</option>
                            </select>
                          </div>
                        )}
                      </>
                    )}

                    {/* Form and Workflow link (Use Case 2) */}
                    {selectedBlock.type === 'form' && (
                      <div className="space-y-2.5">
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
                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-400">Kích hoạt Email Drip Workflow</label>
                          <select
                            value={selectedBlock.workflowId || ''}
                            onChange={(e) => updateBlock({ ...selectedBlock, workflowId: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                          >
                            <option value="">-- Không kích hoạt (Chỉ lưu CRM) --</option>
                            {workflows.map(w => (
                              <option key={w.id} value={String(w.id)}>{w.name} {w.isActive ? '(Đang chạy)' : '(Nháp)'}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Features list */}
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
                            className="w-full bg-slate-950 border border-slate-855 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#f25c22]"
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = [...(selectedBlock.items || []), 'Lợi ích mới'];
                            updateBlock({ ...selectedBlock, items: newItems });
                          }}
                          className="w-full py-1 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 rounded font-semibold transition"
                        >
                          + Thêm mục lợi ích
                        </button>
                      </div>
                    )}

                    {/* Countdown block Settings (Use Case 6) */}
                    {selectedBlock.type === 'countdown' && (
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-400">Hạn đếm ngược (End Date)</label>
                        <input
                          type="datetime-local"
                          value={selectedBlock.countdownEnd || ''}
                          onChange={(e) => updateBlock({ ...selectedBlock, countdownEnd: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#f25c22]"
                        />
                      </div>
                    )}

                    {/* Testimonials block Settings (Use Case 6) */}
                    {selectedBlock.type === 'testimonials' && (
                      <div className="space-y-4">
                        <label className="text-[11px] text-slate-400 font-bold">Danh sách Đánh giá</label>
                        {(selectedBlock.reviews || []).map((r, idx) => (
                          <div key={idx} className="bg-slate-950 p-2.5 rounded border border-slate-850 space-y-2 relative">
                            <button
                              onClick={() => {
                                const newReviews = (selectedBlock.reviews || []).filter((_, i) => i !== idx);
                                updateBlock({ ...selectedBlock, reviews: newReviews });
                              }}
                              className="absolute top-1 right-2 text-rose-500 hover:text-rose-400 text-[10px] font-bold"
                            >
                              Xóa
                            </button>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                placeholder="Họ tên"
                                value={r.name}
                                onChange={(e) => {
                                  const newReviews = [...(selectedBlock.reviews || [])];
                                  newReviews[idx] = { ...newReviews[idx], name: e.target.value };
                                  updateBlock({ ...selectedBlock, reviews: newReviews });
                                }}
                                className="bg-slate-900 border border-slate-850 rounded px-2 py-1 text-xs text-white focus:outline-none"
                              />
                              <input
                                type="text"
                                placeholder="Chức vụ"
                                value={r.role}
                                onChange={(e) => {
                                  const newReviews = [...(selectedBlock.reviews || [])];
                                  newReviews[idx] = { ...newReviews[idx], role: e.target.value };
                                  updateBlock({ ...selectedBlock, reviews: newReviews });
                                }}
                                className="bg-slate-900 border border-slate-850 rounded px-2 py-1 text-xs text-white focus:outline-none"
                              />
                            </div>
                            <textarea
                              placeholder="Nhận xét của khách hàng..."
                              value={r.quote}
                              onChange={(e) => {
                                const newReviews = [...(selectedBlock.reviews || [])];
                                newReviews[idx] = { ...newReviews[idx], quote: e.target.value };
                                updateBlock({ ...selectedBlock, reviews: newReviews });
                              }}
                              rows={2}
                              className="w-full bg-slate-900 border border-slate-850 rounded px-2 py-1 text-xs text-white focus:outline-none"
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500">Đánh giá (1-5 sao):</span>
                              <input
                                type="number"
                                min={1}
                                max={5}
                                value={r.rating}
                                onChange={(e) => {
                                  const newReviews = [...(selectedBlock.reviews || [])];
                                  newReviews[idx] = { ...newReviews[idx], rating: parseInt(e.target.value) || 5 };
                                  updateBlock({ ...selectedBlock, reviews: newReviews });
                                }}
                                className="w-12 bg-slate-900 border border-slate-850 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                              />
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const newReviews = [...(selectedBlock.reviews || []), { name: 'Tên Khách Hàng', role: 'Khách hàng', rating: 5, quote: 'Dịch vụ vô cùng chuyên nghiệp và tuyệt vời!' }];
                            updateBlock({ ...selectedBlock, reviews: newReviews });
                          }}
                          className="w-full py-1 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 rounded font-semibold transition"
                        >
                          + Thêm đánh giá mới
                        </button>
                      </div>
                    )}

                    {/* FAQ block Settings (Use Case 6) */}
                    {selectedBlock.type === 'faq' && (
                      <div className="space-y-4">
                        <label className="text-[11px] text-slate-400 font-bold">Danh sách FAQ</label>
                        {(selectedBlock.faqs || []).map((faq, idx) => (
                          <div key={idx} className="bg-slate-950 p-2.5 rounded border border-slate-850 space-y-2 relative">
                            <button
                              onClick={() => {
                                const newFaqs = (selectedBlock.faqs || []).filter((_, i) => i !== idx);
                                updateBlock({ ...selectedBlock, faqs: newFaqs });
                              }}
                              className="absolute top-1 right-2 text-rose-500 hover:text-rose-400 text-[10px] font-bold"
                            >
                              Xóa
                            </button>
                            <input
                              type="text"
                              placeholder="Câu hỏi?"
                              value={faq.question}
                              onChange={(e) => {
                                const newFaqs = [...(selectedBlock.faqs || [])];
                                newFaqs[idx] = { ...newFaqs[idx], question: e.target.value };
                                updateBlock({ ...selectedBlock, faqs: newFaqs });
                              }}
                              className="w-full bg-slate-900 border border-slate-850 rounded px-2 py-1 text-xs text-white focus:outline-none"
                            />
                            <textarea
                              placeholder="Câu trả lời..."
                              value={faq.answer}
                              onChange={(e) => {
                                const newFaqs = [...(selectedBlock.faqs || [])];
                                newFaqs[idx] = { ...newFaqs[idx], answer: e.target.value };
                                updateBlock({ ...selectedBlock, faqs: newFaqs });
                              }}
                              rows={2}
                              className="w-full bg-slate-900 border border-slate-850 rounded px-2 py-1 text-xs text-white focus:outline-none"
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const newFaqs = [...(selectedBlock.faqs || []), { question: 'Câu hỏi của khách?', answer: 'Nhập câu trả lời giải đáp thắc mắc.' }];
                            updateBlock({ ...selectedBlock, faqs: newFaqs });
                          }}
                          className="w-full py-1 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 rounded font-semibold transition"
                        >
                          + Thêm câu hỏi mới
                        </button>
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
              </>
            )}

            {/* Tab 2: SEO configuration (Use Case 5) */}
            {activeTab === 'seo' && (
              <div className="space-y-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#f25c22]">SEO & Social Card Meta</h4>
                
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">Meta Title (Tiêu đề trang)</label>
                  <input
                    type="text"
                    value={seo.title}
                    onChange={(e) => setSeo({ ...seo, title: e.target.value })}
                    placeholder="Growth OS — Phần mềm tăng trưởng traffic tự động"
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#f25c22]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">Meta Description (Mô tả trang)</label>
                  <textarea
                    value={seo.description}
                    onChange={(e) => setSeo({ ...seo, description: e.target.value })}
                    placeholder="Mô tả tóm tắt nội dung trang giúp đạt thứ hạng cao trên Google..."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#f25c22]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">Share Image (og:image URL)</label>
                  <input
                    type="text"
                    value={seo.ogImage}
                    onChange={(e) => setSeo({ ...seo, ogImage: e.target.value })}
                    placeholder="https://example.com/thumbnail.png"
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">Từ khóa SEO (ngăn cách bởi dấu phẩy)</label>
                  <input
                    type="text"
                    value={seo.keywords}
                    onChange={(e) => setSeo({ ...seo, keywords: e.target.value })}
                    placeholder="seo, chatbot ai, leads automation"
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>

                {/* Live Social Card Preview */}
                <div className="border-t border-slate-800 pt-5 space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Bản xem trước chia sẻ mạng xã hội (Facebook/Zalo)</label>
                  <div className="bg-slate-950 border border-slate-850 rounded-xl overflow-hidden shadow-lg">
                    {seo.ogImage && (
                      <div className="h-36 overflow-hidden">
                        <img src={seo.ogImage} alt="Social Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4 space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">DOMAINDEMO.COM</span>
                      <h5 className="text-white font-bold text-sm truncate">{seo.title || 'Tiêu đề trang khi chia sẻ'}</h5>
                      <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">{seo.description || 'Mô tả tóm tắt nội dung Landing Page khi gửi qua tin nhắn Zalo, Facebook...'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: AI Assistant Generator (Use Case 3) */}
            {activeTab === 'ai' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#f25c22] flex items-center gap-1">
                    🤖 Thiết kế Landing Page bằng AI
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Nhập ý tưởng sản phẩm/dịch vụ của bạn, trợ lý AI sẽ tự động lên bố cục các khối, tạo tiêu đề kích thích mua hàng và viết nội dung tối ưu.
                  </p>
                </div>

                <div className="space-y-2">
                  <textarea
                    value={aiPromptInput}
                    onChange={(e) => setAiPromptInput(e.target.value)}
                    placeholder="Ví dụ: Thiết kế landing page bán khóa học tiếng Anh giao tiếp cho người đi làm bận rộn, cam kết đầu ra trong 6 tháng, gói học phí 1.2 triệu/tháng..."
                    rows={6}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-[#f25c22] leading-relaxed"
                  />
                  <button
                    onClick={handleGenerateAiLayout}
                    disabled={aiGenerating}
                    className="w-full py-2.5 bg-[#f25c22] hover:bg-[#d94d1a] disabled:bg-slate-800 text-white font-bold rounded-lg text-xs transition shadow-md flex justify-center items-center gap-2"
                  >
                    {aiGenerating ? (
                      <>
                        <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                        Đang tạo trang...
                      </>
                    ) : 'Tạo layout bằng AI'}
                  </button>
                </div>

                {/* Templates gợi ý nhanh */}
                <div className="border-t border-slate-800 pt-4 space-y-2">
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Gợi ý nhanh ý tưởng mẫu:</label>
                  <div className="space-y-1.5">
                    <button
                      onClick={() => setAiPromptInput('Thiết kế landing page giới thiệu phần mềm CRM tự động hóa chăm sóc khách hàng đa kênh cho doanh nghiệp nhỏ (SaaS).')}
                      className="w-full bg-slate-950 hover:bg-slate-850 border border-slate-850 rounded p-2 text-left text-[11px] text-slate-400 hover:text-white transition"
                    >
                      💡 Phần mềm SaaS CRM
                    </button>
                    <button
                      onClick={() => setAiPromptInput('Tạo landing page bán mật ong rừng nguyên chất Tây Bắc, cam kết chất lượng, hoàn tiền nếu giả, giao hàng miễn phí toàn quốc.')}
                      className="w-full bg-slate-950 hover:bg-slate-850 border border-slate-850 rounded p-2 text-left text-[11px] text-slate-400 hover:text-white transition"
                    >
                      💡 Bán sản phẩm Nông sản/Mật ong
                    </button>
                    <button
                      onClick={() => setAiPromptInput('Tạo landing page cho trung tâm Yoga & Thiền tại nhà, lớp học thử miễn phí buổi đầu tiên, cải thiện sức khỏe tinh thần.')}
                      className="w-full bg-slate-950 hover:bg-slate-850 border border-slate-850 rounded p-2 text-left text-[11px] text-slate-400 hover:text-white transition"
                    >
                      💡 Trung tâm Yoga & Thiền
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Save Bar */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between gap-3 shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 bg-[#f25c22] hover:bg-[#d94d1a] disabled:bg-slate-800 text-white font-bold rounded-lg text-sm transition shadow-md flex justify-center items-center gap-2"
            >
              {saving ? (
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
              ) : 'Lưu thiết kế'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas - Preview */}
      <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden relative">
        {/* Top bar info & Responsive Switcher (Use Case 4) */}
        <div className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex justify-between items-center shrink-0">
          <h4 className="font-bold text-white text-sm flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            Giao diện trực quan (Visual Canvas Preview)
          </h4>
          
          {/* Responsive device buttons */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setDevice('desktop')}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${device === 'desktop' ? 'bg-[#f25c22] text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              🖥️ Desktop
            </button>
            <button
              onClick={() => setDevice('tablet')}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${device === 'tablet' ? 'bg-[#f25c22] text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              📱 Tablet
            </button>
            <button
              onClick={() => setDevice('mobile')}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${device === 'mobile' ? 'bg-[#f25c22] text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              📞 Mobile
            </button>
          </div>
        </div>

        {/* Display messages */}
        <div className="absolute top-16 left-6 right-6 z-10 space-y-2">
          {success && (
            <div className="p-3.5 bg-emerald-500/90 text-white font-medium rounded-lg text-xs flex justify-between shadow-lg">
              <span>{success}</span>
              <button onClick={() => setSuccess('')} className="font-bold">Đóng</button>
            </div>
          )}
          {error && (
            <div className="p-3.5 bg-rose-500/90 text-white font-medium rounded-lg text-xs flex justify-between shadow-lg">
              <span>{error}</span>
              <button onClick={() => setError('')} className="font-bold">Đóng</button>
            </div>
          )}
        </div>

        {/* Render Canvas Wrapper (Frame effect depending on device type) */}
        <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-slate-950">
          {loading ? (
            <div className="flex h-full items-center justify-center text-slate-400 text-sm font-semibold">
              Đang tải thiết kế...
            </div>
          ) : blocks.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl py-16 text-slate-500 text-sm w-full">
              <p>Chưa có thành phần nào trên trang.</p>
              <p className="text-xs text-slate-600 mt-1">Sử dụng nút Thêm khối ở sidebar để bắt đầu hoặc chọn AI sinh layout.</p>
            </div>
          ) : (
            <div
              className={`h-fit border border-slate-800 bg-gray-950 transition-all duration-300 overflow-hidden shadow-2xl rounded-2xl ${
                device === 'desktop' ? 'w-full max-w-5xl' : 
                device === 'tablet' ? 'w-[768px] border-x-4 border-slate-700' : 
                'w-[375px] border-x-4 border-slate-700'
              }`}
            >
              {blocks.map((block) => {
                const isMobileHidden = block.hiddenOnMobile;
                
                // Hide block completely in Mobile View if toggled
                if (isMobileHidden && device === 'mobile') return null;

                return (
                  <div
                    key={block.id}
                    onClick={() => setSelectedBlockId(block.id)}
                    style={{ backgroundColor: block.backgroundColor, color: block.textColor }}
                    className={`relative p-8 cursor-pointer group border-2 ${selectedBlockId === block.id ? 'border-[#f25c22]' : 'border-transparent hover:border-slate-800'} ${isMobileHidden ? 'opacity-40 bg-slate-900/30' : ''} transition duration-205`}
                  >
                    {/* Block Info Badge */}
                    <span className="absolute top-2 left-2 text-[8px] bg-slate-900 border border-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase">
                      {block.type}
                    </span>

                    {/* Hidden on Mobile Badge Overlay */}
                    {isMobileHidden && (
                      <span className="absolute top-2 left-16 text-[8px] bg-slate-900 border border-slate-800 text-rose-400 px-1.5 py-0.5 rounded font-bold uppercase">
                        🚫 Ẩn trên Mobile
                      </span>
                    )}

                    {/* Edit label overlay */}
                    <span className="absolute top-2 right-2 text-[8px] bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition z-10">
                      Click to edit
                    </span>

                    {block.type === 'hero' && (
                      <>
                        {block.imageUrl && block.imageAlignment !== 'center' ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                            <div className={`space-y-4 ${block.imageAlignment === 'left' ? 'md:order-2' : ''}`}>
                              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">{block.title}</h1>
                              <p className="text-xs md:text-sm text-slate-300 leading-relaxed">{block.subtitle}</p>
                              <button className="px-5 py-2.5 bg-[#f25c22] text-white text-xs font-bold rounded-lg mt-2">
                                {block.buttonText || 'Bấm đăng ký'}
                              </button>
                            </div>
                            <div className={`${block.imageAlignment === 'left' ? 'md:order-1' : ''} flex justify-center`}>
                              <img src={block.imageUrl} alt="preview" className="rounded-lg shadow-lg border border-slate-800 max-h-[220px] object-cover" />
                            </div>
                          </div>
                        ) : (
                          <div className="text-center space-y-4">
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">{block.title}</h1>
                            <p className="text-xs md:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">{block.subtitle}</p>
                            {block.imageUrl && (
                              <div className="my-4 flex justify-center">
                                <img src={block.imageUrl} alt="preview" className="rounded-lg shadow-lg border border-slate-800 max-h-[220px] object-cover" />
                              </div>
                            )}
                            <button className="px-5 py-2.5 bg-[#f25c22] text-white text-xs font-bold rounded-lg mt-2">
                              {block.buttonText || 'Bấm đăng ký'}
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {block.type === 'features' && (
                      <div className="space-y-6">
                        <h2 className="text-md md:text-lg font-bold text-white text-center">{block.title}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(block.items || []).map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2 bg-slate-950/40 p-3 rounded border border-slate-850">
                              <span className="text-indigo-400 text-xs">✓</span>
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
                            <input disabled placeholder="Nguyễn Văn A" className="w-full bg-slate-900 border border-slate-850 rounded px-2.5 py-1.5 text-xs cursor-not-allowed" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-semibold uppercase">Email</label>
                            <input disabled placeholder="name@email.com" className="w-full bg-slate-900 border border-slate-850 rounded px-2.5 py-1.5 text-xs cursor-not-allowed" />
                          </div>
                        </div>
                        <button disabled className="w-full py-2 bg-[#f25c22] text-white font-bold text-xs rounded transition mt-1 cursor-not-allowed">
                          Đăng ký (Demo Form)
                        </button>
                        <p className="text-[9px] text-center text-slate-500 font-semibold">
                          Form ID: {block.formId || 'Chưa liên kết'}
                          {block.workflowId && ` | Workflow: ${workflows.find(w => String(w.id) === block.workflowId)?.name}`}
                        </p>
                      </div>
                    )}

                    {block.type === 'pricing' && (
                      <div className="text-center space-y-4">
                        <h2 className="text-md md:text-lg font-bold text-white">{block.title}</h2>
                        <p className="text-xs text-slate-400">{block.subtitle}</p>
                        <div className="max-w-xs mx-auto bg-slate-950/80 border border-slate-850 rounded-lg p-6 space-y-3 mt-4 relative">
                          <span className="absolute top-0 right-0 bg-[#f25c22] text-[9px] font-bold text-white px-2 py-0.5 rounded-bl">Phổ biến</span>
                          <h4 className="text-xs font-bold text-white">Gói Ưu Đãi</h4>
                          <p className="text-2xl font-extrabold text-white">{block.priceVal || '499.000đ'}<span className="text-[10px] font-normal text-slate-500">/tháng</span></p>
                          <button disabled className="w-full py-2 bg-[#f25c22] text-white font-bold text-xs rounded cursor-not-allowed">
                            {block.productId ? `Thanh toán (${block.paymentMethod || 'PAYOS'})` : (block.buttonText || 'Mua ngay')}
                          </button>
                        </div>
                      </div>
                    )}

                    {block.type === 'countdown' && (
                      <div className="text-center space-y-3">
                        <h2 className="text-md md:text-lg font-bold text-white">{block.title}</h2>
                        <p className="text-xs text-slate-400">{block.subtitle}</p>
                        <div className="flex justify-center gap-3 mt-4 text-white font-mono">
                          <div className="bg-slate-950 border border-slate-850 rounded p-2.5 min-w-[50px]">
                            <span className="text-lg font-extrabold block text-[#f25c22]">02</span>
                            <span className="text-[8px] text-slate-500 uppercase">Ngày</span>
                          </div>
                          <div className="bg-slate-950 border border-slate-850 rounded p-2.5 min-w-[50px]">
                            <span className="text-lg font-extrabold block text-[#f25c22]">14</span>
                            <span className="text-[8px] text-slate-500 uppercase">Giờ</span>
                          </div>
                          <div className="bg-slate-950 border border-slate-850 rounded p-2.5 min-w-[50px]">
                            <span className="text-lg font-extrabold block text-[#f25c22]">38</span>
                            <span className="text-[8px] text-slate-500 uppercase">Phút</span>
                          </div>
                          <div className="bg-slate-950 border border-slate-850 rounded p-2.5 min-w-[50px]">
                            <span className="text-lg font-extrabold block text-[#f25c22]">45</span>
                            <span className="text-[8px] text-slate-500 uppercase">Giây</span>
                          </div>
                        </div>
                        <p className="text-[9px] text-slate-500 italic mt-1">Hạn kết thúc: {block.countdownEnd || 'Chưa cài đặt'}</p>
                      </div>
                    )}

                    {block.type === 'testimonials' && (
                      <div className="space-y-4">
                        <h2 className="text-md md:text-lg font-bold text-white text-center">{block.title}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {(block.reviews || []).map((r, idx) => (
                            <div key={idx} className="bg-slate-950/50 border border-slate-850 p-4 rounded-lg flex flex-col justify-between">
                              <div className="space-y-1">
                                <span className="text-[#f25c22] text-[10px]">{'★'.repeat(r.rating || 5)}{'☆'.repeat(5 - (r.rating || 5))}</span>
                                <p className="text-slate-300 italic text-[11px] leading-relaxed">"{r.quote}"</p>
                              </div>
                              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-850">
                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[#f25c22] text-xs">
                                  {r.name.charAt(0)}
                                </div>
                                <div>
                                  <h4 className="font-bold text-white text-xs">{r.name}</h4>
                                  <p className="text-[8px] text-slate-500">{r.role}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {block.type === 'faq' && (
                      <div className="space-y-4">
                        <h2 className="text-md md:text-lg font-bold text-white text-center">{block.title}</h2>
                        <div className="max-w-2xl mx-auto space-y-2">
                          {(block.faqs || []).map((faq, idx) => (
                            <div key={idx} className="bg-slate-950/40 border border-slate-850 rounded-lg overflow-hidden">
                              <div className="px-4 py-2.5 flex justify-between items-center text-left hover:bg-slate-800/20">
                                <span className="font-semibold text-white text-xs">{faq.question}</span>
                                <span className="text-slate-500 text-[10px]">▼</span>
                              </div>
                              <div className="px-4 py-2 bg-slate-950/20 border-t border-slate-850 text-slate-400 text-xs">
                                {faq.answer}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {block.type === 'footer' && (
                      <div className="flex justify-between items-center text-xs text-slate-400">
                        <div>
                          <h4 className="text-white font-bold">{block.title}</h4>
                          <p className="text-[10px]">{block.subtitle}</p>
                        </div>
                        <p className="text-[9px]">© {new Date().getFullYear()} {block.title}.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
