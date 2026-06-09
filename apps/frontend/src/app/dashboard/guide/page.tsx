'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';

type Section = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  steps: {
    title: string;
    description: string;
    tip?: string;
  }[];
  notes?: string;
};

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const { locale } = useLocale();

  const sectionsVi: Section[] = [
    {
      id: 'dashboard',
      icon: '📈',
      title: 'Báo cáo & Nguồn lưu lượng',
      subtitle: 'Theo dõi lưu lượng truy cập, hiệu suất chiến dịch và lên lịch biểu tự động',
      steps: [
        {
          title: 'Bước 1: Phân tích hiệu năng với Dashboard',
          description: 'Xem biểu đồ hiển thị tổng số lượt click, impression, doanh thu và tỷ lệ chuyển đổi (CR) theo thời gian thực. Hệ thống hỗ trợ bộ lọc lọc theo thời gian hoặc workspace.',
        },
        {
          title: 'Bước 2: Quản lý nguồn lưu lượng truy cập (Traffic Sources)',
          description: 'Cấu hình các kênh nguồn (như Facebook Ads, Google Ads, Direct, Email...). Hệ thống tự động bóc tách các tham số UTM tag để xếp nhóm nguồn traffic đổ về, tính toán chính xác ROI cho từng chiến dịch quảng cáo.',
        },
        {
          title: 'Bước 3: Lên kế hoạch với Lịch biểu (Schedule)',
          description: 'Quản lý lịch trình xuất bản nội dung, lên kế hoạch chạy các chiến dịch tiếp thị tự động hoặc các công việc định kỳ trong hệ thống.',
        }
      ]
    },
    {
      id: 'landing',
      icon: '📐',
      title: 'CMS & Landing Page Builder',
      subtitle: 'Thiết kế trang đích và quản lý nội dung Blog chuẩn SEO',
      steps: [
        {
          title: 'Bước 1: Thiết kế Landing Page kéo thả',
          description: 'Vào phân hệ Landing Pages, bấm "Tạo trang mới". Trong Visual Builder, kéo thả các khối thành phần (Hero Banner, Tính năng, Form đăng ký, Bảng giá, Chân trang). Bạn có thể chỉnh sửa hình ảnh từ Unsplash hoặc đổi căn lề (Trái/Phải/Giữa).',
          tip: 'Hãy gán nút bấm chính về thẻ cuộn `#register-form` để kéo khách hàng đến biểu mẫu đăng ký nhanh nhất!'
        },
        {
          title: 'Bước 2: Cài đặt mã theo dõi Tracking',
          description: 'Trong cấu hình Landing Page, nhập Facebook Pixel ID hoặc Google Tag Manager ID. Hệ thống tự động biên dịch và tiêm mã script tương ứng vào trang HTML tĩnh để tối ưu tiếp thị lại (Remarketing).',
        },
        {
          title: 'Bước 3: Biên soạn Blog CMS chuẩn SEO',
          description: 'Vào Blog CMS để viết bài viết bằng Markdown. Hệ thống hỗ trợ sinh bài viết bằng AI Copilot kèm tự động vẽ ảnh minh hoạ vector tông cam-trắng. Khi bài viết xuất bản, hệ thống sẽ render HTML tĩnh siêu nhẹ giúp đạt điểm Lighthouse tối đa (LCP < 1.2s).',
        }
      ],
      notes: 'Các trang đích được xuất bản sẽ hoạt động công khai dưới đường dẫn /p/:slug và tự động tích hợp Bong bóng Live Chat Chatbot.'
    },
    {
      id: 'seo',
      icon: '🔍',
      title: 'SEO Audit & Link Building',
      subtitle: 'Tối ưu điểm On-page SEO và theo dõi các liên kết ngược (Backlink) trỏ về website',
      steps: [
        {
          title: 'Bước 1: Thực hiện SEO Audit tự động',
          description: 'Vào mục SEO Audit, nhập URL trang web cần phân tích. Hệ thống sẽ quét toàn bộ cấu trúc trang, phát hiện các lỗi SEO On-page như thiếu thẻ Meta Description, thẻ heading H1-H6 phân cấp sai, hoặc ảnh thiếu thuộc tính ALT.',
          tip: 'Khắc phục các đề xuất cải thiện của hệ thống để gia tăng đáng kể thứ hạng hiển thị tự nhiên trên Google!'
        },
        {
          title: 'Bước 2: Theo dõi liên kết ngược (Backlinks)',
          description: 'Khai báo các domain để hệ thống theo dõi và đối soát danh sách Backlink trỏ về website. Hệ thống giúp bạn kiểm soát link-juice, phát hiện các link xấu/spam, và đánh giá chất lượng nguồn dẫn link.',
        },
        {
          title: 'Bước 3: Quản lý sức khỏe kỹ thuật SEO',
          description: 'Xem báo cáo chi tiết về tốc độ tải trang, khả năng lập chỉ mục (indexability) và nhận các đề xuất tối ưu mã nguồn từ AI để giữ trang luôn ở trạng thái tốt nhất với bộ máy tìm kiếm.',
        }
      ]
    },
    {
      id: 'crm',
      icon: '👥',
      title: 'CRM & Custom Forms',
      subtitle: 'Thu thập thông tin Lead đăng ký và quản lý phễu khách hàng',
      steps: [
        {
          title: 'Bước 1: Tạo Custom Form thu thập Leads',
          description: 'Vào Custom Forms, thiết kế các trường nhập liệu cần thiết (Họ tên, Email, SĐT, Tên công ty...). Hệ thống hỗ trợ định nghĩa JSON cấu trúc biểu mẫu động.',
        },
        {
          title: 'Bước 2: Nhúng Form vào Landing Page',
          description: 'Trong Visual Builder của Landing Page, chọn Custom Form vừa tạo để nhúng vào trang. Khi khách hàng điền thông tin và bấm gửi, hệ thống tự động kiểm tra Rate Limiting chống spam và gửi dữ liệu về CRM.',
        },
        {
          title: 'Bước 3: Quản lý khách hàng tiềm năng',
          description: 'Thông tin đăng ký được tự động chuyển đổi thành hồ sơ Customer trong CRM. Bạn có thể lọc khách hàng theo nhãn trạng thái (New, contacted, VIP, HOT/WARM/COLD từ AI) hoặc xem chi tiết nhật ký ghi chú chăm sóc.',
          tip: 'Sử dụng chức năng "Import Khách hàng" để nhập hàng loạt lead từ file CSV hoặc JSON dễ dàng.'
        }
      ]
    },
    {
      id: 'automation',
      icon: '✉️',
      title: 'Email Automation & Drip',
      subtitle: 'Thiết lập kịch bản gửi mail bám đuổi chăm sóc tự động và gửi hàng loạt',
      steps: [
        {
          title: 'Bước 1: Kết nối SMTP cấu hình gửi thư',
          description: 'Vào Cài đặt chung, cấu hình tài khoản gửi thư SMTP của doanh nghiệp để hệ thống có quyền gửi email chăm sóc cá nhân hóa cho khách hàng.',
        },
        {
          title: 'Bước 2: Thiết lập kịch bản Email Workflow',
          description: 'Tạo chiến dịch Email Automation, chọn Sự kiện kích hoạt (Ví dụ: Đăng ký biểu mẫu X). Thêm các bước (Email Steps), điền tiêu đề thư, nội dung thư và đặt độ trễ (delay) gửi (Ví dụ: gửi ngay lập tức, gửi sau 1 ngày, gửi sau 3 ngày).',
          tip: 'Sử dụng các thẻ động {{name}}, {{email}} để tự động cá nhân hóa nội dung thư.'
        },
        {
          title: 'Bước 3: Chạy Chiến dịch Email Broadcast',
          description: 'Ngoài Workflow tự động bám đuổi, bạn có thể tạo Chiến dịch Email thủ công (Email Campaigns) để gửi thông báo/khuyến mãi hàng loạt tới các nhóm khách hàng chọn lọc ngay lập tức.'
        }
      ]
    },
    {
      id: 'store',
      icon: '🛍️',
      title: 'Store & Cổng thanh toán',
      subtitle: 'Bán sản phẩm số và đối soát giao dịch VietQR / Stripe tự động',
      steps: [
        {
          title: 'Bước 1: Tạo sản phẩm số',
          description: 'Vào mục Sản phẩm số, thêm sản phẩm mới (Khóa học, tài liệu Ebook, Gói phần mềm) và đặt giá bán (VND hoặc USD).',
        },
        {
          title: 'Bước 2: Cài đặt API key thanh toán',
          description: 'Vào cấu hình Cửa hàng, điền Client ID & API Key của PayOS (để tạo mã VietQR động chuyển khoản ngân hàng) hoặc Stripe Secret Key (cho thanh toán thẻ quốc tế).',
        },
        {
          title: 'Bước 3: Webhook đối soát giao dịch tự động',
          description: 'Khách hàng truy cập cổng mua sắm công khai, đặt hàng và thanh toán. Khi giao dịch thành công, PayOS/Stripe sẽ bắn Webhook bảo mật về hệ thống. Hệ thống tự động xác nhận đơn hàng PAID, nâng hạng khách hàng trên CRM và gửi email bàn giao sản phẩm tự động.',
          tip: 'Hệ thống sử dụng chữ ký bảo mật (Signature) để xác thực tính toàn vẹn của webhook, ngăn ngừa các giao dịch giả mạo.'
        }
      ]
    },
    {
      id: 'ai',
      icon: '🧠',
      title: 'Trí tuệ nhân tạo (AI)',
      subtitle: 'Soạn thảo văn bản chuẩn SEO, sáng tạo hình ảnh vector và phân tích dữ liệu tự động với AI',
      steps: [
        {
          title: 'Bước 1: Tương tác với AI Copilot',
          description: 'Vào mục Copilot để mở khung chat với trợ lý AI thông minh. Bạn có thể yêu cầu AI viết dàn ý, soạn thảo email marketing, sửa đổi giọng văn bài viết hoặc viết các đoạn mã code ngắn.',
        },
        {
          title: 'Bước 2: Soạn thảo nội dung & vẽ tranh AI',
          description: 'Vào mục Soạn thảo nội dung để lên nội dung bài viết. Chỉ cần nhập từ khóa và mô tả ngắn, AI sẽ tự động lập dàn ý chi tiết và viết bài viết chuẩn SEO, đồng thời gọi công cụ tạo ảnh AI sinh ra các vector minh họa theo phong cách cam-trắng tối giản.',
          tip: 'Bạn có thể chỉnh sửa lại bài viết dễ dàng thông qua bộ soạn thảo Rich Text Editor tích hợp sẵn.'
        },
        {
          title: 'Bước 3: Phân tích dữ liệu & Hành vi khách hàng (AI Analytics)',
          description: 'Truy cập Phân tích Bot để yêu cầu AI đọc và tổng hợp các chỉ số truy cập, phân tích thời gian ở lại trang, tỷ lệ thoát trang và đưa ra báo cáo chi tiết về thói quen duyệt web của khách hàng dưới dạng ngôn ngữ tự nhiên.'
        }
      ]
    },
    {
      id: 'chatbot',
      icon: '🤖',
      title: 'CSKH AI & Chatbot RAG',
      subtitle: 'Huấn luyện chatbot AI tự động tư vấn và phân loại lead CRM',
      steps: [
        {
          title: 'Bước 1: Cấu hình Bong bóng Live Chat',
          description: 'Vào CSKH & Chatbot AI, bật "Live Chat Widget" để hiển thị bong bóng chat trên các Landing Page. Bật "Trợ lý AI Chatbot" để kích hoạt chế độ trả lời tự động.',
        },
        {
          title: 'Bước 2: Nạp tri thức đa kênh (Knowledge Base)',
          description: 'AI cần tri thức để tư vấn sản phẩm. Bạn có 3 cách nạp tri thức: soạn thảo văn bản thủ công, tải lên tệp tài liệu (PDF, Word, TXT) hoặc nhập URL trang web doanh nghiệp để hệ thống tự động cào (crawl) nội dung.',
          tip: 'Nếu mô hình AI chính bị quá tải, hệ thống sẽ tự động chuyển hướng sang mô hình dự phòng Llama 3.2 để đảm bảo Chatbot luôn hoạt động 24/7.'
        },
        {
          title: 'Bước 3: AI tự động phân loại Lead CRM & Cảnh báo',
          description: 'Khi Chatbot thu thập được Email/SĐT của khách chat, hệ thống sẽ bắn cảnh báo tức thì về Telegram/Slack cho admin. Đồng thời, AI sẽ tự động đọc lịch sử chat, phân loại khách hàng thành HOT/WARM/COLD, chấm điểm tiềm năng và ghi Note phân tích chi tiết vào CRM.',
        }
      ]
    },
    {
      id: 'abtest',
      icon: '📊',
      title: 'A/B Testing & Gợi ý tăng trưởng',
      subtitle: 'Tối ưu hóa chuyển đổi bằng kiểm định thống kê Chi-Square, cấu hình cảnh báo lead mới',
      steps: [
        {
          title: 'Bước 1: Tạo chiến dịch thử nghiệm A/B',
          description: 'Vào phân hệ A/B Testing, chọn loại thử nghiệm (Social Post hoặc Landing Page). Chọn Biến thể A (Bản gốc) và Biến thể B (Bản thử nghiệm) để so sánh hiệu quả chuyển đổi.',
        },
        {
          title: 'Bước 2: Chốt Winner tự động & Xem AI Insights',
          description: 'Worker ngầm chạy mỗi phút để phân tích kiểm định Chi-Square (χ²). Khi tổng số impressions >= 200 và chênh lệch đạt độ tin cậy > 95% (chi² > 3.841), hệ thống tự chốt Winner. Đồng thời, xem các phân tích tăng trưởng thông minh tại Insights.',
          tip: 'Bạn có thể vào xem Thống kê chi tiết Chi-Square bất kỳ lúc nào và bấm nút "Chốt Winner" thủ công theo ý muốn.'
        },
        {
          title: 'Bước 3: Thiết lập Cảnh báo thông minh (Alerts)',
          description: 'Cấu hình Alerts để kết nối bot Telegram/Webhook Slack. Mỗi khi có khách hàng đăng ký biểu mẫu mới hoặc đơn hàng được thanh toán thành công, hệ thống sẽ gửi tin nhắn thông báo tức thì kèm thông tin cơ bản của lead.'
        }
      ]
    }
  ];

  const sectionsEn: Section[] = [
    {
      id: 'dashboard',
      icon: '📈',
      title: 'Reports & Traffic Sources',
      subtitle: 'Track traffic, campaign performance, and automated scheduling',
      steps: [
        {
          title: 'Step 1: Analyze Performance with Dashboard',
          description: 'View charts showing total clicks, impressions, revenue, and conversion rate (CR) in real-time. Filter data by date ranges or workspaces.',
        },
        {
          title: 'Step 2: Traffic Sources Management',
          description: 'Configure source channels (e.g., Facebook Ads, Google Ads, Direct, Email...). The system automatically parses UTM tag parameters to group incoming traffic, calculating exact ROI for marketing campaigns.',
        },
        {
          title: 'Step 3: Planning with Schedules',
          description: 'Manage content publishing dates, plan automated marketing campaigns, and monitor periodic backend background cron jobs.',
        }
      ]
    },
    {
      id: 'landing',
      icon: '📐',
      title: 'CMS & Landing Page Builder',
      subtitle: 'Design landing pages and manage SEO-friendly Blog content',
      steps: [
        {
          title: 'Step 1: Drag-and-drop Landing Page Design',
          description: 'Go to Landing Pages, click "Create new page". In the Visual Builder, drag and drop components (Hero Banner, Features, Signup Form, Pricing, Footer). You can edit images from Unsplash or change alignment (Left/Right/Center).',
          tip: 'Link your primary CTA button to the scroll anchor `#register-form` to guide visitors to the sign-up form quickly!'
        },
        {
          title: 'Step 2: Tracking Code Setup',
          description: 'In Landing Page settings, enter your Facebook Pixel ID or Google Tag Manager ID. The system automatically compiles and injects the script into the static HTML page for remarketing.',
        },
        {
          title: 'Step 3: SEO Blog CMS Writing',
          description: 'Go to Blog CMS to write articles using Markdown. The system supports generating articles with AI Copilot and auto-generating orange-and-white vector images. When published, the system renders lightweight static HTML for maximum Lighthouse scores (LCP < 1.2s).',
        }
      ],
      notes: 'Published landing pages live publicly under /p/:slug and automatically integrate the Live Chatbot bubble.'
    },
    {
      id: 'seo',
      icon: '🔍',
      title: 'SEO Audit & Link Building',
      subtitle: 'Optimize On-page SEO and monitor backlinks pointing to your website',
      steps: [
        {
          title: 'Step 1: Run Automatic SEO Audit',
          description: 'Go to SEO Audit, input the URL of the page you want to analyze. The system scans the page and identifies On-page SEO issues such as missing Meta Descriptions, incorrect heading tag structures (H1-H6), or images lacking ALT attributes.',
          tip: 'Resolve the system suggestions to significantly boost your organic search engine visibility on Google!'
        },
        {
          title: 'Step 2: Backlink Tracking',
          description: 'Register domains to track and audit backlinks pointing to your website. The system helps you monitor link-juice, detect malicious/spam links, and analyze referring domain metrics.',
        },
        {
          title: 'Step 3: Maintain SEO Technical Health',
          description: 'View comprehensive reports on page speed, indexability, and receive AI-powered code optimization tips to keep your website search-engine friendly.',
        }
      ]
    },
    {
      id: 'crm',
      icon: '👥',
      title: 'CRM & Custom Forms',
      subtitle: 'Collect Lead signup information and manage the customer funnel',
      steps: [
        {
          title: 'Step 1: Create Custom Forms for Leads',
          description: 'Go to Custom Forms, design required input fields (Full Name, Email, Phone, Company Name...). The system supports defining dynamic JSON form structures.',
        },
        {
          title: 'Step 2: Embed Form in Landing Page',
          description: 'In the Landing Page Visual Builder, choose the Custom Form to embed. When visitors submit data, the system automatically checks Rate Limiting for anti-spam and sends leads to the CRM.',
        },
        {
          title: 'Step 3: Manage Potential Customers',
          description: 'Signup details are automatically converted to Customer profiles in the CRM. You can filter customers by status labels (New, Contacted, VIP, or HOT/WARM/COLD scored by AI) or view detailed care notes.',
          tip: 'Use the "Import Customers" feature to upload leads from CSV or JSON files easily.'
        }
      ]
    },
    {
      id: 'automation',
      icon: '✉️',
      title: 'Email Automation & Drip',
      subtitle: 'Set up drip email campaigns for automated customer nurturing and broadcasts',
      steps: [
        {
          title: 'Step 1: Connect SMTP for Sending Emails',
          description: 'Go to Settings, configure your business SMTP account to grant the system permission to send personalized emails to customers.',
        },
        {
          title: 'Step 2: Set Up Email Workflows',
          description: 'Create an Email Automation campaign, select a trigger event (e.g., Form X submitted). Add email steps, fill subject/content, and set sending delays (e.g., immediate, after 1 day, after 3 days).',
          tip: 'Use dynamic tags like {{name}}, {{email}} to automatically personalize email content.'
        },
        {
          title: 'Step 3: Launch Broadcast Email Campaigns',
          description: 'In addition to automated workflows, you can create manual email campaigns (Email Campaigns) to instantly broadcast newsletters or promotional offers to targeted customer segments.'
        }
      ]
    },
    {
      id: 'store',
      icon: '🛍️',
      title: 'Store & Payment Gateways',
      subtitle: 'Sell digital products and auto-reconcile VietQR / Stripe transactions',
      steps: [
        {
          title: 'Step 1: Create Digital Products',
          description: 'Go to Digital Products, add a new product (Courses, Ebooks, Software package) and set the price (VND or USD).',
        },
        {
          title: 'Step 2: Configure Payment API Keys',
          description: 'Go to Store configuration, enter Client ID & API Key for PayOS (for dynamic VietQR bank transfers) or Stripe Secret Key (for international card payments).',
        },
        {
          title: 'Step 3: Webhook Auto-Reconciliation',
          description: 'Customers access the public store, place orders, and pay. Upon successful transaction, PayOS/Stripe triggers a secure webhook. The system auto-updates order status to PAID, tags the CRM lead, and emails the digital product.',
          tip: 'The system uses security signatures to verify webhook integrity and prevent fraudulent transactions.'
        }
      ]
    },
    {
      id: 'ai',
      icon: '🧠',
      title: 'Artificial Intelligence (AI)',
      subtitle: 'Generate content, design illustrations, and analyze data automatically with AI',
      steps: [
        {
          title: 'Step 1: Interact with AI Copilot',
          description: 'Go to the Copilot section to open a chat frame with the smart AI assistant. You can request AI to draft outlines, compose marketing emails, rewrite text tone, or write minor code snippets.',
        },
        {
          title: 'Step 2: Create SEO Content & AI Images',
          description: 'Go to Content Editor to write new posts. By inputting keywords and short descriptions, AI auto-creates detailed outlines, drafts SEO-friendly posts, and calls the AI image tool to generate minimalist orange-and-white vector graphics.',
          tip: 'You can easily refine the generated content using the built-in rich-text editor.'
        },
        {
          title: 'Step 3: Customer Behavior Analytics (AI Analytics)',
          description: 'Access Bot Analytics to ask AI to read and summarize user session logs, analyze average session duration, bounce rates, and produce detailed natural language insights about user browsing habits.'
        }
      ]
    },
    {
      id: 'chatbot',
      icon: '🤖',
      title: 'CSKH AI & Chatbot RAG',
      subtitle: 'Train the AI Chatbot to consult and classify CRM leads automatically',
      steps: [
        {
          title: 'Step 1: Configure Live Chat Bubble',
          description: 'Go to Customer Service & AI Chatbot, enable "Live Chat Widget" to display the chat bubble on Landing Pages. Enable "AI Chatbot Assistant" for automated responses.',
        },
        {
          title: 'Step 2: Populate Multi-channel Knowledge Base',
          description: 'AI needs knowledge to consult. You have 3 ways to input knowledge: manual text editing, uploading documents (PDF, Word, TXT), or entering website URLs for auto-crawling.',
          tip: 'If the primary AI model is overloaded, the system automatically falls back to Llama 3.2 to keep the chatbot online 24/7.'
        },
        {
          title: 'Step 3: AI Auto-classification of CRM Leads & Alerts',
          description: 'When the Chatbot collects Email/Phone, it immediately alerts the admin on Telegram/Slack. Simultaneously, AI reads the chat history, classifies the customer as HOT/WARM/COLD, scores the lead, and logs notes in the CRM.',
        }
      ]
    },
    {
      id: 'abtest',
      icon: '📊',
      title: 'A/B Testing & Growth Insights',
      subtitle: 'Optimize conversion rate using Chi-Square statistical testing and set up alert bots',
      steps: [
        {
          title: 'Step 1: Create an A/B Test Campaign',
          description: 'Go to A/B Testing, choose the test type (Social Post or Landing Page). Choose Variant A (Control) and Variant B (Test) to compare conversion performance.',
        },
        {
          title: 'Step 2: Promote Winners & View AI Insights',
          description: 'A background worker runs every minute to analyze Chi-Square (χ²). When total impressions >= 200 and confidence exceeds 95% (chi² > 3.841), the system auto-promotes the Winner. You can also view strategic optimization suggestions in the Insights tab.',
          tip: 'You can view the Chi-Square statistics details and promote the winner manually at any time.'
        },
        {
          title: 'Step 3: Setup Smart Alerts',
          description: 'Connect a Telegram bot token or Slack webhook under Alerts. Whenever a user submits a form or pays an order, the system pushes instant mobile notifications with basic lead info.'
        }
      ]
    }
  ];

  const sections = locale === 'vi' ? sectionsVi : sectionsEn;
  const active = sections.find(s => s.id === activeSection) || sections[0];

  const pageTitle = locale === 'vi' ? 'Hướng Dẫn Sử Dụng Hệ Thống' : 'System User Guide';
  const pageDesc = locale === 'vi' 
    ? 'Chào mừng bạn đến với Growth OS! Dưới đây là hướng dẫn chi tiết từng bước để cấu hình và làm chủ toàn bộ tính năng của hệ thống.' 
    : 'Welcome to Growth OS! Here is the step-by-step guide to configure and master all system features.';
  const modulesHeader = locale === 'vi' ? 'Các phân hệ chính' : 'Core Modules';
  const tipLabel = locale === 'vi' ? 'Mẹo:' : 'Tip:';
  const noteLabel = locale === 'vi' ? 'Lưu ý:' : 'Note:';

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader 
        title={pageTitle} 
        description={pageDesc} 
      />

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Left Side: Navigation Menu */}
        <div className="lg:col-span-1 space-y-2">
          <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{modulesHeader}</p>
          <div className="space-y-1">
            {sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                  activeSection === sec.id
                    ? 'bg-orange-500/15 text-[#f25c22] border border-orange-500/30 font-extrabold shadow-sm'
                    : 'bg-white border border-slate-200/50 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="leading-tight truncate">{sec.title}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Step-by-step Content */}
        <div className="lg:col-span-3 bg-white border border-slate-200/60 rounded-2xl p-6 md:p-8 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#f25c22] to-brand"></div>
          
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">{active.title}</h2>
              <p className="text-slate-500 text-xs mt-1">{active.subtitle}</p>
            </div>

            <div className="space-y-6 border-t border-slate-100 pt-6">
              {active.steps.map((step, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-brand text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    {idx < active.steps.length - 1 && (
                      <div className="w-0.5 bg-slate-100 flex-1 my-1"></div>
                    )}
                  </div>
                  <div className="space-y-1.5 pb-2">
                    <h4 className="font-extrabold text-slate-800 text-sm">{step.title}</h4>
                    <p className="text-slate-650 text-xs leading-relaxed">{step.description}</p>
                    {step.tip && (
                      <div className="bg-orange-50 border border-brand/15 rounded-lg p-2.5 text-[11px] text-brand leading-relaxed mt-2">
                        <b>{tipLabel}</b> {step.tip}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {active.notes && (
            <div className="mt-8 pt-4 border-t border-slate-150 text-[10px] text-slate-500 font-semibold">
              <b>{noteLabel}</b> {active.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
