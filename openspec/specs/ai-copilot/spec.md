# AI Copilot Specification

## Purpose
Trợ lý lập kế hoạch nội dung và tạo bài đăng tự động đa kênh (Facebook, Zalo OA, Email) bằng trí tuệ nhân tạo (AI) giúp tối ưu tỷ lệ nhấp chuột (CTR) và đơn giản hóa quy trình marketing.

## Requirements

### Requirement: Lập kế hoạch nội dung tự động (AI Content Plan)
Hệ thống SHALL cho phép người dùng nhập chủ đề, lĩnh vực và giọng điệu để tự động sinh kế hoạch bài viết cho 3, 5, hoặc 7 ngày tiếp theo.

#### Scenario: Sinh kế hoạch bài viết thành công
- **GIVEN** người dùng đã chọn chủ đề "Khuyến mãi hè", lĩnh vực "Thời trang", giọng điệu "Thuyết phục", và số ngày là 5.
- **WHEN** người dùng nhấn nút "Tạo kế hoạch" (Generate Plan).
- **THEN** hệ thống SHALL gọi LLM để sinh một danh sách gồm 5 bài viết chi tiết, phân bổ theo các kênh (Facebook, Zalo, Email).
- **AND** gợi ý khung giờ đăng vàng tương ứng với mỗi ngày (ví dụ: 09:00, 12:00, 20:00).
- **AND** hiển thị kết quả trực quan dạng dòng thời gian (Timeline) hoặc lịch lưới (Grid Calendar).

---

### Requirement: Tự động đóng dấu ảnh AI (AI Image Generation & Watermark)
Hệ thống SHALL hỗ trợ sinh ảnh minh họa bằng AI dựa trên nội dung bài viết và cho phép tự động đóng dấu bản quyền thương hiệu lên hình ảnh trước khi lưu hoặc xuất bản.

#### Scenario: Sinh ảnh và đóng dấu bản quyền thành công
- **GIVEN** một bài viết trong kế hoạch đã được sinh ra.
- **WHEN** người dùng bấm nút "Tạo ảnh" (hoặc chọn tự động tạo ảnh kèm dấu watermark "© Betech JSC").
- **THEN** hệ thống SHALL gọi mô hình sinh ảnh AI (DALL-E 2 hoặc AI Horde fallback) để vẽ hình minh họa phù hợp với tiêu đề/prompt của bài viết.
- **AND** chèn dòng chữ watermark "© Betech JSC" ở vị trí góc phải bên dưới của ảnh (bottom-right) với kích thước và màu sắc tối ưu.
- **AND** lưu ảnh đã xử lý vào thư mục lưu trữ cục bộ (`/uploads`) và cập nhật URL xem trước cho bài viết.
