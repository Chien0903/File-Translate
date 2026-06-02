from lxml import etree
import os
import html
import sys
from detect_lang import detect_language, extract_content
from translate_text import translate_text_with_glossary, translate_file, translate_texts_batch
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache

# Add OCR path
current_dir = os.path.dirname(os.path.abspath(__file__))
ocr_path = os.path.join(current_dir, "OCR", "OCR_IMAGE")
if ocr_path not in sys.path:
    sys.path.append(ocr_path)

def merge_text_runs_in_paragraph(paragraph):
    """
    Gộp tất cả các <a:r> trong cùng một <a:p> thành một <a:r> duy nhất, không xét format.
    Đảm bảo <a:endParaRPr> luôn nằm cuối cùng.
    """
    runs = []
    end_para_rpr = None
    for elem in list(paragraph):
        if elem.tag.endswith('}r'):
            runs.append(elem)
        elif elem.tag.endswith('}endParaRPr'):
            end_para_rpr = elem

    if not runs:
        return

    # Gộp toàn bộ text của các <a:r>
    merged_text = ""
    for run in runs:
        t_elem = run.find(".//{*}t")
        if t_elem is not None and t_elem.text:
            merged_text += t_elem.text

    # Giữ lại run đầu tiên, gán text đã gộp
    first_run = runs[0]
    t_elem = first_run.find(".//{*}t")
    if t_elem is not None:
        t_elem.text = merged_text

    # Xóa tất cả <a:r> và <a:endParaRPr> cũ
    for elem in runs:
        paragraph.remove(elem)
    if end_para_rpr is not None:
        paragraph.remove(end_para_rpr)

    # Thêm lại run đã gộp
    paragraph.append(first_run)
    # Thêm lại <a:endParaRPr> (nếu có)
    if end_para_rpr is not None:
        paragraph.append(end_para_rpr)
        
def merge_all_paragraphs(xml_root):
    for p in xml_root.iter():
        if p.tag.endswith('}p'):
            merge_text_runs_in_paragraph(p)

def set_font_ariel_for_vi_en(elem, slide_idx=0, is_first_text=False):
    """
    Đặt font Arial và kích thước phù hợp cho các đoạn text tiếng Việt, tiếng Anh trong <a:rPr>. 
    - Slide 1: 20pt
    - Slide khác: 10pt
    - Nếu nằm trong bảng: luôn đặt 8pt
    - Đặt character spacing (spc) về 0 (normal)
    """
    def is_inside_table(el):
        while el is not None:
            if el.tag.endswith("}tc"):
                return True
            el = el.getparent()
        return False

    parent_run = elem.getparent()
    if parent_run is not None and parent_run.tag.endswith('}r'):
        rpr = parent_run.find(".//{*}rPr")
        if rpr is None:
            rpr = etree.SubElement(parent_run, "{http://schemas.openxmlformats.org/drawingml/2006/main}rPr")

        # Đặt font cho latin và cs
        latin = rpr.find(".//{*}latin")
        if latin is None:
            latin = etree.SubElement(rpr, "{http://schemas.openxmlformats.org/drawingml/2006/main}latin")
        latin.set("typeface", "Arial")

        cs = rpr.find(".//{*}cs")
        if cs is None:
            cs = etree.SubElement(rpr, "{http://schemas.openxmlformats.org/drawingml/2006/main}cs")
        cs.set("typeface", "Arial")

        # Đặt size
        if is_inside_table(elem):
            sz = "800"  # 8pt nếu nằm trong bảng
        elif slide_idx == 0:
            sz = "2000"  # 20pt cho slide đầu tiên
        else:
            sz = "1000"  # 10pt cho slide khác

        rpr.set("sz", sz)

        # Đặt character spacing về 0 (normal)
        if "spc" in rpr.attrib:
            del rpr.attrib["spc"]
        rpr.set("spc", "0")

    # --- TỰ ĐỘNG CÂN ĐỐI SIZE (AUTOFIT) ---
    # Truy ngược từ thẻ <a:t> lên <p:txBody> để cấu hình Autofit cho Shape
    txBody = None
    curr = elem
    while curr is not None:
        if curr.tag.endswith("}txBody"):
            txBody = curr
            break
        curr = curr.getparent()

    if txBody is not None:
        bodyPr = txBody.find(".//{http://schemas.openxmlformats.org/drawingml/2006/main}bodyPr")
        if bodyPr is not None:
            # Xóa các chế độ cũ (spAutoFit - nở khung, noAutofit - không co dãn)
            for old_fit in bodyPr.findall(".//{*}spAutoFit") + bodyPr.findall(".2//20000{*}noAutofit"):
                bodyPr.remove(old_fit)
            
            # Thêm normAutofit2:20000 Tự động thu nhỏ chữ nếu bị tràn (Shrink text on overflow220000)
            normAutofit = bodyPr.find(".//{http://schemas.openxmlformats.org/drawingml/2006/main}normAutofit")
            if normAutofit is None:
                # fontScale="70000" cho phép co dãn tối đa xuống 70% kích thước font gốc
                etree.SubElement(bodyPr, "{http://schemas.openxmlformats.org/drawingml/2006/main}normAutofit", fontScale="80000")

@lru_cache(maxsize=10000)
def cached_translate_text(text, glossary_id, source_lang, target_lang):
    return translate_text_with_glossary(text, glossary_id, source_lang, target_lang)

def translate_all_xml_in_folder(folder_path, glossary_id, source_lang, target_lang):
    all_xml_tasks = []
    texts_to_translate = set()

    for root_dir, dirs, files in os.walk(folder_path):
        for file in files:
            if not file.endswith(".xml"):
                continue

            xml_file_path = os.path.join(root_dir, file)
            rel_path = os.path.relpath(xml_file_path, folder_path).replace("\\", "/")
            
            if not ((rel_path.startswith("ppt/slides/slide") or rel_path.startswith("ppt/slideLayouts/slide")) and rel_path.endswith(".xml")):
                continue

            try:
                parser = etree.XMLParser(remove_blank_text=True)
                tree = etree.parse(xml_file_path, parser)
                root = tree.getroot()

                merge_all_paragraphs(root)

                text_elements = []
                for elem in root.iter():
                    if elem.tag.endswith("}t") and elem.text and elem.text.strip():
                        text_val = elem.text.strip()
                        text_elements.append(elem)
                        texts_to_translate.add(text_val)
                
                if text_elements:
                    all_xml_tasks.append((xml_file_path, tree, text_elements))

            except Exception as e:
                print(f"❌ Không thể phân tích file {xml_file_path} — {e}")

    if not texts_to_translate:
        return

    unique_texts_list = list(texts_to_translate)
    print(f"🔵 Đang dịch batch {len(unique_texts_list)} chuỗi văn bản từ PPTX...")
    translated_list = translate_texts_batch(unique_texts_list, glossary_id, source_lang, target_lang)
    
    translation_map = {}
    for original, translated in zip(unique_texts_list, translated_list):
        if translated:
            translation_map[original] = html.unescape(translated)

    for xml_file_path, tree, elements in all_xml_tasks:
        try:
            for elem in elements:
                original_text = elem.text.strip()
                if original_text in translation_map:
                    elem.text = translation_map[original_text]
                    if target_lang in ("vi", "en"):
                        is_slide1 = os.path.basename(xml_file_path) == "slide1.xml"
                        set_font_ariel_for_vi_en(elem, slide_idx=0 if is_slide1 else 1)

            tree.write(xml_file_path, pretty_print=True, xml_declaration=True, encoding="UTF-8")
            print(f"✅ Đã lưu file dịch: {xml_file_path}")
        except Exception as e:
            print(f"❌ Lỗi khi cập nhật file {xml_file_path} — {e}")

def translate_pptx(pptx_file, target_lang, source_lang=None):
    if source_lang is None:
        source_lang = detect_language(extract_content(pptx_file))
    print(f"Detected language: {source_lang}")
    translate_file(file_path=pptx_file, source_lang=source_lang, target_lang=target_lang, translate_func=translate_all_xml_in_folder, file_type='pptx')
# Ví dụ sử dụng:
if __name__ == "__main__":
    pptx_files = [r"D:\Document\Code\Projects\TorayTranslator\OCR\A.pptx"]
    for pptx_file in pptx_files:
        # Gọi hàm dịch
        translate_pptx(pptx_file, target_lang="vi")