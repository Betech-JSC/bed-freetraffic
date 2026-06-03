# SRS-FT-2026-001 — Đối chiếu & checklist test một lần

Tài liệu này dùng để QA sau khi chạy `npm run dev` (backend :4000, frontend :3000).

**Đăng nhập mặc định:** `admin@freetraffic.com` / `123456`

---

## Ma trận FR (Done / Partial / Out of scope)

| FR | Mô tả SRS | Trạng thái | Ghi chú test |
|----|-----------|------------|--------------|
| FR-01 | Quản lý kênh traffic | **Partial** | `/dashboard/sources` — thêm/sửa/xóa; kết nối FB/Email/Zalo ở Cài đặt |
| FR-02 | Lên lịch đăng đa kênh | **Done** | `/dashboard/schedule` — hẹn giờ, sửa, gửi ngay, lặp ngày/tuần, A/B |
| FR-03 | SEO audit URL | **Partial** | `/dashboard/seo` — audit + lịch sử; giới hạn `MAX_SEO_AUDITS_PER_DAY` |
| FR-04 | Từ khóa & rank | **Done** | `/dashboard/campaigns` |
| FR-05 | Dashboard tổng quan | **Done** | `/dashboard` |
| FR-06 | Báo cáo CSV/Excel/PDF | **Done** | `/dashboard/reports` — CSV, Excel (.xls XML), PDF |
| FR-07 | Backlink | **Partial** | `/dashboard/backlinks` — CRUD, discover, ước lượnh DA |
| FR-08 | A/B test | **Done** | `/dashboard/abtests` + gắn lịch/bot |
| FR-09 | GA4 / GSC | **Partial** | Cài đặt Google OAuth + `/dashboard/analytics` |
| FR-10 | Users RBAC | **Done** | `/dashboard/users` (ADMIN) |
| FR-11 | Cảnh báo | **Done** | `/dashboard/alerts` |
| FR-12 | Email campaign | **Done** | `/dashboard/email` — gửi/hẹn giờ/SMTP |
| Phase 3 | Gợi ý AI, 2FA | **Partial** | `/dashboard/insights`, 2FA trong Cài đặt |

**Chưa trong scope code (SRS gốc):** Lighthouse, Moz API thật, Mailchimp gửi list, YouTube upload API, i18n EN, Redis, coverage 80%.

---

## Sửa lỗi quan trọng (đợt rà soát này)

| Vấn đề | Cách xử lý |
|--------|------------|
| OAuth FB/Zalo popup 401 | Middleware đọc JWT từ cookie **hoặ** `Authorization`; popup dùng `apiFetch` |
| Xuất CSV/PDF 401 khi `window.open` | Đã dùng `apiFetch` + blob (reports) |
| A/B track click công khai | `GET /api/abtests/track/click/:id` không cần JWT |
| Email track open/click | Public trước `authenticate` trong router |
| Google OAuth callback | `GET /api/google/callback` public → redirect Settings |
| Legacy callback URL | `/dashboard/settings/fb-callback` → redirect `/oauth/fb-callback` |

---

## Checklist test theo luồng (≈30 phút)

### 0. Khởi động

```powershell
cd "D:\git\free traffic"
npm run db:generate -w apps/backend
npm run db:push -w apps/backend
npm run dev
```

- [ ] http://localhost:4000/api/health → `{ "status": "ok" }`
- [ ] http://localhost:3000/login → đăng nhập OK

### 1. FR-05 Dashboard

- [ ] `/dashboard` — biểu đồ/stats tải không lỗi đỏ

### 2. FR-04 Campaigns

- [ ] Thêm từ khóa → hiện bảng
- [ ] Xóa từ khóa → mất dòng

### 3. FR-01 Sources + Settings

- [ ] `/dashboard/sources` — Thêm kênh, **Sửa**, Xóa
- [ ] `/dashboard/settings` — Quick connect Email (SMTP test) nếu đã cấu hình
- [ ] Facebook OAuth: redirect URI = `http://localhost:3000/oauth/fb-callback` (popup đóng, không 401 JSON)
- [ ] Google: nút kết nối → callback → `?google=connected` trên Settings

### 4. FR-02 Schedule (Bot hẹn giờ)

- [ ] Tạo lịch PENDING vài phút tới → đợi worker 60s hoặc **Gửi ngay**
- [ ] Sửa lịch PENDING/FAILED
- [ ] Lặp daily/weekly (sau khi publish thành công)
- [ ] Chọn A/B test đang RUNNING

### 5. FR-03 SEO

- [ ] Audit 1 URL → điểm + checklist
- [ ] `Lịch sử` cùng URL — không 404

### 6. FR-07 Backlinks

- [ ] Thêm/sửa/xóa
- [ ] Discover (URL có HTML)
- [ ] Ước lượnh DA

### 7. FR-08 A/B

- [ ] Tạo test 2 template
- [ ] +imp / +click → CTR đổi
- [ ] Kết thúc → winner

### 8. FR-06 Reports

- [ ] CSV Traffic / Keywords — tải file, **không** mở tab JSON lỗi
- [ ] Excel Traffic / Keywords — file `.xls` mở được
- [ ] PDF — tải được

### 9. FR-12 Email

- [ ] Tạo campaign, gửi thử / hẹn giờ
- [ ] Sửa/xóa campaign SCHEDULED

### 10. FR-11 Alerts

- [ ] Tạo rule `sessions_drop_pct` hoặc `crawl_errors`
- [ ] Bật/tắt, xóa rule

### 11. FR-09 Analytics

- [ ] `/dashboard/analytics` — không crash (có thể dữ liệu mẫu nếu chưa GA)
- [ ] Settings → Sync Google

### 12. Automation + Content

- [ ] `/dashboard/content` — template CRUD + ảnh
- [ ] `/dashboard/automation` — tạo task, toggle, log
- [ ] Task gắn `abTestId` nếu có test RUNNING

### 13. Customers + Insights

- [ ] `/dashboard/customers` — CRUD, ghi chú, gửi care email
- [ ] `/dashboard/insights` — gợi ý; nút AI nếu có `OPENAI_API_KEY`

### 14. FR-10 Users (ADMIN)

- [ ] `/dashboard/users` — tạo user EDITOR

### 15. 2FA (tùy chọn)

- [ ] Settings → bật 2FA → logout → login + mã 6 số

---

## Endpoint cron (production)

```bash
curl -X POST "http://localhost:4000/api/schedules/dispatch-due" -H "x-cron-secret: YOUR_CRON_SECRET"
curl -X POST "http://localhost:4000/api/email-campaigns/dispatch-due" -H "x-cron-secret: YOUR_CRON_SECRET"
```

Dev: không cần secret nếu `NODE_ENV` không phải `production`.

---

## Biến môi trường quan trọng

| Biến | Mục đích |
|------|----------|
| `DATABASE_URL` | PostgreSQL |
| `JWT_SECRET` | Token đăng nhập |
| `API_PUBLIC_URL` | Link track email/A/B trong mail thật |
| `FRONTEND_URL` | Redirect Google OAuth |
| `CRON_SECRET` | Bảo vệ dispatch-due trên production |
| `GOOGLE_*`, `GA4_PROPERTY_ID`, `GSC_SITE_URL` | Analytics |
| `OPENAI_API_KEY` | Gợi ý AI nâng cao |

---

## Nếu gặp lỗi thường gặp

| Triệu chứng | Nguyên nhân | Xử lý |
|-------------|-------------|--------|
| `ECONNREFUSED 127.0.0.1:4000` | Backend chưa chạy / crash Prisma | `npm run dev -w apps/backend`, `db:generate` |
| JSON `Chưa đăng nhập` khi tải file | Gọi API không mang token | Dùng nút trên UI (đã fix reports); F5 login lại |
| OAuth popup lỗi máy chủ | Thiếu cookie hoặc backend | Login lại; kiểm tra backend log |
| Prisma field unknown | Schema lệch | `db:push` + `db:generate` |
