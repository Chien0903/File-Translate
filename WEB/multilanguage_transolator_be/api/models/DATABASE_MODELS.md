# Tài liệu Database Models — Multilanguage Translator

> Thư mục: `api/models/`  
> Tất cả bảng dưới đây được Django tự động tạo trong database thông qua Migration.

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [CustomUser — Bảng người dùng](#2-customuser)
3. [Language — Bảng ngôn ngữ](#3-language)
4. [KeywordSuggestion — Từ khóa gợi ý](#4-keywordsuggestion)
5. [PrivateKeyword — Từ khóa riêng](#5-privatekeyword)
6. [KeywordQueue — Hàng chờ từ khóa](#6-keywordqueue)
7. [LibraryQueueSettings — Cấu hình hàng chờ](#7-libraryqueuesettings)
8. [TranslatedFile — Lịch sử file dịch](#8-translatedfile)
9. [Notification — Thông báo](#9-notification)
10. [RefreshToken — Token xác thực](#10-refreshtoken)
11. [Sơ đồ quan hệ giữa các bảng](#11-sơ-đồ-quan-hệ)
12. [Các ràng buộc đặc biệt](#12-các-ràng-buộc-đặc-biệt)

---

## 1. Tổng quan kiến trúc

Hệ thống có **3 nhóm chức năng** chính, mỗi nhóm có các bảng riêng:

```
┌─────────────────────────────────────────────────────────┐
│  NHÓM 1: Quản lý người dùng & ngôn ngữ                   │
│  CustomUser          Language (bật/tắt + default toàn hệ │
│                       thống, do Admin cấu hình)           │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  NHÓM 2: Hệ thống Glossary (từ điển chuyên ngành)       │
│  KeywordSuggestion ──── PrivateKeyword ──── KeywordQueue │
│  LibraryQueueSettings                                    │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  NHÓM 3: Hoạt động dịch thuật & hệ thống                │
│  TranslatedFile  ──── Notification ──── RefreshToken     │
└─────────────────────────────────────────────────────────┘
```

---

## 2. CustomUser

**File:** `user.py` | **Tên bảng DB:** `api_customuser`

Bảng trung tâm của hệ thống. Kế thừa từ `AbstractBaseUser` của Django nên tích hợp sẵn mã hóa password, hệ thống permission.

### Các trường

| Trường | Kiểu | Bắt buộc | Mô tả |
|--------|------|----------|-------|
| `id` | BigInt (PK) | Tự động | Khóa chính, tự tăng |
| `email` | EmailField (UNIQUE) | Có | Dùng làm username đăng nhập |
| `password` | CharField | Có | Được mã hóa tự động bằng `set_password()` |
| `first_name` | CharField(30) | Không | Tên |
| `last_name` | CharField(30) | Không | Họ |
| `department` | CharField(100) | Không | Phòng ban |
| `role` | CharField(20) | Có | Vai trò: `User` / `Admin` / `Library Keeper` |
| `is_active` | Boolean | Có | `True` = tài khoản hoạt động |
| `is_staff` | Boolean | Có | `True` = truy cập được Django Admin |
| `date_joined` | DateTime | Tự động | Thời điểm tạo tài khoản |

### Vai trò (role)

| Role | Quyền |
|------|-------|
| `User` | Dịch file, quản lý từ khóa cá nhân, xem lịch sử của mình |
| `Admin` | Tất cả quyền User + quản lý người dùng, cấu hình ngôn ngữ công ty |
| `Library Keeper` | Tất cả quyền User + duyệt/từ chối từ khóa trong glossary |

### Lưu ý kỹ thuật

- `USERNAME_FIELD = 'email'` → đăng nhập bằng email, không phải username
- Password **không bao giờ** lưu dạng plaintext — Django tự hash bằng PBKDF2
- Khi xóa User → tất cả `TranslatedFile`, `Notification`, `RefreshToken`, `PrivateKeyword` liên quan **cũng bị xóa** (`CASCADE`)

---

## 3. Language

**File:** `language.py` | **Tên bảng DB:** `api_language`

Bảng master chứa ngôn ngữ hệ thống hỗ trợ. **Cố định đúng 4 ngôn ngữ**: English, Japanese, Vietnamese, Chinese (zh-CN) — seed sẵn qua migration. Không còn trang quản trị nào cho bảng này — `GET /api/languages/` là API duy nhất còn lại, chỉ đọc, dùng bởi `useEnabledLanguages` (frontend) để lấy danh sách ngôn ngữ cho các dropdown chọn ngôn ngữ dịch.

### Các trường

| Trường | Kiểu | Bắt buộc | Mô tả |
|--------|------|----------|-------|
| `id` | BigInt (PK) | Tự động | Khóa chính |
| `code` | CharField(10) UNIQUE | Có | Mã ISO, VD: `vi`, `ja`, `zh-CN`, `en` |
| `name` | CharField(100) | Có | Tên tiếng Anh, VD: "Vietnamese" |
| `native_name` | CharField(100) | Không | Tên bản ngữ, VD: "Tiếng Việt", "日本語" |
| `flag_emoji` | CharField(10) | Không | Emoji quốc kỳ, VD: 🇻🇳, 🇯🇵 |
| `sort_order` | PositiveSmallInt | Có | Thứ tự hiển thị trong dropdown |

### Lưu ý kỹ thuật

- `sort_order` quyết định thứ tự hiển thị: số nhỏ hơn hiển thị trước
- 4 ngôn ngữ cố định seed qua migration `0033_seed_initial_languages` (vi/ja/en gốc) + `0042_fixed_four_languages` (thêm lại zh-CN) — muốn đổi tập ngôn ngữ phải sửa trực tiếp qua Django shell/migration, không có UI/API cho việc này
- Trước đây hệ thống có bảng `Company`/`CompanyLanguage` để cấu hình theo từng công ty (multi-tenant), nhưng thực tế chỉ từng dùng 1 công ty duy nhất — đã gỡ bỏ ở migration 0039–0040
- Trước đây còn có field `is_active` (bật/tắt) và tính năng Add/Remove ngôn ngữ tuỳ ý qua UI — đã gỡ bỏ ở migration 0041, khoá cứng thành 4 ngôn ngữ ở migration 0042
- Trước đây còn có field `is_default` + trang Language Management để chọn ngôn ngữ mặc định (`SetDefaultLanguageView`, unique partial index `unique_default_language`) — cả trang lẫn field đều đã gỡ bỏ hoàn toàn ở migration 0043 vì không còn UI nào sử dụng

---

## 4. KeywordSuggestion

**File:** `keyword.py` | **Tên bảng DB:** `api_keywordsuggestion`

Từ khóa được gợi ý để đưa vào glossary chung của hệ thống. Cần được Admin/Library Keeper duyệt trước khi có hiệu lực.

### Các trường

| Trường | Kiểu | Bắt buộc | Mô tả |
|--------|------|----------|-------|
| `id` | BigInt (PK) | Tự động | Khóa chính |
| `user` | FK → CustomUser (SET_NULL) | Không | Người đề xuất |
| `translations` | JSONField | Có | Bản dịch theo từng ngôn ngữ, VD: `{"en": "valve", "ja": "バルブ", "vi": "van"}` |
| `suggestion_count` | IntegerField | Có | Số lần được đề xuất |
| `frequency_percentage` | FloatField | Có | Tỷ lệ % tần suất xuất hiện |
| `status` | CharField(20) | Có | `pending` / `approved` / `rejected` |
| `approved_by` | FK → CustomUser (SET_NULL) | Không | Người duyệt |
| `created_at` | DateTime | Tự động | Ngày tạo |
| `updated_at` | DateTime | Tự động | Ngày cập nhật |

### Vòng đời của KeywordSuggestion

```
User đề xuất → status: "pending"
                    ↓
        Library Keeper / Admin xem xét
           ↙                    ↘
    Duyệt (approve)         Từ chối (reject)
  status: "approved"        status: "rejected"
  → PrivateKeyword của       → Không đưa vào
    user liên kết với          glossary chung
    suggestion này
```

---

## 5. PrivateKeyword

**File:** `keyword.py` | **Tên bảng DB:** `api_privatekeyword`

Từ khóa riêng của từng user. Chỉ user đó thấy và dùng trong lúc dịch.

### Các trường

| Trường | Kiểu | Bắt buộc | Mô tả |
|--------|------|----------|-------|
| `id` | BigInt (PK) | Tự động | Khóa chính |
| `user` | FK → CustomUser (CASCADE) | Có | Chủ sở hữu từ khóa |
| `translations` | JSONField | Có | Bản dịch đa ngôn ngữ, cùng cấu trúc với `KeywordSuggestion` |
| `note` | TextField | Không | Ghi chú cá nhân của user |
| `suggestion` | FK → KeywordSuggestion (SET_NULL) | Không | Liên kết tới gợi ý đã được duyệt (nếu có) |
| `created_at` | DateTime | Tự động | Ngày tạo |
| `updated_at` | DateTime | Tự động | Ngày cập nhật |

### Lưu ý kỹ thuật

- Khi user bị xóa → tất cả `PrivateKeyword` của user đó **bị xóa theo** (`CASCADE`)
- `suggestion = NULL` khi `KeywordSuggestion` gốc bị xóa (`SET_NULL`) — PrivateKeyword vẫn tồn tại

---

## 6. KeywordQueue

**File:** `keyword.py` | **Tên bảng DB:** `api_keywordqueue`

Hàng chờ trung gian: khi nhiều user đề xuất cùng một từ khóa, hệ thống gom lại vào queue trước khi quyết định có đưa lên `KeywordSuggestion` không.

### Các trường

| Trường | Kiểu | Bắt buộc | Mô tả |
|--------|------|----------|-------|
| `id` | BigInt (PK) | Tự động | Khóa chính |
| `user` | FK → CustomUser (SET_NULL) | Không | Người tạo queue item |
| `translations` | JSONField | Có | Bản dịch đề xuất |
| `is_processed` | Boolean (db_index) | Có | Đã xử lý chưa |
| `processed_at` | DateTime | Không | Thời điểm xử lý |
| `created_at` | DateTime | Tự động | Ngày tạo |

### Lưu ý kỹ thuật

- `is_processed` có `db_index=True` vì thường query `WHERE is_processed = FALSE` để tìm item chưa xử lý
- Ngưỡng để chuyển từ Queue → Suggestion được cấu hình trong `LibraryQueueSettings`

---

## 7. LibraryQueueSettings

**File:** `keyword.py` | **Tên bảng DB:** `api_libraryqueuesettings`

Bảng singleton (chỉ có đúng 1 bản ghi) chứa cấu hình hệ thống glossary.

### Các trường

| Trường | Kiểu | Bắt buộc | Mô tả |
|--------|------|----------|-------|
| `id` | BigInt (PK) | Luôn = 1 | Khóa chính, bị ép về 1 |
| `min_suggesters_for_queue` | PositiveInt | Có | Số user tối thiểu cùng đề xuất để tạo Suggestion |
| `updated_at` | DateTime | Tự động | Lần cập nhật cuối |

### Lưu ý kỹ thuật

- `save()` luôn đặt `self.pk = 1` → không thể tạo nhiều hơn 1 bản ghi
- `delete()` bị override thành no-op → không thể xóa bản ghi này
- Truy cập bằng: `LibraryQueueSettings.load()`

---

## 8. TranslatedFile

**File:** `translated_file.py` | **Tên bảng DB:** `api_translatedfile`

Lưu lịch sử mỗi lần user dịch một file. Dùng để hiển thị tab "Lịch sử dịch".

### Các trường

| Trường | Kiểu | Bắt buộc | Mô tả |
|--------|------|----------|-------|
| `id` | BigInt (PK) | Tự động | Khóa chính |
| `user` | FK → CustomUser (CASCADE) | Có | Ai dịch |
| `original_file_url` | URLField(1000) | Có | URL file gốc (lưu trên cloud) |
| `original_file_name` | CharField(255) | Có | Tên file gốc, VD: `report.docx` |
| `translated_file_url` | URLField(1000) | Có | URL file đã dịch |
| `original_language` | CharField(10) | Có | Ngôn ngữ gốc, VD: `ja` |
| `target_language` | CharField(10) | Có | Ngôn ngữ đích, VD: `vi` |
| `file_type` | CharField(10) | Có | Loại file: `docx`, `pdf`, `xlsx`, `pptx` |
| `created_at` | DateTime | Tự động | Thời điểm dịch |
| `updated_at` | DateTime | Tự động | Cập nhật cuối |

### Lưu ý kỹ thuật

- URL trỏ đến file trên cloud storage (Azure Blob / S3) — bản thân bảng không lưu nội dung file
- Khi user bị xóa → toàn bộ lịch sử dịch **bị xóa theo** (`CASCADE`)

---

## 9. Notification

**File:** `notification.py` | **Tên bảng DB:** `api_notification`

Thông báo gửi đến từng user trong hệ thống (dịch xong, từ khóa được duyệt, v.v.).

### Các trường

| Trường | Kiểu | Bắt buộc | Mô tả |
|--------|------|----------|-------|
| `id` | BigInt (PK) | Tự động | Khóa chính |
| `user` | FK → CustomUser (CASCADE) | Có | Người nhận |
| `title` | CharField(255) | Có | Tiêu đề thông báo |
| `message` | TextField | Có | Nội dung thông báo |
| `read` | Boolean | Có | User đã đọc chưa |
| `details` | Boolean | Có | Có thông tin chi tiết đính kèm không |
| `keyword_details` | JSONField | Không | Chi tiết về từ khóa (nếu thông báo liên quan đến keyword) |
| `created_at` | DateTime | Tự động | Thời điểm tạo |

### Lưu ý kỹ thuật

- `keyword_details` lưu dạng JSON linh hoạt, VD: `{"keyword": "バルブ", "action": "approved"}`
- Khi user bị xóa → tất cả notification **bị xóa theo** (`CASCADE`)

---

## 10. RefreshToken

**File:** `refresh_token.py` | **Tên bảng DB:** `api_refreshtoken`

Quản lý JWT refresh token cho hệ thống xác thực. Token thực không lưu trực tiếp mà chỉ lưu hash.

### Các trường

| Trường | Kiểu | Bắt buộc | Mô tả |
|--------|------|----------|-------|
| `id` | BigInt (PK) | Tự động | Khóa chính |
| `user` | FK → CustomUser (CASCADE) | Có | Chủ sở hữu token |
| `token_hash` | CharField(64) UNIQUE | Có | SHA-256 hash của token thực |
| `expires_at` | DateTime | Có | Thời điểm hết hạn |
| `created_at` | DateTime | Tự động | Thời điểm tạo |

### Các method quan trọng

| Method | Mô tả |
|--------|-------|
| `hash_token(token)` | Chuyển token string → SHA-256 hash (64 ký tự hex) |
| `is_expired()` | Kiểm tra token còn hạn không |
| `purge_expired()` | Xóa toàn bộ token đã hết hạn, trả về số bản ghi đã xóa |

### Lưu ý kỹ thuật

- Token thực gửi về client **không bao giờ lưu trong DB** — chỉ lưu hash để bảo mật
- Khi verify: hash token nhận được → so sánh với `token_hash` trong DB
- Khi user bị xóa → tất cả refresh token **bị xóa theo** (`CASCADE`)

---

## 11. Sơ đồ quan hệ

```
Language   (4 ngôn ngữ cố định, độc lập, không FK tới CustomUser)

CustomUser
   │
   ├──► TranslatedFile (CASCADE)
   ├──► Notification (CASCADE)
   ├──► RefreshToken (CASCADE)
   ├──► PrivateKeyword (CASCADE)
   │        └──► KeywordSuggestion (SET_NULL)
   └──► KeywordQueue (SET_NULL)

Chú thích:
  (CASCADE)  = Xóa User → xóa theo
  (SET_NULL) = Xóa User → set NULL, bản ghi con vẫn còn
```

---

## 12. Các ràng buộc đặc biệt

### on_delete — Hành vi khi xóa bản ghi cha

| Hành vi | Ý nghĩa | Dùng ở đâu |
|---------|---------|------------|
| `CASCADE` | Xóa cha → xóa con theo | User xóa → xóa file dịch, notification, token |
| `SET_NULL` | Xóa cha → set FK = NULL | User xóa → giữ lại KeywordSuggestion (không mất) |

### auto_now_add vs auto_now

| Tham số | Hành vi |
|---------|---------|
| `auto_now_add=True` | Chỉ set khi **tạo mới** — không thay đổi được sau đó |
| `auto_now=True` | Tự động cập nhật **mỗi khi save()** |

### Singleton pattern — LibraryQueueSettings

Bảng chỉ có đúng 1 bản ghi (pk=1). Truy cập bằng:
```python
settings = LibraryQueueSettings.load()
settings.min_suggesters_for_queue  # → VD: 2
```

### JSONField — translations

Nhiều bảng dùng `JSONField` cho `translations` để lưu bản dịch đa ngôn ngữ linh hoạt:
```json
{
  "en": "safety valve",
  "ja": "安全弁",
  "vi": "van an toàn",
  "zh-CN": "安全阀"
}
```
Không cần thêm cột khi thêm ngôn ngữ mới — chỉ thêm key vào JSON.
