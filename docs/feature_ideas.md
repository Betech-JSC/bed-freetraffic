# Định hướng phát triển tính năng: Đồng bộ Đa kênh & Landing Page (Facebook Pages, Zalo OA)

Tài liệu này ghi chú lại ý tưởng và thiết kế sơ bộ cho tính năng kết hợp quản lý **Landing Page (Trình thiết kế web)** và **Facebook Page / Zalo OA (Mạng xã hội & CSKH)** trong hệ thống Free Traffic OS.

---

## 1. Mục tiêu & Ý nghĩa thực tiễn
Tạo ra một quy trình khép kín giúp người dùng:
1. **Thu hút (Traffic)**: Xuất bản Landing Page và tự động đăng bài quảng bá lên nhiều Fanpage/Zalo OA để hút traffic tự nhiên.
2. **Chuyển đổi (Conversion)**: Khách hàng vào Landing Page điền Form, thông tin tự động đồng bộ về CRM.
3. **Chăm sóc (Customer Care)**: Nhúng trực tiếp hộp chat Messenger/Zalo Chat lên Landing Page để AI Chatbot tự động trả lời 24/7 và đồng bộ hội thoại về Live Chat Console.
4. **Tối ưu hóa (Optimization)**: Đồng bộ mã theo dõi Pixel và bắn sự kiện chuyển đổi thời gian thực qua Conversions API.

---

## 2. Chi tiết các tính năng đề xuất

### A. Quản lý Đa Fanpage / Đa Zalo OA
* **Hiện trạng**: Mỗi workspace chỉ được liên kết 1 Facebook Page và 1 Zalo OA (ràng buộc `@@unique([platform, workspaceId])` trong `SocialConnection`).
* **Ý tưởng mới**:
  * Chuyển đổi thành `@@unique([platform, pageId, workspaceId])` để cho phép kết nối không giới hạn số lượng Page.
  * Hỗ trợ giao diện danh sách kết nối trong phần Cài đặt.
  * Hỗ trợ chọn chính xác các Page đích khi Đặt lịch đăng bài (`ContentSchedule`).

### B. Đăng bài viết Landing Page một chạm lên Facebook Pages (One-Click Cross-Publishing)
* **Ý tưởng**:
  * Khi người dùng thiết kế xong Landing Page trên Builder và nhấn "Xuất bản", hệ thống hiển thị tùy chọn **"Chia sẻ lên mạng xã hội"**.
  * Tự động sinh link kèm tham số UTM để theo dõi nguồn truy cập (ví dụ: `utm_source=facebook&utm_medium=social&utm_campaign=landing_page_A`).
  * Gọi API của Facebook/Zalo để đăng bài viết kèm link xem trước Landing Page lên các Fanpage đã chọn.

### C. Nhúng Messenger Chat Widget lên Landing Page
* **Ý tưởng**:
  * Người dùng có thể tích hợp trực tiếp khung chat Messenger của Fanpage vào Landing Page bằng cách gạt nút **"Bật Messenger Chat"** trong cài đặt trang.
  * Backend tự động nhúng mã Facebook Customer Chat SDK kèm `pageId` của Fanpage tương ứng vào mã HTML khi biên dịch trang tĩnh.
  * Tin nhắn từ trang đích sẽ đổ về API Webhook của hệ thống, cho phép tư vấn viên phản hồi trực tiếp hoặc để AI Bot tự động RAG trả lời.

### D. Đồng bộ Sự kiện Chuyển đổi (Facebook Pixel & Conversions API)
* **Ý tưởng**:
  * Tự động cấu hình Facebook Pixel (`fbPixelId`) để đo lường các hành động: Xem trang (`PageView`), Điền form (`Lead`), Đặt hàng (`Purchase`).
  * Khi hành động điền form/đặt hàng thành công, hệ thống gọi API Facebook Conversions từ server để báo cáo chuyển đổi chính xác, bỏ qua các trình chặn quảng cáo hay cơ chế chặn cookie của trình duyệt (iOS 14.5+).

---

## 3. Kế hoạch triển khai kỹ thuật sơ bộ

### 1. Cơ sở dữ liệu (`schema.prisma`):
* Nâng cấp duy nhất trên `SocialConnection` sang đa bản ghi (`platform, pageId, workspaceId`).
* Thêm trường `enableMessengerChat Boolean @default(false)` vào `LandingPage`.

### 2. Giao diện người dùng (Frontend):
* Bổ sung nút **"Chia sẻ Fanpage"** trong danh sách quản lý Landing Page.
* Thêm cấu hình bật/tắt nhúng Chat widget trong trình thiết kế Builder.

### 3. API & Webhook (Backend):
* Cổng webhook `/api/webhooks/facebook` để nhận tin nhắn của người dùng và route theo `pageId` của từng kết nối để AI tự động phản hồi.
