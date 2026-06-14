# Multi-tenant Language Management — Roadmap

## Tổng quan

Dự án nâng cấp hệ thống Multilanguage Translator từ cấu hình ngôn ngữ **hardcode** sang **dynamic per-company**, cho phép mỗi công ty tự chọn ngôn ngữ cho domain của họ.

---

## Trạng thái các Phase

| Phase | Tên | Thời gian | Trạng thái |
|-------|-----|-----------|------------|
| 1 | Database & Backend Core | 3–4 ngày | ✅ HOÀN THÀNH |
| 2 | API Layer | 2–3 ngày | 🔲 Chưa bắt đầu |
| 3 | Frontend — Admin UI | 2–3 ngày | 🔲 Chưa bắt đầu |
| 4 | Kết nối luồng dịch với DB | 2 ngày | 🔲 Chưa bắt đầu |
| 5 | Dynamic Glossary Pairs | 1–2 ngày | 🔲 Chưa bắt đầu |

---

## Phase 1 — Database & Backend Core ✅

**Guide:** [PHASE1_IMPLEMENTATION_GUIDE.md](PHASE1_IMPLEMENTATION_GUIDE.md)

**Đã hoàn thành:**
- Model `Language` (master ngôn ngữ — thay thế dict hardcode)
- Model `Company` (tenant)
- Model `CompanyLanguage` (mapping company ↔ ngôn ngữ, với partial unique index)
- Thêm FK `company` + `preferred_language` vào `CustomUser`
- Model `LanguageAuditLog`
- Migration 0032: schema
- Migration 0033: seed 10 ngôn ngữ vào DB
- Migration 0034: tạo company "Toray", kích hoạt tất cả ngôn ngữ, gán users
- `CompanyLanguageService` (enable / disable / set_default / get_default)
- AuditLog signal + đăng ký vào `apps.py`

---

## Phase 2 — API Layer

**Guide:** [PHASE2_IMPLEMENTATION_GUIDE.md](PHASE2_IMPLEMENTATION_GUIDE.md)

**Mục tiêu:** Expose REST API để frontend và admin có thể quản lý ngôn ngữ theo company.

**Endpoints cần tạo:**
```
GET  /api/languages/                                    — Danh sách tất cả ngôn ngữ hệ thống
GET  /api/companies/{id}/languages/                     — Ngôn ngữ của 1 company
POST /api/companies/{id}/languages/{lang_id}/enable/    — Bật ngôn ngữ
POST /api/companies/{id}/languages/{lang_id}/disable/   — Tắt ngôn ngữ
POST /api/companies/{id}/languages/{lang_id}/set-default/ — Đặt mặc định
GET  /api/companies/{id}/languages/audit-log/           — Lịch sử thao tác
```

**Files cần tạo/sửa:**
- `api/serializers/language.py` (tạo mới)
- `api/views/language.py` (tạo mới)
- `api/urls/language.py` (tạo mới)
- `api/urls/__init__.py` (thêm route)

---

## Phase 3 — Frontend Admin UI

**Guide:** [PHASE3_IMPLEMENTATION_GUIDE.md](PHASE3_IMPLEMENTATION_GUIDE.md)

**Mục tiêu:** Trang quản lý ngôn ngữ cho Admin — bật/tắt/đặt mặc định ngôn ngữ cho company.

**Components cần tạo:**
- `src/pages/admin/LanguageManagement.jsx` — trang chính
- `src/components/features/language/LanguageToggleCard.jsx` — card 1 ngôn ngữ
- `src/services/languageService.js` — API calls
- Route mới trong `App.jsx`

**UI:**
- Danh sách ngôn ngữ dạng card với toggle on/off
- Badge "Default" cho ngôn ngữ mặc định
- Button "Set as Default"
- Tab Audit Log

---

## Phase 4 — Kết nối luồng dịch với DB

**Guide:** [PHASE4_IMPLEMENTATION_GUIDE.md](PHASE4_IMPLEMENTATION_GUIDE.md)

**Mục tiêu:** Thay thế các dict/array ngôn ngữ hardcode bằng query từ DB, theo company của user đang đăng nhập.

**Vấn đề hiện tại:** Ngôn ngữ được hardcode ở 6+ nơi:
- `Translate_v2/detect_lang.py` — `LANGUAGES` dict
- `api/services/glossary_service.py` — `LANG_MAP` dict
- Frontend: `LanguageSelector.jsx`, `constants.js`, và nhiều file khác

**Thay đổi chính:**
- Backend: `TranslateFileView` / `TranslateTextView` lấy ngôn ngữ từ `company` của user
- Frontend: `LanguageSelector` gọi API thay vì dùng constant hardcode
- Validate ngôn ngữ dịch dựa trên danh sách enabled của company

---

## Phase 5 — Dynamic Glossary Pairs

**Guide:** [PHASE5_IMPLEMENTATION_GUIDE.md](PHASE5_IMPLEMENTATION_GUIDE.md)

**Mục tiêu:** Thay thế dict `language_pair` hardcode (44 cặp) bằng auto-generate từ danh sách ngôn ngữ active.

**Vấn đề hiện tại:**
- `Translate_v2/create_glossary.py` có 44 cặp hardcode với ID số nguyên tuần tự
- Khi thêm ngôn ngữ mới → phải cập nhật thủ công dict này

**Giải pháp:**
- Dùng `itertools.combinations` để tự tạo pairs từ danh sách ngôn ngữ
- Glossary ID = `toray_glossary_{lang1}_{lang2}` (dùng code thay số)
- Khi company bật ngôn ngữ mới → tự động tạo glossary pairs cần thiết

---

## Dependency giữa các Phase

```
Phase 1 (DB) ──► Phase 2 (API) ──► Phase 3 (Frontend)
                      │
                      └──────────► Phase 4 (Luồng dịch)
                                        │
                                        └──► Phase 5 (Glossary)
```

Phase 4 và 5 có thể làm song song với Phase 3 sau khi Phase 2 xong.
