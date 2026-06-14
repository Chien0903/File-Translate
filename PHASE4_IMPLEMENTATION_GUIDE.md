# Phase 4 Implementation Guide — Kết nối luồng dịch với DB

> **Prerequisite:** Phase 2 hoàn thành (API `/api/languages/` và `/api/companies/` hoạt động)  
> **Thời gian ước tính:** 2 ngày  
> **Kết quả:** Frontend và backend đọc ngôn ngữ từ DB theo company của user, không còn hardcode

---

## Vấn đề cần giải quyết

Hiện tại ngôn ngữ được định nghĩa ở **6 nơi** — tất cả hardcode:

| # | File | Biến | Vai trò |
|---|------|------|---------|
| 1 | `Translate_v2/detect_lang.py` | `LANGUAGES` dict | Validate ngôn ngữ hợp lệ |
| 2 | `api/services/glossary_service.py` | `LANG_MAP` dict | Map code → tên cột DB |
| 3 | `api/views/translate.py` | (dùng LANGUAGES từ detect_lang) | Validate input |
| 4 | `src/components/features/uploadFile/LanguageSelector.jsx` | `LANGUAGE_CODES` | UI chọn ngôn ngữ |
| 5 | `src/components/features/privateLibrary/constants.js` | `ALL_LANGUAGES` | UI thư viện |
| 6 | Nhiều file frontend khác | `EMPTY_KEYWORD` | Object khởi tạo |

---

## Tổng quan các bước

| # | Bước | File |
|---|------|------|
| 1 | Backend: thêm endpoint trả ngôn ngữ theo user's company | `api/views/language.py` |
| 2 | Backend: validate ngôn ngữ dịch từ DB thay vì dict | `api/views/translate.py` |
| 3 | Frontend: tạo hook `useCompanyLanguages` | `src/hooks/useCompanyLanguages.js` |
| 4 | Frontend: cập nhật `LanguageSelector` dùng dynamic data | `src/components/features/uploadFile/LanguageSelector.jsx` |
| 5 | Frontend: cập nhật constants thư viện | `src/components/features/privateLibrary/constants.js` |

---

## Bước 1 — Backend: Endpoint ngôn ngữ theo user's company

Thêm view mới vào `api/views/language.py` (file đã tạo ở Phase 2):

```python
class MyCompanyLanguagesView(APIView):
    """
    GET /api/languages/my-company/
    Trả về ngôn ngữ đang enabled của company mà user đang đăng nhập thuộc về.
    Frontend dùng endpoint này để build LanguageSelector.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = request.user.company
        if not company:
            # User chưa gán company → trả tất cả ngôn ngữ active
            languages = Language.objects.filter(is_active=True).order_by('sort_order')
            return Response(LanguageSerializer(languages, many=True).data)

        languages = CompanyLanguageService.get_enabled_languages(company)
        return Response(LanguageSerializer(languages, many=True).data)
```

Thêm URL vào `api/urls/language.py`:

```python
from api.views.language import MyCompanyLanguagesView

# Thêm vào urlpatterns:
path('my-company/', MyCompanyLanguagesView.as_view(), name='my_company_languages'),
```

---

## Bước 2 — Backend: Validate ngôn ngữ từ DB

**File:** `api/views/translate.py`

Tìm chỗ validate ngôn ngữ (thường là check `source_language in LANGUAGES`). Thay bằng:

```python
def get_valid_language_codes(user):
    """Lấy set language codes hợp lệ cho user (theo company)."""
    from api.services.company_language_service import CompanyLanguageService
    company = getattr(user, 'company', None)
    if company:
        langs = CompanyLanguageService.get_enabled_languages(company)
    else:
        from api.models.language import Language
        langs = Language.objects.filter(is_active=True)
    return set(langs.values_list('code', flat=True))
```

Trong view translate, thay đoạn validate:

```python
# TRƯỚC (hardcode):
# from Translate_v2.detect_lang import LANGUAGES
# if source_lang not in LANGUAGES:
#     return Response({'error': 'Invalid language'}, status=400)

# SAU (dynamic):
valid_codes = get_valid_language_codes(request.user)
if source_lang not in valid_codes:
    return Response(
        {'error': f"Language '{source_lang}' is not enabled for your company."},
        status=status.HTTP_400_BAD_REQUEST,
    )
```

---

## Bước 3 — Frontend: Hook `useCompanyLanguages`

**File:** `src/hooks/useCompanyLanguages.js` *(tạo mới)*

```javascript
import { useState, useEffect } from 'react';
import api from '../services/api';

export const useCompanyLanguages = () => {
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/languages/my-company/')
      .then(res => setLanguages(res.data))
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  }, []);

  return { languages, loading, error };
};
```

Hook trả về array `Language` objects:
```json
[
  {"id": 1, "code": "vi", "name": "Vietnamese", "flag_emoji": "🇻🇳", ...},
  {"id": 2, "code": "ja", "name": "Japanese", "flag_emoji": "🇯🇵", ...}
]
```

---

## Bước 4 — Frontend: Cập nhật `LanguageSelector.jsx`

**File:** `src/components/features/uploadFile/LanguageSelector.jsx`

Thay `LANGUAGE_CODES` dict hardcode bằng hook:

```jsx
import { useCompanyLanguages } from '../../../hooks/useCompanyLanguages';

const LanguageSelector = ({
  selectedOriginLanguage,
  onOriginLanguageChange,
  selectedTargetLanguages,
  onTargetLanguagesChange,
  availableTargetLanguages,
  onAvailableTargetLanguagesChange,
}) => {
  const { languages, loading } = useCompanyLanguages();

  // languages là array của {id, code, name, native_name, flag_emoji}
  // Build map tương đương LANGUAGE_CODES cũ: { "Vietnamese": "vi", ... }
  const languageNames = languages.map(l => l.name);
  const codeByName = Object.fromEntries(languages.map(l => [l.name, l.code]));

  const handleOriginLanguageSelect = (languageName) => {
    onOriginLanguageChange(languageName);

    let filtered = languageNames.filter(n => n !== languageName);

    // Loại bỏ Chinese variant kia nếu chọn 1 trong 2
    if (languageName === 'Chinese (Traditional)') {
      filtered = filtered.filter(n => n !== 'Chinese (Simplified)');
    }
    if (languageName === 'Chinese (Simplified)') {
      filtered = filtered.filter(n => n !== 'Chinese (Traditional)');
    }

    onAvailableTargetLanguagesChange(filtered);
    onTargetLanguagesChange([]);
  };

  if (loading) return <div>Loading languages...</div>;

  // Phần JSX render giữ nguyên cấu trúc cũ, chỉ thay Object.keys(LANGUAGE_CODES) → languageNames
  // ...
};
```

> **Lưu ý:** Chỗ translate gửi lên API dùng `codeByName[selectedOriginLanguage]` thay vì `LANGUAGE_CODES[selectedOriginLanguage]`.

---

## Bước 5 — Frontend: Cập nhật constants thư viện

**File:** `src/components/features/privateLibrary/constants.js`

Hiện tại `ALL_LANGUAGES` hardcode. Có 2 cách xử lý:

**Cách A (đơn giản hơn):** Giữ nguyên constants, nhưng thêm comment sẽ dynamic hóa ở Phase 4+

**Cách B (clean hơn):** Export async function thay vì constant:

```javascript
import api from '../../../services/api';

export const fetchCompanyLanguages = () =>
  api.get('/languages/my-company/').then(res =>
    res.data.map(lang => ({
      key: lang.code.replace('-', '_').toLowerCase(),  // 'zh-CN' → 'zh_cn'
      label: lang.name,
      emoji: lang.flag_emoji,
    }))
  );

// EMPTY_KEYWORD vẫn giữ hardcode tạm thời
// sẽ dynamic hóa khi có đủ data từ API
export const buildEmptyKeyword = (languages) =>
  Object.fromEntries(languages.map(l => [l.key, '']));
```

> Chọn **Cách A** nếu thời gian eo hẹp — Phase 4 chỉ cần LanguageSelector dynamic là đủ cho luồng dịch.

---

## Verify checklist

- [ ] `GET /api/languages/my-company/` trả đúng ngôn ngữ của company user
- [ ] Trang upload file: LanguageSelector load ngôn ngữ từ API (không hardcode)
- [ ] Khi disable ngôn ngữ ở trang Admin → ngôn ngữ đó biến mất khỏi LanguageSelector
- [ ] Dịch sang ngôn ngữ bị disable → backend trả lỗi 400
- [ ] Không có regression ở các luồng dịch hiện tại
