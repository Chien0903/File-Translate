# Phase 2 Implementation Guide — API Layer

> **Prerequisite:** Phase 1 hoàn thành (migrations 0031–0034 đã apply)  
> **Thời gian ước tính:** 2–3 ngày  
> **Kết quả:** 6 REST endpoint hoạt động, có authentication + permission

---

## Tổng quan các bước

| # | Bước | File |
|---|------|------|
| 1 | Tạo serializers | `api/serializers/language.py` |
| 2 | Tạo views | `api/views/language.py` |
| 3 | Tạo URL file | `api/urls/language.py` |
| 4 | Đăng ký URL vào router | `api/urls/__init__.py` |
| 5 | Test API bằng curl/Postman | — |

---

## API Endpoints thiết kế

```
GET  /api/languages/                                      — Tất cả ngôn ngữ hệ thống
GET  /api/companies/{company_id}/languages/               — Ngôn ngữ của company
POST /api/companies/{company_id}/languages/{lang_id}/enable/
POST /api/companies/{company_id}/languages/{lang_id}/disable/
POST /api/companies/{company_id}/languages/{lang_id}/set-default/
GET  /api/companies/{company_id}/languages/audit-log/     — Lịch sử thao tác
```

**Permission:**
- `GET /api/languages/` — IsAuthenticated (mọi user đều xem được)
- Các endpoint company — IsAuthenticated + phải là Admin

---

## Bước 1 — Tạo Serializers

**Kiểm tra thư mục serializers hiện có:**

```bash
ls WEB/multilanguage_transolator_be/api/serializers/
```

**File:** `api/serializers/language.py` *(tạo mới)*

```python
from rest_framework import serializers
from ..models.language import Language
from ..models.company import Company
from ..models.company_language import CompanyLanguage
from ..models.audit_log import LanguageAuditLog


class LanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Language
        fields = ['id', 'code', 'name', 'native_name', 'flag_emoji', 'is_active', 'sort_order']


class CompanyLanguageSerializer(serializers.ModelSerializer):
    language = LanguageSerializer(read_only=True)

    class Meta:
        model = CompanyLanguage
        fields = ['id', 'language', 'is_enabled', 'is_default', 'enabled_at']


class LanguageAuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.SerializerMethodField()
    language_code = serializers.SerializerMethodField()

    class Meta:
        model = LanguageAuditLog
        fields = ['id', 'actor_email', 'language_code', 'action', 'note', 'created_at']

    def get_actor_email(self, obj):
        return obj.actor.email if obj.actor else 'system'

    def get_language_code(self, obj):
        return obj.language.code if obj.language else None
```

---

## Bước 2 — Tạo Views

**File:** `api/views/language.py` *(tạo mới)*

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from ..models.language import Language
from ..models.company import Company
from ..models.company_language import CompanyLanguage
from ..models.audit_log import LanguageAuditLog
from ..serializers.language import (
    LanguageSerializer,
    CompanyLanguageSerializer,
    LanguageAuditLogSerializer,
)
from ..services.company_language_service import CompanyLanguageService


class LanguageListView(APIView):
    """GET /api/languages/ — tất cả ngôn ngữ trong hệ thống."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        languages = Language.objects.filter(is_active=True)
        serializer = LanguageSerializer(languages, many=True)
        return Response(serializer.data)


class CompanyLanguageListView(APIView):
    """GET /api/companies/{company_id}/languages/ — ngôn ngữ của 1 company."""
    permission_classes = [IsAuthenticated]

    def get(self, request, company_id):
        company = get_object_or_404(Company, pk=company_id, is_active=True)
        company_languages = CompanyLanguage.objects.filter(
            company=company
        ).select_related('language').order_by('language__sort_order')
        serializer = CompanyLanguageSerializer(company_languages, many=True)
        return Response(serializer.data)


class EnableLanguageView(APIView):
    """POST /api/companies/{company_id}/languages/{lang_id}/enable/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, company_id, lang_id):
        if request.user.role not in ('Admin',):
            return Response(
                {'detail': 'Permission denied.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        company = get_object_or_404(Company, pk=company_id)
        language = get_object_or_404(Language, pk=lang_id)
        cl = CompanyLanguageService.enable_language(company, language, actor=request.user)
        return Response(CompanyLanguageSerializer(cl).data, status=status.HTTP_200_OK)


class DisableLanguageView(APIView):
    """POST /api/companies/{company_id}/languages/{lang_id}/disable/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, company_id, lang_id):
        if request.user.role not in ('Admin',):
            return Response(
                {'detail': 'Permission denied.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        company = get_object_or_404(Company, pk=company_id)
        language = get_object_or_404(Language, pk=lang_id)
        try:
            cl = CompanyLanguageService.disable_language(company, language, actor=request.user)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CompanyLanguageSerializer(cl).data, status=status.HTTP_200_OK)


class SetDefaultLanguageView(APIView):
    """POST /api/companies/{company_id}/languages/{lang_id}/set-default/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, company_id, lang_id):
        if request.user.role not in ('Admin',):
            return Response(
                {'detail': 'Permission denied.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        company = get_object_or_404(Company, pk=company_id)
        language = get_object_or_404(Language, pk=lang_id)
        try:
            cl = CompanyLanguageService.set_default(company, language, actor=request.user)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CompanyLanguageSerializer(cl).data, status=status.HTTP_200_OK)


class LanguageAuditLogView(APIView):
    """GET /api/companies/{company_id}/languages/audit-log/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, company_id):
        if request.user.role not in ('Admin',):
            return Response(
                {'detail': 'Permission denied.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        company = get_object_or_404(Company, pk=company_id)
        logs = LanguageAuditLog.objects.filter(
            company=company
        ).select_related('actor', 'language').order_by('-created_at')[:50]
        serializer = LanguageAuditLogSerializer(logs, many=True)
        return Response(serializer.data)
```

---

## Bước 3 — Tạo URL file

**File:** `api/urls/language.py` *(tạo mới)*

```python
from django.urls import path
from api.views.language import (
    LanguageListView,
    CompanyLanguageListView,
    EnableLanguageView,
    DisableLanguageView,
    SetDefaultLanguageView,
    LanguageAuditLogView,
)

urlpatterns = [
    # System-level: all languages
    path('', LanguageListView.as_view(), name='language_list'),

    # Company-level: manage languages per company
    path(
        'companies/<int:company_id>/languages/',
        CompanyLanguageListView.as_view(),
        name='company_language_list',
    ),
    path(
        'companies/<int:company_id>/languages/<int:lang_id>/enable/',
        EnableLanguageView.as_view(),
        name='language_enable',
    ),
    path(
        'companies/<int:company_id>/languages/<int:lang_id>/disable/',
        DisableLanguageView.as_view(),
        name='language_disable',
    ),
    path(
        'companies/<int:company_id>/languages/<int:lang_id>/set-default/',
        SetDefaultLanguageView.as_view(),
        name='language_set_default',
    ),
    path(
        'companies/<int:company_id>/languages/audit-log/',
        LanguageAuditLogView.as_view(),
        name='language_audit_log',
    ),
]
```

---

## Bước 4 — Đăng ký URL vào router

**File:** `api/urls/__init__.py` *(sửa)*

Thêm 2 dòng vào file hiện tại:

```python
# Thêm import ở đầu (cùng block với các include khác):
path('languages/', include('api.urls.language')),
```

File đầy đủ sau khi sửa:

```python
from django.urls import include, path
from api.views.translate import TranslateFileView, TranslateTextView
from api.services.upload_to_s3 import upload_file_to_s3
from api.views.health import HealthCheckView

urlpatterns = [
    # Core functionality
    path('keywords/', include('api.urls.keyword')),
    path('user/', include('api.urls.user')),
    path('upload-to-s3/', upload_file_to_s3, name='upload_file_to_s3'),
    path('translate/', TranslateFileView.as_view(), name='translate_file'),
    path('translate-text/', TranslateTextView.as_view(), name='translate_text'),
    path('convert/', include('api.urls.convert')),
    path('translated-file/', include('api.urls.translated_file')),
    path('notifications/', include('api.urls.notification')),
    path('check-pdf-editable/', include('api.urls.pdf_validation')),

    # Admin statistics
    path('', include('api.urls.keyword_stats')),

    # JWT authentication
    path('auth/', include('api.urls.alb_auth')),
    path('health/', HealthCheckView.as_view(), name='health_check'),

    # Language management (Phase 2)
    path('languages/', include('api.urls.language')),
]
```

---

## Bước 5 — Kiểm tra có thư mục serializers chưa

Nếu `api/serializers/` chưa có `__init__.py`, tạo thêm:

```bash
# Kiểm tra
ls WEB/multilanguage_transolator_be/api/serializers/

# Nếu chưa có __init__.py thì tạo file rỗng
touch WEB/multilanguage_transolator_be/api/serializers/__init__.py
```

---

## Bước 6 — Test API

Khởi động server:
```bash
python manage.py runserver
```

### Test 1: GET danh sách ngôn ngữ hệ thống

```bash
# Lấy token trước
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com", "password": "yourpassword"}'

# Dùng token để get languages
curl http://localhost:8000/api/languages/ \
  -H "Authorization: Bearer <access_token>"
```

**Expected response:**
```json
[
  {"id": 1, "code": "vi", "name": "Vietnamese", "native_name": "Tiếng Việt", "flag_emoji": "🇻🇳", "is_active": true, "sort_order": 1},
  {"id": 2, "code": "ja", "name": "Japanese", "native_name": "日本語", "flag_emoji": "🇯🇵", "is_active": true, "sort_order": 2},
  ...
]
```

### Test 2: GET languages của company 1

```bash
curl http://localhost:8000/api/companies/1/languages/ \
  -H "Authorization: Bearer <access_token>"
```

**Expected response:**
```json
[
  {
    "id": 1,
    "language": {"id": 2, "code": "ja", "name": "Japanese", ...},
    "is_enabled": true,
    "is_default": true,
    "enabled_at": "2026-06-15T..."
  },
  ...
]
```

### Test 3: Disable một ngôn ngữ (cần Admin role)

```bash
curl -X POST http://localhost:8000/api/companies/1/languages/7/disable/ \
  -H "Authorization: Bearer <access_token>"
```

### Test 4: Set default

```bash
curl -X POST http://localhost:8000/api/companies/1/languages/3/set-default/ \
  -H "Authorization: Bearer <access_token>"
```

### Test 5: Disable ngôn ngữ đang là default → phải trả 400

```bash
curl -X POST http://localhost:8000/api/companies/1/languages/3/disable/ \
  -H "Authorization: Bearer <access_token>"
# Expected: 400 Bad Request với message lỗi
```

### Test 6: Audit log

```bash
curl http://localhost:8000/api/companies/1/languages/audit-log/ \
  -H "Authorization: Bearer <access_token>"
```

---

## Verify checklist

- [ ] `GET /api/languages/` trả 10 ngôn ngữ
- [ ] `GET /api/companies/1/languages/` trả đúng số ngôn ngữ enabled
- [ ] `POST enable/` hoạt động với Admin, trả 403 với User thường
- [ ] `POST disable/` hoạt động, trả 400 khi disable default
- [ ] `POST set-default/` thay đổi đúng default
- [ ] `GET audit-log/` hiển thị lịch sử các thao tác
