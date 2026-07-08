import itertools
import os
from dotenv import load_dotenv
from google.cloud import storage
from google.cloud import translate_v3 as translate
from google.protobuf import field_mask_pb2

load_dotenv()
project_id = os.getenv("PROJECT_ID")
input_uri = os.getenv("INPUT_URI", "gs://company-buckets/glossary_term.csv")
google_credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if google_credentials_path:
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = google_credentials_path


# Danh sách ngôn ngữ hiện tại — source of truth khi chạy script độc lập
# (backend đọc từ DB qua generate_pairs_from_db())
CURRENT_LANGUAGES = ['vi', 'ja', 'en', 'zh-CN', 'zh-TW', 'th', 'bn', 'hi', 'id', 'or']


def make_glossary_id(lang1: str, lang2: str) -> str:
    """
    Tạo glossary ID từ 2 language codes — luôn sort để commutative.
    Ví dụ: make_glossary_id('vi', 'en') == make_glossary_id('en', 'vi') == 'company_glossary_en_vi'
    """
    pair = sorted([lang1, lang2])
    return "company_glossary_" + "_".join(c.replace("-", "_") for c in pair)


def generate_pairs(language_codes: list) -> list:
    """Tạo tất cả cặp (lang1, lang2) từ danh sách ngôn ngữ."""
    return list(itertools.combinations(sorted(language_codes), 2))


def manage_glossary(
    source_lang_code: str,
    target_lang_code: str,
    location: str = "us-central1",
    mode: int = 0,
    timeout: int = 180,
    glossary_id: str = None,
) -> translate.Glossary:
    """
    Tạo hoặc cập nhật glossary cho 1 cặp ngôn ngữ.
    mode=0: CREATE, mode=1: UPDATE
    glossary_id: tự động tạo bằng make_glossary_id() nếu không truyền vào
    """
    if glossary_id is None:
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


def manage_all_glossaries(language_codes: list = None, mode: int = 0):
    """Tạo/update tất cả glossary cho danh sách ngôn ngữ."""
    if language_codes is None:
        language_codes = CURRENT_LANGUAGES
    pairs = generate_pairs(language_codes)
    print(f"Managing {len(pairs)} glossary pairs for {len(language_codes)} languages...")
    for lang1, lang2 in pairs:
        gid = make_glossary_id(lang1, lang2)
        try:
            print(f"  {gid} ({lang1} ↔ {lang2})")
            manage_glossary(lang1, lang2, mode=mode, glossary_id=gid)
        except Exception as e:
            print(f"  FAILED {gid}: {e}")


def upload_csv(source_file_path: str):
    """Upload file local lên GCS."""
    bucket_name = "toray-buckets"
    destination_blob_name = "glossary_term.csv"
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(destination_blob_name)
    blob.upload_from_filename(source_file_path)
    print(f"Đã upload {source_file_path} → gs://{bucket_name}/{destination_blob_name}")


# Giữ backward compat với code cũ import language_pair
language_pair = {
    "vi-en": 1, "vi-ja": 2, "vi-zh-CN": 3, "vi-zh-TW": 4, "en-ja": 5,
    "en-zh-CN": 6, "en-zh-TW": 7, "ja-zh-CN": 8, "ja-zh-TW": 9,
    "vi-th": 10, "en-th": 11, "ja-th": 12,
    "vi-bn": 13, "en-bn": 14, "ja-bn": 15, "th-bn": 16,
    "vi-hi": 17, "en-hi": 18, "ja-hi": 19, "th-hi": 20, "bn-hi": 21,
    "vi-id": 22, "en-id": 23, "ja-id": 24, "th-id": 25, "bn-id": 26, "hi-id": 27,
    "th-zh-CN": 28, "bn-zh-CN": 29, "hi-zh-CN": 30, "id-zh-CN": 31,
    "th-zh-TW": 32, "bn-zh-TW": 33, "hi-zh-TW": 34, "id-zh-TW": 35,
    "vi-or": 36, "en-or": 37, "ja-or": 38, "th-or": 39, "bn-or": 40,
    "hi-or": 41, "id-or": 42, "or-zh-CN": 43, "or-zh-TW": 44,
}

if __name__ == "__main__":
    # Cập nhật tất cả glossaries với file CSV mới (mode=1: UPDATE)
    manage_all_glossaries(CURRENT_LANGUAGES, mode=1)
