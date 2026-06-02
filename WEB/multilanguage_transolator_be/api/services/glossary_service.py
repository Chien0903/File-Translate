"""
Glossary management service for Google Cloud Translation API.

Handles:
- Creating and updating glossaries for language pairs
- Generating CSV files from approved keywords
- Uploading CSV to Google Cloud Storage
"""
import os
import csv
import tempfile
import logging

from google.cloud import storage
from google.cloud import translate_v3 as translate
from google.protobuf import field_mask_pb2
from dotenv import load_dotenv

from ..models.keyword import KeywordSuggestion, PrivateKeyword

load_dotenv()
logger = logging.getLogger(__name__)

INVALID_GLOSSARY_VALUES = {"", "-", "—", "–", "null", "none"}


def normalize_glossary_value(value) -> str:
    """
    Normalize glossary cell value:
    - Convert None to ""
    - Strip leading/trailing whitespace
    - Always return a string
    """
    return str(value or "").strip()


def is_valid_glossary_value(value: str) -> bool:
    """
    A normalized glossary value is considered invalid if it is empty
    or matches known placeholders such as '-', '—', '–', 'null', 'None'.
    """
    normalized = normalize_glossary_value(value)
    if normalized == "":
        return False
    normalized_lower = normalized.lower()
    # Note: '-' / '—' / '–' are not affected by lower(), but we still check
    # the lower-cased invalid set for 'null'/'none'.
    return normalized_lower not in {v.lower() for v in INVALID_GLOSSARY_VALUES}


def build_pair_rows(rows, source_lang_col: str, target_lang_col: str):
    """
    Build pair rows (source_text, target_text) from a multi-column vocabulary-like dataset.
    - Drop rows with invalid/placeholder source or target.
    - Deduplicate by (source_text, target_text).
    - Return list of [source_text, target_text].
    """
    seen = set()
    results = []

    skipped_invalid_source = 0
    skipped_invalid_target = 0
    skipped_duplicate = 0

    for row in rows:
        # Support both dict-like rows and model instances
        if hasattr(row, "get"):
            src_raw = row.get(source_lang_col)
            tgt_raw = row.get(target_lang_col)
        else:
            src_raw = getattr(row, source_lang_col, None)
            tgt_raw = getattr(row, target_lang_col, None)

        source_text = normalize_glossary_value(src_raw)
        target_text = normalize_glossary_value(tgt_raw)

        if not is_valid_glossary_value(source_text):
            skipped_invalid_source += 1
            continue
        if not is_valid_glossary_value(target_text):
            skipped_invalid_target += 1
            continue

        key = (source_text, target_text)
        if key in seen:
            skipped_duplicate += 1
            continue
        seen.add(key)
        results.append([source_text, target_text])

    if not results:
        logger.warning(
            f"No valid pair rows built for ({source_lang_col} -> {target_lang_col}). "
            f"Skipped invalid: source={skipped_invalid_source}, target={skipped_invalid_target}, "
            f"duplicates={skipped_duplicate}."
        )
    else:
        logger.info(
            f"Built pair rows for ({source_lang_col} -> {target_lang_col}): "
            f"valid={len(results)}, skipped_invalid: source={skipped_invalid_source}, "
            f"target={skipped_invalid_target}, duplicates={skipped_duplicate}."
        )

    return results


def manage_glossary(
    glossary_id: str,
    source_lang_code: str,
    target_lang_code: str,
    location: str = "us-central1",
    mode: int = 0,  # 0=create, 1=update
    timeout: int = 180,
    input_uri: str = None
) -> translate.Glossary:
    """
    Create or update a glossary.
    - mode=0: create new glossary (CREATE)
    - mode=1: update source file of existing glossary (UPDATE)
    """
    project_id = os.getenv("PROJECT_ID")
    if input_uri is None:
        input_uri = os.getenv("INPUT_URI", "gs://toray-buckets/glossary_term.csv")

    client = translate.TranslationServiceClient()
    parent = f"projects/{project_id}/locations/{location}"
    name = client.glossary_path(project_id, location, glossary_id)

    gcs_source = translate.GcsSource(input_uri=input_uri)
    input_config = translate.GlossaryInputConfig(gcs_source=gcs_source)

    if mode == 0:
        # CREATE using LanguageCodesSet (Equivalent Term Set - supports multi-language CSV)
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
        # UPDATE: only change input_config
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
        raise ValueError("mode must be 0 (create) or 1 (update)")

    result = operation.result(timeout=timeout)
    logger.info(f"{action} glossary: {result.name}")
    logger.info(f"Input URI: {result.input_config.gcs_source.input_uri}")
    return result


# Language pairs mapping: pair_key -> glossary_id_suffix
# Đồng bộ với Translate_v2/create_glossary.py
LANGUAGE_PAIRS = {
    "vi-en": 1,
    "vi-ja": 2,
    "vi-zh-CN": 3,
    "vi-zh-TW": 4,
    "en-ja": 5,
    "en-zh-CN": 6,
    "en-zh-TW": 7,
    "ja-zh-CN": 8,
    "ja-zh-TW": 9,
    # Thai (th)
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
    # Chinese Simplified — nhóm ngôn ngữ mới
    "th-zh-CN": 28,
    "bn-zh-CN": 29,
    "hi-zh-CN": 30,
    "id-zh-CN": 31,
    # Chinese Traditional — nhóm ngôn ngữ mới
    "th-zh-TW": 32,
    "bn-zh-TW": 33,
    "hi-zh-TW": 34,
    "id-zh-TW": 35,
    # Oriya (or)
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


def delete_glossary(glossary_id: str, location: str = "us-central1", timeout: int = 180):
    """
    Delete a glossary from Google Cloud Translation.
    Returns True if deleted, False if it didn't exist.
    """
    project_id = os.getenv("PROJECT_ID")
    client = translate.TranslationServiceClient()
    name = client.glossary_path(project_id, location, glossary_id)
    try:
        operation = client.delete_glossary(name=name)
        operation.result(timeout=timeout)
        logger.info(f"Deleted glossary: {name}")
        return True
    except Exception as e:
        if "NOT_FOUND" in str(e) or "404" in str(e):
            logger.info(f"Glossary {glossary_id} does not exist, nothing to delete.")
            return False
        raise


def manage_all_glossaries(mode=1):
    """
    Manage all glossaries for all language pairs.
    - If a pair has valid keywords: create/update glossary.
    - If a pair has NO keywords: delete the glossary so stale entries don't affect translation.
    """
    results = []
    errors = []

    for pair, glossary_id_suffix in LANGUAGE_PAIRS.items():
        source_lang_code, target_lang_code = pair.split("-", 1)
        glossary_id = f"toray_translation_glossary_{glossary_id_suffix}"
        try:
            logger.info(f"Managing glossary: {glossary_id} ({source_lang_code} -> {target_lang_code})")
            tsv_path = create_pair_csv_file(
                user=None,
                source_lang=source_lang_code,
                target_lang=target_lang_code,
            )
            if not tsv_path:
                # No keywords for this pair → delete stale glossary if it exists
                logger.warning(
                    f"No valid rows for pair {source_lang_code}->{target_lang_code}. "
                    f"Attempting to delete stale glossary {glossary_id}."
                )
                try:
                    deleted = delete_glossary(glossary_id)
                    results.append({
                        'glossary_id': glossary_id,
                        'source_lang': source_lang_code,
                        'target_lang': target_lang_code,
                        'status': 'deleted' if deleted else 'not_found',
                    })
                except Exception as del_err:
                    logger.error(f"Failed to delete glossary {glossary_id}: {del_err}")
                    errors.append({
                        'glossary_id': glossary_id,
                        'source_lang': source_lang_code,
                        'target_lang': target_lang_code,
                        'status': 'error',
                        'error': str(del_err),
                    })
                continue

            custom_blob_name = f"glossary_pair_{source_lang_code}_{target_lang_code}.csv"
            try:
                input_uri = upload_csv_to_gcs(tsv_path, custom_blob_name=custom_blob_name)
                result = manage_glossary(
                    glossary_id,
                    source_lang_code,
                    target_lang_code,
                    mode=mode,
                    input_uri=input_uri,
                )
                results.append({
                    'glossary_id': glossary_id,
                    'source_lang': source_lang_code,
                    'target_lang': target_lang_code,
                    'status': 'success',
                    'name': result.name
                })
            finally:
                try:
                    os.unlink(tsv_path)
                except Exception:
                    pass
        except Exception as e:
            error_msg = f"Failed to manage glossary {glossary_id}: {str(e)}"
            logger.error(error_msg)
            errors.append({
                'glossary_id': glossary_id,
                'source_lang': source_lang_code,
                'target_lang': target_lang_code,
                'status': 'error',
                'error': str(e)
            })

    return results, errors


def create_glossary_csv_file():
    """Extract approved keywords -> CSV with 10 columns: en, ja, vi, zh-CN, zh-TW, th, bn, hi, id, or"""
    try:
        approved_keywords = KeywordSuggestion.objects.filter(
            status='approved'
        ).select_related('user', 'approved_by')

        if not approved_keywords.exists():
            logger.warning("No approved keywords found for CSV generation")
            return None

        # CRITICAL: newline='' required on Windows so csv.writer controls line endings
        csv_file = tempfile.NamedTemporaryFile(
            mode='w', delete=False, suffix='.csv',
            encoding='utf-8', newline=''
        )

        try:
            writer = csv.writer(csv_file, quoting=csv.QUOTE_MINIMAL)

            # Header: 10 columns (đồng bộ với tất cả ngôn ngữ hỗ trợ)
            writer.writerow(['en', 'ja', 'vi', 'zh-CN', 'zh-TW', 'th', 'bn', 'hi', 'id', 'or'])

            for keyword in approved_keywords:
                writer.writerow([
                    keyword.english or '',
                    keyword.japanese or '',
                    keyword.vietnamese or '',
                    keyword.chinese_simplified or '',
                    keyword.chinese_traditional or '',
                    keyword.thai or '',
                    keyword.bengali or '',
                    keyword.hindi or '',
                    keyword.indonesian or '',
                    keyword.oriya or '',
                ])

            csv_file.close()
            logger.info(f"Created CSV file with {approved_keywords.count()} keywords at: {csv_file.name}")
            return csv_file.name

        except Exception as e:
            csv_file.close()
            if os.path.exists(csv_file.name):
                os.unlink(csv_file.name)
            raise e

    except Exception as e:
        logger.error(f"Error creating CSV file: {str(e)}")
        raise Exception(f"Error creating CSV file: {str(e)}")


def create_pair_csv_file(user, source_lang, target_lang):
    """Extract approved AND private keywords for a SPECIFIC pair. Only include rows where BOTH sides exist."""
    LANG_MAP = {
        'en': 'english', 'ja': 'japanese', 'vi': 'vietnamese',
        'zh-CN': 'chinese_simplified', 'zh-TW': 'chinese_traditional',
        'th': 'thai', 'bn': 'bengali', 'hi': 'hindi',
        'id': 'indonesian', 'or': 'oriya'
    }
    src_field = LANG_MAP.get(source_lang)
    tgt_field = LANG_MAP.get(target_lang)
    if not src_field or not tgt_field:
        return None

    approved_keywords = KeywordSuggestion.objects.filter(status='approved').iterator()
    private_keywords = (
        PrivateKeyword.objects.filter(user=user).iterator() if user is not None else []
    )

    # Combine iterables into a single iterable without forcing evaluation
    all_keywords = list(approved_keywords) + list(private_keywords)

    pair_rows = build_pair_rows(
        rows=all_keywords,
        source_lang_col=src_field,
        target_lang_col=tgt_field,
    )
    if not pair_rows:
        return None

    import tempfile
    # Pair glossary file for Google:
    # We generate a *2-column CSV* (comma-separated) with header = [source_lang, target_lang].
    # This avoids TSV output while still feeding only valid, non-empty, deduplicated rows.
    csv_file = tempfile.NamedTemporaryFile(
        mode="w",
        delete=False,
        suffix=".csv",
        encoding="utf-8",
        newline="",
    )
    try:
        writer = csv.writer(csv_file, quoting=csv.QUOTE_MINIMAL)
        # Header required by Google API
        writer.writerow([source_lang, target_lang])

        for src_text, tgt_text in pair_rows:
            # Safety cleanup: avoid breaking line-based parsing
            src_val = src_text.replace("\t", " ").replace("\n", " ").replace("\r", " ")
            tgt_val = tgt_text.replace("\t", " ").replace("\n", " ").replace("\r", " ")
            writer.writerow([src_val, tgt_val])

        csv_file.close()
        logger.info(
            f"Pair CSV generated for {source_lang}->{target_lang}: file={csv_file.name}, rows={len(pair_rows)}"
        )
        return csv_file.name
    except Exception as e:
        csv_file.close()
        if os.path.exists(csv_file.name):
            os.unlink(csv_file.name)
        raise e

def upload_csv_to_gcs(source_file_path: str, custom_blob_name: str = None):
    """Upload CSV file to GCS, reading config from INPUT_URI/BUCKET_NAME."""
    try:
        # Parse INPUT_URI format gs://bucket/object
        input_uri = os.getenv("INPUT_URI")
        bucket_name = None
        destination_blob_name = None
        if input_uri and input_uri.startswith("gs://"):
            without_scheme = input_uri[len("gs://"):]
            parts = without_scheme.split("/", 1)
            if len(parts) == 2:
                bucket_name = parts[0]
                destination_blob_name = parts[1]

        # Fallback defaults
        if bucket_name is None:
            bucket_name = os.getenv("BUCKET_NAME", "toray-buckets")
        
        if custom_blob_name is not None:
            destination_blob_name = custom_blob_name
        elif destination_blob_name is None:
            destination_blob_name = "glossary_term.csv"

        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(destination_blob_name)
        blob.upload_from_filename(source_file_path)

        logger.info(f"Uploaded {source_file_path} to gs://{bucket_name}/{destination_blob_name}")
        return f"gs://{bucket_name}/{destination_blob_name}"

    except Exception as e:
        logger.error(f"Error uploading CSV to GCS: {str(e)}")
        raise Exception(f"Error uploading CSV to GCS: {str(e)}")


def create_user_glossary_csv_file(user):
    """Extract approved keywords AND user's private keywords -> CSV."""
    try:
        approved_keywords = list(KeywordSuggestion.objects.filter(status='approved'))
        private_keywords = list(PrivateKeyword.objects.filter(user=user))
        
        csv_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv', encoding='utf-8')
        try:
            writer = csv.writer(csv_file, quoting=csv.QUOTE_MINIMAL)
            writer.writerow(['en', 'ja', 'vi', 'zh-CN', 'zh-TW', 'th', 'bn', 'hi', 'id', 'or'])
            
            for keyword in approved_keywords:
                writer.writerow([
                    keyword.english or '', keyword.japanese or '', keyword.vietnamese or '',
                    keyword.chinese_simplified or '', keyword.chinese_traditional or '',
                    keyword.thai or '', keyword.bengali or '', keyword.hindi or '',
                    keyword.indonesian or '', keyword.oriya or '',
                ])
                
            for keyword in private_keywords:
                writer.writerow([
                    keyword.english or '', keyword.japanese or '', keyword.vietnamese or '',
                    keyword.chinese_simplified or '', keyword.chinese_traditional or '',
                    keyword.thai or '', keyword.bengali or '', keyword.hindi or '',
                    keyword.indonesian or '', keyword.oriya or '',
                ])
                
            csv_file.close()
            return csv_file.name
        except Exception as e:
            csv_file.close()
            if os.path.exists(csv_file.name):
                os.unlink(csv_file.name)
            raise e
    except Exception as e:
        logger.error(f"Error creating user CSV file: {str(e)}")
        raise e

def upload_user_csv_to_gcs(source_file_path: str, user_id: int):
    try:
        bucket_name = os.getenv("BUCKET_NAME", "toray-buckets")
        destination_blob_name = f"glossary_term_user_{user_id}.csv"
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(destination_blob_name)
        blob.upload_from_filename(source_file_path)
        return f"gs://{bucket_name}/{destination_blob_name}"
    except Exception as e:
        logger.error(f"Error uploading user CSV to GCS: {str(e)}")
        raise e

import threading

def _manage_user_glossaries_bg(user_id):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    print(f"\n[BACKGROUND THREAD] BẮT ĐẦU CẬP NHẬT TỪ ĐIỂN CÁ NHÂN CHO USER ID: {user_id}", flush=True)
    try:
        user = User.objects.get(id=user_id)
        
        print("[BACKGROUND THREAD] 1. Đang tạo file CSV 10 cột (Common + Private keywords)...", flush=True)
        
        # Lấy cả từ thư viện chung (approved) và từ private của user
        approved_keywords = list(KeywordSuggestion.objects.filter(status='approved'))
        private_keywords = list(PrivateKeyword.objects.filter(user=user))
        print(f"[BACKGROUND THREAD]    => Approved: {len(approved_keywords)} từ | Private: {len(private_keywords)} từ", flush=True)

        if not approved_keywords and not private_keywords:
            print("[BACKGROUND THREAD] => Dừng lại: Không có từ vựng nào.", flush=True)
            return

        # CRITICAL: newline='' required on Windows so csv.writer controls line endings
        # Without it, Python adds \r\n causing Google to read "en\r" as invalid language code
        csv_file_obj = tempfile.NamedTemporaryFile(
            mode='w', delete=False, suffix='.csv',
            encoding='utf-8', newline=''
        )
        try:
            import csv as csv_module
            writer = csv_module.writer(csv_file_obj, quoting=csv_module.QUOTE_MINIMAL)
            writer.writerow(['en', 'ja', 'vi', 'zh-CN', 'zh-TW', 'th', 'bn', 'hi', 'id', 'or'])
            for kw in approved_keywords:
                writer.writerow([
                    kw.english or '', kw.japanese or '', kw.vietnamese or '',
                    kw.chinese_simplified or '', kw.chinese_traditional or '',
                    kw.thai or '', kw.bengali or '', kw.hindi or '',
                    kw.indonesian or '', kw.oriya or '',
                ])
            for kw in private_keywords:
                writer.writerow([
                    kw.english or '', kw.japanese or '', kw.vietnamese or '',
                    kw.chinese_simplified or '', kw.chinese_traditional or '',
                    kw.thai or '', kw.bengali or '', kw.hindi or '',
                    kw.indonesian or '', kw.oriya or '',
                ])
            csv_file_obj.close()
            csv_file_path = csv_file_obj.name
        except Exception as e:
            csv_file_obj.close()
            if os.path.exists(csv_file_obj.name):
                os.unlink(csv_file_obj.name)
            raise e

        print(f"[BACKGROUND THREAD] 2. Đang tải file lên Google Storage...", flush=True)
        custom_blob_name = f"glossary_term_user_{user.id}.csv"
        input_uri = upload_csv_to_gcs(csv_file_path, custom_blob_name=custom_blob_name)
        print(f"[BACKGROUND THREAD] => Upload thành công: {input_uri}", flush=True)
        
        # Debug: show preview of CSV content
        with open(csv_file_path, encoding='utf-8') as f:
            preview = f.read(400)
        print(f"[BACKGROUND THREAD]    => Preview CSV:\n{preview}", flush=True)

        client = translate.TranslationServiceClient()

        print(f"[BACKGROUND THREAD] 3. Bắt đầu gọi API Google per-pair (dùng CSV 10 cột)...", flush=True)
        # Determine which languages have data
        pks = PrivateKeyword.objects.filter(user=user)
        has_lang = set()
        for pk in pks:
            if pk.english and pk.english.strip(): has_lang.add('en')
            if pk.japanese and pk.japanese.strip(): has_lang.add('ja')
            if pk.vietnamese and pk.vietnamese.strip(): has_lang.add('vi')
            if pk.chinese_simplified and pk.chinese_simplified.strip(): has_lang.add('zh-CN')
            if pk.chinese_traditional and pk.chinese_traditional.strip(): has_lang.add('zh-TW')
            if pk.thai and pk.thai.strip(): has_lang.add('th')
            if pk.bengali and pk.bengali.strip(): has_lang.add('bn')
            if pk.hindi and pk.hindi.strip(): has_lang.add('hi')
            if pk.indonesian and pk.indonesian.strip(): has_lang.add('id')
        print(f"[BACKGROUND THREAD] => Ngôn ngữ có dữ liệu: {has_lang}", flush=True)

        for pair, glossary_id_suffix in LANGUAGE_PAIRS.items():
            source_lang_code, target_lang_code = pair.split("-", 1)
            # Chỉ tạo glossary nếu user có từ vựng ở cả 2 ngôn ngữ
            if source_lang_code in has_lang and target_lang_code in has_lang:
                glossary_id = f"toray_translation_glossary_{glossary_id_suffix}_{user.id}"
                name = client.glossary_path(os.getenv("PROJECT_ID"), "us-central1", glossary_id)
                mode = 0
                try:
                    client.get_glossary(name=name)
                    mode = 1
                except Exception:
                    pass

                print(f"\n[BACKGROUND THREAD] => Xử lý cặp {pair}: {glossary_id} (mode={mode})", flush=True)
                logger.info(f"Managing private glossary: {glossary_id} mode={mode}")
                try:
                    # Build pair-specific TSV so empty/placeholder cells are removed
                    # before Google glossary parses input.
                    tsv_path = create_pair_csv_file(
                        user=user,
                        source_lang=source_lang_code,
                        target_lang=target_lang_code,
                    )
                    if not tsv_path:
                        logger.warning(
                            f"Skip private glossary {glossary_id}: no valid non-empty rows for pair "
                            f"{source_lang_code}->{target_lang_code}"
                        )
                        continue

                    private_custom_blob_name = (
                        f"glossary_term_user_{user.id}_{source_lang_code}_{target_lang_code}.csv"
                    )
                    private_input_uri = upload_csv_to_gcs(
                        tsv_path,
                        custom_blob_name=private_custom_blob_name,
                    )
                    try:
                        manage_glossary(
                            glossary_id,
                            source_lang_code,
                            target_lang_code,
                            mode=mode,
                            input_uri=private_input_uri,
                        )
                    finally:
                        try:
                            os.unlink(tsv_path)
                        except Exception:
                            pass
                    print(f"[BACKGROUND THREAD]    => Tạo thành công {glossary_id}!", flush=True)
                except Exception as e:
                    print(f"[BACKGROUND THREAD]    => THẤT BẠI cho {glossary_id}: {str(e)}", flush=True)
                    logger.error(f"Failed to manage private glossary {glossary_id}: {str(e)}")

        if os.path.exists(csv_file_path):
            os.unlink(csv_file_path)

        print("\n[BACKGROUND THREAD] --- HOÀN TẤT CẬP NHẬT TỪ ĐIỂN ---", flush=True)
    except Exception as e:
        print(f"[BACKGROUND THREAD] LỖI TOÀN BỘ: {e}", flush=True)
        logger.error(f"Background user glossary failed: {e}")

def async_manage_user_glossaries(user):
    """Trigger background thread to update glossaries for a given user"""
    thread = threading.Thread(target=_manage_user_glossaries_bg, args=(user.id,))
    thread.start()


def _manage_common_glossaries_bg():
    """Background thread: rebuild all common glossaries from current approved keywords."""
    print("\n[BACKGROUND THREAD] BẮT ĐẦU CẬP NHẬT GLOSSARY CHUNG (common)...", flush=True)
    try:
        results, errors = manage_all_glossaries(mode=1)
        print(
            f"[BACKGROUND THREAD] Glossary chung: thành công={len(results)}, lỗi={len(errors)}",
            flush=True,
        )
        if errors:
            for e in errors:
                logger.error(f"[BACKGROUND THREAD] Lỗi glossary: {e}")
    except Exception as ex:
        print(f"[BACKGROUND THREAD] LỖI CẬP NHẬT GLOSSARY CHUNG: {ex}", flush=True)
        logger.error(f"Background common glossary update failed: {ex}")


def async_manage_common_glossaries():
    """Trigger background thread to rebuild all common glossaries."""
    thread = threading.Thread(target=_manage_common_glossaries_bg)
    thread.daemon = True
    thread.start()
