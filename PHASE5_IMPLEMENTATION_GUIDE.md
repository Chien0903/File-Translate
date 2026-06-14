# Phase 5 Implementation Guide — Dynamic Glossary Pairs

> **Prerequisite:** Phase 1 hoàn thành (Language model tồn tại trong DB)  
> **Thời gian ước tính:** 1–2 ngày  
> **Kết quả:** Glossary pairs tự động generate từ danh sách ngôn ngữ active, không còn hardcode 44 cặp

---

## Vấn đề hiện tại

**File:** `Translate_v2/create_glossary.py`

```python
language_pair = {
    "vi-en": 1,
    "vi-ja": 2,
    # ... 44 cặp hardcode với ID số nguyên
    "or-zh-TW": 44,
}
```

**Vấn đề:**
1. Thêm ngôn ngữ mới → phải tính toán thủ công bao nhiêu cặp mới, gán ID tiếp theo
2. ID số nguyên (`toray_translation_glossary_1`) không nói lên ngôn ngữ nào
3. Nếu xóa ngôn ngữ → ID bị lỗ, khó maintain

---

## Giải pháp

1. **ID dạng code:** `toray_glossary_vi_en` thay vì `toray_translation_glossary_1`
2. **Auto-generate pairs** bằng `itertools.combinations` từ danh sách ngôn ngữ
3. **Glossary chỉ tạo khi cần** — khi company bật ngôn ngữ mới, tự động tạo các pair liên quan

---

## Tổng quan các bước

| # | Bước | File |
|---|------|------|
| 1 | Refactor `create_glossary.py`: dùng code-based ID | `Translate_v2/create_glossary.py` |
| 2 | Cập nhật `glossary_service.py`: generate pairs từ DB | `api/services/glossary_service.py` |
| 3 | Trigger tạo glossary khi enable ngôn ngữ mới | `api/services/company_language_service.py` |
| 4 | Script migration: đổi tên glossary cũ trên GCS | *(chạy 1 lần)* |

---

## Bước 1 — Refactor `create_glossary.py`

**File:** `Translate_v2/create_glossary.py`

Thay `language_pair` dict hardcode bằng function dynamic:

```python
import itertools
from google.cloud import translate_v3 as translate
import os
from dotenv import load_dotenv

load_dotenv()
project_id = os.getenv("PROJECT_ID")
input_uri = os.getenv("INPUT_URI", "gs://toray-buckets/glossary_term.csv")
google_credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if google_credentials_path:
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = google_credentials_path


def make_glossary_id(lang1: str, lang2: str) -> str:
    """
    Tạo glossary ID từ 2 language codes.
    Luôn sort để đảm bảo 'vi-en' và 'en-vi' cho cùng 1 ID.
    Dấu '-' và '-' trong code thay bằng '_' để hợp lệ với GCS naming.
    """
    pair = sorted([lang1, lang2])
    return "toray_glossary_" + "_".join(c.replace("-", "_") for c in pair)


def generate_pairs(language_codes: list) -> list[tuple]:
    """Tạo tất cả cặp (lang1, lang2) từ danh sách ngôn ngữ."""
    return list(itertools.combinations(sorted(language_codes), 2))


def manage_glossary(
    source_lang_code: str,
    target_lang_code: str,
    location: str = "us-central1",
    mode: int = 0,
    timeout: int = 180,
):
    """
    Tạo hoặc cập nhật glossary cho 1 cặp ngôn ngữ.
    mode=0: CREATE, mode=1: UPDATE
    """
    from google.protobuf import field_mask_pb2
    glossary_id = make_glossary_id(source_lang_code, target_lang_code)
    client = translate.TranslationServiceClient()
    parent = f"projects/{project_id}/locations/{location}"
    name = client.glossary_path(project_id, location, glossary_id)

    gcs_source = translate.GcsSource(input_uri=input_uri)
    input_config = translate.GlossaryInputConfig(gcs_source=gcs_source)

    if mode == 0:
        language_codes_set = translate.types.Glossary.LanguageCodesSet(
            language_codes=[source_lang_code, target_lang_code]
        )
        glossary = translate.types.Glossary(
            name=name,
            language_codes_set=language_codes_set,
            input_config=input_config,
        )
        operation = client.create_glossary(parent=parent, glossary=glossary)
        action = "Created"
    elif mode == 1:
        glossary = translate.types.Glossary(name=name, input_config=input_config)
        update_mask = field_mask_pb2.FieldMask(paths=["input_config"])
        operation = client.update_glossary(glossary=glossary, update_mask=update_mask)
        action = "Updated"
    else:
        raise ValueError("mode phải là 0 (create) hoặc 1 (update)")

    result = operation.result(timeout=timeout)
    print(f"{action} glossary: {result.name}")
    return result


def manage_all_glossaries(language_codes: list, mode: int = 0):
    """Tạo/update tất cả glossary cho danh sách ngôn ngữ."""
    pairs = generate_pairs(language_codes)
    print(f"Managing {len(pairs)} glossary pairs for {len(language_codes)} languages...")
    for lang1, lang2 in pairs:
        try:
            print(f"  {make_glossary_id(lang1, lang2)} ({lang1} ↔ {lang2})")
            manage_glossary(lang1, lang2, mode=mode)
        except Exception as e:
            print(f"  FAILED: {e}")


# Danh sách ngôn ngữ hiện tại — sau Phase 4 sẽ đọc từ DB
CURRENT_LANGUAGES = ['vi', 'ja', 'en', 'zh-CN', 'zh-TW', 'th', 'bn', 'hi', 'id', 'or']

if __name__ == "__main__":
    # Cập nhật tất cả glossaries với file CSV mới
    manage_all_glossaries(CURRENT_LANGUAGES, mode=1)
```

**Kiểm tra số cặp:** 10 ngôn ngữ → C(10,2) = **45 cặp** (tăng 1 so với 44 vì trước thiếu `zh-CN ↔ zh-TW`)

---

## Bước 2 — Cập nhật `glossary_service.py`

**File:** `api/services/glossary_service.py`

Thay `LANGUAGE_PAIRS` dict hardcode bằng function dùng `make_glossary_id`:

```python
# Thêm import ở đầu file
import itertools

# Thêm function lấy glossary_id từ DB
def get_glossary_id(source_lang: str, target_lang: str) -> str:
    """Trả về glossary ID cho cặp ngôn ngữ."""
    from Translate_v2.create_glossary import make_glossary_id
    return make_glossary_id(source_lang, target_lang)


def get_all_pairs_for_languages(language_codes: list) -> list[tuple]:
    """Tạo tất cả cặp từ danh sách ngôn ngữ."""
    return list(itertools.combinations(sorted(language_codes), 2))
```

Tìm chỗ trong `glossary_service.py` dùng `LANGUAGE_PAIRS[f"{lang1}-{lang2}"]` để lấy ID và thay bằng:

```python
# TRƯỚC:
# glossary_id = f"toray_translation_glossary_{LANGUAGE_PAIRS[pair_key]}"

# SAU:
glossary_id = get_glossary_id(source_lang, target_lang)
```

---

## Bước 3 — Trigger tạo glossary khi enable ngôn ngữ mới

**File:** `api/services/company_language_service.py`

Thêm vào method `enable_language` sau khi enable thành công:

```python
@staticmethod
@transaction.atomic
def enable_language(company: Company, language: Language, actor=None) -> CompanyLanguage:
    cl, created = CompanyLanguage.objects.get_or_create(...)
    # ... (code hiện tại)

    # Trigger tạo glossary pairs mới nếu đây là ngôn ngữ lần đầu enable
    if created:
        CompanyLanguageService._schedule_glossary_creation(company, language)

    return cl

@staticmethod
def _schedule_glossary_creation(company: Company, new_language: Language):
    """
    Tạo glossary pairs cho ngôn ngữ mới với tất cả ngôn ngữ đang enabled.
    Chạy trong background thread để không block response.
    """
    import threading
    from Translate_v2.create_glossary import manage_glossary

    enabled_codes = list(
        CompanyLanguageService.get_enabled_languages(company)
        .exclude(code=new_language.code)
        .values_list('code', flat=True)
    )

    def create_pairs():
        for existing_code in enabled_codes:
            try:
                manage_glossary(new_language.code, existing_code, mode=0)
            except Exception as e:
                print(f"[GlossaryCreation] Failed {new_language.code}↔{existing_code}: {e}")

    t = threading.Thread(target=create_pairs, daemon=True)
    t.start()
```

---

## Bước 4 — Script đổi tên glossary cũ (chạy 1 lần)

Chạy script này **1 lần duy nhất** để đổi tên 44 glossary cũ (`toray_translation_glossary_1..44`) sang naming mới (`toray_glossary_vi_en`...):

```python
# rename_glossaries.py — chạy 1 lần, KHÔNG commit vào codebase
from google.cloud import translate_v3 as translate
import os

# Map ID cũ → pair code (từ create_glossary.py cũ)
OLD_PAIRS = {
    1: ("vi", "en"), 2: ("vi", "ja"), 3: ("vi", "zh-CN"), 4: ("vi", "zh-TW"),
    5: ("en", "ja"), 6: ("en", "zh-CN"), 7: ("en", "zh-TW"), 8: ("ja", "zh-CN"),
    9: ("ja", "zh-TW"), 10: ("vi", "th"), 11: ("en", "th"), 12: ("ja", "th"),
    13: ("vi", "bn"), 14: ("en", "bn"), 15: ("ja", "bn"), 16: ("th", "bn"),
    17: ("vi", "hi"), 18: ("en", "hi"), 19: ("ja", "hi"), 20: ("th", "hi"),
    21: ("bn", "hi"), 22: ("vi", "id"), 23: ("en", "id"), 24: ("ja", "id"),
    25: ("th", "id"), 26: ("bn", "id"), 27: ("hi", "id"), 28: ("th", "zh-CN"),
    29: ("bn", "zh-CN"), 30: ("hi", "zh-CN"), 31: ("id", "zh-CN"), 32: ("th", "zh-TW"),
    33: ("bn", "zh-TW"), 34: ("hi", "zh-TW"), 35: ("id", "zh-TW"), 36: ("vi", "or"),
    37: ("en", "or"), 38: ("ja", "or"), 39: ("th", "or"), 40: ("bn", "or"),
    41: ("hi", "or"), 42: ("id", "or"), 43: ("or", "zh-CN"), 44: ("or", "zh-TW"),
}

# Các bước:
# 1. Tạo glossary mới với tên mới (cùng config)
# 2. Verify glossary mới hoạt động
# 3. Xóa glossary cũ
# Script này là manual — chạy thủ công và kiểm tra từng bước
print("Xem OLD_PAIRS để biết mapping cũ → mới")
print("Chạy manage_glossary() cho từng pair với tên mới, sau đó delete tên cũ")
```

> **Quan trọng:** Trên môi trường production, các glossary cũ vẫn hoạt động cho đến khi rename xong. Không có downtime.

---

## Verify checklist

- [ ] `make_glossary_id('vi', 'en')` == `make_glossary_id('en', 'vi')` (commutative)
- [ ] `generate_pairs(['vi', 'en', 'ja'])` trả 3 cặp: `(en,ja), (en,vi), (ja,vi)`
- [ ] Enable ngôn ngữ mới → glossary pairs tự động tạo (kiểm tra log)
- [ ] Translate với ngôn ngữ mới dùng đúng glossary ID mới
- [ ] 10 ngôn ngữ → 45 cặp (C(10,2) = 45)
