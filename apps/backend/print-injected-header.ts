import prisma from './src/lib/prisma';

function injectNavbarAndFooter(html: string, slug: string, workspaceName: string, activeTab: string, theme = 'ocean-breeze'): string {
  let headInject = '';
  if (!html.includes('cdn.tailwindcss.com')) {
    headInject += `<script src="https://cdn.tailwindcss.com"></script>\n`;
  }
  if (!html.includes('fonts.googleapis.com')) {
    headInject += `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; }
</style>\n`;
  }

  const isDark = html.includes('bg-gray-950') || html.includes('bg-slate-950') || html.includes('bg-gray-900') || html.includes('background-color: #0f172a') || html.includes('background-color: #030712') || html.includes('background-color: #0b0f19') || html.includes('background-color: #111827');

  let activeColorClass = 'text-[#f25c22]';
  let btnColorClass = 'bg-[#f25c22] hover:bg-[#d94d1a]';
  
  if (theme === 'saleticket-theme') {
    activeColorClass = 'text-sky-600';
    btnColorClass = 'bg-sky-600 hover:bg-sky-700';
  } else if (theme === 'education-theme') {
    activeColorClass = 'text-[#f05123]';
    btnColorClass = 'bg-[#f05123] hover:bg-[#d94416]';
  }

  const navClass = isDark 
    ? 'backdrop-blur-md bg-slate-950/80 border-b border-slate-900/60 text-slate-200' 
    : 'backdrop-blur-md bg-white/80 border-b border-slate-100 text-slate-800';

  const linkClass = isDark
    ? 'hover:text-[#f25c22] text-slate-300'
    : 'hover:text-[#f25c22] text-slate-600';

  const loginClass = isDark
    ? 'text-slate-400 hover:text-slate-100'
    : 'text-slate-600 hover:text-slate-900';

  const navbarHtml = `
<header class="sticky top-0 z-50 w-full ${navClass} transition-all duration-300">
  <div class="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
    <nav class="hidden md:flex gap-6 items-center text-sm font-bold">
      <a href="/api/public/pages/${slug}/html" class="transition ${activeTab === 'home' ? activeColorClass : linkClass}">Trang chủ</a>
      <a href="/api/public/pages/${slug}/html/blog" class="transition ${activeTab === 'blog' ? activeColorClass : linkClass}">Blog</a>
      <a href="/api/public/pages/${slug}/html/products" class="transition ${activeTab === 'products' ? activeColorClass : linkClass}">Sản phẩm</a>
      <a href="/api/public/pages/${slug}/html/about" class="transition ${activeTab === 'about' ? activeColorClass : linkClass}">Giới thiệu</a>
    </nav>
    <div class="flex gap-3 items-center" id="nav-auth-section">
      <a href="/api/public/pages/${slug}/html/login" class="text-xs ${loginClass} px-3 py-1.5 font-bold transition">Đăng nhập</a>
      <a href="/api/public/pages/${slug}/html/register" class="text-xs ${btnColorClass} text-white px-4 py-2 rounded-xl font-bold transition shadow-sm">Đăng ký</a>
    </div>
  </div>
</header>
`;

  let resultHtml = html;
  if (headInject) {
    if (resultHtml.includes('</head>')) {
      resultHtml = resultHtml.replace('</head>', `${headInject}</head>`);
    } else {
      resultHtml = headInject + resultHtml;
    }
  }

  if (resultHtml.includes('<body class="')) {
    const idx = resultHtml.indexOf('<body class="');
    const bodyTagCloseIdx = resultHtml.indexOf('>', idx);
    if (bodyTagCloseIdx !== -1) {
      resultHtml = resultHtml.substring(0, bodyTagCloseIdx + 1) + navbarHtml + resultHtml.substring(bodyTagCloseIdx + 1);
    }
  } else if (resultHtml.includes('<body>')) {
    resultHtml = resultHtml.replace('<body>', `<body>${navbarHtml}`);
  } else {
    resultHtml = navbarHtml + resultHtml;
  }

  return resultHtml;
}

async function main() {
  const page = await prisma.landingPage.findFirst({
    where: { slug: 'betecccchhh' }
  });
  if (!page) return;

  const finalHtml = injectNavbarAndFooter(page.htmlContent, page.slug, "Workspace", "home");
  console.log("=== HEADER IN FINAL HTML ===");
  const headerStart = finalHtml.indexOf('<header');
  const headerEnd = finalHtml.indexOf('</header>');
  console.log(finalHtml.substring(headerStart, headerEnd + 9));
}
main();
