import os
from lxml import etree as ET
import html
from translate_text import translate_text_with_glossary, translate_file, translate_texts_batch
from functools import lru_cache
@lru_cache(maxsize=10000)
def cached_translate_text(text, glossary_id, source_lang, target_lang):
    return translate_text_with_glossary(text, glossary_id, source_lang, target_lang)

def clean_and_merge_runs(xml_file_path):
    namespaces = {
        'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
        'wps': 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape'
    }

    # Parse XML
    parser = ET.XMLParser(remove_blank_text=True)
    tree = ET.parse(xml_file_path, parser)
    root = tree.getroot()

    def clean_run(run):
        # Xóa mọi rsidR, rsidRPr khỏi <w:r>
        for attr in list(run.attrib):
            if 'rsidR' in attr:
                del run.attrib[attr]
        # Xóa <w:lang> trong rPr
        rpr = run.find('w:rPr', namespaces)
        if rpr is not None:
            for lang in rpr.findall('w:lang', namespaces):
                rpr.remove(lang)
            # Bình thường hoá w:rFonts nếu có (đặt cùng font cho ascii/hAnsi/cs/eastAsia)
            rfonts = rpr.find('w:rFonts', namespaces)
            if rfonts is not None:
                ascii_val = rfonts.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}ascii') \
                            or rfonts.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}hAnsi') \
                            or rfonts.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}cs') \
                            or rfonts.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}eastAsia') \
                            or 'Times New Roman'
                for a in ('ascii','hAnsi','cs','eastAsia'):
                    rfonts.set(f'{{http://schemas.openxmlformats.org/wordprocessingml/2006/main}}{a}', ascii_val)
            if len(rpr) == 0:
                run.remove(rpr)
        # Xóa xml:space khỏi <w:t>
        for t in run.findall('w:t', namespaces):
            t.attrib.pop('{http://www.w3.org/XML/1998/namespace}space', None)

    def rpr_equal(rpr1, rpr2):
        if rpr1 is None and rpr2 is None:
            return True
        if rpr1 is None or rpr2 is None:
            return False

        # Tạo bản sao để không ảnh hưởng đến XML gốc
        rpr1_copy = ET.fromstring(ET.tostring(rpr1))
        rpr2_copy = ET.fromstring(ET.tostring(rpr2))

        # Xóa các thẻ không quan trọng khi merge (đã có mặc định Arial 10pt)
        for tag in ('w:spacing', 'w:w', 'w:rFonts', 'w:sz', 'w:szCs'):
            for elem in rpr1_copy.findall(tag, namespaces):
                rpr1_copy.remove(elem)
            for elem in rpr2_copy.findall(tag, namespaces):
                rpr2_copy.remove(elem)

        return ET.tostring(rpr1_copy) == ET.tostring(rpr2_copy)

    def process_paragraph(para):
        runs = para.findall('w:r', namespaces)

        # 1) Clean ALL runs first
        for run in runs:
            clean_run(run)

        # 2) Thêm mặc định rPr nếu thiếu (mặc định 10pt = val "20")
        default_rpr = ET.fromstring(
            '<w:rPr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            '<w:spacing w:val="-2"/>'
            '<w:sz w:val="20"/>'
            '<w:szCs w:val="20"/>'
            '</w:rPr>'
        )
        for run in runs:
            rpr = run.find('w:rPr', namespaces)
            if rpr is None or len(rpr) == 0:
                if rpr is not None:
                    run.remove(rpr)
                run.insert(0, ET.fromstring(ET.tostring(default_rpr)))

        # 3) Merge các run có rPr giống nhau
        new_runs = []
        current = None
        for run in runs:
            rpr = run.find('w:rPr', namespaces)
            t_elem = run.find('w:t', namespaces)
            text = t_elem.text if t_elem is not None else None

            if current is None:
                current = ET.fromstring(ET.tostring(run))
                continue

            curr_rpr = current.find('w:rPr', namespaces)
            curr_t = current.find('w:t', namespaces)

            if text and curr_t is not None and rpr_equal(rpr, curr_rpr):
                curr_t.text = (curr_t.text or '') + text
            else:
                new_runs.append(current)
                current = ET.fromstring(ET.tostring(run))

        if current is not None:
            new_runs.append(current)

        # Thay runs cũ bằng mới
        for run in runs:
            para.remove(run)
        for run in new_runs:
            para.append(run)
    # Xử lý tất cả các paragraph trong document chính
    for para in root.findall('.//w:p', namespaces):
        process_paragraph(para)
    
    # Xử lý các paragraph trong textbox (wps:txbx)
    for para in root.findall('.//wps:txbx//w:p', namespaces):
        process_paragraph(para)

    tree.write(xml_file_path, pretty_print=True, xml_declaration=True, encoding='UTF-8')
    print(f"🧹 Đã clean & merge: {xml_file_path}")

def _is_docx_content_xml(folder_path, xml_file_path):
    """Check if an XML file contains translatable document content."""
    rel_path = os.path.relpath(xml_file_path, folder_path).replace("\\", "/")
    # Only process word/document.xml, word/header*.xml, word/footer*.xml,
    # word/footnotes.xml, word/endnotes.xml, word/comments.xml
    # Skip styles, settings, fontTable, numbering, rels, [Content_Types], theme, etc.
    skip_names = ('styles.xml', 'settings.xml', 'fontTable.xml', 'numbering.xml',
                  'webSettings.xml', 'theme1.xml')
    basename = os.path.basename(rel_path)
    if basename in skip_names:
        return False
    if rel_path.startswith('word/') and not rel_path.startswith('word/_rels/') and not rel_path.startswith('word/theme/'):
        return True
    return False

def translate_all_xml_in_folder(folder_path, glossary_id, source_lang, target_lang):
    all_xml_tasks = []
    texts_to_translate = set()

    for root_dir, dirs, files in os.walk(folder_path):
        for file in files:
            if not file.endswith(".xml"):
                continue
                
            xml_file_path = os.path.join(root_dir, file)

            if not _is_docx_content_xml(folder_path, xml_file_path):
                continue

            print(f"🔵 Đang xử lý file XML: {xml_file_path}")
            
            try:
                # 1. Dọn dẹp và merge runs trước
                clean_and_merge_runs(xml_file_path)

                parser = ET.XMLParser(remove_blank_text=True)
                tree = ET.parse(xml_file_path, parser)
                root = tree.getroot()

                ns = {
                    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
                    "wps": "http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
                }

                # 2. Xử lý font và size (mặc định Arial 10pt)
                if target_lang in ("vi", "en"):
                    # Cập nhật Font Family
                    for rFonts_elem in root.findall(".//w:rFonts", namespaces=ns):
                        rFonts_elem.set("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}ascii", "Arial")
                        rFonts_elem.set("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}eastAsia", "Arial")
                        rFonts_elem.set("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}hAnsi", "Arial")
                        rFonts_elem.set("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}cs", "Arial")
                    
                    # Cập nhật Size (10pt = val "20")
                    for rPr_elem in root.findall(".//w:rPr", namespaces=ns):
                        # Xử lý w:sz
                        sz_elem = rPr_elem.find("w:sz", namespaces=ns)
                        if sz_elem is None:
                            sz_elem = ET.SubElement(rPr_elem, "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}sz")
                        sz_elem.set("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val", "20")
                        
                        # Xử lý w:szCs
                        szCs_elem = rPr_elem.find("w:szCs", namespaces=ns)
                        if szCs_elem is None:
                            szCs_elem = ET.SubElement(rPr_elem, "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}szCs")
                        szCs_elem.set("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val", "20")

                    # Cập nhật Size cho Textbox/Shape (7pt = val "14")
                    for rPr_elem in root.findall(".//wps:txbx//w:rPr", namespaces=ns):
                        for sz_tag in ["w:sz", "w:szCs"]:
                            sz_elem = rPr_elem.find(sz_tag, namespaces=ns)
                            if sz_elem is not None:
                                sz_elem.set("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val", "10")

                # 3. Thu thập text
                text_elements = []
                for elem in root.iter():
                    if elem.tag.endswith("}t") and elem.text and elem.text.strip():
                        text_val = elem.text.strip()
                        text_elements.append(elem)
                        texts_to_translate.add(text_val)
                
                if text_elements:
                    all_xml_tasks.append((xml_file_path, tree, text_elements))

            except Exception as e:
                print(f"❌ Lỗi khi phân tích file {xml_file_path}: {e}")

    if not texts_to_translate:
        return

    # 4. Dịch batch toàn bộ các chuỗi văn bản duy nhất
    unique_texts_list = list(texts_to_translate)
    print(f"🔵 Đang dịch batch {len(unique_texts_list)} chuỗi văn bản từ DOCX (Traditional)...")
    translated_list = translate_texts_batch(unique_texts_list, glossary_id, source_lang, target_lang)
    
    translation_map = {}
    for original, translated in zip(unique_texts_list, translated_list):
        if translated:
            translation_map[original] = html.unescape(translated)

    # 5. Cập nhật và lưu lại các file XML
    for xml_file_path, tree, elements in all_xml_tasks:
        try:
            for elem in elements:
                original_text = elem.text.strip()
                if original_text in translation_map:
                    elem.text = translation_map[original_text]

            tree.write(xml_file_path, pretty_print=True, xml_declaration=True, encoding="UTF-8")
            print(f"✅ Đã lưu file dịch: {xml_file_path}")
        except Exception as e:
            print(f"❌ Lỗi khi ghi file {xml_file_path} — {e}")

def translate_docx_traditional(docx_file, source_lang, target_lang):
    translate_file(file_path=docx_file, source_lang=source_lang, target_lang=target_lang, translate_func=translate_all_xml_in_folder, file_type='docx')
 
# Ví dụ sử dụng:
if __name__ == "__main__":  
    docx_file = r"D:\Document\(CN) 202503_品质确认业务及机能的说明资料_V1.0.docx"
    translate_docx_traditional(docx_file, source_lang="ja", target_lang="vi")