from google.cloud import translate_v3 as translate
import os
from dotenv import load_dotenv
from google.cloud import storage
from google.cloud import translate_v3 as translate
from google.protobuf import field_mask_pb2
import os
load_dotenv()
project_id = os.getenv("PROJECT_ID")
input_uri = os.getenv("INPUT_URI", "gs://toray-buckets/glossary_term.csv")
google_credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = google_credentials_path

language_pair = {
    "vi-en": 1,
    "vi-ja": 2,
    "vi-zh-CN": 3,
    "vi-zh-TW": 4,
    "en-ja": 5,
    "en-zh-CN": 6,
    "en-zh-TW": 7,
    "ja-zh-CN": 8,
    "ja-zh-TW": 9,
    # mở rộng theo yêu cầu
    "vi-th": 10,
    "en-th": 11,
    "ja-th": 12,

    # Bengali (bn)
    "vi-bn": 13,
    "en-bn": 14,
    "ja-bn": 15,
    "th-bn": 16,

    # Hindi (hi)
    "vi-hi": 17,
    "en-hi": 18,
    "ja-hi": 19,
    "th-hi": 20,
    "bn-hi": 21,

    # Indonesian (id)
    "vi-id": 22,
    "en-id": 23,
    "ja-id": 24,
    "th-id": 25,
    "bn-id": 26,
    "hi-id": 27,

    # nhóm zh-CN đích
    "th-zh-CN": 28,
    "bn-zh-CN": 29,
    "hi-zh-CN": 30,
    "id-zh-CN": 31,

    # nhóm zh-TW đích
    "th-zh-TW": 32,
    "bn-zh-TW": 33,
    "hi-zh-TW": 34,
    "id-zh-TW": 35,

    # nhóm Oriya (or)
    "vi-or": 36,
    "en-or": 37,
    "ja-or": 38,
    "th-or": 39,
    "bn-or": 40,
    "hi-or": 41,
    "id-or": 42,
    "or-zh-CN": 43,
    "or-zh-TW": 44,
}

def manage_glossary(
    glossary_id: str,
    source_lang_code: str,
    target_lang_code: str,
    location: str = "us-central1",
    mode: int = 0,  # 0=create, 1=update
    timeout: int = 180,
) -> translate.Glossary:
    """
    Tạo hoặc cập nhật một glossary.
    - mode=0: tạo glossary mới (CREATE)
    - mode=1: cập nhật nguồn file của glossary đã có sẵn (UPDATE)
    """
    client = translate.TranslationServiceClient()
    parent = f"projects/{project_id}/locations/{location}"
    name = client.glossary_path(project_id, location, glossary_id)

    gcs_source = translate.GcsSource(input_uri=input_uri)
    input_config = translate.GlossaryInputConfig(gcs_source=gcs_source)

    if mode == 0:
        # CREATE
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
        # UPDATE: chỉ đổi input_config
        glossary = translate.types.Glossary(
            name=name,
            input_config=input_config,
        )
        update_mask = field_mask_pb2.FieldMask(paths=["input_config"])
        operation = client.update_glossary(
            glossary=glossary,
            update_mask=update_mask
        )
        action = "Updated"
    else:
        raise ValueError("mode phải là 0 (create) hoặc 1 (update)")

    result = operation.result(timeout=timeout)
    print(f"{action} glossary: {result.name}")
    print(f"Input URI: {result.input_config.gcs_source.input_uri}")
    return result

# nếu lần đầu tạo glossaries thì dùng mode 0, update library mới thì mode 
def manage_all_glossaries(mode):
    for pair, glossary_id_suffix in language_pair.items():
        source_lang_code, target_lang_code = pair.split("-", 1)
        glossary_id = f"toray_translation_glossary_{glossary_id_suffix}"
        try:
            print(f"Managing glossary: {glossary_id} ({source_lang_code} -> {target_lang_code})")
            manage_glossary(glossary_id, source_lang_code, target_lang_code, mode=mode)
        except Exception as e:
            print(f"Failed to manage glossary {glossary_id}: {e}")

# mặc định file csv tên là glossary_term.csv
def upload_csv(source_file_path: str):
    """Upload một file local lên GCS."""
    bucket_name = "toray-buckets"
    destination_blob_name = "glossary_term.csv"
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(destination_blob_name)
    blob.upload_from_filename(source_file_path)
    print(f"Đã upload {source_file_path} lên gs://{bucket_name}/{destination_blob_name}")

if __name__ == "__main__":

    src_path = r"C:\Users\User\OneDrive - Hanoi University of Science and Technology\Documents\Lập trình cơ bản\Projects\[ISE] Toray translator project\glossary_term.csv"
    upload_csv(src_path)
    manage_all_glossaries(mode=1)
    # Gọi hàm để tạo tất cả glossary
    # create_all_glossaries()
    # import pandas as pd

    # # Đọc file xlsx
    # df = pd.read_excel(r"C:\Users\User\OneDrive - Hanoi University of Science and Technology\Documents\Lập trình cơ bản\Projects\[ISE] Toray translator project\Test library\library.xlsx")

    # # Lưu dưới dạng CSV với mã hóa UTF-8
    # df.to_csv(r"C:\Users\User\OneDrive - Hanoi University of Science and Technology\Documents\Lập trình cơ bản\Projects\[ISE] Toray translator project\Test library\library.csv", encoding='utf-8', index=False)
    
    