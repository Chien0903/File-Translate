



import os
import pandas as pd
from dotenv import load_dotenv
load_dotenv()

project_id = os.getenv("PROJECT_ID")
google_credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if google_credentials_path:
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = google_credentials_path

try:
    # Dùng module mới có _translation_context (hỗ trợ library_mode, private glossary)
    from translate_text import translate_text_with_glossary
except ImportError:
    from google.cloud import translate_v3 as translate

    def translate_text_with_glossary(
        text: str,
        glossary_id: str,
        source_lang_code: str,
        target_lang_code: str,
    ) -> str:
        client = translate.TranslationServiceClient()
        location = "us-central1"
        parent = f"projects/{project_id}/locations/{location}"

        if glossary_id:
            glossary = client.glossary_path(project_id, location, glossary_id)
            glossary_config = translate.TranslateTextGlossaryConfig(glossary=glossary)
            response = client.translate_text(
                request={
                    "contents": [text],
                    "target_language_code": target_lang_code,
                    "source_language_code": source_lang_code,
                    "parent": parent,
                    "glossary_config": glossary_config,
                }
            )
            translations = [t.translated_text for t in response.glossary_translations]
            result = translations[0] if translations else ""
        else:
            response = client.translate_text(
                request={
                    "contents": [text],
                    "target_language_code": target_lang_code,
                    "source_language_code": source_lang_code,
                    "parent": parent,
                }
            )
            translations = [t.translated_text for t in response.translations]
            result = translations[0] if translations else ""

        return result

def process_csv(
    input_path: str,
    output_path: str,
    glossary_id: str,
    source_lang_code: str,
    target_lang_code: str,
):
    # Đọc CSV, giữ nguyên format gốc
    df = pd.read_csv(input_path, dtype=str)

    # Dịch cột content
    def translate_row(text):
        if pd.isna(text) or text.strip() == "":
            return text
        return translate_text_with_glossary(
            text=text,
            glossary_id=glossary_id,
            source_lang_code=source_lang_code,
            target_lang_code=target_lang_code,
        )

    df["content"] = df["content"].apply(translate_row)

    # Đổi font thành Times New Roman
    # Nếu file của bạn có cột fontStyle thì gán tại đây
    if "fontStyle" in df.columns:
        df["fontStyle"] = "Times New Roman"

    # Nếu bạn muốn đổi similarFontFamily thay vì fontStyle thì dùng:
    # if "similarFontFamily" in df.columns:
    #     df["similarFontFamily"] = "Times New Roman"

    # Ghi ra CSV, giữ nguyên header và không thêm index
    df.to_csv(output_path, index=False, encoding="utf-8-sig")

if __name__ == "__main__":
    input_csv = "/Users/loclinh/Documents/TORAY/OCR/newapp1/output/paragraph1.csv"
    output_csv = "/Users/loclinh/Documents/TORAY/OCR/newapp1/output/paragraph1_translated.csv"
    glossary_id = "toray_translation_glossary_2"
    source_lang_code = "ja"  # Ví dụ: tiếng Nhật
    target_lang_code = "vi"  # Ví dụ: tiếng Việt

    process_csv(
        input_path=input_csv,
        output_path=output_csv,
        glossary_id=glossary_id,
        source_lang_code=source_lang_code,
        target_lang_code=target_lang_code,
    )