import logging
from translate_docx_strict import translate_docx_strict
from translate_docx_traditional import translate_docx_traditional
from detect_lang import detect_language, extract_content
import docx

logging.basicConfig(
    level=logging.INFO,  
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def translate_docx(docx_file, target_lang, source_lang=None):
    if source_lang is None:
        try:
            content = extract_content(docx_file)
            source_lang = detect_language(content)
            logging.info(f"Detected language: {source_lang}")
        except Exception as e:
            logging.error(f"Error detecting language: {e}")
            source_lang = None
    try:
        logging.info(f"Trying traditional translation method for {docx_file}")
        doc = docx.Document(docx_file)  
        translate_docx_traditional(docx_file, source_lang, target_lang)
    except Exception as e:
        logging.warning(f"Traditional method failed: {e}")
        logging.info("Trying strict translation method...")
        try:
            translate_docx_strict(docx_file, source_lang, target_lang)
            logging.info("Strict translation completed successfully.")
        except Exception as e2:
            logging.error(f"Strict translation also failed: {e2}")
if __name__ == "__main__":  
    docx_file = r"D:\W00138 SOFT V SCOOP NECK ...WITH POWER MESH PCING -PPS Evaluation TP - Supplier Specific - Toray-en (1) (1).docx"
    # docx_file = r"D:\Dowloads\Mr. Suzuki Akihiro GĐ Công ty TNHH Toray Industries-S-d.docx"
    # output_dir = r"D:\Dowloads"
    translate_docx(docx_file, target_lang="ja")
    # pdf_to_docx(docx_file, output_dir)