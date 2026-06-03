# Rà soát logic — Be Traffic (một lần QA)

## Kết luận nhanh

| Vấn đề bạn gặp | Nguyên nhân thật | Cách xử lý |
|----------------|------------------|------------|
| 404 `/api/backlinks/scan` | Process Node **cũ** trên cổng 4000, chưa load code mới | Tắt hết backend → chạy lại → `npm run check:backend` |
| `sourceUrl và targetUrl là bắt buộc` | Request quét đi nhầm vào **Thêm backlink** (backend cũ) | Cùng cách: restart backend mới |
| Build frontend lỗi `customers` notes `id` | Giao kiểu TypeScript `CustomerRow & CustomerDetail` | **Đã sửa** (`Omit<CustomerRow, 'notes'>`) |

---

## Logic quét backlink (FR-07) — đúng SRS

| Ô UI | Tham số API | Vai trò |
|------|-------------|---------|
| URL site của bạn (đích) | `targetUrl` | Domain cần tìm link **trỏ về** (vd. betech-digital.com) |
| Trang cần quét (nguồn) | `scanUrl` | Trang HTML để quét (vd. bài trên daotao.hcmunre.edu.vn) |

**Luồng:** Tải HTML trang `scanUrl` (hoặc `targetUrl` nếu để trống) → tìm thẻ `<a href>` trỏ về host của `targetUrl` → lưu DB `sourceUrl` = trang quét, `targetUrl` = URL link tìm được.

**API:** `GET /api/backlinks/scan?targetUrl=...&scanUrl=...`

---

## Ma trận Frontend ↔ Backend (đã khớp)

| Trang | Gọi API | Backend |
|-------|---------|---------|
| Backlinks list | `GET /backlinks` | ✓ |
| Quét | `GET /backlinks/scan` | ✓ `index.ts` |
| Thêm/Sửa | `POST/PATCH /backlinks` | ✓ |
| Ước lượnh DA | `POST /backlinks/:id/estimate-da` | ✓ (đặt sau `/scan`, không nuốt route) |
| Campaigns | `GET/POST/DELETE /keywords` | ✓ |
| Schedule | `GET/POST/PATCH /schedules`, `POST .../send-now` | ✓ |
| OAuth FB/Zalo | `/oauth/*` → `apiFetch` + cookie JWT | ✓ |
| Google | `GET /google/callback` public | ✓ |
| A/B track click | `GET /abtests/track/click/:id` public | ✓ |
| Email track | `GET /email-campaigns/track/*` public | ✓ |
| Reports export | `apiFetch` blob CSV/PDF/XLS | ✓ |
| Users | `/users` (ADMIN trong router) | ✓ |

---

## Checklist chạy một lần (copy cho QA)

```powershell
cd "D:\git\free traffic"

# 1. Tắt backend cũ (nếu cần)
netstat -ano | findstr :4000
# taskkill /PID <PID_LISTENING> /F

# 2. DB + chạy
npm run db:generate -w apps/backend
npm run dev

# Terminal khác:
npm run check:backend
# Phải: OK backlinks-scan

# 3. Build
npm run build
```

**Trình duyệt:** Login → Backlinks → không còn banner "Backend chưa cập nhật" → Quét với 2 URL → thông báo xanh.

---

## Lỗi không chặn app (có thể bỏ qua khi test FR-07)

- `PERMISSION_DENIED` GA4: sai quyền / Property ID Google.
- `GSC_SITE_URL` chưa set: organic dùng mẫu.

---

## Phiên bản API

`GET /api/health` trả `apiVersion` + `features`. Cần có `backlinks-scan` trong `features`.
