import os
from lxml import etree as ET
import html
from translate_text import translate_text_with_glossary, translate_file, translate_texts_batch
from functools import lru_cache

@lru_cache(maxsize=10000)
def cached_translate_text(text, glossary_id, source_lang, target_lang):
    return translate_text_with_glossary(text, glossary_id, source_lang, target_lang)

def clean_and_merge_runs(xml_file_path):
    parser = ET.XMLParser(remove_blank_text=True)
    tree = ET.parse(xml_file_path, parser)
    root = tree.getroot()

    w_namespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    if root.tag.startswith('{'):
        w_namespace = root.tag.split('}')[0][1:]

    namespaces = {
        'w': w_namespace,
        'wps': 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape'
    }

    for tag in ['proofErr', 'noProof', 'gramE', 'permStart', 'permEnd']:
        for elem in root.xpath(f'.//*[local-name()="{tag}"]'):
            parent = elem.getparent()
            if parent is not None:
                parent.remove(elem)

    def clean_run(run):
        for attr in list(run.attrib):
            if 'rsidR' in attr:
                del run.attrib[attr]
        # Xóa <w:lang> trong rPr
        rpr = run.find('w:rPr', namespaces)
        if rpr is not None:
            for lang in rpr.findall('w:lang', namespaces):
                rpr.remove(lang)
            # Loại bỏ các child rPr rỗng hoặc placeholder (ví dụ: <w:bCs/>)
            # các phần tử rỗng này không chứa thuộc tính, text hay children
            for child in list(rpr):
                tag_local = ET.QName(child.tag).localname
                if tag_local == 'lang':
                    continue
                if len(child) == 0 and not child.attrib and (child.text is None or not child.text.strip()):
                    rpr.remove(child)
            # Bình thường hoá w:rFonts nếu có (đặt cùng font cho ascii/hAnsi/cs/eastAsia)
            rfonts = rpr.find('w:rFonts', namespaces)
            if rfonts is not None:
                # Xóa w:hint để tránh việc không merge được do khác hint
                if f'{{{w_namespace}}}hint' in rfonts.attrib:
                    del rfonts.attrib[f'{{{w_namespace}}}hint']

                ascii_val = rfonts.get(f'{{{w_namespace}}}ascii') \
                            or rfonts.get(f'{{{w_namespace}}}hAnsi') \
                            or rfonts.get(f'{{{w_namespace}}}cs') \
                            or rfonts.get(f'{{{w_namespace}}}eastAsia') \
                            or 'Times New Roman'
                for a in ('ascii','hAnsi','cs','eastAsia'):
                    rfonts.set(f'{{{w_namespace}}}{a}', ascii_val)
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
        # Chuẩn hoá rPr thành cấu trúc đơn giản để so sánh
        def normalize_rpr(rpr):
            items = []
            for child in rpr:
                # Lấy local-name của tag (bỏ prefix namespace)
                tag = ET.QName(child.tag).localname
                # Bỏ qua các thẻ spacing, w và một số placeholder như bCs (không ảnh hưởng merge)
                if tag in ('spacing', 'w', 'bCs'):
                    continue

                # Nếu là rFonts, chuẩn hoá bằng một giá trị font chung (ascii/hAnsi/cs/eastAsia)
                # NOTE: rFonts thường khác giữa runs nhưng không nhất thiết ngăn việc merge
                # (ví dụ: một run chỉ có spacing, run kế có rFonts). Chuẩn hoá bằng giá trị ascii
                # nhưng sau đó sẽ bỏ qua rFonts trong so sánh (xem ignore_tags bên dưới).
                if tag == 'rFonts':
                    ascii_val = (
                        child.get(f'{{{w_namespace}}}ascii')
                        or child.get(f'{{{w_namespace}}}hAnsi')
                        or child.get(f'{{{w_namespace}}}cs')
                        or child.get(f'{{{w_namespace}}}eastAsia')
                        or ''
                    )
                    items.append(('rFonts', ascii_val))
                    continue

                # Thu thập attributes (local-name, value) và text, sắp xếp attributes để bỏ khác biệt thứ tự
                attribs = tuple(sorted((ET.QName(k).localname, v) for k, v in child.attrib.items()))
                text = (child.text or '').strip()
                items.append((tag, attribs, text))

            # Bỏ qua các tag không ảnh hưởng tới merge (đã ép về Arial 10pt)
            ignore_tags = {'spacing', 'w', 'bCs', 'rFonts', 'sz', 'szCs'}
            filtered = [it for it in items if it[0] not in ignore_tags]

            # Sắp xếp items để bỏ khác biệt thứ tự con; thứ tự rPr thường không quan trọng cho merge
            return tuple(sorted(filtered))

        return normalize_rpr(rpr1) == normalize_rpr(rpr2)

    def process_paragraph(para):
        runs = para.findall('w:r', namespaces)

        # 1) Clean ALL runs first
        for run in runs:
            clean_run(run)

        # 2) Thêm mặc định rPr nếu thiếu (mặc định 10pt = val "20")
        default_rpr = ET.fromstring(
            f'<w:rPr xmlns:w="{w_namespace}">'
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

        for run in runs:
            para.remove(run)
        for run in new_runs:
            para.append(run)
    for para in root.findall('.//w:p', namespaces):
        process_paragraph(para)
    
    for para in root.findall('.//wps:txbx//w:p', namespaces):
        process_paragraph(para)

    tree.write(xml_file_path, pretty_print=True, xml_declaration=True, encoding='UTF-8')
    print(f"🧹 Đã clean & merge: {xml_file_path}")

def _is_docx_content_xml(folder_path, xml_file_path):
    """Check if an XML file contains translatable document content."""
    rel_path = os.path.relpath(xml_file_path, folder_path).replace("\\", "/")
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

                w_namespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
                if root.tag.startswith('{'):
                    w_namespace = root.tag.split('}')[0][1:]

                ns = {
                    "w": w_namespace,
                    "wps": "http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
                }

                # 2. Xử lý font và size (mặc định Arial 10pt)
                if target_lang in ("vi", "en"):
                    # Cập nhật Font Family
                    for rFonts_elem in root.findall(".//w:rFonts", namespaces=ns):
                        rFonts_elem.set(f"{{{w_namespace}}}ascii", "Arial")
                        rFonts_elem.set(f"{{{w_namespace}}}eastAsia", "Arial")
                        rFonts_elem.set(f"{{{w_namespace}}}hAnsi", "Arial")
                        rFonts_elem.set(f"{{{w_namespace}}}cs", "Arial")
                    
                    # Cập nhật Size (10pt = val "20")
                    for rPr_elem in root.findall(".//w:rPr", namespaces=ns):
                        # Xử lý w:sz
                        sz_tag = f"{{{w_namespace}}}sz"
                        sz_elem = rPr_elem.find(sz_tag)
                        if sz_elem is None:
                            sz_elem = ET.SubElement(rPr_elem, sz_tag)
                        sz_elem.set(f"{{{w_namespace}}}val", "20")
                        
                        # Xử lý w:szCs
                        szCs_tag = f"{{{w_namespace}}}szCs"
                        szCs_elem = rPr_elem.find(szCs_tag)
                        if szCs_elem is None:
                            szCs_elem = ET.SubElement(rPr_elem, szCs_tag)
                        szCs_elem.set(f"{{{w_namespace}}}val", "20")

                    # Cập nhật Size cho Textbox/Shape (7pt = val "14")
                    for rPr_elem in root.findall(".//wps:txbx//w:rPr", namespaces=ns):
                        for tag in ["sz", "szCs"]:
                            sz_tag = f"{{{w_namespace}}}{tag}"
                            sz_elem = rPr_elem.find(sz_tag)
                            if sz_elem is not None:
                                sz_elem.set(f"{{{w_namespace}}}val", "10")

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
    print(f"🔵 Đang dịch batch {len(unique_texts_list)} chuỗi văn bản từ DOCX...")
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

def translate_docx_strict(docx_file, source_lang, target_lang):
    translate_file(file_path=docx_file, source_lang=source_lang,target_lang=target_lang, translate_func=translate_all_xml_in_folder, file_type='docx')

# Ví dụ sử dụng:
if __name__ == "__main__":  
    docx_file = r"D:\Dowloads\123.docx"
    # docx_file = r"D:\Dowloads\Mr. Suzuki Akihiro GĐ Công ty TNHH Toray Industries-S-d.docx"
    # output_dir = r"D:\Dowloads"
    translate_docx_strict(docx_file)
    # pdf_to_docx(docx_file, output_dir)