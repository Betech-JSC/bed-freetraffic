'use client';

import React, { useEffect, useState, useCallback } from 'react';
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

const getDynamicFallbackProducts = (title: string, promptText: string, theme: string) => {
  const combined = `${title} ${promptText}`.toLowerCase();
  
  if (combined.includes('mật ong') || combined.includes('honey') || combined.includes('ong')) {
    return [
      { id: 'fallback-1', name: 'Mật Ong Rừng Tây Bắc', description: 'Mật ong rừng tự nhiên nguyên chất được khai thác trực tiếp từ rừng Tây Bắc.', price: 250000, currency: 'VND' },
      { id: 'fallback-2', name: 'Mật Ong Hoa Nhãn', description: 'Mật ong từ hoa nhãn ngọt thanh, giàu dưỡng chất tốt cho sức khỏe.', price: 180000, currency: 'VND' },
      { id: 'fallback-3', name: 'Mật Ong Bạc Hà', description: 'Mật ong hoa bạc hà đặc sản Hà Giang thơm mát, chất lượng thượng hạng.', price: 320000, currency: 'VND' }
    ];
  }
  
  if (combined.includes('học') || combined.includes('course') || combined.includes('lập trình') || combined.includes('đào tạo') || combined.includes('tiếng anh') || theme === 'education-theme') {
    return [
      { id: 'fallback-1', name: 'Khóa Học HTML/CSS/JS Cơ Bản', description: 'Khóa học nền tảng lập trình web cho người mới bắt đầu từ số 0.', price: 499000, currency: 'VND' },
      { id: 'fallback-2', name: 'Khóa Học React & Next.js Pro', description: 'Xây dựng dự án web thực tế chuẩn chuyên nghiệp cùng Mentor.', price: 999000, currency: 'VND' },
      { id: 'fallback-3', name: 'Khóa Học Node.js Backend Developer', description: 'Làm chủ kiến trúc hệ thống và cơ sở dữ liệu chuyên sâu.', price: 899000, currency: 'VND' }
    ];
  }
  
  if (combined.includes('vé') || combined.includes('bay') || combined.includes('flight') || combined.includes('du lịch') || combined.includes('travel') || combined.includes('tour') || theme === 'saleticket-theme') {
    return [
      { id: 'fallback-1', name: 'Combo Vé Máy Bay & Resort 3N2Đ', description: 'Trọn gói vé máy bay khứ hồi kèm phòng nghỉ dưỡng cao cấp ven biển.', price: 2490000, currency: 'VND' },
      { id: 'fallback-2', name: 'Tour Du Lịch Trọn Gói Đà Lạt', description: 'Khám phá thành phố ngàn hoa thơ mộng với hướng dẫn viên chu đáo.', price: 3190000, currency: 'VND' },
      { id: 'fallback-3', name: 'Vé Máy Bay Khứ Hồi Hà Nội - Phú Quốc', description: 'Hãng hàng không chất lượng, giờ bay đẹp, hỗ trợ 24/7.', price: 1890000, currency: 'VND' }
    ];
  }

  if (combined.includes('hải sản') || combined.includes('seafood') || combined.includes('tôm') || combined.includes('cá') || combined.includes('ngâm tương') || theme === 'sale-theme') {
    return [
      { id: 'fallback-1', name: 'Tôm Sú Cà Mau Ngâm Tương', description: 'Tôm sú tươi sống ngâm nước tương cốt gia truyền đậm vị đặc sản.', price: 250000, currency: 'VND' },
      { id: 'fallback-2', name: 'Cá Hồi Na Uy Ngâm Tương', description: 'Cá hồi Na Uy tươi rói ngâm tương mẻ mới làm sạch sẽ mỗi ngày.', price: 280000, currency: 'VND' },
      { id: 'fallback-3', name: 'Mực Trứng Sốt Tương Cay', description: 'Mực trứng nhiều gạch bùi béo sốt tương ớt cay nồng đậm vị.', price: 190000, currency: 'VND' }
    ];
  }

  // Fallback to generic product names based on page title
  const cleanTitle = title || 'Sản phẩm';
  return [
    { id: 'fallback-1', name: `${cleanTitle} Cao Cấp`, description: 'Mô tả chi tiết sản phẩm chất lượng cao của cửa hàng.', price: 150000, currency: 'VND' },
    { id: 'fallback-2', name: `${cleanTitle} Thượng Hạng`, description: 'Sản phẩm tuyển chọn loại thượng hạng chất lượng vượt trội.', price: 250000, currency: 'VND' },
    { id: 'fallback-3', name: `${cleanTitle} Đặc Biệt`, description: 'Sản phẩm độc quyền phiên bản giới hạn đặc biệt.', price: 350000, currency: 'VND' }
  ];
};

const isColorLight = (hex: string): boolean => {
  const cleanHex = (hex || '').replace('#', '');
  if (cleanHex.length !== 6) return false;
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150;
};

const getAdaptiveCardStyles = (textColor?: string) => {
  const hex = textColor || '#000000';
  const isLight = isColorLight(hex);
  if (isLight) {
    return {
      bg: 'rgba(255, 255, 255, 0.08)',
      bgHover: 'rgba(255, 255, 255, 0.12)',
      border: 'rgba(255, 255, 255, 0.15)',
      textSecondary: 'rgba(255, 255, 255, 0.65)',
      textPrimary: 'inherit',
    };
  } else {
    return {
      bg: 'rgba(0, 0, 0, 0.03)',
      bgHover: 'rgba(0, 0, 0, 0.05)',
      border: 'rgba(0, 0, 0, 0.08)',
      textSecondary: 'rgba(0, 0, 0, 0.65)',
      textPrimary: 'inherit',
    };
  }
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
    backgroundColor: '#ffffff',
    textColor: '#0f172a',
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
    backgroundColor: '#f1f5f9',
    textColor: '#1e293b',
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
  const [activeTab, setActiveTab] = useState<'blocks' | 'seo' | 'ai' | 'popups'>('blocks');
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [seo, setSeo] = useState({
    title: '',
    description: '',
    ogImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60',
    keywords: ''
  });

  // AI SEO-Doctor States
  const [seoRecommendations, setSeoRecommendations] = useState<{ title: string; description: string; keywords: string } | null>(null);
  const [loadingSeoRecommendation, setLoadingSeoRecommendation] = useState(false);
  const [seoDoctorOpen, setSeoDoctorOpen] = useState(false);

  // Smart Popup States
  const [popupEnabled, setPopupEnabled] = useState(false);
  const [popupExitIntent, setPopupExitIntent] = useState(false);
  const [popupScrollDepth, setPopupScrollDepth] = useState(0);
  const [popupInactivity, setPopupInactivity] = useState(0);
  const [popupTitle, setPopupTitle] = useState('Đăng ký nhận quà tặng!');
  const [popupDescription, setPopupDescription] = useState('Nhập email của bạn dưới đây để nhận ngay tài liệu hướng dẫn miễn phí.');
  const [popupFormId, setPopupFormId] = useState('');

  // AI Prompt State
  const [aiPromptInput, setAiPromptInput] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiTheme, setAiTheme] = useState<string>('ocean-breeze');
  const [useCase, setUseCase] = useState<string>('saas');

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
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
      
      let parsedBlocks = DEFAULT_BLOCKS;
      let parsedSeo = {
        title: pageData.title || '',
        description: '',
        ogImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60',
        keywords: ''
      };
      let parsedTheme = 'ocean-breeze';
      let parsedUseCase = 'saas';

      if (pageData.layoutJson && pageData.layoutJson !== '{}') {
        try {
          const parsed = JSON.parse(pageData.layoutJson);
          if (Array.isArray(parsed)) {
            parsedBlocks = parsed;
          } else if (parsed && typeof parsed === 'object') {
            parsedBlocks = parsed.blocks || DEFAULT_BLOCKS;
            parsedSeo = { ...parsedSeo, ...(parsed.seo || {}) };
            if (parsed.theme) parsedTheme = parsed.theme;
            if (parsed.useCase) parsedUseCase = parsed.useCase;
            if (parsed.popupConfig) {
              setPopupEnabled(parsed.popupConfig.enabled || false);
              setPopupExitIntent(parsed.popupConfig.exitIntent || false);
              setPopupScrollDepth(parsed.popupConfig.scrollDepth || 0);
              setPopupInactivity(parsed.popupConfig.inactivity || 0);
              setPopupTitle(parsed.popupConfig.title || 'Đăng ký nhận quà tặng!');
              setPopupDescription(parsed.popupConfig.description || 'Nhập email của bạn dưới đây để nhận ngay tài liệu hướng dẫn miễn phí.');
              setPopupFormId(parsed.popupConfig.formId || '');
            } else {
              setPopupEnabled(false);
              setPopupExitIntent(false);
              setPopupScrollDepth(0);
              setPopupInactivity(0);
              setPopupTitle('Đăng ký nhận quà tặng!');
              setPopupDescription('Nhập email của bạn dưới đây để nhận ngay tài liệu hướng dẫn miễn phí.');
              setPopupFormId('');
            }
          }
        } catch (e) {
          // Keep defaults
        }
      }
      setBlocks(parsedBlocks);
      setSeo(parsedSeo);
      setAiTheme(parsedTheme);
      setUseCase(parsedUseCase);

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

  const handleSeoDoctor = async () => {
    setLoadingSeoRecommendation(true);
    setSeoRecommendations(null);
    try {
      const issues = [];
      if (!seo.title.trim()) issues.push("Tiêu đề trang đang trống");
      else if (seo.title.length < 30) issues.push("Tiêu đề trang ngắn hơn 30 ký tự (chưa tối ưu)");
      else if (seo.title.length > 65) issues.push("Tiêu đề trang dài hơn 65 ký tự (dễ bị cắt bớt)");

      if (!seo.description.trim()) issues.push("Mô tả trang đang trống");
      else if (seo.description.length < 80) issues.push("Mô tả trang ngắn hơn 80 ký tự (thiếu thông tin)");
      else if (seo.description.length > 160) issues.push("Mô tả trang dài hơn 160 ký tự (dễ bị cắt bớt)");

      if (!seo.keywords.trim()) issues.push("Từ khóa SEO đang trống");

      const res = await apiJson<{ title: string; description: string; keywords: string }>('/seo/fix-issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: seo.title,
          description: seo.description,
          keywords: seo.keywords,
          issues
        })
      });
      setSeoRecommendations(res);
      setSeoDoctorOpen(true);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi gọi bác sĩ SEO AI');
    } finally {
      setLoadingSeoRecommendation(false);
    }
  };

  const applySeoRecommendations = () => {
    if (seoRecommendations) {
      setSeo({
        ...seo,
        title: seoRecommendations.title,
        description: seoRecommendations.description,
        keywords: seoRecommendations.keywords
      });
      setSeoRecommendations(null);
      setSeoDoctorOpen(false);
      setSuccess('Đã áp dụng cấu hình SEO đề xuất từ AI thành công.');
      setError('');
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Generate public HTML code based on layout blocks
  const compileHtml = (blocksList: PageBlock[], seoData: typeof seo, productsList: any[]): string => {
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
    body { font-family: system-ui, -apple-system, sans-serif; background-color: #ffffff; color: #1f2937; scroll-behavior: smooth; }
    .accordion-content { max-height: 0; overflow: hidden; transition: max-height 0.25s ease-out; }
    .accordion-item.active .accordion-content { max-height: 350px; }
    .accordion-item.active .accordion-arrow { transform: rotate(180deg); }
  </style>
</head>
<body class="bg-white text-gray-900 min-h-screen">`;

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
  <section class="py-20 px-6${isMobileHidden}" style="background-color: ${block.backgroundColor || '#f1f5f9'}; color: ${block.textColor || '#1e293b'};">
    <div class="max-w-5xl mx-auto">
      <h2 class="text-3xl font-bold text-center text-gray-900 mb-12">${block.title}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        ${(block.items || []).map(item => `
        <div class="flex items-start gap-3 bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <span class="text-indigo-600 text-lg font-bold">✓</span>
          <p class="text-gray-700 font-medium">${item}</p>
        </div>`).join('')}
      </div>
    </div>
  </section>`;
      } else if (block.type === 'form') {
        html += `
  <section id="register-form" class="py-20 px-6${isMobileHidden}" style="background-color: ${block.backgroundColor || '#ffffff'};">
    <div class="max-w-md mx-auto bg-white border border-gray-200 rounded-xl p-8 shadow-xl">
      <h3 class="text-2xl font-bold text-gray-900 text-center mb-6">${block.title}</h3>
      <p class="text-gray-500 text-sm text-center mb-6">${block.subtitle || 'Vui lòng điền thông tin để tiếp tục'}</p>
      
      <form id="public-lead-form" class="space-y-4">
        <input type="hidden" name="formId" id="form-id-holder" value="${block.formId || ''}" />
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Họ và Tên</label>
          <input type="text" id="lead-name" required class="w-full bg-gray-5-0 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-[#f25c22] placeholder-gray-400" placeholder="Nguyễn Văn A" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Địa chỉ Email</label>
          <input type="email" id="lead-email" required class="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-[#f25c22] placeholder-gray-400" placeholder="name@email.com" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Số điện thoại</label>
          <input type="tel" id="lead-phone" class="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-[#f25c22] placeholder-gray-400" placeholder="0987654321" />
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

        let btnBgCol = '#f25c22';
        let btnHoverBgCol = '#d94d1a';
        if (aiTheme === 'saleticket-theme') {
          btnBgCol = '#0284c7';
          btnHoverBgCol = '#0369a1';
        } else if (aiTheme === 'education-theme') {
          btnBgCol = '#f05123';
          btnHoverBgCol = '#d94416';
        }

        const bgCol = block.backgroundColor || '#0b0f19';
        const txtCol = block.textColor || '#ffffff';
        const isLight = isColorLight(bgCol);
        const sectionHeading = isLight ? 'text-slate-900' : 'text-white';
        const cardBg = isLight ? 'bg-white border border-slate-100' : 'bg-slate-900 border border-slate-800';
        const cardTextPrimary = isLight ? 'text-slate-800' : 'text-white';
        const cardTextSecondary = isLight ? 'text-slate-500' : 'text-slate-400';
        const cardTextMuted = isLight ? 'text-slate-400' : 'text-slate-500';
        const iconCheck = isLight ? 'text-slate-600' : 'text-slate-400';

        const displayProducts = productsList && productsList.length > 0
          ? productsList.slice(0, 3)
          : getDynamicFallbackProducts(page?.title || '', aiPromptInput, aiTheme);

        const getProductImage = (pName: string, index: number): string => {
          const lowerName = pName.toLowerCase();
          if (lowerName.includes('mật ong') || lowerName.includes('honey') || lowerName.includes('ong')) {
            const honeyImgs = [
              'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=600&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=600&auto=format&fit=crop&q=80'
            ];
            return honeyImgs[index % honeyImgs.length];
          }
          if (aiTheme === 'sale-theme') {
            const foodImgs = [
              'https://images.unsplash.com/photo-1534080391025-09795d197360?w=600&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1534482421-64566f976cfa?w=600&auto=format&fit=crop&q=80'
            ];
            return foodImgs[index % foodImgs.length];
          }
          if (aiTheme === 'education-theme') {
            const eduImgs = [
              'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&auto=format&fit=crop&q=80'
            ];
            return eduImgs[index % eduImgs.length];
          }
          if (aiTheme === 'saleticket-theme') {
            const travelImgs = [
              'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?w=600&auto=format&fit=crop&q=80'
            ];
            return travelImgs[index % travelImgs.length];
          }
          return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80';
        };

        if (aiTheme === 'sale-theme') {
          html += `
  <section class="py-20 px-6 text-center${isMobileHidden}" style="background-color: ${bgCol}; color: ${txtCol};">
    <div class="max-w-6xl mx-auto space-y-6">
      <div class="text-center max-w-xl mx-auto mb-12">
        <span class="px-3 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full uppercase tracking-wider">Đặc Sản</span>
        <h2 class="text-3xl md:text-4xl font-extrabold mt-2 ${sectionHeading}">${block.title}</h2>
        <p class="text-sm mt-2 opacity-90">${block.subtitle || 'Chọn những sản phẩm đặc sản chất lượng được giao trong ngày.'}</p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        ${displayProducts.map((p, index) => {
          const img = getProductImage(p.name, index);
          const pPrice = typeof p.price === 'number' ? p.price.toLocaleString('vi-VN') : p.price;
          const pCurrency = p.currency || 'VND';
          const buttonAction = isDirectCheckout 
            ? `onclick="openCheckout('${p.id}', '${p.name}', '${pPrice} ${pCurrency}')"`
            : `href="${block.buttonLink || '#register-form'}"`;

          const badges = ['Bán Chạy Nhất', 'Đặc Sản Cửa Hàng', 'Gợi Ý Đứng Đầu'];
          const badgeBg = ['bg-orange-100 text-orange-800', 'bg-amber-100 text-amber-800', 'bg-green-100 text-green-800'];
          const badge = badges[index % badges.length];
          const badgeClass = badgeBg[index % badgeBg.length];

          return `
          <div class="rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between transform hover:-translate-y-1 transition duration-350 ${cardBg}">
            <img src="${img}" alt="${p.name}" class="h-48 w-full object-cover" />
            <div class="p-6 flex-1 flex flex-col justify-between text-left">
              <div class="space-y-2">
                <span class="inline-block px-2 py-0.5 ${badgeClass} text-[10px] font-bold rounded">${badge}</span>
                <h3 class="text-lg font-bold ${cardTextPrimary}">${p.name}</h3>
                <p class="text-xs ${cardTextSecondary}">${p.description || 'Sản phẩm chất lượng cao được tuyển chọn kỹ lưỡng, đảm bảo an toàn vệ sinh thực phẩm.'}</p>
              </div>
              <div class="mt-6 pt-4 border-t ${isLight ? 'border-slate-100' : 'border-gray-800'} flex justify-between items-center">
                <span class="text-orange-600 font-extrabold text-base">chỉ từ ${pPrice}đ</span>
                <${isDirectCheckout ? 'button' : 'a'} ${buttonAction} style="background-color: #f25c22;" class="px-4 py-2 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition">Đặt Mua</${isDirectCheckout ? 'button' : 'a'}>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </section>`;
        } else if (aiTheme === 'education-theme') {
          html += `
  <section class="py-20 px-6 text-center${isMobileHidden}" style="background-color: ${bgCol}; color: ${txtCol};">
    <div class="max-w-6xl mx-auto space-y-6">
      <div class="text-center max-w-xl mx-auto mb-12">
        <span class="px-3 py-1 bg-orange-100 text-orange-800 text-[10px] font-bold rounded-full uppercase tracking-wider">Lộ Trình Bài Bản</span>
        <h2 class="text-3xl md:text-4xl font-extrabold mt-2 ${sectionHeading}">${block.title}</h2>
        <p class="text-sm mt-2 opacity-90">${block.subtitle || 'Khóa học lập trình chất lượng cao học trực tuyến hiệu quả cao cùng Mentor.'}</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        ${displayProducts.map((p, index) => {
          const img = getProductImage(p.name, index);
          const pPrice = typeof p.price === 'number' ? p.price.toLocaleString('vi-VN') : p.price;
          const pCurrency = p.currency || 'VND';
          const buttonAction = isDirectCheckout 
            ? `onclick="openCheckout('${p.id}', '${p.name}', '${pPrice} ${pCurrency}')"`
            : `href="${block.buttonLink || '#register-form'}"`;

          const badges = ['Pro Course', 'Web Backend', 'Foundation'];
          const badgeBg = ['bg-sky-100 text-sky-800', 'bg-purple-100 text-purple-800', 'bg-green-100 text-green-800'];
          const badge = badges[index % badges.length];
          const badgeClass = badgeBg[index % badgeBg.length];

          return `
          <div class="rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between transform hover:-translate-y-1 transition duration-350 ${cardBg}">
            <img src="${img}" alt="${p.name}" class="h-48 w-full object-cover" />
            <div class="p-6 flex-1 flex flex-col justify-between text-left">
              <div class="space-y-2">
                <span class="inline-block px-2 py-0.5 ${badgeClass} text-[10px] font-bold rounded">${badge}</span>
                <h3 class="text-lg font-bold ${cardTextPrimary}">${p.name}</h3>
                <p class="text-xs ${cardTextSecondary}">${p.description || 'Khóa học chất lượng cao với lộ trình bài bản học từ số 0 giúp tự tin đi làm.'}</p>
              </div>
              <div class="mt-6 pt-4 border-t ${isLight ? 'border-slate-100' : 'border-gray-800'} flex justify-between items-center">
                <span class="text-[#f05123] font-extrabold text-base">${pPrice}đ</span>
                <${isDirectCheckout ? 'button' : 'a'} ${buttonAction} style="background-color: #f05123;" class="px-4 py-2 hover:bg-[#d94416] text-white rounded-lg text-xs font-bold transition">Đăng Ký Học</${isDirectCheckout ? 'button' : 'a'}>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </section>`;
        } else if (aiTheme === 'saleticket-theme') {
          html += `
  <section class="py-20 px-6 text-center${isMobileHidden}" style="background-color: ${bgCol}; color: ${txtCol};">
    <div class="max-w-6xl mx-auto space-y-6">
      <div class="text-center max-w-xl mx-auto mb-12">
        <span class="px-3 py-1 bg-sky-100 text-sky-800 text-[10px] font-bold rounded-full uppercase tracking-wider">Hành Trình Mơ Ước</span>
        <h2 class="text-3xl md:text-4xl font-extrabold mt-2 ${sectionHeading}">${block.title}</h2>
        <p class="text-sm mt-2 opacity-90">${block.subtitle || 'Đặt combo giá tốt nhất, an tâm hỗ trợ 24/7.'}</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        ${displayProducts.map((p, index) => {
          const img = getProductImage(p.name, index);
          const pPrice = typeof p.price === 'number' ? p.price.toLocaleString('vi-VN') : p.price;
          const pCurrency = p.currency || 'VND';
          const buttonAction = isDirectCheckout 
            ? `onclick="openCheckout('${p.id}', '${p.name}', '${pPrice} ${pCurrency}')"`
            : `href="${block.buttonLink || '#register-form'}"`;

          const badges = ['Combo Bay + Ở', 'Tour Trọn Gói', 'Vé Máy Bay Hot'];
          const badgeBg = ['bg-sky-100 text-sky-800', 'bg-blue-100 text-blue-800', 'bg-green-100 text-green-800'];
          const badge = badges[index % badges.length];
          const badgeClass = badgeBg[index % badgeBg.length];
          const btnLabel = index === 0 ? 'Đặt Combo' : index === 1 ? 'Đặt Tour' : 'Đặt Vé';

          return `
          <div class="rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between transform hover:-translate-y-1 transition duration-350 ${cardBg}">
            <img src="${img}" alt="${p.name}" class="h-48 w-full object-cover" />
            <div class="p-6 flex-1 flex flex-col justify-between text-left">
              <div class="space-y-2">
                <span class="inline-block px-2 py-0.5 ${badgeClass} text-[10px] font-bold rounded">${badge}</span>
                <h3 class="text-lg font-bold ${cardTextPrimary}">${p.name}</h3>
                <p class="text-xs ${cardTextSecondary}">${p.description || 'Dịch vụ du lịch lữ hành, vé máy bay giá tốt, tư vấn chăm sóc khách hàng 24/7.'}</p>
              </div>
              <div class="mt-6 pt-4 border-t ${isLight ? 'border-slate-100' : 'border-gray-800'} flex justify-between items-center">
                <span class="text-sky-600 font-extrabold text-base">chỉ từ ${pPrice}đ</span>
                <${isDirectCheckout ? 'button' : 'a'} ${buttonAction} style="background-color: #0284c7;" class="px-4 py-2 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition">${btnLabel}</${isDirectCheckout ? 'button' : 'a'}>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </section>`;
        } else {
          html += `
  <section class="py-20 px-6 text-center${isMobileHidden}" style="background-color: ${bgCol}; color: ${txtCol};">
    <div class="max-w-4xl mx-auto space-y-6">
      <h2 class="text-3xl md:text-4xl font-bold">${block.title}</h2>
      <p class="opacity-90 text-sm max-w-2xl mx-auto">${block.subtitle || ''}</p>
      
      <div class="max-w-sm mx-auto rounded-2xl p-8 shadow-xl mt-8 relative overflow-hidden ${cardBg}">
        <div class="absolute top-0 right-0 px-3 py-1 bg-[#f25c22] text-xs font-bold text-white uppercase rounded-bl-lg">Phổ biến</div>
        <h3 class="text-xl font-bold ${cardTextPrimary}">Gói Ưu Đãi</h3>
        <p class="text-4xl font-extrabold mt-4 my-2 ${cardTextPrimary}">${block.priceVal || '499.000đ'}<span class="text-sm font-normal text-gray-500">/tháng</span></p>
        <p class="text-xs mt-2 ${cardTextMuted}">Truy cập toàn bộ tính năng tăng trưởng.</p>
        
        <ul class="text-left space-y-3 mt-6 text-sm ${cardTextSecondary}">
          <li class="flex items-center gap-2"><span class="${iconCheck}">✓</span> Viết bài chuẩn SEO bằng AI</li>
          <li class="flex items-center gap-2"><span class="${iconCheck}">✓</span> Quản lý bài đăng đa kênh</li>
          <li class="flex items-center gap-2"><span class="${iconCheck}">✓</span> Hệ thống Drip Email tự động</li>
          <li class="flex items-center gap-2"><span class="${iconCheck}">✓</span> Báo cáo Analytics nâng cao</li>
        </ul>
        
        <div class="pt-6">
          <${isDirectCheckout ? 'button' : 'a'} ${buttonActionHtml} style="background-color: ${btnBgCol};" class="block w-full py-3 hover:bg-[#d94d1a] text-white font-bold rounded-lg text-center cursor-pointer transition duration-200">
            ${block.buttonText || 'Mua ngay'}
          </${isDirectCheckout ? 'button' : 'a'}>
        </div>
      </div>
    </div>
  </section>`;
        }
      } else if (block.type === 'countdown') {
        html += `
  <section class="py-12 px-6 text-center${isMobileHidden}" style="background-color: ${block.backgroundColor || '#f8fafc'}; color: ${block.textColor || '#0f172a'};">
    <div class="max-w-4xl mx-auto space-y-4">
      <h2 class="text-2xl md:text-3xl font-bold">${block.title}</h2>
      <p class="text-gray-500 text-sm">${block.subtitle || ''}</p>
      <div class="flex justify-center gap-4 text-gray-900 font-mono mt-6" id="timer-${block.id}">
        <div class="bg-white border border-gray-200 rounded-lg p-4 min-w-[70px] shadow-sm">
          <span class="text-3xl font-extrabold block text-[#f25c22]" id="days-${block.id}">00</span>
          <span class="text-xs text-gray-400 uppercase">Ngày</span>
        </div>
        <div class="bg-white border border-gray-200 rounded-lg p-4 min-w-[70px] shadow-sm">
          <span class="text-3xl font-extrabold block text-[#f25c22]" id="hours-${block.id}">00</span>
          <span class="text-xs text-gray-400 uppercase">Giờ</span>
        </div>
        <div class="bg-white border border-gray-200 rounded-lg p-4 min-w-[70px] shadow-sm">
          <span class="text-3xl font-extrabold block text-[#f25c22]" id="mins-${block.id}">00</span>
          <span class="text-xs text-gray-400 uppercase">Phút</span>
        </div>
        <div class="bg-white border border-gray-200 rounded-lg p-4 min-w-[70px] shadow-sm">
          <span class="text-3xl font-extrabold block text-[#f25c22]" id="secs-${block.id}">00</span>
          <span class="text-xs text-gray-400 uppercase">Giây</span>
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
  <section class="py-20 px-6${isMobileHidden}" style="background-color: ${block.backgroundColor || '#f8fafc'}; color: ${block.textColor || '#0f172a'};">
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl font-bold text-center text-gray-900 mb-12">${block.title}</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        ${(block.reviews || []).map(r => `
        <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-md flex flex-col justify-between">
          <div class="space-y-4">
            <div class="text-[#f25c22] text-sm">
              ${'★'.repeat(r.rating || 5)}${'☆'.repeat(5 - (r.rating || 5))}
            </div>
            <p class="text-gray-600 italic text-sm leading-relaxed">"${r.quote}"</p>
          </div>
          <div class="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100">
            ${r.avatar ? `<img src="${r.avatar}" alt="${r.name}" class="w-10 h-10 rounded-full object-cover" />` : `
            <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-[#f25c22]">${r.name.charAt(0)}</div>`}
            <div>
              <h4 class="font-bold text-gray-900 text-sm">${r.name}</h4>
              <p class="text-xs text-gray-500">${r.role || ''}</p>
            </div>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </section>`;
      } else if (block.type === 'faq') {
        html += `
  <section class="py-20 px-6${isMobileHidden}" style="background-color: ${block.backgroundColor || '#ffffff'}; color: ${block.textColor || '#1e293b'};">
    <div class="max-w-3xl mx-auto">
      <h2 class="text-3xl font-bold text-center text-gray-900 mb-12">${block.title}</h2>
      <div class="space-y-4">
        ${(block.faqs || []).map((faq, index) => `
        <div class="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden accordion-item" id="faq-${block.id}-${index}">
          <button onclick="document.getElementById('faq-${block.id}-${index}').classList.toggle('active')" class="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-gray-100 transition">
            <span class="font-semibold text-gray-800 text-sm">${faq.question}</span>
            <span class="text-gray-500 font-bold transition transform accordion-arrow text-xs">▼</span>
          </button>
          <div class="accordion-content border-t border-gray-200">
            <div class="px-6 py-4 text-xs md:text-sm text-gray-600 leading-relaxed">${faq.answer}</div>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </section>`;
      } else if (block.type === 'footer') {
        html += `
  <footer class="py-12 px-6 border-t border-gray-100${isMobileHidden}" style="background-color: ${block.backgroundColor || '#f8fafc'}; color: ${block.textColor || '#4b5563'};">
    <div class="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
      <div class="text-center md:text-left">
        <h4 class="text-gray-800 font-bold text-lg">${block.title}</h4>
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
    <div class="bg-white border border-gray-200 rounded-xl p-8 max-w-md w-full relative">
      <button onclick="document.getElementById('checkout-modal').classList.add('hidden')" class="absolute top-4 right-4 text-gray-500 hover:text-gray-800 font-bold text-lg">&times;</button>
      <h3 class="text-2xl font-bold text-gray-900 text-center mb-2" id="modal-product-title">Thanh toán đơn hàng</h3>
      <p class="text-gray-500 text-xs text-center mb-6" id="modal-product-price">Số tiền cần thanh toán: ...</p>
      
      <form id="public-checkout-form" class="space-y-4">
        <input type="hidden" id="checkout-product-id" />
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Họ và Tên</label>
          <input type="text" id="checkout-name" required class="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-[#f25c22] placeholder-gray-400" placeholder="Nguyễn Văn A" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Địa chỉ Email</label>
          <input type="email" id="checkout-email" required class="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-[#f25c22] placeholder-gray-400" placeholder="name@email.com" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Số điện thoại</label>
          <input type="tel" id="checkout-phone" required class="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-[#f25c22] placeholder-gray-400" placeholder="0987654321" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Phương thức thanh toán</label>
          <select id="checkout-gateway" class="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-[#f25c22]">
            <option value="PAYOS">Chuyển khoản VietQR nhanh (PayOS)</option>
            <option value="SEPAY">Chuyển khoản VietQR tự động (SePay.vn)</option>
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

    if (popupEnabled) {
      const inactivityVal = popupInactivity || 0;
      html += `
  <!-- Smart Lead Generation Popup Modal -->
  <div id="behavioral-popup" class="fixed inset-0 z-50 flex items-center justify-center hidden bg-black bg-opacity-60 backdrop-filter backdrop-blur-sm transition-opacity duration-300">
    <div class="relative w-full max-w-md p-6 bg-white border border-gray-200 rounded-2xl shadow-2xl mx-4 transform scale-95 transition-transform duration-300">
      <!-- Close Button -->
      <button id="close-popup-btn" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
      <!-- Content -->
      <div class="text-center space-y-4">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#f25c22] bg-opacity-10 text-[#f25c22] mb-2">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
        </div>
        <h3 class="text-xl font-bold text-gray-900">${popupTitle || 'Đăng ký nhận quà tặng!'}</h3>
        <p class="text-xs text-gray-500 leading-relaxed">${popupDescription || ''}</p>
      </div>
      <!-- Lead capture form -->
      <form id="popup-lead-form" class="mt-6 space-y-4">
        <input type="hidden" id="popup-form-id-holder" value="${popupFormId || ''}" />
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Họ và Tên</label>
          <input type="text" id="popup-lead-name" placeholder="Nguyễn Văn A" class="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 text-xs placeholder-gray-400 focus:outline-none focus:border-[#f25c22] transition-colors" required />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Địa chỉ Email</label>
          <input type="email" id="popup-lead-email" placeholder="name@email.com" class="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 text-xs placeholder-gray-400 focus:outline-none focus:border-[#f25c22] transition-colors" required />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Số điện thoại</label>
          <input type="tel" id="popup-lead-phone" placeholder="0987654321" class="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 text-xs placeholder-gray-400 focus:outline-none focus:border-[#f25c22] transition-colors" required />
        </div>
        <div id="popup-form-message" class="hidden text-center text-xs font-semibold py-1"></div>
        <button type="submit" id="popup-submit-btn" class="w-full py-3 bg-[#f25c22] hover:bg-[#d94d1a] text-white font-bold rounded-lg transition duration-200 mt-2 shadow-md">
          Gửi thông tin đăng ký
        </button>
      </form>
    </div>
  </div>

  <script>
    (function() {
      const modal = document.getElementById('behavioral-popup');
      const closeBtn = document.getElementById('close-popup-btn');
      const form = document.getElementById('popup-lead-form');
      const msgText = document.getElementById('popup-form-message');
      const submitBtn = document.getElementById('popup-submit-btn');

      let popupShown = sessionStorage.getItem('behavioral_popup_shown') === 'true';

      function showPopup() {
        if (popupShown) return;
        popupShown = true;
        sessionStorage.setItem('behavioral_popup_shown', 'true');
        modal.classList.remove('hidden');
        setTimeout(() => {
          modal.querySelector('.transform').classList.remove('scale-95');
          modal.querySelector('.transform').classList.add('scale-100');
        }, 10);
      }

      function hidePopup() {
        modal.querySelector('.transform').classList.remove('scale-100');
        modal.querySelector('.transform').classList.add('scale-95');
        setTimeout(() => {
          modal.classList.add('hidden');
        }, 200);
      }

      if (closeBtn) {
        closeBtn.addEventListener('click', hidePopup);
      }

      modal.addEventListener('click', function(e) {
        if (e.target === modal) hidePopup();
      });

      // Triggers configuration
      const triggerExitIntent = ${popupExitIntent ? 'true' : 'false'};
      const scrollDepthTrigger = ${popupScrollDepth || 0};
      const inactivityTrigger = ${inactivityVal};

      // 1. Exit Intent Trigger
      if (triggerExitIntent) {
        document.addEventListener('mouseleave', function(e) {
          if (e.clientY < 50) {
            showPopup();
          }
        });
      }

      // 2. Scroll Depth Trigger
      if (scrollDepthTrigger > 0) {
        window.addEventListener('scroll', function() {
          const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
          if (totalHeight > 0) {
            const percentage = (window.scrollY / totalHeight) * 100;
            if (percentage >= scrollDepthTrigger) {
              showPopup();
            }
          }
        });
      }

      // 3. Inactivity Trigger
      if (inactivityTrigger > 0) {
        let idleTimer;
        function resetTimer() {
          clearTimeout(idleTimer);
          if (!popupShown) {
            idleTimer = setTimeout(showPopup, inactivityTrigger * 1000);
          }
        }
        
        ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(function(evt) {
          document.addEventListener(evt, resetTimer);
        });
        resetTimer();
      }

      // Submit lead captured
      if (form) {
        form.addEventListener('submit', async function(e) {
          e.preventDefault();
          const formId = document.getElementById('popup-form-id-holder').value;
          const name = document.getElementById('popup-lead-name').value;
          const email = document.getElementById('popup-lead-email').value;
          const phone = document.getElementById('popup-lead-phone').value;

          if (!formId) {
            msgText.className = 'text-center text-xs font-semibold py-1 text-red-500 block';
            msgText.innerText = 'Lỗi: Chưa cấu hình Custom Form cho popup.';
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
            if (res.ok) {
              msgText.className = 'text-center text-xs font-semibold py-1 text-green-500 block';
              msgText.innerText = result.message || 'Đăng ký thành công!';
              form.reset();
              setTimeout(hidePopup, 2000);
            } else {
              msgText.className = 'text-center text-xs font-semibold py-1 text-red-500 block';
              msgText.innerText = result.error || 'Gửi thất bại.';
            }
          } catch (err) {
            msgText.className = 'text-center text-xs font-semibold py-1 text-red-500 block';
            msgText.innerText = 'Lỗi kết nối máy chủ.';
          } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Gửi thông tin đăng ký';
          }
        });
      }
    })();
  </script>
`;
    }

    html += `
</body>
</html>`;
    return html;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const compiledHtml = compileHtml(blocks, seo, products);
      
      const layoutPayload = {
        blocks,
        seo,
        theme: aiTheme,
        useCase: useCase,
        popupConfig: {
          enabled: popupEnabled,
          exitIntent: popupExitIntent,
          scrollDepth: popupScrollDepth,
          inactivity: popupInactivity,
          title: popupTitle,
          description: popupDescription,
          formId: popupFormId
        }
      };

      // Update Landing Page
      await apiJson(`/landing-pages/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: page?.title,
          slug: page?.slug,
          layoutJson: JSON.stringify(layoutPayload),
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
        backgroundColor: '#ffffff',
        textColor: '#0f172a',
      };
    } else if (type === 'features') {
      newBlock = {
        id: `block-${Date.now()}`,
        type: 'features',
        title: 'Tính Năng Độc Đáo',
        items: ['Tính năng 1', 'Tính năng 2', 'Tính năng 3'],
        backgroundColor: '#f1f5f9',
        textColor: '#1e293b',
      };
    } else if (type === 'form') {
      newBlock = {
        id: `block-${Date.now()}`,
        type: 'form',
        title: 'Đăng Ký Nhận Tư Vấn Miễn Phí',
        subtitle: 'Chúng tôi sẽ gọi lại hỗ trợ bạn trong vòng 10 phút.',
        backgroundColor: '#ffffff',
        textColor: '#1e293b',
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
        backgroundColor: '#ffffff',
        textColor: '#0f172a',
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
        backgroundColor: '#f8fafc',
        textColor: '#1e293b',
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
        backgroundColor: '#f8fafc',
        textColor: '#0f172a',
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
        backgroundColor: '#ffffff',
        textColor: '#1e293b',
      };
    } else {
      newBlock = {
        id: `block-${Date.now()}`,
        type: 'footer',
        title: page?.title || 'Growth OS',
        subtitle: 'Bảo lưu mọi quyền.',
        backgroundColor: '#f8fafc',
        textColor: '#4b5563',
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

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === blocks.length - 1) return;
    const nextIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...blocks];
    const temp = updated[index];
    updated[index] = updated[nextIdx];
    updated[nextIdx] = temp;
    setBlocks(updated);
  };

  const duplicateBlock = (blockId: string) => {
    const targetIdx = blocks.findIndex(b => b.id === blockId);
    if (targetIdx === -1) return;
    const target = blocks[targetIdx];
    const duplicated: PageBlock = {
      ...target,
      id: `block-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: `${target.title} (Bản sao)`,
    };
    const updated = [...blocks];
    updated.splice(targetIdx + 1, 0, duplicated);
    setBlocks(updated);
    setSelectedBlockId(duplicated.id);
  };

  const handleDragStart = (index: number) => {
    setDraggedIdx(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIdx(index);
  };

  const handleDrop = (index: number) => {
    if (draggedIdx === null || draggedIdx === index) return;
    const updated = [...blocks];
    const draggedBlock = updated[draggedIdx];
    updated.splice(draggedIdx, 1);
    updated.splice(index, 0, draggedBlock);
    setBlocks(updated);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const renderEditableText = (
    block: PageBlock,
    field: keyof PageBlock,
    text: string,
    className: string,
    nestedIndex?: number,
    nestedField?: string
  ) => {
    return (
      <span
        contentEditable
        suppressContentEditableWarning
        className={`${className} outline-none focus:ring-2 focus:ring-[#f25c22] focus:bg-orange-500/10 rounded px-1 transition-all cursor-text`}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onBlur={(e) => {
          const newText = e.currentTarget.innerText;
          if (newText === text) return;
          
          const updated = { ...block };
          if (nestedIndex !== undefined) {
            if (field === 'items' && Array.isArray(updated.items)) {
              const newItems = [...updated.items];
              newItems[nestedIndex] = newText;
              updated.items = newItems;
            } else if (field === 'reviews' && Array.isArray(updated.reviews) && nestedField) {
              const newReviews = [...updated.reviews];
              newReviews[nestedIndex] = {
                ...newReviews[nestedIndex],
                [nestedField]: newText
              };
              updated.reviews = newReviews;
            } else if (field === 'faqs' && Array.isArray(updated.faqs) && nestedField) {
              const newFaqs = [...updated.faqs];
              newFaqs[nestedIndex] = {
                ...newFaqs[nestedIndex],
                [nestedField]: newText
              };
              updated.faqs = newFaqs;
            }
          } else {
            (updated as any)[field] = newText;
          }
          updateBlock(updated);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      >
        {text}
      </span>
    );
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
        body: JSON.stringify({ 
          prompt: aiPromptInput,
          theme: aiTheme,
          useCase: useCase
        })
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
    <div className="flex h-[calc(100vh-140px)] min-h-[550px] bg-white text-slate-800 overflow-hidden rounded-xl border border-slate-200 shadow-xl">
      {/* Sidebar - Controls */}
      <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col justify-between shrink-0">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Main Title & Back */}
          <div className="p-4 border-b border-slate-200 flex justify-between items-center shrink-0">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Trình Thiết Kế</h3>
              <p className="text-slate-500 text-xs truncate max-w-[120px]">{page?.title || 'Loading...'}</p>
            </div>
            <Link href="/dashboard/landing" className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-lg transition duration-200 shadow border border-slate-200 flex items-center gap-1">
              ← Quay lại
            </Link>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 shrink-0">
            <button
              onClick={() => setActiveTab('blocks')}
              className={`flex-1 py-2.5 text-center text-xs font-bold transition ${activeTab === 'blocks' ? 'border-b-2 border-[#f25c22] text-[#f25c22] bg-orange-50/30' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Thành phần
            </button>
            <button
              onClick={() => setActiveTab('seo')}
              className={`flex-1 py-2.5 text-center text-xs font-bold transition ${activeTab === 'seo' ? 'border-b-2 border-[#f25c22] text-[#f25c22] bg-orange-50/30' : 'text-slate-500 hover:text-slate-800'}`}
            >
              SEO & Card
            </button>
            <button
              onClick={() => setActiveTab('popups')}
              className={`flex-1 py-2.5 text-center text-xs font-bold transition ${activeTab === 'popups' ? 'border-b-2 border-[#f25c22] text-[#f25c22] bg-orange-50/30' : 'text-slate-500 hover:text-slate-800'}`}
            >
              ✨ Popups
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 py-2.5 text-center text-xs font-bold transition ${activeTab === 'ai' ? 'border-b-2 border-[#f25c22] text-[#f25c22] bg-orange-50/30' : 'text-slate-500 hover:text-slate-800'}`}
            >
              🤖 Thiết kế AI
            </button>
          </div>

          {/* Scrollable Content Pane */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {/* Tab 1: Blocks builder */}
            {activeTab === 'blocks' && (
              <>
                {selectedBlock ? (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setSelectedBlockId(null)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-[#f25c22] text-xs font-bold rounded-lg border border-slate-200 transition shadow-sm"
                    >
                      ← Quay lại Cấu trúc trang
                    </button>
                    
                    <div className="pt-2 space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#f25c22] flex items-center gap-1">
                          ⚙️ Cấu hình {selectedBlock.type === 'hero' ? 'Banner' : selectedBlock.type === 'features' ? 'Lợi ích' : selectedBlock.type === 'form' ? 'Biểu mẫu' : selectedBlock.type === 'pricing' ? 'Bảng giá' : selectedBlock.type === 'countdown' ? 'Đếm ngược' : selectedBlock.type === 'testimonials' ? 'Đánh giá' : selectedBlock.type === 'faq' ? 'FAQ' : selectedBlock.type}
                        </h4>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            id="block-hidden-mobile"
                            checked={!!selectedBlock.hiddenOnMobile}
                            onChange={(e) => updateBlock({ ...selectedBlock, hiddenOnMobile: e.target.checked })}
                            className="rounded border-slate-200 bg-white text-[#f25c22] focus:ring-0 w-3.5 h-3.5"
                          />
                          <label htmlFor="block-hidden-mobile" className="text-[10px] text-slate-500 font-bold uppercase cursor-pointer select-none">Ẩn trên Mobile</label>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-500 font-semibold">Tiêu đề</label>
                        <input
                          type="text"
                          value={selectedBlock.title}
                          onChange={(e) => updateBlock({ ...selectedBlock, title: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]"
                        />
                      </div>

                      {/* Subtitle / Description */}
                      {(selectedBlock.type === 'hero' || selectedBlock.type === 'form' || selectedBlock.type === 'pricing' || selectedBlock.type === 'footer' || selectedBlock.type === 'countdown') && (
                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-550 font-semibold">Mô tả phụ</label>
                          <textarea
                            value={selectedBlock.subtitle || ''}
                            onChange={(e) => updateBlock({ ...selectedBlock, subtitle: e.target.value })}
                            rows={3}
                            className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]"
                          />
                        </div>
                      )}

                      {/* Button Text & Button Link */}
                      {(selectedBlock.type === 'hero' || selectedBlock.type === 'pricing') && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[11px] text-slate-555 font-semibold">Chữ trên nút</label>
                              <input
                                type="text"
                                value={selectedBlock.buttonText || ''}
                                onChange={(e) => updateBlock({ ...selectedBlock, buttonText: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-slate-555 font-semibold">Đường dẫn nút</label>
                              <input
                                type="text"
                                disabled={!!selectedBlock.productId}
                                value={selectedBlock.productId ? 'Thanh toán trực tiếp' : (selectedBlock.buttonLink || '')}
                                onChange={(e) => updateBlock({ ...selectedBlock, buttonLink: e.target.value })}
                                placeholder="#register-form"
                                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22] disabled:opacity-50"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {/* Image URL & Alignment for Hero block */}
                      {selectedBlock.type === 'hero' && (
                        <>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-550 font-semibold">Đường dẫn hình ảnh (URL)</label>
                            <input
                              type="text"
                              value={selectedBlock.imageUrl || ''}
                              onChange={(e) => updateBlock({ ...selectedBlock, imageUrl: e.target.value })}
                              placeholder="https://example.com/image.png"
                              className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]"
                            />
                            {/* Suggested Images */}
                            <div className="pt-1.5 space-y-1">
                              <label className="text-[9px] text-slate-400 uppercase font-bold">Ảnh gợi ý mẫu:</label>
                              <div className="grid grid-cols-4 gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateBlock({ ...selectedBlock, imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&auto=format&fit=crop&q=80' })}
                                  className="h-8 bg-white border border-slate-200 hover:border-[#f25c22] rounded overflow-hidden"
                                  title="Honey Jar"
                                >
                                  <img src="https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=100&auto=format&fit=crop&q=80" className="object-cover w-full h-full" alt="honey" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateBlock({ ...selectedBlock, imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60' })}
                                  className="h-8 bg-white border border-slate-200 hover:border-[#f25c22] rounded overflow-hidden"
                                  title="SaaS Chart"
                                >
                                  <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=100&auto=format&fit=crop&q=60" className="object-cover w-full h-full" alt="suggested 1" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateBlock({ ...selectedBlock, imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=60' })}
                                  className="h-8 bg-white border border-slate-200 hover:border-[#f25c22] rounded overflow-hidden"
                                  title="Dashboard Layout"
                                >
                                  <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=100&auto=format&fit=crop&q=60" className="object-cover w-full h-full" alt="suggested 2" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateBlock({ ...selectedBlock, imageUrl: '' })}
                                  className="h-8 bg-white border border-slate-200 hover:border-rose-500 rounded text-[9px] text-slate-500 font-semibold"
                                >
                                  Xóa ảnh
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-550 font-semibold">Vị trí ảnh</label>
                            <select
                              value={selectedBlock.imageAlignment || 'right'}
                              onChange={(e) => updateBlock({ ...selectedBlock, imageAlignment: e.target.value as any })}
                              className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]"
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
                            <label className="text-[11px] text-slate-550 font-semibold">Giá trị hiển thị</label>
                            <input
                              type="text"
                              value={selectedBlock.priceVal || ''}
                              onChange={(e) => updateBlock({ ...selectedBlock, priceVal: e.target.value })}
                              placeholder="499.000đ"
                              className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-550 font-semibold">Mua nhanh & Thanh toán trực tiếp</label>
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
                              className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]"
                            >
                              <option value="">-- Dùng liên kết thường (Không checkout) --</option>
                              {products.map(p => (
                                <option key={p.id} value={String(p.id)}>{p.name} ({p.price.toLocaleString('vi-VN')} {p.currency})</option>
                              ))}
                            </select>
                          </div>
                          {selectedBlock.productId && (
                            <div className="space-y-1">
                              <label className="text-[11px] text-slate-550 font-semibold">Cổng thanh toán mặc định</label>
                              <select
                                value={selectedBlock.paymentMethod || 'PAYOS'}
                                onChange={(e) => updateBlock({ ...selectedBlock, paymentMethod: e.target.value as any })}
                                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-850 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]"
                              >
                                <option value="PAYOS">VietQR chuyển khoản nhanh (PayOS)</option>
                                <option value="SEPAY">VietQR đối soát tự động (SePay.vn)</option>
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
                            <label className="text-[11px] text-slate-550 font-semibold">Liên kết Custom Form</label>
                            <select
                              value={selectedBlock.formId || ''}
                              onChange={(e) => updateBlock({ ...selectedBlock, formId: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-850 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]"
                            >
                              <option value="">-- Chọn form thu lead --</option>
                              {forms.map(f => (
                                <option key={f.id} value={String(f.id)}>{f.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-550 font-semibold">Kích hoạt Email Drip Workflow</label>
                            <select
                              value={selectedBlock.workflowId || ''}
                              onChange={(e) => updateBlock({ ...selectedBlock, workflowId: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-855 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]"
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
                          <label className="text-[11px] text-slate-555 font-semibold">Các mục lợi ích</label>
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
                              className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]"
                            />
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const newItems = [...(selectedBlock.items || []), 'Lợi ích mới'];
                              updateBlock({ ...selectedBlock, items: newItems });
                            }}
                            className="w-full py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] text-slate-700 rounded font-semibold transition"
                          >
                            + Thêm mục lợi ích
                          </button>
                        </div>
                      )}

                      {/* Countdown block Settings (Use Case 6) */}
                      {selectedBlock.type === 'countdown' && (
                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-550 font-semibold">Hạn đếm ngược (End Date)</label>
                          <input
                            type="datetime-local"
                            value={selectedBlock.countdownEnd || ''}
                            onChange={(e) => updateBlock({ ...selectedBlock, countdownEnd: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]"
                          />
                        </div>
                      )}

                      {/* Testimonials block Settings (Use Case 6) */}
                      {selectedBlock.type === 'testimonials' && (
                        <div className="space-y-4">
                          <label className="text-[11px] text-slate-550 font-bold">Danh sách Đánh giá</label>
                          {(selectedBlock.reviews || []).map((r, idx) => (
                            <div key={idx} className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-2 relative">
                              <button
                                type="button"
                                onClick={() => {
                                  const newReviews = (selectedBlock.reviews || []).filter((_, i) => i !== idx);
                                  updateBlock({ ...selectedBlock, reviews: newReviews });
                                }}
                                className="absolute top-1 right-2 text-rose-500 hover:text-rose-600 text-[10px] font-bold"
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
                                  className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none"
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
                                  className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none"
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
                                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none"
                              />
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 font-semibold">Đánh giá (1-5 sao):</span>
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
                                  className="w-12 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-800 focus:outline-none"
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
                            className="w-full py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] text-slate-700 rounded font-semibold transition"
                          >
                            + Thêm đánh giá mới
                          </button>
                        </div>
                      )}

                      {/* FAQ block Settings (Use Case 6) */}
                      {selectedBlock.type === 'faq' && (
                        <div className="space-y-4">
                          <label className="text-[11px] text-slate-550 font-bold">Danh sách FAQ</label>
                          {(selectedBlock.faqs || []).map((faq, idx) => (
                            <div key={idx} className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-2 relative">
                              <button
                                type="button"
                                onClick={() => {
                                  const newFaqs = (selectedBlock.faqs || []).filter((_, i) => i !== idx);
                                  updateBlock({ ...selectedBlock, faqs: newFaqs });
                                }}
                                className="absolute top-1 right-2 text-rose-500 hover:text-rose-600 text-[10px] font-bold"
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
                                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none"
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
                                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none"
                              />
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const newFaqs = [...(selectedBlock.faqs || []), { question: 'Câu hỏi của khách?', answer: 'Nhập câu trả lời giải đáp thắc mắc.' }];
                              updateBlock({ ...selectedBlock, faqs: newFaqs });
                            }}
                            className="w-full py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] text-slate-700 rounded font-semibold transition"
                          >
                            + Thêm câu hỏi mới
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-500 font-semibold">Màu nền</label>
                          <input
                            type="color"
                            value={selectedBlock.backgroundColor || '#0f172a'}
                            onChange={(e) => updateBlock({ ...selectedBlock, backgroundColor: e.target.value })}
                            className="w-full bg-transparent border-0 h-8 cursor-pointer rounded"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-500 font-semibold">Màu chữ</label>
                          <input
                            type="color"
                            value={selectedBlock.textColor || '#ffffff'}
                            onChange={(e) => updateBlock({ ...selectedBlock, textColor: e.target.value })}
                            className="w-full bg-transparent border-0 h-8 cursor-pointer rounded"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Add Blocks */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Thêm khối mới</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => addBlock('hero')} className="bg-white border border-slate-200 hover:border-[#f25c22] rounded p-2 text-center text-xs text-slate-700 hover:text-slate-900 transition shadow-sm animate-in fade-in duration-200">
                          Banner (Hero)
                        </button>
                        <button onClick={() => addBlock('features')} className="bg-white border border-slate-200 hover:border-[#f25c22] rounded p-2 text-center text-xs text-slate-700 hover:text-slate-900 transition shadow-sm animate-in fade-in duration-200">
                          Lợi ích (Features)
                        </button>
                        <button onClick={() => addBlock('form')} className="bg-white border border-slate-200 hover:border-[#f25c22] rounded p-2 text-center text-xs text-slate-700 hover:text-slate-900 transition shadow-sm animate-in fade-in duration-200">
                          Biểu mẫu (Form)
                        </button>
                        <button onClick={() => addBlock('pricing')} className="bg-white border border-slate-200 hover:border-[#f25c22] rounded p-2 text-center text-xs text-slate-700 hover:text-slate-900 transition shadow-sm animate-in fade-in duration-200">
                          Bảng giá (Pricing)
                        </button>
                        <button onClick={() => addBlock('countdown')} className="bg-white border border-slate-200 hover:border-[#f25c22] rounded p-2 text-center text-xs text-slate-700 hover:text-slate-900 transition shadow-sm animate-in fade-in duration-200">
                          ⏳ Đếm ngược
                        </button>
                        <button onClick={() => addBlock('testimonials')} className="bg-white border border-slate-200 hover:border-[#f25c22] rounded p-2 text-center text-xs text-slate-700 hover:text-slate-900 transition shadow-sm animate-in fade-in duration-200">
                          ★ Đánh giá
                        </button>
                        <button onClick={() => addBlock('faq')} className="bg-white border border-slate-200 hover:border-[#f25c22] rounded p-2 text-center text-xs text-slate-700 hover:text-slate-900 transition shadow-sm animate-in fade-in duration-200">
                          ❓ Câu hỏi FAQ
                        </button>
                        <button onClick={() => addBlock('footer')} className="bg-white border border-slate-200 hover:border-[#f25c22] rounded p-2 text-center text-xs text-slate-700 hover:text-slate-900 transition shadow-sm animate-in fade-in duration-200">
                          Chân trang (Footer)
                        </button>
                      </div>
                    </div>

                    {/* Block List / Navigation */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Cấu trúc trang</label>
                      {blocks.length === 0 ? (
                        <p className="text-slate-400 text-xs text-center py-4">Trang chưa có khối nào.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {blocks.map((block, index) => (
                            <div
                              key={block.id}
                              draggable
                              onDragStart={() => handleDragStart(index)}
                              onDragOver={(e) => handleDragOver(e, index)}
                              onDrop={() => handleDrop(index)}
                              onDragEnd={() => {
                                setDraggedIdx(null);
                                setDragOverIdx(null);
                              }}
                              onClick={() => setSelectedBlockId(block.id)}
                              className={`flex justify-between items-center px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing transition ${selectedBlockId === block.id ? 'bg-orange-50 border-[#f25c22] text-[#f25c22]' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'} ${draggedIdx === index ? 'opacity-40 border-dashed border-[#f25c22]' : ''}`}
                            >
                              <div className="flex items-center gap-1.5 overflow-hidden">
                                <span className="text-slate-400 select-none text-xs font-mono">⋮⋮</span>
                                <span className="text-xs font-medium capitalize truncate">
                                  {index + 1}. {block.type === 'countdown' ? 'Đếm ngược' : block.type === 'testimonials' ? 'Đánh giá' : block.type === 'faq' ? 'FAQ' : block.type}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={(e) => { e.stopPropagation(); moveBlock(index, 'up'); }}
                                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-500 hover:text-slate-900"
                                  title="Di chuyển lên"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  disabled={index === blocks.length - 1}
                                  onClick={(e) => { e.stopPropagation(); moveBlock(index, 'down'); }}
                                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-500 hover:text-slate-900"
                                  title="Di chuyển xuống"
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
                                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition"
                                  title="Xóa khối"
                                >
                                  &times;
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {/* Tab 2: SEO configuration (Use Case 5) */}
            {activeTab === 'seo' && (
              <div className="space-y-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#f25c22]">SEO & Social Card Meta</h4>

                {/* Bác sĩ SEO AI Section */}
                <div className="bg-slate-100/60 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        ✨ Bác sĩ SEO AI
                      </h5>
                      <p className="text-[10px] text-slate-550 mt-0.5">
                        Tự động rà soát, phát hiện lỗi SEO và đề xuất tối ưu bằng trí tuệ nhân tạo.
                      </p>
                    </div>
                  </div>

                  {loadingSeoRecommendation ? (
                    <div className="flex items-center justify-center py-4 text-xs text-slate-550 gap-2 font-medium">
                      <svg className="animate-spin h-4 w-4 text-[#f25c22]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      Đang phân tích và viết lại cấu hình tối ưu...
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSeoDoctor}
                      className="w-full py-2 bg-slate-100 hover:bg-[#f25c22] text-slate-800 hover:text-white font-bold text-xs rounded-lg transition duration-200 shadow border border-slate-200 hover:border-transparent flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      🩺 Khám bệnh & Tối ưu SEO bằng AI
                    </button>
                  )}

                  {seoDoctorOpen && seoRecommendations && (
                    <div className="bg-white border border-slate-200 shadow-lg rounded-lg p-3.5 space-y-3 mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <h6 className="text-[11px] font-bold text-[#f25c22] uppercase tracking-wider">
                        Đề xuất tối ưu từ Bác sĩ AI:
                      </h6>
                      
                      <div className="space-y-2.5 text-left text-xs">
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-slate-500 font-bold block">TIÊU ĐỀ GỢI Ý (META TITLE)</span>
                          <span className="text-slate-900 font-semibold block">{seoRecommendations.title}</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-slate-500 font-bold block">MÔ TẢ GỢI Ý (META DESCRIPTION)</span>
                          <span className="text-slate-700 leading-relaxed block">{seoRecommendations.description}</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-slate-500 font-bold block">TỪ KHÓA GỢI Ý (META KEYWORDS)</span>
                          <span className="text-slate-600 font-mono block">{seoRecommendations.keywords}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={applySeoRecommendations}
                          className="flex-1 py-1.5 bg-[#f25c22] hover:bg-[#d94d1a] text-white text-[11px] font-bold rounded transition-colors"
                        >
                          Áp dụng gợi ý
                        </button>
                        <button
                          type="button"
                          onClick={() => setSeoDoctorOpen(false)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-[11px] font-medium rounded border border-slate-200 transition-colors"
                        >
                          Bỏ qua
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-550 font-semibold">Meta Title (Tiêu đề trang)</label>
                  <input
                    type="text"
                    value={seo.title}
                    onChange={(e) => setSeo({ ...seo, title: e.target.value })}
                    placeholder="Growth OS — Phần mềm tăng trưởng traffic tự động"
                    className="w-full bg-white border border-slate-250 rounded px-2.5 py-1.5 text-xs text-slate-850 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-550 font-semibold">Meta Description (Mô tả trang)</label>
                  <textarea
                    value={seo.description}
                    onChange={(e) => setSeo({ ...seo, description: e.target.value })}
                    placeholder="Mô tả tóm tắt nội dung trang giúp đạt thứ hạng cao trên Google..."
                    rows={3}
                    className="w-full bg-white border border-slate-250 rounded px-2.5 py-1.5 text-xs text-slate-855 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-550 font-semibold">Share Image (og:image URL)</label>
                  <input
                    type="text"
                    value={seo.ogImage}
                    onChange={(e) => setSeo({ ...seo, ogImage: e.target.value })}
                    placeholder="https://example.com/thumbnail.png"
                    className="w-full bg-white border border-slate-250 rounded px-2.5 py-1.5 text-xs text-slate-850 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-550 font-semibold">Từ khóa SEO (ngăn cách bởi dấu phẩy)</label>
                  <input
                    type="text"
                    value={seo.keywords}
                    onChange={(e) => setSeo({ ...seo, keywords: e.target.value })}
                    placeholder="seo, chatbot ai, leads automation"
                    className="w-full bg-white border border-slate-250 rounded px-2.5 py-1.5 text-xs text-slate-850 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]"
                  />
                </div>

                {/* Live Social Card Preview */}
                <div className="border-t border-slate-200 pt-5 space-y-3">
                  <label className="text-[10px] font-bold text-slate-550 uppercase tracking-wider block">Bản xem trước chia sẻ mạng xã hội (Facebook/Zalo)</label>
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    {seo.ogImage && (
                      <div className="h-36 overflow-hidden">
                        <img src={seo.ogImage} alt="Social Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">DOMAINDEMO.COM</span>
                      <h5 className="text-slate-900 font-bold text-sm truncate">{seo.title || 'Tiêu đề trang khi chia sẻ'}</h5>
                      <p className="text-slate-655 text-xs line-clamp-2 leading-relaxed">{seo.description || 'Mô tả tóm tắt nội dung Landing Page khi gửi qua tin nhắn Zalo, Facebook...'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Behavioral Popups Settings */}
            {activeTab === 'popups' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between bg-slate-100/60 p-4 rounded-xl border border-slate-200">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">
                      💡 Kích hoạt Smart Popup
                    </h3>
                    <p className="text-[10px] text-slate-550 mt-1">
                      Hiển thị hộp thoại thu thập thông tin khách hàng dựa trên hành vi.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={popupEnabled}
                    onChange={(e) => setPopupEnabled(e.target.checked)}
                    className="w-5 h-5 accent-[#f25c22] rounded cursor-pointer shrink-0"
                  />
                </div>

                {popupEnabled && (
                  <div className="space-y-4">
                    {/* Form Linkage */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-550 font-bold uppercase tracking-wider block">
                        Liên kết Biểu mẫu (Custom Form) <span className="text-[#f25c22]">*</span>
                      </label>
                      <select
                        value={popupFormId}
                        onChange={(e) => setPopupFormId(e.target.value)}
                        className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-2 text-xs text-slate-850 focus:outline-none focus:border-[#f25c22] transition-colors"
                      >
                        <option value="">-- Chọn Biểu mẫu đăng ký --</option>
                        {forms.map(form => (
                          <option key={form.id} value={form.id}>
                            {form.name}
                          </option>
                        ))}
                      </select>
                      {!popupFormId && (
                        <p className="text-[10px] text-amber-600 font-semibold leading-relaxed">
                          ⚠️ Vui lòng liên kết biểu mẫu để lưu dữ liệu đăng ký vào danh sách khách hàng CRM.
                        </p>
                      )}
                    </div>

                    {/* Content settings */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-550 font-bold uppercase tracking-wider block">
                        Tiêu đề Popup
                      </label>
                      <input
                        type="text"
                        value={popupTitle}
                        onChange={(e) => setPopupTitle(e.target.value)}
                        className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-2 text-xs text-slate-850 focus:outline-none focus:border-[#f25c22]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-550 font-bold uppercase tracking-wider block">
                        Mô tả ngắn
                      </label>
                      <textarea
                        value={popupDescription}
                        onChange={(e) => setPopupDescription(e.target.value)}
                        rows={3}
                        className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-2 text-xs text-slate-855 focus:outline-none focus:border-[#f25c22] resize-none"
                      />
                    </div>

                    {/* Behavior Triggers */}
                    <div className="border-t border-slate-200 pt-4 space-y-4">
                      <h4 className="text-xs font-bold text-slate-850 uppercase tracking-wider flex items-center gap-1.5">
                        ⚙️ Thiết lập hành vi kích hoạt
                      </h4>

                      <div className="flex items-center justify-between py-1">
                        <label className="text-xs text-slate-600 cursor-pointer select-none" htmlFor="exitIntentCheck">
                          Kích hoạt khi rê chuột ra ngoài (Exit-Intent)
                        </label>
                        <input
                          id="exitIntentCheck"
                          type="checkbox"
                          checked={popupExitIntent}
                          onChange={(e) => setPopupExitIntent(e.target.checked)}
                          className="w-4 h-4 accent-[#f25c22] rounded cursor-pointer"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-xs text-slate-600">
                            Kích hoạt khi cuộn trang đạt (%)
                          </label>
                          <span className="text-xs font-bold text-[#f25c22]">{popupScrollDepth}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={popupScrollDepth}
                          onChange={(e) => setPopupScrollDepth(parseInt(e.target.value))}
                          className="w-full accent-[#f25c22] cursor-pointer"
                        />
                        <span className="text-[10px] text-slate-500 block">
                          * Chọn 0% để tắt điều kiện cuộn trang.
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-xs text-slate-600">
                            Kích hoạt sau thời gian không tương tác (giây)
                          </label>
                          <span className="text-xs font-bold text-[#f25c22]">
                            {popupInactivity === 0 ? 'Tắt' : `${popupInactivity} giây`}
                          </span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max="300"
                          value={popupInactivity}
                          onChange={(e) => setPopupInactivity(parseInt(e.target.value) || 0)}
                          className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-2 text-xs text-slate-850 focus:outline-none focus:border-[#f25c22]"
                        />
                        <span className="text-[10px] text-slate-500 block">
                          * Chọn 0 để tắt điều kiện thời gian không tương tác.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: AI Assistant Generator (Use Case 3) */}
            {activeTab === 'ai' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#f25c22] flex items-center gap-1">
                    🤖 Thiết kế Landing Page bằng AI
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                    Nhập ý tưởng sản phẩm/dịch vụ của bạn, trợ lý AI sẽ tự động lên bố cục các khối, tạo tiêu đề kích thích mua hàng và viết nội dung tối ưu.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-550 font-bold uppercase">Giao diện / Màu sắc (Theme)</label>
                    <select
                      value={aiTheme}
                      onChange={(e) => setAiTheme(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]"
                    >
                      <option value="ocean-breeze">Ocean Breeze (Xanh biển dịu)</option>
                      <option value="sunny-meadow">Sunny Meadow (Xanh lá cỏ)</option>
                      <option value="sunset-glow">Sunset Glow (Cam hoàng hôn)</option>
                      <option value="vibrant-orchid">Vibrant Orchid (Tím phong lan)</option>
                      <option value="minimalist-light">Minimalist Light (Sáng tối giản)</option>
                      <option value="sale-theme">🍅 Cô Thảo Tôm Cá (Ấm cúng, Thực phẩm)</option>
                      <option value="education-theme">🧡 F8 (Học trực tuyến, Đào tạo)</option>
                      <option value="saleticket-theme">✈️ HappyBook Travel (Bán vé, Du lịch)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-550 font-bold uppercase">Mục đích trang (Use Case)</label>
                    <select
                      value={useCase}
                      onChange={(e) => setUseCase(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22]"
                    >
                      <option value="saas">SaaS / Phần mềm & Dịch vụ số</option>
                      <option value="course">Khóa học / Đào tạo trực tuyến / E-book</option>
                      <option value="ecommerce">Bán hàng / Thương mại điện tử (E-commerce)</option>
                      <option value="service">Dịch vụ (Spa, Yoga, Phòng khám, Agency...)</option>
                      <option value="event">Sự kiện / Hội thảo trực tuyến (Webinar)</option>
                      <option value="sale-theme">🍅 Bán hàng / Ẩm thực / Hải sản (cothaotomca.vn)</option>
                      <option value="education-theme">🧡 Học lập trình / Đào tạo trực tuyến (f8.edu.vn)</option>
                      <option value="saleticket-theme">✈️ Bán vé máy bay / Đặt tour du lịch (happybooktravel.com)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <textarea
                    value={aiPromptInput}
                    onChange={(e) => setAiPromptInput(e.target.value)}
                    placeholder="Ví dụ: Thiết kế landing page bán khóa học tiếng Anh giao tiếp cho người đi làm bận rộn, cam kết đầu ra trong 6 tháng, gói học phí 1.2 triệu/tháng..."
                    rows={6}
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:border-[#f25c22] focus:ring-1 focus:ring-[#f25c22] leading-relaxed"
                  />
                  <button
                    onClick={handleGenerateAiLayout}
                    disabled={aiGenerating}
                    className="w-full py-2.5 bg-[#f25c22] hover:bg-[#d94d1a] disabled:bg-slate-300 text-white font-bold rounded-lg text-xs transition shadow-md flex justify-center items-center gap-2"
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
                <div className="border-t border-slate-200 pt-4 space-y-2">
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Gợi ý nhanh ý tưởng mẫu:</label>
                  <div className="space-y-1.5">
                    <button
                      onClick={() => {
                        setAiPromptInput('Thiết kế landing page giới thiệu phần mềm CRM tự động hóa chăm sóc khách hàng đa kênh cho doanh nghiệp nhỏ (SaaS).');
                        setAiTheme('ocean-breeze');
                        setUseCase('saas');
                      }}
                      className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded p-2 text-left text-[11px] text-slate-600 hover:text-slate-800 transition shadow-2xs"
                    >
                      💡 Phần mềm SaaS CRM
                    </button>
                    <button
                      onClick={() => {
                        setAiPromptInput('Tạo landing page bán mật ong rừng nguyên chất Tây Bắc, cam kết chất lượng, hoàn tiền nếu giả, giao hàng miễn phí toàn quốc.');
                        setAiTheme('sale-theme');
                        setUseCase('sale-theme');
                      }}
                      className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded p-2 text-left text-[11px] text-slate-600 hover:text-slate-800 transition shadow-2xs"
                    >
                      💡 Bán sản phẩm Nông sản/Mật ong
                    </button>
                    <button
                      onClick={() => {
                        setAiPromptInput('Tạo landing page cho trung tâm Yoga & Thiền tại nhà, lớp học thử miễn phí buổi đầu tiên, cải thiện sức khỏe tinh thần.');
                        setAiTheme('sunset-glow');
                        setUseCase('service');
                      }}
                      className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded p-2 text-left text-[11px] text-slate-600 hover:text-slate-800 transition shadow-2xs"
                    >
                      💡 Trung tâm Yoga & Thiền
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Save Bar */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between gap-3 shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 bg-[#f25c22] hover:bg-[#d94d1a] disabled:bg-slate-350 text-white font-bold rounded-lg text-sm transition shadow-md flex justify-center items-center gap-2"
            >
              {saving ? (
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
              ) : 'Lưu thiết kế'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas - Preview */}
      <div className="flex-1 bg-slate-100 flex flex-col overflow-hidden relative">
        {/* Top bar info & Responsive Switcher (Use Case 4) */}
        <div className="h-14 bg-slate-50 border-b border-slate-200 px-6 flex justify-between items-center shrink-0">
          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Giao diện trực quan (Visual Canvas Preview)
          </h4>
          
          {/* Responsive device buttons */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setDevice('desktop')}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${device === 'desktop' ? 'bg-[#f25c22] text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}
            >
              🖥️ Desktop
            </button>
            <button
              onClick={() => setDevice('tablet')}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${device === 'tablet' ? 'bg-[#f25c22] text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}
            >
              📱 Tablet
            </button>
            <button
              onClick={() => setDevice('mobile')}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${device === 'mobile' ? 'bg-[#f25c22] text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}
            >
              📞 Mobile
            </button>
          </div>
        </div>

        {/* Display messages */}
        <div className="absolute top-16 left-6 right-6 z-10 space-y-2">
          {success && (
            <div className="p-3.5 bg-emerald-500/95 text-white font-medium rounded-lg text-xs flex justify-between shadow-lg">
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
        <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-slate-100">
          {loading ? (
            <div className="flex h-full items-center justify-center text-slate-550 text-sm font-semibold">
              Đang tải thiết kế...
            </div>
          ) : blocks.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl py-16 text-slate-500 text-sm w-full bg-white">
              <p className="font-bold text-slate-700">Chưa có thành phần nào trên trang.</p>
              <p className="text-xs text-slate-500 mt-1">Sử dụng nút Thêm khối ở sidebar để bắt đầu hoặc chọn AI sinh layout.</p>
            </div>
          ) : (
            <div
              className={`h-fit border border-slate-200 bg-white transition-all duration-300 overflow-hidden shadow-2xl rounded-2xl relative ${
                device === 'desktop' ? 'w-full max-w-5xl' : 
                device === 'tablet' ? 'w-[768px] border-x-4 border-slate-300' : 
                'w-[375px] border-x-4 border-slate-300'
              }`}
            >
              {blocks.map((block, index) => {
                const isMobileHidden = block.hiddenOnMobile;
                
                // Hide block completely in Mobile View if toggled
                if (isMobileHidden && device === 'mobile') return null;

                const cardStyle = getAdaptiveCardStyles(block.textColor);

                return (
                  <div
                    key={block.id}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                    onClick={() => setSelectedBlockId(block.id)}
                    style={{ backgroundColor: block.backgroundColor, color: block.textColor }}
                    className={`relative p-8 cursor-pointer group border-2 ${selectedBlockId === block.id ? 'border-[#f25c22] ring-2 ring-[#f25c22]/10 shadow-lg' : dragOverIdx === index ? 'border-dashed border-2 border-orange-500' : 'border-transparent hover:border-slate-300'} ${isMobileHidden ? 'opacity-40 bg-slate-100/30' : ''} transition duration-205`}
                  >
                    {/* Action Bar */}
                    <div className="absolute -top-3.5 right-4 z-20 hidden group-hover:flex items-center gap-1.5 bg-white border border-slate-200 shadow-md rounded-lg px-2 py-1 select-none text-slate-700 animate-in fade-in duration-150">
                      {/* Drag Handle */}
                      <div
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragEnd={() => {
                          setDraggedIdx(null);
                          setDragOverIdx(null);
                        }}
                        className="cursor-grab active:cursor-grabbing hover:bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 text-slate-500 hover:text-slate-800"
                        title="Kéo thả sắp xếp"
                      >
                        ⋮⋮ Kéo
                      </div>
                      
                      {/* Move Up */}
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={(e) => { e.stopPropagation(); moveBlock(index, 'up'); }}
                        className="hover:bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold disabled:opacity-30 text-slate-500 hover:text-slate-850"
                        title="Di chuyển lên"
                      >
                        ↑
                      </button>

                      {/* Move Down */}
                      <button
                        type="button"
                        disabled={index === blocks.length - 1}
                        onClick={(e) => { e.stopPropagation(); moveBlock(index, 'down'); }}
                        className="hover:bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold disabled:opacity-30 text-slate-500 hover:text-slate-850"
                        title="Di chuyển xuống"
                      >
                        ↓
                      </button>

                      {/* Duplicate */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); duplicateBlock(block.id); }}
                        className="hover:bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-indigo-600 hover:text-indigo-700"
                        title="Nhân bản khối"
                      >
                        🗐 Nhân bản
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
                        className="hover:bg-rose-50 px-1.5 py-0.5 rounded text-[10px] font-bold text-rose-600 hover:text-rose-700"
                        title="Xóa khối"
                      >
                        🗑 Xóa
                      </button>

                      {/* Divider */}
                      <div className="w-[1px] h-3.5 bg-slate-200"></div>

                      {/* Background Color Picker */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[9px] font-bold text-slate-400">Nền:</span>
                        <input
                          type="color"
                          value={block.backgroundColor || '#ffffff'}
                          onChange={(e) => {
                            const updated = { ...block, backgroundColor: e.target.value };
                            updateBlock(updated);
                          }}
                          className="w-4 h-4 p-0 bg-transparent border-0 cursor-pointer rounded overflow-hidden"
                          title="Đổi màu nền"
                        />
                      </div>

                      {/* Text Color Picker */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[9px] font-bold text-slate-400">Chữ:</span>
                        <input
                          type="color"
                          value={block.textColor || '#000000'}
                          onChange={(e) => {
                            const updated = { ...block, textColor: e.target.value };
                            updateBlock(updated);
                          }}
                          className="w-4 h-4 p-0 bg-transparent border-0 cursor-pointer rounded overflow-hidden"
                          title="Đổi màu chữ"
                        />
                      </div>
                    </div>

                    {/* Block Info Badge */}
                    <span className="absolute top-2 left-2 text-[8px] bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase shadow-xs">
                      {block.type}
                    </span>

                    {/* Hidden on Mobile Badge Overlay */}
                    {isMobileHidden && (
                      <span className="absolute top-2 left-16 text-[8px] bg-white border border-slate-200 text-rose-500 px-1.5 py-0.5 rounded font-bold uppercase shadow-xs">
                        🚫 Ẩn trên Mobile
                      </span>
                    )}

                    {/* Edit label overlay */}
                    <span className="absolute top-2 right-2 text-[8px] bg-white border border-slate-200 text-slate-650 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition z-10 shadow-xs">
                      Click to edit
                    </span>

                    {block.type === 'hero' && (
                      <>
                        {block.imageUrl && block.imageAlignment !== 'center' ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                            <div className={`space-y-4 ${block.imageAlignment === 'left' ? 'md:order-2' : ''}`}>
                              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">
                                {renderEditableText(block, 'title', block.title, "block")}
                              </h1>
                              <p className="text-xs md:text-sm leading-relaxed opacity-90">
                                {renderEditableText(block, 'subtitle', block.subtitle || '', "block")}
                              </p>
                              <button className="px-5 py-2.5 bg-[#f25c22] text-white text-xs font-bold rounded-lg mt-2">
                                {renderEditableText(block, 'buttonText', block.buttonText || 'Bấm đăng ký', "")}
                              </button>
                            </div>
                            <div className={`${block.imageAlignment === 'left' ? 'md:order-1' : ''} flex justify-center relative group/img`}>
                              <img src={block.imageUrl} alt="preview" className="rounded-lg shadow-lg border border-slate-200 max-h-[220px] object-cover" />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newUrl = prompt('Nhập link ảnh mới (URL):', block.imageUrl);
                                  if (newUrl !== null) {
                                    updateBlock({ ...block, imageUrl: newUrl });
                                  }
                                }}
                                className="absolute inset-0 bg-black/40 hover:bg-black/60 text-white text-[11px] font-bold rounded-lg opacity-0 group-hover/img:opacity-100 transition duration-150 flex items-center justify-center gap-1 cursor-pointer"
                              >
                                📷 Đổi hình ảnh
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center space-y-4">
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">
                              {renderEditableText(block, 'title', block.title, "block")}
                            </h1>
                            <p className="text-xs md:text-sm max-w-xl mx-auto leading-relaxed opacity-90">
                              {renderEditableText(block, 'subtitle', block.subtitle || '', "block")}
                            </p>
                            {block.imageUrl && (
                              <div className="my-4 flex justify-center relative group/img max-w-fit mx-auto">
                                <img src={block.imageUrl} alt="preview" className="rounded-lg shadow-lg border border-slate-200 max-h-[220px] object-cover" />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newUrl = prompt('Nhập link ảnh mới (URL):', block.imageUrl);
                                    if (newUrl !== null) {
                                      updateBlock({ ...block, imageUrl: newUrl });
                                    }
                                  }}
                                  className="absolute inset-0 bg-black/40 hover:bg-black/60 text-white text-[11px] font-bold rounded-lg opacity-0 group-hover/img:opacity-100 transition duration-150 flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  📷 Đổi hình ảnh
                                </button>
                              </div>
                            )}
                            <button className="px-5 py-2.5 bg-[#f25c22] text-white text-xs font-bold rounded-lg mt-2">
                              {renderEditableText(block, 'buttonText', block.buttonText || 'Bấm đăng ký', "")}
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {block.type === 'features' && (
                      <div className="space-y-6">
                        <h2 className="text-md md:text-lg font-bold text-center">
                          {renderEditableText(block, 'title', block.title, "block")}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(block.items || []).map((item, idx) => (
                            <div
                              key={idx}
                              style={{ backgroundColor: cardStyle.bg, borderColor: cardStyle.border }}
                              className="flex items-start gap-2 p-3 rounded border"
                            >
                              <span className="text-indigo-400 text-xs">✓</span>
                              {renderEditableText(block, 'items', item, "text-xs font-medium block flex-1", idx)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {block.type === 'form' && (
                      <div
                        style={{ backgroundColor: cardStyle.bg, borderColor: cardStyle.border }}
                        className="max-w-xs mx-auto border rounded-lg p-6 space-y-4 shadow-md"
                      >
                        <h3 className="font-bold text-sm text-center">
                          {renderEditableText(block, 'title', block.title, "block")}
                        </h3>
                        <p style={{ color: cardStyle.textSecondary }} className="text-[10px] text-center">
                          {renderEditableText(block, 'subtitle', block.subtitle || '', "block")}
                        </p>
                        
                        {!block.formId ? (
                          <div className="p-3 bg-amber-50/15 border border-amber-500/30 rounded-lg text-center space-y-2">
                            <p className="text-xs text-amber-500 font-bold">⚠️ Chưa liên kết biểu mẫu</p>
                            <p style={{ color: cardStyle.textSecondary }} className="text-[10px] leading-normal">Bạn cần liên kết Custom Form để thu thập thông tin khách hàng.</p>
                            <select
                              value={block.formId || ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateBlock({ ...block, formId: e.target.value });
                              }}
                              className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none"
                            >
                              <option value="">-- Chọn biểu mẫu --</option>
                              {forms.map(f => (
                                <option key={f.id} value={String(f.id)}>{f.name}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-2">
                              <div className="space-y-1">
                                <label style={{ color: cardStyle.textSecondary }} className="text-[9px] font-semibold uppercase opacity-95">Họ và Tên</label>
                                <input
                                  disabled
                                  placeholder="Nguyễn Văn A"
                                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.02)', borderColor: cardStyle.border, color: block.textColor }}
                                  className="w-full border rounded px-2.5 py-1.5 text-xs cursor-not-allowed"
                                />
                              </div>
                              <div className="space-y-1">
                                <label style={{ color: cardStyle.textSecondary }} className="text-[9px] font-semibold uppercase opacity-95">Email</label>
                                <input
                                  disabled
                                  placeholder="name@email.com"
                                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.02)', borderColor: cardStyle.border, color: block.textColor }}
                                  className="w-full border rounded px-2.5 py-1.5 text-xs cursor-not-allowed"
                                />
                              </div>
                            </div>
                            <button disabled className="w-full py-2 bg-[#f25c22] text-white font-bold text-xs rounded transition mt-1 cursor-not-allowed">
                              Đăng ký (Demo Form)
                            </button>
                            <p style={{ color: cardStyle.textSecondary }} className="text-[9px] text-center font-semibold">
                              Form ID: {block.formId}
                              {block.workflowId && ` | Workflow: ${workflows.find(w => String(w.id) === block.workflowId)?.name}`}
                            </p>
                          </>
                        )}
                      </div>
                    )}

                    {block.type === 'pricing' && (() => {
                      const displayProducts = products && products.length > 0
                        ? products.slice(0, 3)
                        : getDynamicFallbackProducts(page?.title || '', aiPromptInput, aiTheme);

                      const getProductImage = (pName: string, index: number): string => {
                        const lowerName = pName.toLowerCase();
                        if (lowerName.includes('mật ong') || lowerName.includes('honey') || lowerName.includes('ong')) {
                          const honeyImgs = [
                            'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=300&auto=format&fit=crop',
                            'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=300&auto=format&fit=crop',
                            'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=300&auto=format&fit=crop'
                          ];
                          return honeyImgs[index % honeyImgs.length];
                        }
                        if (aiTheme === 'sale-theme') {
                          const foodImgs = [
                            'https://images.unsplash.com/photo-1534080391025-09795d197360?w=300&auto=format&fit=crop',
                            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop',
                            'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300&auto=format&fit=crop',
                            'https://images.unsplash.com/photo-1534482421-64566f976cfa?w=300&auto=format&fit=crop'
                          ];
                          return foodImgs[index % foodImgs.length];
                        }
                        if (aiTheme === 'education-theme') {
                          const eduImgs = [
                            'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=300&auto=format&fit=crop',
                            'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=300&auto=format&fit=crop',
                            'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=300&auto=format&fit=crop',
                            'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=300&auto=format&fit=crop'
                          ];
                          return eduImgs[index % eduImgs.length];
                        }
                        if (aiTheme === 'saleticket-theme') {
                          const travelImgs = [
                            'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&auto=format&fit=crop',
                            'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=300&auto=format&fit=crop',
                            'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=300&auto=format&fit=crop',
                            'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?w=300&auto=format&fit=crop'
                          ];
                          return travelImgs[index % travelImgs.length];
                        }
                        return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&auto=format&fit=crop';
                      };

                      if (aiTheme === 'sale-theme') {
                        return (
                          <div className="space-y-6">
                            <div className="text-center max-w-xl mx-auto mb-4">
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-bold rounded-full uppercase tracking-wider">Đặc Sản</span>
                              <h2 className="text-md md:text-lg font-bold mt-1">
                                {renderEditableText(block, 'title', block.title, "block")}
                              </h2>
                              <p style={{ color: cardStyle.textSecondary }} className="text-xs mt-1">
                                {renderEditableText(block, 'subtitle', block.subtitle || '', "block")}
                              </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                              {displayProducts.map((p, index) => {
                                const img = getProductImage(p.name, index);
                                const pPrice = typeof p.price === 'number' ? p.price.toLocaleString('vi-VN') : p.price;
                                const badges = ['Bán Chạy', 'Đặc Sản', 'Gợi Ý'];
                                const badgeClass = ['bg-orange-900/40 text-orange-400', 'bg-amber-900/40 text-amber-400', 'bg-green-900/40 text-green-400'][index % 3];

                                return (
                                  <div
                                    key={p.id || index}
                                    style={{ backgroundColor: cardStyle.bg, borderColor: cardStyle.border }}
                                    className="border rounded-xl overflow-hidden shadow flex flex-col justify-between"
                                  >
                                    <img src={img} alt="preview" className="h-28 w-full object-cover" />
                                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                      <div className="space-y-1">
                                        <span className={`px-1.5 py-0.5 ${badgeClass} text-[8px] font-bold rounded`}>{badges[index % 3]}</span>
                                        <h4 className="text-xs font-bold line-clamp-1">{p.name}</h4>
                                        <p style={{ color: cardStyle.textSecondary }} className="text-[10px] line-clamp-2">{p.description || 'Sản phẩm chất lượng cao được tuyển chọn kỹ lưỡng.'}</p>
                                      </div>
                                      <div style={{ borderColor: cardStyle.border }} className="flex justify-between items-center pt-2 border-t">
                                        <span className="text-orange-400 text-xs font-bold">chỉ từ {pPrice}đ</span>
                                        <button disabled style={{ backgroundColor: '#f25c22' }} className="px-3 py-1 text-white rounded text-[10px] font-bold cursor-not-allowed">Đặt Mua</button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      if (aiTheme === 'education-theme') {
                        return (
                          <div className="space-y-6">
                            <div className="text-center max-w-xl mx-auto mb-4">
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-850 text-[9px] font-bold rounded-full uppercase tracking-wider">Lộ Trình Bài Bản</span>
                              <h2 className="text-md md:text-lg font-bold mt-1">
                                {renderEditableText(block, 'title', block.title, "block")}
                              </h2>
                              <p style={{ color: cardStyle.textSecondary }} className="text-xs mt-1">
                                {renderEditableText(block, 'subtitle', block.subtitle || '', "block")}
                              </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                              {displayProducts.map((p, index) => {
                                const img = getProductImage(p.name, index);
                                const pPrice = typeof p.price === 'number' ? p.price.toLocaleString('vi-VN') : p.price;
                                const badges = ['Pro Course', 'Web Backend', 'Foundation'];
                                const badgeClass = ['bg-sky-900/40 text-sky-400', 'bg-purple-900/40 text-purple-400', 'bg-green-900/40 text-green-400'][index % 3];

                                return (
                                  <div
                                    key={p.id || index}
                                    style={{ backgroundColor: cardStyle.bg, borderColor: cardStyle.border }}
                                    className="border rounded-xl overflow-hidden shadow flex flex-col justify-between"
                                  >
                                    <img src={img} alt="preview" className="h-28 w-full object-cover" />
                                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                      <div className="space-y-1">
                                        <span className={`px-1.5 py-0.5 ${badgeClass} text-[8px] font-bold rounded`}>{badges[index % 3]}</span>
                                        <h4 className="text-xs font-bold line-clamp-1">{p.name}</h4>
                                        <p style={{ color: cardStyle.textSecondary }} className="text-[10px] line-clamp-2">{p.description || 'Khóa học chất lượng cao học trực tuyến hiệu quả cao.'}</p>
                                      </div>
                                      <div style={{ borderColor: cardStyle.border }} className="flex justify-between items-center pt-2 border-t">
                                        <span className="text-orange-400 text-xs font-bold">{pPrice}đ</span>
                                        <button disabled style={{ backgroundColor: '#f05123' }} className="px-3 py-1 text-white rounded text-[10px] font-bold cursor-not-allowed">Đăng Ký</button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      if (aiTheme === 'saleticket-theme') {
                        return (
                          <div className="space-y-6">
                            <div className="text-center max-w-xl mx-auto mb-4">
                              <span className="px-2 py-0.5 bg-sky-100 text-sky-850 text-[9px] font-bold rounded-full uppercase tracking-wider">Hành Trình Mơ Ước</span>
                              <h2 className="text-md md:text-lg font-bold mt-1">
                                {renderEditableText(block, 'title', block.title, "block")}
                              </h2>
                              <p style={{ color: cardStyle.textSecondary }} className="text-xs mt-1">
                                {renderEditableText(block, 'subtitle', block.subtitle || '', "block")}
                              </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                              {displayProducts.map((p, index) => {
                                const img = getProductImage(p.name, index);
                                const pPrice = typeof p.price === 'number' ? p.price.toLocaleString('vi-VN') : p.price;
                                const badges = ['Combo', 'Trọn Gói', 'Ưu Đãi Hot'];
                                const badgeClass = ['bg-sky-900/40 text-sky-400', 'bg-blue-900/40 text-blue-400', 'bg-green-900/40 text-green-400'][index % 3];
                                const btnLabel = index === 0 ? 'Đặt Combo' : index === 1 ? 'Đặt Tour' : 'Đặt Vé';

                                return (
                                  <div
                                    key={p.id || index}
                                    style={{ backgroundColor: cardStyle.bg, borderColor: cardStyle.border }}
                                    className="border rounded-xl overflow-hidden shadow flex flex-col justify-between"
                                  >
                                    <img src={img} alt="preview" className="h-28 w-full object-cover" />
                                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                      <div className="space-y-1">
                                        <span className={`px-1.5 py-0.5 ${badgeClass} text-[8px] font-bold rounded`}>{badges[index % 3]}</span>
                                        <h4 className="text-xs font-bold line-clamp-1">{p.name}</h4>
                                        <p style={{ color: cardStyle.textSecondary }} className="text-[10px] line-clamp-2">{p.description || 'Dịch vụ chất lượng cao, hỗ trợ nhiệt tình chu đáo.'}</p>
                                      </div>
                                      <div style={{ borderColor: cardStyle.border }} className="flex justify-between items-center pt-2 border-t">
                                        <span className="text-sky-400 text-xs font-bold">từ {pPrice}đ</span>
                                        <button disabled style={{ backgroundColor: '#0284c7' }} className="px-3 py-1 text-white rounded text-[10px] font-bold cursor-not-allowed">{btnLabel}</button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="text-center space-y-4">
                          <h2 className="text-md md:text-lg font-bold">
                            {renderEditableText(block, 'title', block.title, "block")}
                          </h2>
                          <p style={{ color: cardStyle.textSecondary }} className="text-xs">
                            {renderEditableText(block, 'subtitle', block.subtitle || '', "block")}
                          </p>
                          <div
                            style={{ backgroundColor: cardStyle.bg, borderColor: cardStyle.border }}
                            className="max-w-xs mx-auto border rounded-lg p-6 space-y-3 mt-4 relative"
                          >
                            <span className="absolute top-0 right-0 bg-[#f25c22] text-[9px] font-bold text-white px-2 py-0.5 rounded-bl">Phổ biến</span>
                            <h4 className="text-xs font-bold">Gói Ưu Đãi</h4>
                            <p className="text-2xl font-extrabold">
                              {renderEditableText(block, 'priceVal', block.priceVal || '499.000đ', "")}
                              <span style={{ color: cardStyle.textSecondary }} className="text-[10px] font-normal">/tháng</span>
                            </p>
                            <button disabled className="w-full py-2 bg-[#f25c22] text-white font-bold text-xs rounded cursor-not-allowed">
                              {block.productId ? `Thanh toán (${block.paymentMethod || 'PAYOS'})` : (block.buttonText || 'Mua ngay')}
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {block.type === 'countdown' && (
                      <div className="text-center space-y-3">
                        <h2 className="text-md md:text-lg font-bold">
                          {renderEditableText(block, 'title', block.title, "block")}
                        </h2>
                        <p style={{ color: cardStyle.textSecondary }} className="text-xs">
                          {renderEditableText(block, 'subtitle', block.subtitle || '', "block")}
                        </p>
                        <div className="flex justify-center gap-3 mt-4 font-mono">
                          <div style={{ backgroundColor: cardStyle.bg, borderColor: cardStyle.border }} className="border rounded p-2.5 min-w-[50px]">
                            <span className="text-lg font-extrabold block text-[#f25c22]">02</span>
                            <span style={{ color: cardStyle.textSecondary }} className="text-[8px] uppercase">Ngày</span>
                          </div>
                          <div style={{ backgroundColor: cardStyle.bg, borderColor: cardStyle.border }} className="border rounded p-2.5 min-w-[50px]">
                            <span className="text-lg font-extrabold block text-[#f25c22]">14</span>
                            <span style={{ color: cardStyle.textSecondary }} className="text-[8px] uppercase">Giờ</span>
                          </div>
                          <div style={{ backgroundColor: cardStyle.bg, borderColor: cardStyle.border }} className="border rounded p-2.5 min-w-[50px]">
                            <span className="text-lg font-extrabold block text-[#f25c22]">38</span>
                            <span style={{ color: cardStyle.textSecondary }} className="text-[8px] uppercase">Phút</span>
                          </div>
                          <div style={{ backgroundColor: cardStyle.bg, borderColor: cardStyle.border }} className="border rounded p-2.5 min-w-[50px]">
                            <span className="text-lg font-extrabold block text-[#f25c22]">45</span>
                            <span style={{ color: cardStyle.textSecondary }} className="text-[8px] uppercase">Giây</span>
                          </div>
                        </div>
                        <p style={{ color: cardStyle.textSecondary }} className="text-[9px] italic mt-1">Hạn kết thúc: {block.countdownEnd || 'Chưa cài đặt'}</p>
                      </div>
                    )}

                    {block.type === 'testimonials' && (
                      <div className="space-y-4">
                        <h2 className="text-md md:text-lg font-bold text-center">
                          {renderEditableText(block, 'title', block.title, "block")}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {(block.reviews || []).map((r, idx) => (
                            <div
                              key={idx}
                              style={{ backgroundColor: cardStyle.bg, borderColor: cardStyle.border }}
                              className="border p-4 rounded-lg flex flex-col justify-between"
                            >
                              <div className="space-y-1">
                                <span className="text-[#f25c22] text-[10px]">{'★'.repeat(r.rating || 5)}{'☆'.repeat(5 - (r.rating || 5))}</span>
                                <p style={{ color: cardStyle.textSecondary }} className="italic text-[11px] leading-relaxed">
                                  "{renderEditableText(block, 'reviews', r.quote, "", idx, 'quote')}"
                                </p>
                              </div>
                              <div style={{ borderColor: cardStyle.border }} className="flex items-center gap-2 mt-4 pt-3 border-t">
                                <div style={{ backgroundColor: cardStyle.border }} className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[#f25c22] text-xs">
                                  {r.name.charAt(0)}
                                </div>
                                <div>
                                  <h4 className="font-bold text-xs">
                                    {renderEditableText(block, 'reviews', r.name, "block", idx, 'name')}
                                  </h4>
                                  <p style={{ color: cardStyle.textSecondary }} className="text-[8px] opacity-80">
                                    {renderEditableText(block, 'reviews', r.role, "block", idx, 'role')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {block.type === 'faq' && (
                      <div className="space-y-4">
                        <h2 className="text-md md:text-lg font-bold text-center">
                          {renderEditableText(block, 'title', block.title, "block")}
                        </h2>
                        <div className="max-w-2xl mx-auto space-y-2">
                          {(block.faqs || []).map((faq, idx) => (
                            <div
                              key={idx}
                              style={{ backgroundColor: cardStyle.bg, borderColor: cardStyle.border }}
                              className="border rounded-lg overflow-hidden"
                            >
                              <div
                                style={{ borderBottomColor: cardStyle.border }}
                                className="px-4 py-2.5 flex justify-between items-center text-left hover:bg-black/5 hover:dark:bg-white/5 cursor-pointer"
                              >
                                <span className="font-semibold text-xs flex-1">
                                  {renderEditableText(block, 'faqs', faq.question, "block flex-1", idx, 'question')}
                                </span>
                                <span className="text-slate-400 text-[10px]">▼</span>
                              </div>
                              <div
                                style={{ backgroundColor: 'rgba(0, 0, 0, 0.01)', borderColor: cardStyle.border }}
                                className="px-4 py-2 border-t"
                              >
                                <p style={{ color: cardStyle.textSecondary }} className="text-xs">
                                  {renderEditableText(block, 'faqs', faq.answer, "block", idx, 'answer')}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {block.type === 'footer' && (
                      <div style={{ color: cardStyle.textSecondary }} className="flex justify-between items-center text-xs">
                        <div>
                          <h4 style={{ color: block.textColor }} className="font-bold">
                            {renderEditableText(block, 'title', block.title, "block")}
                          </h4>
                          <p className="text-[10px]">
                            {renderEditableText(block, 'subtitle', block.subtitle || '', "block")}
                          </p>
                        </div>
                        <p className="text-[9px]">© {new Date().getFullYear()} {block.title}.</p>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Behavioral Popup Preview Overlay inside the visual canvas */}
              {popupEnabled && activeTab === 'popups' && (
                <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="relative w-full max-w-md p-6 bg-white border border-slate-200 rounded-2xl shadow-2xl text-center space-y-4 text-slate-800">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 text-orange-600 mb-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{popupTitle || 'Đăng ký nhận quà tặng!'}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{popupDescription}</p>
                    <div className="space-y-3 mt-4 text-left">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Họ và Tên</label>
                        <input disabled placeholder="Nguyễn Văn A" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Địa chỉ Email</label>
                        <input disabled placeholder="name@email.com" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Số điện thoại</label>
                        <input disabled placeholder="0987654321" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs cursor-not-allowed" />
                      </div>
                      <button disabled className="w-full py-2.5 bg-[#f25c22] text-white font-bold text-xs rounded-lg mt-2 cursor-not-allowed">
                        Gửi thông tin đăng ký (Bản xem trước)
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-2 font-medium">
                      Liên kết Custom Form: {forms.find(f => String(f.id) === popupFormId)?.name || 'Chưa liên kết'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
