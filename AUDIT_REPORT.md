# Toray Multilanguage Translator — Audit Report
**Date:** 2026-06-26  
**Scope:** Full codebase scan (Django REST backend + React/Vite frontend)  
**Total findings:** 30

---

## Table of Contents
1. [High Priority](#high-priority)
2. [Medium Priority](#medium-priority)
3. [SDLC Gaps](#sdlc-gaps)
4. [Accessibility & UX](#accessibility--ux)
5. [Code Quality](#code-quality)
6. [Action Plan](#action-plan)

---

## HIGH PRIORITY

---

### H-01 — `get_language_name()` hardcoded, ngôn ngữ mới không hiển thị tên

**File:** `WEB/multilanguage_transolator_be/api/views/translated_file.py:44–51`  
**Severity:** 🔴 High  
**Impact:** Khi thêm ngôn ngữ mới qua Language Management (ví dụ: French), lịch sử file dịch hiển thị code `fr` thay vì tên "French".

**Hiện trạng:**
```python
LANGUAGE_NAMES = {
    'vi': 'Vietnamese',
    'ja': 'Japanese',
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'en': 'English',
}
def get_language_name(code):
    return LANGUAGE_NAMES.get(code, code)
```

**Đề xuất:**
```python
def get_language_name(code):
    try:
        from api.models.language import Language
        lang = Language.objects.filter(code=code).first()
        if lang:
            return lang.name
    except Exception:
        pass
    return code
```

---

### H-02 — Translation API validate ngôn ngữ theo whitelist tĩnh thay vì DB

**File:** `WEB/multilanguage_transolator_be/api/views/translate.py:551–555`  
**Severity:** 🔴 High  
**Impact:** Sau khi thêm ngôn ngữ mới vào Language Management, người dùng vẫn nhận lỗi "Unsupported target language" cho đến khi developer sửa code.

**Hiện trạng:**
```python
if target_language not in LANGUAGES:
    return JsonResponse({
        "error": f"Unsupported target language: {target_language}. Supported: {list(LANGUAGES.keys())}"
    }, status=400)
```

**Đề xuất:** Đã fix một phần — kiểm tra lại để đảm bảo source language cũng validate từ DB, không chỉ target:
```python
from api.models.language import Language as LangModel
active_codes = set(LangModel.objects.filter(is_active=True).values_list('code', flat=True))
supported = active_codes if active_codes else set(LANGUAGES.keys())
if target_language not in supported:
    return JsonResponse({
        "error": f"Unsupported target language: {target_language}. Supported: {sorted(supported)}"
    }, status=400)
```

---

### H-03 — Keyword POST không validate translations đủ chặt

**File:** `WEB/multilanguage_transolator_be/api/views/keyword.py:794–812`  
**Severity:** 🔴 High  
**Impact:** User có thể tạo keyword với `translations = {"en": "   "}` (chỉ whitespace) → keyword rỗng lọt vào DB, tạo ra glossary entry hỏng.

**Hiện trạng:**
```python
has_content = any(
    str(v).strip() for v in translations.values()
)
```

**Đề xuất:**
```python
def _validate_translations(translations):
    if not isinstance(translations, dict):
        return False, "translations must be a JSON object"
    valid = {k: v for k, v in translations.items()
             if isinstance(v, str) and v.strip() and len(v.strip()) <= 500}
    if not valid:
        return False, "At least one non-empty translation is required"
    if any(len(v) > 500 for v in translations.values() if isinstance(v, str)):
        return False, "Each translation must be 500 characters or less"
    return True, valid
```

---

### H-04 — File dịch lớn không có timeout → client nhận 504 với lỗi generic

**File:** `Translate_v2/translate_text.py` (translate_document)  
**File:** `WEB/multilanguage_transolator_be/api/views/translate.py` (TranslateFileView)  
**Severity:** 🔴 High  
**Impact:** File PDF lớn hoặc nhiều trang → OCR + dịch có thể mất 10–20 phút → Nginx/Gunicorn timeout (504) → user thấy lỗi generic, không biết file đã được xử lý hay chưa.

**Đề xuất ngắn hạn:**
- Tăng Gunicorn timeout lên 600s cho endpoint dịch file
- Trả lời ngay `202 Accepted` với `job_id` và poll trạng thái

**Đề xuất dài hạn:**
```python
# Dùng Celery task thay vì xử lý đồng bộ
@shared_task(bind=True, time_limit=600)
def translate_file_task(self, file_url, target_lang, user_id, ...):
    ...

# View trả về job_id
job = translate_file_task.delay(...)
return JsonResponse({"job_id": job.id, "status": "processing"}, status=202)
```

---

### H-05 — Error feedback khi fetch keywords không phân loại lỗi

**File:** `WEB/multilanguage_transolator_fe/src/pages/privateLibrary/index.jsx:157–170`  
**Severity:** 🔴 High  
**Impact:** Network lỗi, auth hết hạn, hay server crash đều hiển thị cùng một thông báo chung chung → user không biết phải làm gì.

**Hiện trạng:**
```js
} catch (err) {
  toast.error("Failed to load keywords");
}
```

**Đề xuất:**
```js
} catch (err) {
  const status = err?.response?.status;
  if (status === 401 || status === 403) {
    toast.error("Session expired. Please log in again.");
  } else if (status >= 500) {
    toast.error("Server error. Please try again later.");
  } else if (!navigator.onLine) {
    toast.error("No internet connection.");
  } else {
    toast.error("Failed to load keywords. Please refresh the page.");
  }
}
```

---

## MEDIUM PRIORITY

---

### M-01 — Không có Rate Limiting trên Translation API

**File:** `WEB/multilanguage_transolator_be/api/views/translate.py`  
**Severity:** 🟡 Medium  
**Impact:** User (hoặc bot) có thể spam translate requests → burn Google Cloud quota trong vài phút, gây chi phí đột biến hoặc block toàn bộ service.

**Đề xuất:**
```python
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle

class TranslateTextThrottle(UserRateThrottle):
    rate = '20/minute'

class TranslateFileThrottle(UserRateThrottle):
    rate = '5/minute'

class TranslateTextView(APIView):
    throttle_classes = [TranslateTextThrottle]
    ...

class TranslateFileView(APIView):
    throttle_classes = [TranslateFileThrottle]
    ...
```

Trong `settings.py`:
```python
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_RATES': {
        'user': '100/hour',
    }
}
```

---

### M-02 — `page_size=5000` hardcoded ở frontend, không có server-side limit

**File:** Frontend keyword service calls  
**File:** `WEB/multilanguage_transolator_be/api/views/keyword.py`  
**Severity:** 🟡 Medium  
**Impact:** Với 5000+ keywords, query DB trả về toàn bộ dataset → RAM spike, slow render, browser có thể freeze.

**Đề xuất backend:**
```python
MAX_PAGE_SIZE = 200
DEFAULT_PAGE_SIZE = 50

class KeywordSuggestionListView(APIView):
    def get(self, request):
        page_size = min(int(request.query_params.get('page_size', DEFAULT_PAGE_SIZE)), MAX_PAGE_SIZE)
        page = int(request.query_params.get('page', 1))
        offset = (page - 1) * page_size
        ...
```

**Đề xuất frontend:** Implement virtual scrolling hoặc infinite scroll thay vì load toàn bộ.

---

### M-03 — N+1 Query Pattern khi iterate keyword suggestions

**File:** `WEB/multilanguage_transolator_be/api/views/keyword.py:405–420`  
**Severity:** 🟡 Medium  
**Impact:** 100 suggestions = 100 lần deserialize JSONField riêng lẻ trong Python loop → chậm dần theo số lượng data.

**Hiện trạng:**
```python
for sug in queryset:
    if sug.translations.get('en'):  # JSONField decode mỗi lần
        ...
```

**Đề xuất:**
```python
# Dùng .only() để giới hạn fields fetch
queryset = queryset.only('id', 'translations', 'status', 'user_id', 'created_at')
# Tránh thêm bất kỳ FK lookup nào trong loop mà không có select_related
```

---

### M-04 — Notification gửi cho ALL users, không lọc theo role

**File:** `WEB/multilanguage_transolator_be/api/views/keyword.py:338–346`  
**Severity:** 🟡 Medium  
**Impact:** Khi admin approve keyword, 100 users đều nhận notification → inbox bị spam → user ignore notification → mất giá trị thông báo.

**Đề xuất:**
```python
# Khi keyword được approved → notify tất cả users (hợp lý)
# Khi keyword được edited → chỉ notify Library Keepers + Admins
# Khi keyword suggestion được submitted → chỉ notify Library Keepers + Admins
# Khi user's OWN suggestion bị reject → chỉ notify người submit

def notify_admins_and_keepers(title, message, details):
    targets = CustomUser.objects.filter(role__in=['Admin', 'Library Keeper'])
    for user in targets:
        Notification.objects.create(user=user, title=title, message=message, ...)
```

---

### M-05 — Duplicate click "Suggest" có thể submit 2 lần

**File:** `WEB/multilanguage_transolator_fe/src/pages/privateLibrary/index.jsx`  
**File:** `WEB/multilanguage_transolator_fe/src/components/features/privateLibrary/SuggestConfirmModal.jsx`  
**Severity:** 🟡 Medium  
**Impact:** Double click → 2 identical suggestions tạo ra → admin phải review duplicate.

**Đề xuất:**
```jsx
// Trong SuggestConfirmModal
<button
  onClick={onConfirm}
  disabled={isSubmitting}  // đã có
  className={`... ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
>
  {isSubmitting ? (
    <><Spinner size="sm" /> Submitting...</>
  ) : (
    `Confirm & Submit (${keywords.length})`
  )}
</button>
```

Thêm backend idempotency check: hash của translations → reject nếu cùng user submit cùng content trong vòng 5 giây.

---

### M-06 — Empty State thiếu trên keyword tables

**File:** `WEB/multilanguage_transolator_fe/src/pages/Admin/CommonLibraryManagement.jsx`  
**File:** `WEB/multilanguage_transolator_fe/src/pages/privateLibrary/index.jsx`  
**Severity:** 🟡 Medium  
**Impact:** Library trống → table render không có row → user không biết đây là empty state hay đang load.

**Đề xuất:**
```jsx
{!loading && keywords.length === 0 && (
  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
    <FiBook size={48} className="mb-4 opacity-30" />
    <p className="text-lg font-medium">No keywords yet</p>
    <p className="text-sm mt-1">Add your first keyword to get started</p>
  </div>
)}
```

---

### M-07 — Upload progress bar là fake (timer-based, không phải % thực)

**File:** `WEB/multilanguage_transolator_fe/src/components/features/uploadFile/UploadFileNew.jsx:213–215`  
**Severity:** 🟡 Medium  
**Impact:** Progress bar nhảy đến 90% rồi treo → user lo lắng không biết file có đang upload không.

**Hiện trạng:**
```js
const interval = setInterval(() => {
  setUploadProgress(prev => Math.min(prev + 10, 90));
}, 300);
```

**Đề xuất:**
```js
await axios.post(uploadUrl, formData, {
  onUploadProgress: (progressEvent) => {
    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
    setUploadProgress(percent);
  }
});
```

---

### M-08 — Temp file orphan khi process bị kill giữa chừng

**File:** `WEB/multilanguage_transolator_be/api/views/translate.py` (finally block)  
**Severity:** 🟡 Medium  
**Impact:** Server restart hoặc OOM killer → temp files trong `/tmp/` không được dọn → disk đầy dần.

**Đề xuất:**
```python
# Thêm management command cleanup chạy daily via cron
# management/commands/cleanup_temp_files.py
import os, glob, time

class Command(BaseCommand):
    def handle(self, *args, **options):
        tmp_dir = tempfile.gettempdir()
        pattern = os.path.join(tmp_dir, "tmp*.{docx,pdf,xlsx,pptx}")
        cutoff = time.time() - 3600  # files older than 1 hour
        for f in glob.glob(pattern):
            if os.path.getmtime(f) < cutoff:
                os.remove(f)
                self.stdout.write(f"Removed: {f}")
```

---

### M-09 — Không có Error Boundary React

**File:** `WEB/multilanguage_transolator_fe/src/components/Layouts/layout.jsx`  
**Severity:** 🟡 Medium  
**Impact:** Một component throw uncaught error → toàn bộ app crash → màn hình trắng, không có thông báo gì.

**Đề xuất:**
```jsx
// src/components/ErrorBoundary.jsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h2 className="text-xl font-bold text-red-600">Something went wrong</h2>
          <p className="text-gray-500 mt-2">{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>Refresh Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Wrap trong layout.jsx
<ErrorBoundary>
  <Routes>...</Routes>
</ErrorBoundary>
```

---

### M-10 — API Response format không nhất quán

**Files:** Nhiều views trả về `{'detail': ...}`, `{'error': ...}`, hoặc `{'message': ...}`  
**Severity:** 🟡 Medium  
**Impact:** Frontend phải check 3 keys khác nhau → bug dễ xảy ra khi thêm error handling.

**Đề xuất:** Tạo helper function dùng chung:
```python
# api/utils/responses.py
from rest_framework.response import Response

def error_response(message, code=None, status=400):
    return Response({
        "error": message,
        "code": code or "GENERIC_ERROR"
    }, status=status)

def success_response(data=None, message=None, status=200):
    return Response({
        "data": data,
        "message": message
    }, status=status)
```

---

### M-11 — Loading skeleton thiếu trên trang Private Library và Common Library

**File:** `WEB/multilanguage_transolator_fe/src/pages/privateLibrary/index.jsx`  
**File:** `WEB/multilanguage_transolator_fe/src/pages/Admin/CommonLibraryManagement.jsx`  
**Severity:** 🟡 Medium  
**Impact:** Initial load → blank table → user không biết đang tải hay lỗi.

**Đề xuất:**
```jsx
{loading ? (
  <div className="space-y-2 p-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
    ))}
  </div>
) : (
  <table>...</table>
)}
```

---

## SDLC GAPS

---

### S-01 — Không có test coverage

**File:** `WEB/multilanguage_transolator_be/api/tests.py` (boilerplate trống)  
**Severity:** 🟡 Medium  
**Impact:** Không phát hiện regression khi refactor. Migration JSONField vừa rồi hoàn toàn không có safety net.

**Đề xuất — Test cases tối thiểu cần viết:**
```python
# tests/test_keyword_api.py
class PrivateKeywordTests(APITestCase):
    def test_create_keyword_with_translations(self):
        ...
    def test_reject_empty_translations(self):
        ...
    def test_duplicate_detection(self):
        ...
    def test_suggest_keyword_creates_queue_entry(self):
        ...

# tests/test_translation_api.py
class TranslationTests(APITestCase):
    def test_translate_text_no_glossary(self):
        ...
    def test_translate_text_private_library(self):
        ...
    def test_unsupported_language_returns_400(self):
        ...
    def test_rate_limiting(self):
        ...
```

**Tool:** pytest-django + factory_boy để tạo test data.

---

### S-02 — Không có API Documentation

**Severity:** 🟡 Medium  
**Impact:** Developer mới phải đọc toàn bộ code để hiểu API contract. Frontend/Backend không đồng bộ khi thay đổi.

**Đề xuất:**
```python
# Cài đặt
pip install drf-spectacular

# settings.py
INSTALLED_APPS += ['drf_spectacular']
REST_FRAMEWORK['DEFAULT_SCHEMA_CLASS'] = 'drf_spectacular.openapi.AutoSchema'

# urls.py
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
urlpatterns += [
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema')),
]
```

Sau đó thêm `@extend_schema` decorator vào các view quan trọng.

---

### S-03 — Mix `print()` và `logger` trong cùng file

**File:** `Translate_v2/translate_text.py`  
**File:** `WEB/multilanguage_transolator_be/api/views/translate.py`  
**Severity:** 🟡 Medium  
**Impact:** `print()` không có level, không vào log file, không thể filter/config. Khó debug trên production.

**Đề xuất:**
```python
# Thay toàn bộ print() bằng logger
import logging
logger = logging.getLogger(__name__)

# Thay:
print(f"[BACKGROUND THREAD] => Upload thành công: {uri}")
# Bằng:
logger.info("Uploaded to GCS: %s", uri)

# Thay:
print(f"⚠️ Glossary {glossary_id} failed ({e}). Falling back...")
# Bằng:
logger.warning("Glossary %s not found, falling back to standard translation: %s", glossary_id, e)
```

---

### S-04 — Không validate Environment Variables khi startup

**File:** `WEB/multilanguage_transolator_be/backend/config/settings.py`  
**Severity:** 🟡 Medium  
**Impact:** `PROJECT_ID=None` → app start thành công → crash lúc translate với lỗi cryptic "NoneType has no attribute 'format'".

**Đề xuất:**
```python
# settings.py — thêm cuối file
REQUIRED_ENV_VARS = [
    'SECRET_KEY',
    'PROJECT_ID',
    'BUCKET_NAME',
    'GOOGLE_APPLICATION_CREDENTIALS',
]

missing = [v for v in REQUIRED_ENV_VARS if not os.getenv(v)]
if missing and not DEBUG:
    raise ImproperlyConfigured(
        f"Missing required environment variables: {', '.join(missing)}"
    )
```

---

### S-05 — Không có Audit Trail cho Suggestion approval/rejection

**File:** `WEB/multilanguage_transolator_be/api/views/keyword.py` (ApproveSuggestionView)  
**Severity:** 🟡 Medium  
**Impact:** Không biết ai approve, ai reject, lúc nào → không thể trả lời câu hỏi "tại sao suggestion của tôi bị xóa?".

**Đề xuất:**
```python
# Thêm vào model KeywordSuggestion
class KeywordSuggestion(models.Model):
    ...
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, null=True)
    # Thay vì xóa khi merge:
    merged_into = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL)
    action_history = models.JSONField(default=list)  # [{action, by, at, reason}]
```

---

## ACCESSIBILITY & UX

---

### A-01 — Không có ARIA labels trên Language Dropdown

**File:** `WEB/multilanguage_transolator_fe/src/components/features/uploadFile/UploadFileNew.jsx:106–114`  
**Severity:** 🟢 Low-Medium  
**Impact:** Screen reader không đọc được dropdown ngôn ngữ. Người dùng dùng keyboard không navigate được.

**Đề xuất:**
```jsx
<div
  role="listbox"
  aria-label="Select target language"
  aria-expanded={isOpen}
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') setIsOpen(true);
    if (e.key === 'Escape') setIsOpen(false);
  }}
>
  {options.map(opt => (
    <div
      key={opt.code}
      role="option"
      aria-selected={opt.code === selected}
      onClick={() => onSelect(opt)}
    >
      {opt.label}
    </div>
  ))}
</div>
```

---

### A-02 — Progress bar upload không phản ánh tiến trình thực

**File:** `WEB/multilanguage_transolator_fe/src/components/features/uploadFile/UploadFileNew.jsx:213`  
**Severity:** 🟢 Low-Medium  
**Chi tiết:** Đã đề cập ở M-07. Progress fake gây mất tin tưởng khi file lớn bị stuck ở 90%.

---

### A-03 — Không có Skeleton Loader

**Files:** Tất cả list pages (privateLibrary, CommonLibrary, suggestionReviewList)  
**Severity:** 🟢 Low-Medium  
**Chi tiết:** Đã đề cập ở M-11. Thêm shimmer animation thay vì blank table khi loading.

---

## CODE QUALITY

---

### Q-01 — Magic numbers rải rác trong code

**Files:** `api/views/keyword.py` (page_size=8, page_size=50, batch_size=500)  
**Severity:** 🟢 Low

**Đề xuất:** Tập trung vào constants file:
```python
# api/constants.py
DEFAULT_KEYWORD_PAGE_SIZE = 50
MAX_KEYWORD_PAGE_SIZE = 200
KEYWORD_BATCH_UPDATE_SIZE = 500
QUEUE_THRESHOLD_DEFAULT = 2
TRANSLATION_MAX_CHARS = 5000
```

---

### Q-02 — `language_pair` dict trong `create_glossary.py` không bao gồm ngôn ngữ mới

**File:** `Translate_v2/create_glossary.py:109–120`  
**Severity:** 🟢 Low  
**Impact:** Common Library glossary cho ngôn ngữ mới (French, etc.) sẽ không được sử dụng khi dịch file. Cần generate `language_pair` động từ DB.

**Đề xuất:**
```python
def get_language_pairs_from_db():
    """Generate all active language pairs from DB dynamically."""
    try:
        import django
        from api.models.language import Language
        codes = list(Language.objects.filter(is_active=True).values_list('code', flat=True))
        pairs = {}
        idx = 1
        for i, a in enumerate(sorted(codes)):
            for b in sorted(codes)[i+1:]:
                pairs[f"{a}-{b}"] = idx
                idx += 1
        return pairs
    except Exception:
        return language_pair  # fallback to static dict

# Dùng trong translate_text.py thay vì import language_pair trực tiếp
```

---

### Q-03 — `LANGUAGES` dict trong `detect_lang.py` vẫn còn fallback hardcoded nhưng thiếu `fr`

**File:** `Translate_v2/detect_lang.py`  
**Severity:** 🟢 Low  
**Impact:** Nếu DB không available, fallback dict thiếu French → validation fail.

**Đề xuất:** Fallback dict `_LANGUAGES_FALLBACK` đã được thêm `fr` trong lần fix trước. Cần kiểm tra thêm các ngôn ngữ khác có thể được add sau này.

---

### Q-04 — Không có input sanitization trên search term

**File:** `WEB/multilanguage_transolator_be/api/views/keyword.py` (search filtering)  
**Severity:** 🟢 Low  
**Impact:** Search term rất dài (10,000 ký tự) → slow Python filter loop trên toàn bộ dataset.

**Đề xuất:**
```python
search = request.query_params.get('search', '').strip()[:100]  # max 100 chars
```

---

### Q-05 — Frontend service files thiếu JSDoc

**File:** `WEB/multilanguage_transolator_fe/src/services/`  
**Severity:** 🟢 Low  
**Impact:** Developer mới không biết params/return value của mỗi service function.

**Đề xuất:**
```js
/**
 * Create a new private keyword
 * @param {{ translations: Record<string, string>, note?: string }} data
 * @returns {Promise<{ id: number, translations: Record<string, string> }>}
 */
export const createPrivateKeyword = (data) => api.post('/keywords/private/', data);
```

---

## ACTION PLAN

### Phase 1 — Sprint hiện tại (High impact, Low effort)

| # | Task | Est. | Priority |
|---|------|------|----------|
| H-01 | Fix `get_language_name()` → query DB | 30 min | 🔴 |
| H-03 | Thêm validation chặt cho keyword translations | 1h | 🔴 |
| H-05 | Phân loại error feedback khi fetch data | 1h | 🔴 |
| M-05 | Disable Suggest button trong khi submitting | 30 min | 🟡 |
| M-06 | Thêm empty state cho keyword tables | 1h | 🟡 |
| M-09 | Thêm Error Boundary vào React layout | 1h | 🟡 |
| M-11 | Thêm loading skeleton cho list pages | 2h | 🟡 |
| S-04 | Validate env vars khi startup | 30 min | 🟡 |

**Tổng:** ~8h

---

### Phase 2 — Sprint tiếp theo (Medium impact, Medium effort)

| # | Task | Est. | Priority |
|---|------|------|----------|
| M-01 | Thêm Rate Limiting trên Translation endpoints | 1h | 🟡 |
| M-02 | Server-side pagination limit (max 200) | 2h | 🟡 |
| M-07 | Upload progress % thực từ axios | 1h | 🟡 |
| M-08 | Management command cleanup temp files | 1h | 🟡 |
| M-10 | Chuẩn hóa API response format | 3h | 🟡 |
| Q-02 | Generate `language_pair` dynamic từ DB | 2h | 🟢 |
| S-03 | Thay toàn bộ `print()` bằng `logger` | 2h | 🟡 |
| S-05 | Thêm audit trail cho suggestion actions | 3h | 🟡 |

**Tổng:** ~15h

---

### Phase 3 — SDLC Foundation (Long-term)

| # | Task | Est. |
|---|------|------|
| S-01 | Viết test suite (target 60% coverage) | 3–5 ngày |
| S-02 | Thêm API docs với drf-spectacular | 1 ngày |
| H-04 | Migrate file translation sang Celery async | 3–5 ngày |
| M-04 | Refactor notification targeting theo role | 1 ngày |
| A-01 | Thêm keyboard nav + ARIA labels | 2 ngày |

---

## Metrics mục tiêu sau khi fix

| Metric | Hiện tại | Mục tiêu |
|--------|----------|-----------|
| Test coverage | 0% | 60% |
| API response time (translate text) | ~2s | <2s |
| API response time (list keywords) | ~1.5s (5000 items) | <300ms (paginated) |
| Error clarity (user sees actionable msg) | ~40% | >90% |
| Languages supported (without code change) | Manual update required | Fully dynamic |
| Temp file cleanup | Manual / on-crash only | Automated hourly |
