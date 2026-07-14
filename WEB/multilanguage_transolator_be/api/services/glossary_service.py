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
    """Làm sạch 1 ô dữ liệu trước khi đưa vào glossary: None -> chuỗi rỗng, bỏ khoảng trắng thừa hai đầu."""
    return str(value or "").strip()


def is_valid_glossary_value(value: str) -> bool:
    """Kiểm tra 1 giá trị có dùng được cho glossary không — loại các ô rỗng hoặc chỉ chứa
    placeholder rác như '-', '—', 'null', 'none' (những ô này không phải bản dịch thật)."""
    normalized = normalize_glossary_value(value)
    if normalized == "":
        return False
    normalized_lower = normalized.lower()
    # Note: '-' / '—' / '–' are not affected by lower(), but we still check
    # the lower-cased invalid set for 'null'/'none'.
    return normalized_lower not in {v.lower() for v in INVALID_GLOSSARY_VALUES}


def build_pair_rows(rows, source_lang_col: str, target_lang_col: str):
    """Từ bảng từ vựng nhiều cột (nhiều ngôn ngữ), rút ra danh sách cặp (từ nguồn, từ đích)
    cho đúng 2 cột được chọn — bỏ dòng thiếu/rác, bỏ dòng trùng lặp."""
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
    """Gọi Google Cloud Translation API để tạo mới (mode=0) hoặc cập nhật (mode=1)
    1 glossary — tức là gắn file CSV thuật ngữ (input_uri) vào 1 cặp ngôn ngữ cụ thể."""
    project_id = os.getenv("PROJECT_ID")
    if input_uri is None:
        input_uri = os.getenv("INPUT_URI", "gs://company-buckets/glossary_term.csv")

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


def make_glossary_id(lang1: str, lang2: str) -> str:
    """Sinh tên (ID) glossary từ 2 mã ngôn ngữ, luôn sắp xếp trước nên dịch chiều nào cũng
    ra cùng 1 ID: make_glossary_id('vi','en') == make_glossary_id('en','vi') == 'company_glossary_en_vi'."""
    pair = sorted([lang1, lang2])
    return "company_glossary_" + "_".join(c.replace("-", "_") for c in pair)


def generate_pairs_from_db():
    """Lấy danh sách ngôn ngữ đang bật trong DB rồi ghép thành mọi cặp 2 ngôn ngữ có thể
    (không trùng, không đảo chiều) — mỗi cặp sẽ cần 1 glossary riêng."""
    import itertools
    try:
        from ..models.language import Language
        codes = list(
            Language.objects.all()
            .order_by('sort_order')
            .values_list('code', flat=True)
        )
        return list(itertools.combinations(sorted(codes), 2))
    except Exception as e:
        logger.error(f"generate_pairs_from_db failed: {e}. Falling back to LANGUAGE_PAIRS.")
        # Fallback sang LANGUAGE_PAIRS cũ nếu DB chưa có
        return [(p.split("-", 1)[0], p.split("-", 1)[1]) for p in LANGUAGE_PAIRS.keys()]


# DEPRECATED: dùng make_glossary_id() + generate_pairs_from_db() thay thế.
# Giữ lại để tương thích với các glossary cũ đã tạo trên GCS (company_translation_glossary_1..44).
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
    """Xóa 1 glossary trên Google Cloud (dùng khi 1 cặp ngôn ngữ không còn từ vựng nào,
    để tránh glossary cũ còn sót lại làm sai kết quả dịch). Trả về False nếu vốn đã không tồn tại."""
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


def manage_all_glossaries():
    """Đồng bộ lại TOÀN BỘ glossary chung cho mọi cặp ngôn ngữ đang có trong DB:
    cặp nào có từ vựng thì tạo/cập nhật glossary, cặp nào hết từ vựng thì xóa glossary cũ đi.

    Mode được xác định RIÊNG cho từng cặp ngôn ngữ bằng cách kiểm tra glossary đã tồn tại
    trên Google Cloud hay chưa (giống hệt cách _manage_user_glossaries_bg làm cho glossary
    cá nhân) — không dùng mù quáng tham số `mode` cho mọi cặp, vì gọi update_glossary() lên
    một glossary chưa từng tồn tại sẽ trả lỗi NOT_FOUND và bị nuốt bởi try/except bên dưới,
    khiến glossary chung không bao giờ được tạo."""
    results = []
    errors = []

    project_id = os.getenv("PROJECT_ID")
    client = translate.TranslationServiceClient()

    for source_lang_code, target_lang_code in generate_pairs_from_db():
        glossary_id = make_glossary_id(source_lang_code, target_lang_code)
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

                # Probe whether this pair's glossary already exists on GCP to pick the
                # correct mode — create (0) if missing, update (1) if it's already there.
                name = client.glossary_path(project_id, "us-central1", glossary_id)
                pair_mode = 0
                try:
                    client.get_glossary(name=name)
                    pair_mode = 1
                except Exception:
                    pass

                result = manage_glossary(
                    glossary_id,
                    source_lang_code,
                    target_lang_code,
                    mode=pair_mode,
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


def _get_active_language_codes():
    """Lấy danh sách mã ngôn ngữ đang được bật trong hệ thống (dùng làm cột cho file CSV)."""
    try:
        from ..models.language import Language
        return list(Language.objects.all().order_by('sort_order').values_list('code', flat=True))
    except Exception:
        return ['en', 'ja', 'vi', 'zh-CN', 'th', 'bn', 'hi', 'id', 'or']


def create_glossary_csv_file():
    """Xuất toàn bộ từ khóa ĐÃ ĐƯỢC DUYỆT ra 1 file CSV, mỗi cột là 1 ngôn ngữ —
    file này sau đó được upload lên GCS để Google Translate dùng làm glossary chung."""
    try:
        approved_keywords = list(KeywordSuggestion.objects.filter(status='approved'))
        if not approved_keywords:
            logger.warning("No approved keywords found for CSV generation")
            return None

        lang_codes = _get_active_language_codes()

        csv_file = tempfile.NamedTemporaryFile(
            mode='w', delete=False, suffix='.csv', encoding='utf-8', newline=''
        )
        try:
            writer = csv.writer(csv_file, quoting=csv.QUOTE_MINIMAL)
            writer.writerow(lang_codes)
            for kw in approved_keywords:
                t = kw.translations or {}
                writer.writerow([t.get(c, '') for c in lang_codes])
            csv_file.close()
            logger.info(f"Created CSV with {len(approved_keywords)} keywords: {csv_file.name}")
            return csv_file.name
        except Exception as e:
            csv_file.close()
            if os.path.exists(csv_file.name):
                os.unlink(csv_file.name)
            raise e
    except Exception as e:
        logger.error(f"Error creating CSV file: {str(e)}")
        raise


def create_pair_csv_file(user, source_lang, target_lang):
    """Xuất file CSV chỉ 2 cột (nguồn - đích) cho ĐÚNG 1 cặp ngôn ngữ, gồm cả từ khóa
    chung đã duyệt và từ khóa riêng của user (nếu có) — dùng để build glossary cho riêng cặp đó."""
    approved_keywords = list(KeywordSuggestion.objects.filter(status='approved'))
    private_keywords = list(PrivateKeyword.objects.filter(user=user)) if user is not None else []
    all_keywords = approved_keywords + private_keywords

    # Build pair rows using translations dict
    seen = set()
    pair_rows = []
    for kw in all_keywords:
        t = kw.translations or {}
        src = normalize_glossary_value(t.get(source_lang, ""))
        tgt = normalize_glossary_value(t.get(target_lang, ""))
        if not is_valid_glossary_value(src) or not is_valid_glossary_value(tgt):
            continue
        key = (src, tgt)
        if key in seen:
            continue
        seen.add(key)
        pair_rows.append([src, tgt])

    if not pair_rows:
        logger.warning(f"No valid rows for pair {source_lang}->{target_lang}")
        return None
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
    """Đẩy 1 file CSV từ máy chủ backend lên Google Cloud Storage — bắt buộc phải làm bước
    này vì Google Translate chỉ đọc glossary từ file nằm trên GCS, không nhận file local."""
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
            bucket_name = os.getenv("BUCKET_NAME", "company-buckets")
        
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


import threading

def _manage_user_glossaries_bg(user_id):
    """Chạy trong luồng nền: build lại glossary RIÊNG của 1 user — mỗi cặp ngôn ngữ mà
    user đó có từ vựng sẽ có 1 glossary riêng (tên có hậu tố _user_<id>), tách biệt với glossary chung."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    print(f"\n[BACKGROUND THREAD] BẮT ĐẦU CẬP NHẬT TỪ ĐIỂN CÁ NHÂN CHO USER ID: {user_id}", flush=True)
    try:
        user = User.objects.get(id=user_id)
        
        print("[BACKGROUND THREAD] 1. Đang tải từ vựng (Common + Private keywords)...", flush=True)

        approved_keywords = list(KeywordSuggestion.objects.filter(status='approved'))
        private_keywords = list(PrivateKeyword.objects.filter(user=user))
        print(f"[BACKGROUND THREAD]    => Approved: {len(approved_keywords)} từ | Private: {len(private_keywords)} từ", flush=True)

        if not approved_keywords and not private_keywords:
            print("[BACKGROUND THREAD] => Dừng lại: Không có từ vựng nào.", flush=True)
            return

        client = translate.TranslationServiceClient()

        print(f"[BACKGROUND THREAD] 2. Bắt đầu gọi API Google per-pair...", flush=True)
        # Determine which languages have data from translations JSONField
        pks = PrivateKeyword.objects.filter(user=user).only('translations')
        has_lang = set()
        for pk in pks:
            for code, val in (pk.translations or {}).items():
                if val and str(val).strip():
                    has_lang.add(code)
        print(f"[BACKGROUND THREAD] => Ngôn ngữ có dữ liệu: {has_lang}", flush=True)

        for source_lang_code, target_lang_code in generate_pairs_from_db():
            # Chỉ tạo glossary nếu user có từ vựng ở cả 2 ngôn ngữ
            if source_lang_code in has_lang and target_lang_code in has_lang:
                glossary_id = make_glossary_id(source_lang_code, target_lang_code) + f"_user_{user.id}"
                name = client.glossary_path(os.getenv("PROJECT_ID"), "us-central1", glossary_id)
                mode = 0
                try:
                    client.get_glossary(name=name)
                    mode = 1
                except Exception:
                    pass

                print(f"\n[BACKGROUND THREAD] => Xử lý cặp {source_lang_code}-{target_lang_code}: {glossary_id} (mode={mode})", flush=True)
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

        print("\n[BACKGROUND THREAD] --- HOÀN TẤT CẬP NHẬT TỪ ĐIỂN ---", flush=True)
    except Exception as e:
        print(f"[BACKGROUND THREAD] LỖI TOÀN BỘ: {e}", flush=True)
        logger.error(f"Background user glossary failed: {e}")

def async_manage_user_glossaries(user):
    """Khởi chạy 1 luồng nền để cập nhật glossary riêng của user — chạy ngầm nên
    request HTTP (vd. sau khi user lưu 1 từ mới) trả về ngay, không phải chờ Google xử lý xong."""
    thread = threading.Thread(target=_manage_user_glossaries_bg, args=(user.id,))
    thread.start()


def _manage_common_glossaries_bg():
    """Chạy trong luồng nền: build lại toàn bộ glossary CHUNG dựa trên các từ khóa
    vừa được duyệt/sửa/xóa — gọi manage_all_glossaries() và log lại kết quả thành công/lỗi."""
    print("\n[BACKGROUND THREAD] BẮT ĐẦU CẬP NHẬT GLOSSARY CHUNG (common)...", flush=True)
    try:
        results, errors = manage_all_glossaries()
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
    """Khởi chạy 1 luồng nền để build lại glossary chung — gọi ngay sau khi admin
    duyệt/sửa/xóa 1 từ khóa, để glossary trên Google luôn đồng bộ với dữ liệu mới nhất."""
    thread = threading.Thread(target=_manage_common_glossaries_bg)
    thread.daemon = True
    thread.start()
