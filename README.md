# Growth OS — Hệ thống Tối ưu hóa Traffic & Bán hàng Tự động (All-in-One)

Nền tảng **Growth OS (Free Traffic)** là một giải pháp All-in-One khép kín được xây dựng trên mô hình Multi-tenant (Đa người thuê), hỗ trợ các doanh nghiệp tự động hóa toàn bộ phễu marketing, SEO, quản trị nội dung, thu thập Lead, email chăm sóc tự động, và cổng thanh toán đối soát trực tuyến.

---

## 🏗️ Kiến trúc & Công nghệ sử dụng (Tech Stack)

### 1. Tầng Backend (API Server)
- **Runtime**: Node.js với TypeScript.
- **Framework**: Express.js.
- **Database ORM**: Prisma Client kết nối cơ sở dữ liệu đám mây PostgreSQL.
- **Worker & Queue**: Hàng đợi gửi mail ngầm kết hợp trình lập lịch tác vụ tự động (`node-cron`).
- **Nội dung & Dịch vụ**: Tích hợp các SDK chính thức của Google APIs (Analytics & Search Console), PayOS SDK, Stripe API, và Nodemailer.

### 2. Tầng Frontend (Dashboard & Builder)
- **Framework**: Next.js (App Router) dùng React & TypeScript.
- **Styling**: Tailwind CSS & CSS nguyên bản (Vanilla CSS) với giao diện tối hiện đại, hiệu ứng bo góc mượt mà và chuyển màu gradient thương hiệu.
- **Client API**: Module `apiJson` tự động đính kèm Token xác thực và Header `x-workspace-id` từ `localStorage`.

---

## ⚙️ Các Phân hệ chính của Hệ thống (Core Modules)

### 1. Phân hệ Quản trị Không gian làm việc (Multi-tenant Workspace)
- Cách ly hoàn toàn dữ liệu giữa các doanh nghiệp dựa trên `workspaceId`.
- Bộ chuyển đổi nhanh Workspace trực quan (Workspace Switcher) tích hợp trên thanh điều hướng bên.

### 2. Phân hệ Organic Traffic & SEO Tool
- **SEO Onpage Auditor**: Tự động thu thập, thu thập dữ liệu (Crawler) và chấm điểm PageSpeed của trang web.
- **Backlink Auditor**: Quét và kiểm tra tính hợp lệ của các backlink trỏ về web.
- **Golden Hour Planner**: Đề xuất thời gian gửi email chiến dịch tối ưu dựa trên tương tác thực tế của khách hàng.
- **GSC & GA4 Sync Engine**: Đồng bộ chỉ số nhấp chuột, hiển thị, từ khóa SEO và chuyển đổi thực tế từ tài khoản Google.

### 3. Phân hệ CMS Blog (SEO Content)
- Trình soạn thảo và quản lý bài đăng chuẩn SEO hỗ trợ Markdown.
- Tiện ích biên dịch Markdown sang HTML tự động tối ưu hóa tốc độ tải và thẻ Meta Description của Google.

### 4. Phân hệ Landing Page & Visual Builder
- Canvas kéo thả thiết kế trang trực quan không cần viết mã (Banner, Tính năng, Form).
- Tự động biên dịch cấu trúc thiết kế JSON thành mã HTML tĩnh tối ưu điểm Lighthouse (LCP < 1.2s).
- Hỗ trợ chèn riêng mã Facebook Pixel ID và Google Tag Manager phục vụ tiếp thị lại (Remarketing).

### 5. Phân hệ Custom Forms & Lead Capturing (CRM)
- Tự định nghĩa số lượng và kiểu của các trường nhập dữ liệu biểu mẫu.
- Tự động lọc và đồng bộ dữ liệu vào danh sách CRM khách hàng (`Customer`) ngay khi có submission.
- Cơ chế Rate Limiting bảo vệ máy chủ ngăn chặn tin nhắn rác.

### 6. Phân hệ Tự động hóa Email (Drip Campaigns)
- Thiết lập kịch bản gửi mail chuỗi tự động theo sơ đồ Timeline (gửi ngay, trì hoãn X phút).
- Worker nền tự động quét hàng đợi, cá nhân hóa nội dung qua các thẻ động `{{name}}`, `{{email}}`, và tự động xếp lịch bước kế tiếp.

### 7. Phân hệ Cửa hàng & Cổng thanh toán Tự động
- Quản lý danh mục sản phẩm số, dịch vụ đi kèm giá.
- Sinh liên kết thanh toán VietQR động (qua PayOS) và cổng Stripe quốc tế.
- Webhook đối soát giao dịch tự động có đối chiếu chữ ký bảo mật (Signature), cập nhật đơn hàng thành `PAID` và nâng hạng khách hàng trên CRM tức thì.

### 8. Phân hệ CSKH AI & Chatbot
- Live Chat widget hiển thị trực tiếp trên Landing Page.
- Huấn luyện Chatbot trả lời khách hàng tự động dựa trên tài liệu tri thức tải lên (Knowledge Base).
- Nhận thông báo lead/đơn hàng mới tức thì qua các kênh Zalo, Email, Slack.

---

## 🚀 Khởi chạy dự án dưới Local

### 1. Yêu cầu hệ thống
- Đã cài đặt **Node.js v18+** và **PostgreSQL** (hoặc dùng Neon Cloud).

### 2. Cài đặt các thư viện
```bash
npm install
```

### 3. Thiết lập biến môi trường
Tạo file `.env` tại thư mục `apps/backend/` và cấu hình các trường:
```env
DATABASE_URL="postgresql://username:password@host/db?sslmode=require"
PORT=4000
```

### 4. Khởi tạo Database
```bash
npm run db:push -w apps/backend
```

### 5. Chạy môi trường nhà phát triển (Local Development)
```bash
npm run dev
```
- Frontend chạy tại: `http://localhost:3000`
- Backend chạy tại: `http://localhost:4000`
