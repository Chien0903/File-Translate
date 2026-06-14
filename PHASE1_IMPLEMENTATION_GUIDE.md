# Phase 1 Implementation Guide — Database & Backend Core

> **Mục tiêu:** Tạo nền tảng database cho hệ thống Multi-tenant Language Management.  
> **Thời gian ước tính:** 3–4 ngày  
> **Migration hiện tại:** `0031_remove_cognito_fields`  
> **Kết quả Phase 1:** 5 model mới + 2 data migration + service layer + audit log

---

## Tổng quan các bước

| # | Bước | File thay đổi |
|---|------|---------------|
| 1 | Tạo model `Language` | `api/models/language.py` |
| 2 | Tạo model `Company` | `api/models/company.py` |
| 3 | Tạo model `CompanyLanguage` | `api/models/company_language.py` |
| 4 | Thêm FK vào `CustomUser` | `api/models/user.py` |
| 5 | Tạo model `LanguageAuditLog` | `api/models/audit_log.py` |
| 6 | Đăng ký models vào `__init__.py` | `api/models/__init__.py` |
| 7 | Tạo schema migration | `api/migrations/0032_...py` |
| 8 | Tạo data migration: seed languages | `api/migrations/0033_...py` |
| 9 | Tạo data migration: seed default company | `api/migrations/0034_...py` |
| 10 | Viết `CompanyLanguageService` | `api/services/company_language_service.py` |
| 11 | Viết AuditLog signal | `api/signals/audit_log.py` |
| 12 | Đăng ký signal vào `apps.py` | `api/apps.py` |
| 13 | Verify toàn bộ Phase 1 | — |

---

## Bước 1 — Tạo model `Language`

**File:** `WEB/multilanguage_transolator_be/api/models/language.py` *(tạo mới)*

```python
from django.db import models


class Language(models.Model):
    """Bảng master ngôn ngữ — thay thế dict LANGUAGES hardcode."""
    code = models.CharField(max_length=10, unique=True)   # 'vi', 'ja', 'zh-CN'
    name = models.CharField(max_length=100)               # 'Vietnamese', 'Japanese'
    native_name = models.CharField(max_length=100, blank=True)  # 'Tiếng Việt', '日本語'
    flag_emoji = models.CharField(max_length=10, blank=True)    # '🇻🇳', '🇯🇵'
    is_active = models.BooleanField(default=True)         # tắt toàn hệ thống nếu cần
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return f"{self.code} — {self.name}"
```

**Giải thích:**
- `code` là khóa dùng để gọi Google Translate API (phải khớp với `LANGUAGES` dict hiện tại)
- `native_name` và `flag_emoji` để hiển thị UI sau này
- `is_active` để admin tắt ngôn ngữ mà không cần xóa

---

## Bước 2 — Tạo model `Company`

**File:** `WEB/multilanguage_transolator_be/api/models/company.py` *(tạo mới)*

```python
from django.db import models


class Company(models.Model):
    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=100, unique=True)  # 'toray-vn', 'toray-jp'
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "companies"
        ordering = ['name']

    def __str__(self):
        return self.name
```

**Giải thích:**
- `slug` dùng làm subdomain hoặc URL path sau này (`/toray-vn/translate`)
- Bắt đầu đơn giản — chỉ thêm field khi Phase 3+ cần

---

## Bước 3 — Tạo model `CompanyLanguage`

**File:** `WEB/multilanguage_transolator_be/api/models/company_language.py` *(tạo mới)*

```python
from django.db import models
from .company import Company
from .language import Language


class CompanyLanguage(models.Model):
    """Ngôn ngữ mà từng company kích hoạt."""
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name='company_languages'
    )
    language = models.ForeignKey(
        Language, on_delete=models.CASCADE, related_name='company_languages'
    )
    is_enabled = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    enabled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('company', 'language')]
        # Partial unique index: mỗi company chỉ có 1 default language
        # Django không hỗ trợ native — tạo thủ công trong migration (Bước 7)

    def __str__(self):
        default_mark = " [default]" if self.is_default else ""
        return f"{self.company.name} — {self.language.code}{default_mark}"
```

> **Lưu ý quan trọng:** Django không có syntax cho partial unique index.  
> Constraint `UNIQUE WHERE is_default = TRUE` sẽ được thêm thủ công trong migration ở Bước 7.

---

## Bước 4 — Thêm FK vào `CustomUser`

**File:** `WEB/multilanguage_transolator_be/api/models/user.py` *(sửa)*

Thêm 2 dòng import và 2 field vào class `CustomUser`:

```python
# Thêm vào đầu file (sau các import hiện tại)
from django.db import models  # đã có rồi

# Thêm 2 field vào class CustomUser, sau field 'date_joined':
    company = models.ForeignKey(
        'api.Company',                  # string reference tránh circular import
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users',
    )
    preferred_language = models.ForeignKey(
        'api.Language',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='preferred_by_users',
    )
```

**File đầy đủ sau khi sửa `class CustomUser`:**

```python
class CustomUser(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('User', 'User'),
        ('Admin', 'Admin'),
        ('Library Keeper', 'Library Keeper'),
    ]
    
    email = models.EmailField(unique=True, max_length=255)
    first_name = models.CharField(max_length=30, blank=True, null=True)
    last_name = models.CharField(max_length=30, blank=True, null=True)
    department = models.CharField(max_length=100, blank=True, null=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='User')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    company = models.ForeignKey(
        'api.Company',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users',
    )
    preferred_language = models.ForeignKey(
        'api.Language',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='preferred_by_users',
    )
    
    objects = CustomUserManager()
    USERNAME_FIELD = 'email'           
    REQUIRED_FIELDS = ["first_name", "last_name"]

    def __str__(self):
        return f"{self.email} - {self.first_name} {self.last_name} - {self.role}"
```

---

## Bước 5 — Tạo model `LanguageAuditLog`

**File:** `WEB/multilanguage_transolator_be/api/models/audit_log.py` *(tạo mới)*

```python
from django.db import models
from .user import CustomUser
from .company import Company
from .language import Language


class LanguageAuditLog(models.Model):
    ACTION_CHOICES = [
        ('enable', 'Enable Language'),
        ('disable', 'Disable Language'),
        ('set_default', 'Set Default Language'),
        ('add_language', 'Add Language to System'),
    ]

    actor = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, related_name='audit_logs'
    )
    company = models.ForeignKey(
        Company, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs'
    )
    language = models.ForeignKey(
        Language, on_delete=models.SET_NULL, null=True, related_name='audit_logs'
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.created_at:%Y-%m-%d %H:%M}] {self.actor} — {self.action} — {self.language}"
```

---

## Bước 6 — Đăng ký models vào `__init__.py`

**File:** `WEB/multilanguage_transolator_be/api/models/__init__.py` *(sửa)*

Đọc file hiện tại, rồi thêm các dòng import mới:

```python
from .language import Language
from .company import Company
from .company_language import CompanyLanguage
from .audit_log import LanguageAuditLog
```

> Nếu file `__init__.py` đang trống hoặc chỉ có comment, thêm tất cả 4 dòng trên vào.

---

## Bước 7 — Tạo schema migration

Chạy lệnh:

```bash
cd WEB/multilanguage_transolator_be
python manage.py makemigrations api --name="add_language_company_models"
```

Lệnh này sẽ tạo file `0032_add_language_company_models.py`.  
**Sau khi tạo xong**, mở file đó và thêm thủ công partial unique index vào cuối `operations` list:

```python
# Thêm vào cuối list operations[] trong migration 0032:
migrations.RunSQL(
    sql="""
        CREATE UNIQUE INDEX unique_default_language_per_company
        ON api_companylanguage (company_id)
        WHERE is_default = TRUE;
    """,
    reverse_sql="DROP INDEX IF EXISTS unique_default_language_per_company;",
),
```

Sau đó chạy migrate:

```bash
python manage.py migrate
```

**Verify:** Kiểm tra DB có đủ các bảng mới:

```bash
python manage.py shell -c "
from api.models import Language, Company, CompanyLanguage, LanguageAuditLog
print('OK:', Language._meta.db_table)
print('OK:', Company._meta.db_table)
print('OK:', CompanyLanguage._meta.db_table)
print('OK:', LanguageAuditLog._meta.db_table)
"
```

---

## Bước 8 — Data migration: Seed 10 ngôn ngữ

Tạo file migration mới **rỗng**:

```bash
python manage.py makemigrations api --empty --name="seed_initial_languages"
```

Mở file `0033_seed_initial_languages.py` vừa tạo, **thay toàn bộ nội dung** bằng:

```python
from django.db import migrations

INITIAL_LANGUAGES = [
    # (code, name, native_name, flag_emoji, sort_order)
    ('vi',    'Vietnamese',          'Tiếng Việt',   '🇻🇳', 1),
    ('ja',    'Japanese',            '日本語',        '🇯🇵', 2),
    ('en',    'English',             'English',       '🇬🇧', 3),
    ('zh-CN', 'Chinese (Simplified)','简体中文',      '🇨🇳', 4),
    ('zh-TW', 'Chinese (Traditional)','繁體中文',     '🇹🇼', 5),
    ('th',    'Thai',                'ภาษาไทย',      '🇹🇭', 6),
    ('bn',    'Bengali',             'বাংলা',         '🇧🇩', 7),
    ('hi',    'Hindi',               'हिन्दी',       '🇮🇳', 8),
    ('id',    'Indonesian',          'Bahasa Indonesia','🇮🇩', 9),
    ('or',    'Oriya',               'ଓଡ଼ିଆ',        '🇮🇳', 10),
]


def seed_languages(apps, schema_editor):
    Language = apps.get_model('api', 'Language')
    for code, name, native_name, flag_emoji, sort_order in INITIAL_LANGUAGES:
        Language.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'native_name': native_name,
                'flag_emoji': flag_emoji,
                'sort_order': sort_order,
                'is_active': True,
            }
        )


def unseed_languages(apps, schema_editor):
    Language = apps.get_model('api', 'Language')
    codes = [row[0] for row in INITIAL_LANGUAGES]
    Language.objects.filter(code__in=codes).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0032_add_language_company_models'),
    ]

    operations = [
        migrations.RunPython(seed_languages, reverse_code=unseed_languages),
    ]
```

Chạy:

```bash
python manage.py migrate
```

**Verify:**

```bash
python manage.py shell -c "
from api.models import Language
for lang in Language.objects.all():
    print(lang.sort_order, lang.code, lang.name)
"
```

Expected output:
```
1 vi Vietnamese
2 ja Japanese
3 en English
4 zh-CN Chinese (Simplified)
...
10 or Oriya
```

---

## Bước 9 — Data migration: Seed default company và gán users

Tạo migration rỗng:

```bash
python manage.py makemigrations api --empty --name="seed_default_company_and_assign_users"
```

Mở file `0034_seed_default_company_and_assign_users.py`, **thay toàn bộ** bằng:

```python
from django.db import migrations
from django.utils.text import slugify

DEFAULT_COMPANY_NAME = "Toray"
DEFAULT_COMPANY_SLUG = "toray"


def seed_company_and_assign(apps, schema_editor):
    Company = apps.get_model('api', 'Company')
    Language = apps.get_model('api', 'Language')
    CompanyLanguage = apps.get_model('api', 'CompanyLanguage')
    CustomUser = apps.get_model('api', 'CustomUser')

    # 1. Tạo company mặc định
    company, _ = Company.objects.get_or_create(
        slug=DEFAULT_COMPANY_SLUG,
        defaults={'name': DEFAULT_COMPANY_NAME, 'is_active': True},
    )

    # 2. Kích hoạt tất cả 10 ngôn ngữ cho company này
    languages = Language.objects.all()
    for idx, lang in enumerate(languages.order_by('sort_order')):
        CompanyLanguage.objects.get_or_create(
            company=company,
            language=lang,
            defaults={
                'is_enabled': True,
                'is_default': (lang.code == 'ja'),  # Japanese là default
            },
        )

    # 3. Gán tất cả user hiện tại vào company này
    CustomUser.objects.filter(company__isnull=True).update(company=company)


def unseed_company_and_assign(apps, schema_editor):
    Company = apps.get_model('api', 'Company')
    CustomUser = apps.get_model('api', 'CustomUser')
    CustomUser.objects.all().update(company=None)
    Company.objects.filter(slug=DEFAULT_COMPANY_SLUG).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0033_seed_initial_languages'),
    ]

    operations = [
        migrations.RunPython(seed_company_and_assign, reverse_code=unseed_company_and_assign),
    ]
```

Chạy:

```bash
python manage.py migrate
```

**Verify:**

```bash
python manage.py shell -c "
from api.models import Company, CompanyLanguage, CustomUser
company = Company.objects.first()
print('Company:', company.name)
print('Languages enabled:', company.company_languages.filter(is_enabled=True).count())
print('Users assigned:', CustomUser.objects.filter(company=company).count())
default_lang = company.company_languages.get(is_default=True)
print('Default language:', default_lang.language.code)
"
```

---

## Bước 10 — Viết `CompanyLanguageService`

**File:** `WEB/multilanguage_transolator_be/api/services/company_language_service.py` *(tạo mới)*

```python
from django.db import transaction
from ..models.company import Company
from ..models.language import Language
from ..models.company_language import CompanyLanguage
from ..models.audit_log import LanguageAuditLog


class CompanyLanguageService:

    @staticmethod
    def get_enabled_languages(company: Company):
        """Trả về queryset Language đang bật cho company."""
        return Language.objects.filter(
            company_languages__company=company,
            company_languages__is_enabled=True,
        ).order_by('sort_order')

    @staticmethod
    @transaction.atomic
    def enable_language(company: Company, language: Language, actor=None) -> CompanyLanguage:
        """Bật một ngôn ngữ cho company. Nếu chưa có CompanyLanguage thì tạo mới."""
        cl, created = CompanyLanguage.objects.get_or_create(
            company=company,
            language=language,
            defaults={'is_enabled': True},
        )
        if not created and not cl.is_enabled:
            cl.is_enabled = True
            cl.save(update_fields=['is_enabled'])

        LanguageAuditLog.objects.create(
            actor=actor,
            company=company,
            language=language,
            action='enable',
        )
        return cl

    @staticmethod
    @transaction.atomic
    def disable_language(company: Company, language: Language, actor=None) -> CompanyLanguage:
        """Tắt một ngôn ngữ. Không cho phép tắt ngôn ngữ đang là default."""
        cl = CompanyLanguage.objects.get(company=company, language=language)
        if cl.is_default:
            raise ValueError(
                f"Cannot disable '{language.code}' — it is the default language. "
                "Set another language as default first."
            )
        cl.is_enabled = False
        cl.save(update_fields=['is_enabled'])

        LanguageAuditLog.objects.create(
            actor=actor,
            company=company,
            language=language,
            action='disable',
        )
        return cl

    @staticmethod
    @transaction.atomic
    def set_default(company: Company, language: Language, actor=None) -> CompanyLanguage:
        """Đặt ngôn ngữ mặc định. Tự động bỏ default cũ trong cùng transaction."""
        # Đảm bảo ngôn ngữ đang được bật trước
        cl = CompanyLanguage.objects.filter(
            company=company, language=language, is_enabled=True
        ).first()
        if not cl:
            raise ValueError(
                f"Language '{language.code}' is not enabled for company '{company.name}'. "
                "Enable it first before setting as default."
            )

        # Bỏ default cũ
        CompanyLanguage.objects.filter(
            company=company, is_default=True
        ).update(is_default=False)

        # Set default mới
        cl.is_default = True
        cl.save(update_fields=['is_default'])

        LanguageAuditLog.objects.create(
            actor=actor,
            company=company,
            language=language,
            action='set_default',
        )
        return cl

    @staticmethod
    def get_default_language(company: Company):
        """Trả về Language object là default của company, hoặc None."""
        cl = CompanyLanguage.objects.filter(
            company=company, is_default=True, is_enabled=True
        ).select_related('language').first()
        return cl.language if cl else None
```

---

## Bước 11 — Viết AuditLog Signal

**File:** `WEB/multilanguage_transolator_be/api/signals/audit_log.py` *(tạo mới)*

Tạo thư mục `signals/` nếu chưa có:

```bash
mkdir WEB/multilanguage_transolator_be/api/signals
touch WEB/multilanguage_transolator_be/api/signals/__init__.py
```

**File `audit_log.py`:**

```python
from django.db.models.signals import post_save
from django.dispatch import receiver
from ..models.company_language import CompanyLanguage
from ..models.audit_log import LanguageAuditLog


@receiver(post_save, sender=CompanyLanguage)
def log_default_change(sender, instance, created, **kwargs):
    """
    Tự động ghi audit log khi is_default thay đổi.
    Service layer cũng ghi log — signal này là lớp backup cho direct ORM saves.
    """
    if not created and instance.is_default:
        # Kiểm tra xem log đã được ghi bởi service chưa (trong 1 giây)
        from django.utils import timezone
        from datetime import timedelta
        recent = LanguageAuditLog.objects.filter(
            company=instance.company,
            language=instance.language,
            action='set_default',
            created_at__gte=timezone.now() - timedelta(seconds=1),
        ).exists()
        if not recent:
            LanguageAuditLog.objects.create(
                actor=None,
                company=instance.company,
                language=instance.language,
                action='set_default',
                note='Auto-logged by signal',
            )
```

---

## Bước 12 — Đăng ký Signal vào `apps.py`

**File:** `WEB/multilanguage_transolator_be/api/apps.py`

Đọc file hiện tại. Nếu chưa có `ready()` method, thêm vào:

```python
from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        import api.signals.audit_log  # noqa: F401 — kích hoạt signal
```

Đảm bảo trong `api/__init__.py` có dòng:

```python
default_app_config = 'api.apps.ApiConfig'
```

> Nếu Django >= 3.2 thì dòng trên không cần — `apps.py` được tự động detect.

---

## Bước 13 — Verify toàn bộ Phase 1

Chạy lần lượt từng lệnh, đảm bảo không có error:

### 13.1 — Kiểm tra migration status

```bash
python manage.py showmigrations api
```

Expected: `0031` đến `0034` đều có dấu `[X]`

### 13.2 — Test service layer

```bash
python manage.py shell
```

```python
from api.models import Company, Language
from api.services.company_language_service import CompanyLanguageService

company = Company.objects.get(slug='toray')
lang_en = Language.objects.get(code='en')
lang_ja = Language.objects.get(code='ja')

# Test get enabled languages
enabled = CompanyLanguageService.get_enabled_languages(company)
print("Enabled:", list(enabled.values_list('code', flat=True)))

# Test get default
default = CompanyLanguageService.get_default_language(company)
print("Default:", default.code)  # ja

# Test set_default
CompanyLanguageService.set_default(company, lang_en)
default = CompanyLanguageService.get_default_language(company)
print("New default:", default.code)  # en

# Test disable (không phải default)
lang_bn = Language.objects.get(code='bn')
CompanyLanguageService.disable_language(company, lang_bn)
enabled = CompanyLanguageService.get_enabled_languages(company)
print("bn still enabled:", 'bn' in list(enabled.values_list('code', flat=True)))  # False

# Test disable default -> phải raise lỗi
try:
    CompanyLanguageService.disable_language(company, lang_en)
    print("ERROR: Should have raised ValueError!")
except ValueError as e:
    print("Correct error:", e)

exit()
```

### 13.3 — Kiểm tra AuditLog

```python
from api.models import LanguageAuditLog
logs = LanguageAuditLog.objects.all()
print(f"Total logs: {logs.count()}")
for log in logs[:5]:
    print(f"  [{log.action}] {log.language.code} — {log.created_at:%H:%M:%S}")
```

### 13.4 — Kiểm tra partial unique index (PostgreSQL)

Vào psql hoặc Django shell:

```bash
python manage.py dbshell
```

```sql
-- Kiểm tra index tồn tại
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'api_companylanguage';

-- Test constraint: thử insert 2 default cho cùng company -> phải lỗi
-- (Chỉ test nếu muốn, đây là DB-level test)
```

---

## Tóm tắt files đã tạo/sửa trong Phase 1

```
api/
├── models/
│   ├── __init__.py          [UPDATED]
│   ├── user.py              [UPDATED] — thêm company + preferred_language FK
│   ├── language.py          [NEW]
│   ├── company.py           [NEW]
│   ├── company_language.py  [NEW]
│   └── audit_log.py         [NEW]
├── services/
│   └── company_language_service.py   [NEW]
├── signals/
│   ├── __init__.py          [NEW]
│   └── audit_log.py         [NEW]
├── apps.py                  [UPDATED] — đăng ký signal
└── migrations/
    ├── 0032_add_language_company_models.py   [NEW] — schema
    ├── 0033_seed_initial_languages.py        [NEW] — data
    └── 0034_seed_default_company_and_assign_users.py  [NEW] — data
```

---

## Sau khi hoàn thành Phase 1

Chuyển sang **Phase 2: API Layer** — viết ViewSet và serializer cho:
- `GET /api/languages/` — danh sách tất cả ngôn ngữ trong hệ thống
- `GET /api/companies/{id}/languages/` — ngôn ngữ của company
- `POST /api/companies/{id}/languages/{lang_id}/enable/`
- `POST /api/companies/{id}/languages/{lang_id}/disable/`
- `POST /api/companies/{id}/languages/{lang_id}/set-default/`
