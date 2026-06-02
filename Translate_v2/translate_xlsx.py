from lxml import etree
import os
import html
import sys
from detect_lang import detect_language, extract_content
from translate_text import translate_text_with_glossary, translate_file, translate_texts_batch
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
import re

current_dir = os.path.dirname(os.path.abspath(__file__))
ocr_path = os.path.join(current_dir, "OCR", "OCR_IMAGE")
if ocr_path not in sys.path:
    sys.path.append(ocr_path)

def set_font_ariel_for_vi_en(elem):
    pass

@lru_cache(maxsize=10000)
def cached_translate_text(text, glossary_id, source_lang, target_lang):
    return translate_text_with_glossary(text, glossary_id, source_lang, target_lang)

def merge_runs_in_paragraphs(paragraph):
    runs = []
    end_para_rpr = None
    for elem in list(paragraph):
        if elem.tag.endswith('}r'):
            runs.append(elem)
        elif elem.tag.endswith('}endParaRPr'):
            end_para_rpr = elem

    if not runs:
        return

    merged_text = ""
    for run in runs:
        t_elem = run.find(".//{*}t")
        if t_elem is not None and t_elem.text:
            merged_text += t_elem.text

    first_run = runs[0]
    t_elem = first_run.find(".//{*}t")
    if t_elem is not None:
        t_elem.text = merged_text

    for elem in runs:
        paragraph.remove(elem)
    if end_para_rpr is not None:
        paragraph.remove(end_para_rpr)

    paragraph.append(first_run)
    if end_para_rpr is not None:
        paragraph.append(end_para_rpr)
        
def merge_all_paragraphs(xml_root):
    for p in xml_root.iter():
        if p.tag.endswith('}p'):
            merge_runs_in_paragraphs(p)

def translate_all_xml_in_folder(folder_path, glossary_id, source_lang, target_lang):
    all_xml_tasks = []
    texts_to_translate = set()
    
    # 1. Thu thập tất cả các file XML và text cần dịch
    for root_dir, dirs, files in os.walk(folder_path):
        for file in files:
            if not file.endswith(".xml"):
                continue

            xml_file_path = os.path.join(root_dir, file)
            rel_path = os.path.relpath(xml_file_path, folder_path).replace("\\", "/")
            
            if not (
                rel_path == "xl/sharedStrings.xml"
                or rel_path == "xl/workbook.xml"
                or rel_path.startswith("xl/drawings/drawing")
                or rel_path == "xl/styles.xml"
                or rel_path.startswith("xl/worksheets/sheet")
            ):
                continue

            try:
                parser = etree.XMLParser(remove_blank_text=True)
                tree = etree.parse(xml_file_path, parser)
                root = tree.getroot()

                if rel_path.startswith("xl/drawings/drawing"):
                    merge_all_paragraphs(root)

                # Thu thập text từ các thẻ <t>
                text_elements = []
                for elem in root.iter():
                    if elem.tag.endswith("}t") and elem.text and elem.text.strip():
                        text_val = elem.text.strip()
                        text_elements.append(elem)
                        texts_to_translate.add(text_val)

                # Thu thập tên sheet từ workbook.xml
                sheet_name_elements = []
                if rel_path == "xl/workbook.xml":
                    nsmap = {"ns": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
                    for sheet in root.findall(".//ns:sheet", namespaces=nsmap):
                        if "name" in sheet.attrib:
                            name_val = html.unescape(sheet.attrib["name"]).strip()
                            sheet_name_elements.append(sheet)
                            texts_to_translate.add(name_val)

                all_xml_tasks.append({
                    "path": xml_file_path,
                    "rel_path": rel_path,
                    "tree": tree,
                    "text_elements": text_elements,
                    "sheet_elements": sheet_name_elements
                })

            except Exception as e:
                print(f"❌ Không thể phân tích file {xml_file_path} — {e}")

    if not texts_to_translate:
        return

    # 2. Dịch batch toàn bộ các chuỗi văn bản duy nhất
    unique_texts_list = list(texts_to_translate)
    print(f"🔵 Đang dịch batch {len(unique_texts_list)} chuỗi văn bản từ XLSX...")
    translated_list = translate_texts_batch(unique_texts_list, glossary_id, source_lang, target_lang)
    
    translation_map = {}
    for original, translated in zip(unique_texts_list, translated_list):
        if translated:
            translation_map[original] = html.unescape(translated)

    # 3. Cập nhật và lưu lại
    for task in all_xml_tasks:
        xml_file_path = task["path"]
        rel_path = task["rel_path"]
        tree = task["tree"]
        root = tree.getroot()
        changed = False

        # Cập nhật các thẻ <t>
        for elem in task["text_elements"]:
            original_text = elem.text.strip()
            if original_text in translation_map:
                elem.text = translation_map[original_text]
                changed = True
                if rel_path == "xl/sharedStrings.xml" and target_lang in ("vi", "en"):
                    set_font_ariel_for_vi_en(elem)

        # Cập nhật tên sheet
        used_names = set()
        for sheet in task["sheet_elements"]:
            original_name = html.unescape(sheet.attrib["name"]).strip()
            if original_name in translation_map:
                new_name = translation_map[original_name]
                # Sanitize: remove illegal characters and truncate to 31 chars
                new_name = re.sub(r'[\\/?*\[\]:]', '', new_name).strip()
                if not new_name:
                    new_name = "Sheet"
                if len(new_name) > 31:
                    new_name = new_name[:31]
                # Ensure uniqueness
                base_name = new_name
                counter = 1
                while new_name in used_names:
                    suffix = str(counter)
                    new_name = base_name[:31 - len(suffix)] + suffix
                    counter += 1
                used_names.add(new_name)
                sheet.attrib["name"] = new_name
                changed = True

        # Xử lý styles.xml
        if rel_path == "xl/styles.xml" and (target_lang in ("vi", "en")):
            ns = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            fonts_elem = root.find(".//a:fonts", namespaces=ns)
            if fonts_elem is not None:
                for font in fonts_elem.findall("a:font", namespaces=ns):
                    name_elem = font.find("a:name", namespaces=ns)
                    if name_elem is not None and "val" in name_elem.attrib:
                        name_elem.set("val", "Arial")
                        changed = True

        if changed:
            try:
                tree.write(xml_file_path, pretty_print=True, xml_declaration=True, encoding="UTF-8")
                print(f"✅ Đã lưu file dịch: {xml_file_path}")
            except Exception as e:
                print(f"❌ Lỗi khi ghi file {xml_file_path} — {e}")

def translate_xlsx(xlsx_file, target_lang, source_lang=None):
    if source_lang is None:
        print(extract_content(xlsx_file))
        source_lang = detect_language(extract_content(xlsx_file))
    print(f"Detected language: {source_lang}")
    translate_file(file_path=xlsx_file, source_lang=source_lang, target_lang=target_lang, translate_func=translate_all_xml_in_folder, file_type='xlsx')

# Ví dụ sử dụng:
if __name__ == "__main__":
    xlsx_files = [r"D:\Projects\Toray_Multilanguage_transolator\Translate_v2\files\0226BULK 294F083A Ultra stretch Airism dress(SS)-ASEAN LENGTH.xlsx"]
    for xlsx_file in xlsx_files:
        translate_xlsx(xlsx_file, target_lang="ja")