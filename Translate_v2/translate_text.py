import time
import os
import shutil
import re
import html
import threading
from google.cloud import translate_v3 as translate
from fastapi import HTTPException
from dotenv import load_dotenv
from detect_lang import LANGUAGES, language_pair
from xml_process import copy_and_extract, compress_folder
from concurrent.futures import ThreadPoolExecutor
from translate_image import translate_images_in_folder
load_dotenv()
project_id = os.getenv("PROJECT_ID")
google_credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if google_credentials_path:
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = google_credentials_path

# ─── Thread-local translation context ────────────────────────────────────────
# Allows Django views to control glossary usage and inject private keywords
# without modifying every function signature throughout the call chain.
_translation_context = threading.local()

LANG_CODE_TO_FIELD = {
    'ja': 'ja',
    'en': 'en',
    'vi': 'vi',
    'zh-TW': 'zh-TW',
    'zh-CN': 'zh-CN',
    'th': 'th',
    'bn': 'bn',
    'hi': 'hi',
    'id': 'id',
    'or': 'or',
}

def set_translation_context(library_mode="common", user_id=None):
    """
    Set per-thread translation context before calling any translate_* function.
    """
    _translation_context.library_mode = library_mode
    _translation_context.user_id = user_id

def clear_translation_context():
    """Reset context to defaults after translation is complete."""
    _translation_context.library_mode = "common"
    _translation_context.user_id = None

# Removed old _build_tokens_map, _apply_tokens_pre, _apply_tokens_post

def preprocess_brackets(text: str) -> str:
    if not isinstance(text, str):
        return text
    # Google thường bỏ qua nội dung trong <> vì coi là tag XML/HTML.
    # Ta thay thế bằng ký hiệu [[[ ]]] để Google dịch nội dung bên trong.
    return re.sub(r'<([^>]+)>', r'[[[\1]]]', text)

def postprocess_brackets(text: str) -> str:
    if not isinstance(text, str):
        return text
    # Khôi phục lại <> và xóa khoảng trắng thừa do Google có thể tự chèn vào
    text = re.sub(r'\[\[\[\s*', '<', text)
    text = re.sub(r'\s*\]\]\]', '>', text)
    # Giải mã HTML entities (&quot; -> ", &amp; -> &, &lt; -> <, v.v.)
    return html.unescape(text)

def translate_text_with_glossary(
    text: str,
    glossary_id: str,
    source_lang_code: str,
    target_lang_code: str,
) -> str:
    client = translate.TranslationServiceClient()
    location = "us-central1"
    parent = f"projects/{project_id}/locations/{location}"

    # Apply thread-local context: override glossary and inject private keywords
    library_mode = getattr(_translation_context, 'library_mode', 'common')
    user_id = getattr(_translation_context, 'user_id', None)
    
    if library_mode == "none":
        glossary_id = None
    elif library_mode == "private" and glossary_id and user_id:
        glossary_id = f"{glossary_id}_{user_id}"

    # Tiền xử lý để đảm bảo nội dung trong <> được dịch
    processed_text = preprocess_brackets(text)

    if glossary_id:
        try:
            glossary = client.glossary_path(
                project_id, location, glossary_id
            )
            glossary_config = translate.TranslateTextGlossaryConfig(glossary=glossary, ignore_case=True)
            response = client.translate_text(
                request={
                    "contents": [processed_text],
                    "target_language_code": target_lang_code,
                    "source_language_code": source_lang_code,
                    "parent": parent,
                    "glossary_config": glossary_config,
                }
            )
            translations = [translation.translated_text for translation in response.glossary_translations]
            result = translations[0] if translations else ""
        except Exception as e:
            print(f"⚠️ Glossary {glossary_id} failed ({e}). Falling back to standard translation.")
            response = client.translate_text(
                request={
                    "contents": [processed_text],
                    "target_language_code": target_lang_code,
                    "source_language_code": source_lang_code,
                    "parent": parent,
                }
            )
            translations = [translation.translated_text for translation in response.translations]
            result = translations[0] if translations else ""
    else:
        response = client.translate_text(
            request={
                "contents": [processed_text],
                "target_language_code": target_lang_code,
                "source_language_code": source_lang_code,
                "parent": parent,
            }
        )
        translations = [translation.translated_text for translation in response.translations]
        result = translations[0] if translations else ""

    # Hậu xử lý: khôi phục <>
    return postprocess_brackets(result)

def translate_texts_batch(
    contents: list,
    glossary_id: str,
    source_lang_code: str,
    target_lang_code: str,
) -> list:
    if not contents:
        return []

    # Apply thread-local context: only handle "none" mode to disable glossary.
    # For private mode in FILE translation, glossary_id is ALREADY fully resolved
    # by translate_file() as "{base}_{user_id}". We must NOT append user_id again.
    library_mode = getattr(_translation_context, 'library_mode', 'common')
    
    if library_mode == "none":
        glossary_id = None
    # NOTE: private mode override is intentionally NOT done here to avoid double "_{user_id}"

    client = translate.TranslationServiceClient()
    location = "us-central1"
    parent = f"projects/{project_id}/locations/{location}"

    # Tiền xử lý toàn bộ danh sách: brackets
    processed_contents = [
        preprocess_brackets(c) for c in contents
    ]

    results = []
    chunk_size = 100  # Google limits usually 1024 or based on characters

    for i in range(0, len(processed_contents), chunk_size):
        chunk = processed_contents[i:i + chunk_size]
        try:
            if glossary_id:
                try:
                    glossary = client.glossary_path(project_id, location, glossary_id)
                    glossary_config = translate.TranslateTextGlossaryConfig(glossary=glossary, ignore_case=True)
                    response = client.translate_text(
                        request={
                            "contents": chunk,
                            "target_language_code": target_lang_code,
                            "source_language_code": source_lang_code,
                            "parent": parent,
                            "glossary_config": glossary_config,
                        }
                    )
                    results.extend([t.translated_text for t in response.glossary_translations])
                except Exception as e:
                    print(f"⚠️ Glossary {glossary_id} failed in batch ({e}). Falling back to standard translation.")
                    response = client.translate_text(
                        request={
                            "contents": chunk,
                            "target_language_code": target_lang_code,
                            "source_language_code": source_lang_code,
                            "parent": parent,
                        }
                    )
                    results.extend([t.translated_text for t in response.translations])
            else:
                response = client.translate_text(
                    request={
                        "contents": chunk,
                        "target_language_code": target_lang_code,
                        "source_language_code": source_lang_code,
                        "parent": parent,
                    }
                )
                results.extend([t.translated_text for t in response.translations])
        except Exception as e:
            print(f"⚠️ Error in batch translation: {e}")
            for _ in chunk:
                results.append("")

    # Hậu xử lý: khôi phục <>
    return [postprocess_brackets(r) for r in results]

def translate_file(file_path, source_lang, target_lang, translate_func, file_type):
    start = time.time()
    extracted_folder = copy_and_extract(file_path)
    extracted_folder_temp = f"{extracted_folder}_{target_lang}"
    if os.path.exists(extracted_folder_temp):
        shutil.rmtree(extracted_folder_temp)
    extracted_folder_temp = shutil.copytree(extracted_folder, f"{extracted_folder}_{target_lang}")
    
    try:
        library_mode = getattr(_translation_context, 'library_mode', 'common')
        user_id = getattr(_translation_context, 'user_id', None)
        glossary_id = None
        print(f"[TRANSLATE FILE] library_mode={library_mode}, user_id={user_id}, source_lang={source_lang}, target_lang={target_lang}", flush=True)
        
        if library_mode != "none" and source_lang in LANGUAGES:
            pair_code = f"{source_lang}-{target_lang}"
            if pair_code not in language_pair:
                pair_code = f"{target_lang}-{source_lang}"
            if pair_code in language_pair:
                base_glossary_id = f"toray_translation_glossary_{language_pair[pair_code]}"
                if library_mode == "private" and user_id:
                    glossary_id = f"{base_glossary_id}_{user_id}"
                    print(f"[TRANSLATE FILE] => PRIVATE glossary: {glossary_id}", flush=True)
                else:
                    glossary_id = base_glossary_id
                    print(f"[TRANSLATE FILE] => COMMON glossary: {glossary_id}", flush=True)
            else:
                print(f"[TRANSLATE FILE] => Không tìm thấy cặp ngôn ngữ {source_lang}-{target_lang}, dịch không có glossary", flush=True)
        else:
            print(f"[TRANSLATE FILE] => Dịch không có glossary (mode={library_mode}, source_lang={source_lang})", flush=True)
        # Run sequentially to avoid XML corruption from concurrent writes
        try:
            translate_func(extracted_folder_temp, glossary_id, source_lang, target_lang)
        except Exception as e:
            print(f"⚠️ Lỗi khi dịch văn bản: {e}")

        try:
            translate_images_in_folder(extracted_folder_temp, target_lang, source_lang, file_type)
        except Exception as e:
            print(f"⚠️ Lỗi khi dịch hình ảnh: {e}")

        output = file_path.replace(f".{file_type}", f"_{target_lang}.{file_type}")
        compress_folder(extracted_folder_temp, file_path, output)

        end = time.time()
        print(f"Time: {end - start}")
    finally:
        # Xóa thư mục tạm extracted_folder_temp
        shutil.rmtree(extracted_folder_temp, ignore_errors=True)
        # Xóa thư mục tạm extracted_folder
        shutil.rmtree(extracted_folder, ignore_errors=True)

        # Xóa file zip tạm
        zip_path = file_path.replace(f".{file_type}", "_copy.zip")
        if os.path.exists(zip_path):
            os.remove(zip_path)
