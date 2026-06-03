# Kế hoạch & tiến độ Phase 2/3 (SRS-FT-2026-001)

## Đã triển khai trong đợt này

| FR | Hạng mục | Ghi chú |
|----|----------|---------|
| FR-12 | Worker `emailCampaignEngine` + `dispatch-due` | Gửi campaign `SCHEDULED` mỗi 60s |
| FR-12 | UI email: hẹn giờ, sửa, xóa | |
| FR-02 | Sửa lịch `ContentSchedule` (PATCH có validate) | UI sửa PENDING/FAILED |
| FR-08 | Chọn template A/B, click, winner theo CTR | Nút ghi nhận thủ công (+imp/+click) |
| FR-11 | Metric `sessions_drop_pct`, `crawl_errors` | Dedupe alert 24h/rule |
| FR-11 | UI bật/tắt, xóa rule | |
| FR-07 | UI sửa/xóa backlink, linkType | |
| FR-03 | Audit: tốc độ, internal link, H2, HTML size | `GET /seo/history?url=` + UI tiến độ |

## Đợt 2 (đã triển khai)

| FR | Hạng mục |
|----|----------|
| FR-02 | `repeatRule` daily/weekly + `repeatUntil`; tự lên lịch lần sau khi gửi OK |
| FR-08 | Gắn `abTestId` trên lịch; resolve mẫu A/B + track click khi publish |
| FR-06 | `GET /reports/export/pdf` + nút PDF trên UI |
| FR-07 | `POST /backlinks/discover` quét link ngoài từ HTML trang |

**Sau deploy:** `npm run db:push` (cột `repeatRule`, `repeatUntil`, `abTestId` trên `ContentSchedule`).

## Đợt 3 (đã triển khai)

| Hạng mục | Ghi chú |
|----------|---------|
| Gợi ý AI | `/dashboard/insights` — rule-based + nút OpenAI |
| FR-08 Automation + A/B | `abTestId` trên task, bot dùng `resolveAutomationPost` |
| FR-02 kênh mở rộng | YouTube + Community (hướng dẫn đăng tay) |
| FR-03 OI-01 | `MAX_SEO_AUDITS_PER_DAY` (mặc định 20) |
| FR-07 DA | Nút ước lượnh DA trên backlink |
| FR-12 Mailchimp | `GET /integrations/mailchimp/status` |
| NFR 2FA | TOTP setup/bật/tắt trong Cài đặt; login hỗ trợ mã 6 số |
| Fix | `/api/abtests` không bọc `authenticate` toàn router (track click công khai) |

## Đợt rà soát SRS (mới nhất)

| Hạng mục | Ghi chú |
|----------|---------|
| OAuth cookie + `apiFetch` popup | Sửa 401 callback FB/Zalo |
| FR-06 Excel | `GET /reports/export/xlsx` + nút UI |
| FR-01 Sửa kênh | UI `PUT /channels/:id` trên Sources |
| Mailchimp status | Hiển thị trong Cài đặt |
| QA | Xem `docs/SRS-COMPLIANCE.md` |

## Còn lại (hậu SRS)

- Lighthouse audit, cron expression lịch lặp
- Moz API DA thật, Mailchimp gửi list
- Upload API YouTube, Reddit API
- i18n EN toàn app, test 80%, Redis

## Deploy cron (production)

```bash
# Mỗi phút
curl -X POST "https://API/api/schedules/dispatch-due" -H "x-cron-secret: $CRON_SECRET"
curl -X POST "https://API/api/email-campaigns/dispatch-due" -H "x-cron-secret: $CRON_SECRET"
```

Backend phải chạy 24/7 hoặc dùng cron gọi hai endpoint trên.
