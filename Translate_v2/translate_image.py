import os
import sys
import json
import copy
import logging
import html
from lxml import etree as ET
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
load_dotenv()

# Add OCR path
current_dir = os.path.dirname(os.path.abspath(__file__))
ocr_path = os.path.join(current_dir, "OCR", "OCR_IMAGE")
if ocr_path not in sys.path:
    sys.path.append(ocr_path)

def translate_images_in_folder(folder_path, target_lang, source_lang, file_type='docx'):
    try:
        from ocr import detect_text_with_coords
    except ImportError:
        logging.warning("Could not import detect_text_with_coords from ocr.py")
        def detect_text_with_coords(*args, **kwargs):
            print("OCR functionality not available.")
            return [], None
            
    sub_folders = {
        'docx': 'word',
        'pptx': 'ppt',
        'xlsx': 'xl'
    }
    sub_folder = sub_folders.get(file_type, 'word')
    
    media_path = os.path.join(folder_path, sub_folder, "media")
    if not os.path.exists(media_path):
        return

    # Font path
    font_path = os.getenv("font_path")
    
    print(f"🔵 Bắt đầu dịch hình ảnh trong: {media_path} ({file_type})")

    def process_image(file):
        image_path = os.path.join(media_path, file)
        base, ext = os.path.splitext(image_path)
        temp_output_path = base + "_tmp" + ext
        print(f"  - Đang OCR hình ảnh: {file}")
        try:
            # New OCR returns (blocks, inpainted_path)
            blocks, inpainted_path = detect_text_with_coords(
                image_path=image_path,
                source_lang=None,
                target_lang=target_lang,
                output_path=temp_output_path , # overwrite original image with inpainted one
                font_path=font_path,
                font_size=14,
                max_font_size=36,
            )
            if inpainted_path and os.path.exists(inpainted_path):
                os.replace(inpainted_path, image_path)
            else:
                print(f"⚠️ Không có file OCR output cho {file}, bỏ qua replace")
            # Save meta JSON for downstream XML insertion
            meta_path = os.path.join(media_path, f"{file}.ocr.json")
            try:
                with open(meta_path, 'w', encoding='utf-8') as mf:
                    json.dump({'image': file, 'blocks': blocks}, mf, ensure_ascii=False, indent=2)
            except: pass
            
            return file, blocks, inpainted_path
        except Exception as e:
            print(f"⚠️ Lỗi khi OCR hình ảnh {file}: {e}")
            if os.path.exists(temp_output_path):
                os.remove(temp_output_path)
            return file, [], None

    image_files = [f for f in os.listdir(media_path) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.tiff', '.bmp'))]
    
    # Run OCR in parallel (safe since it only reads and writes separate image files)
    with ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(process_image, image_files))

    # Insert textboxes into XML for all file types
    print(f"🔵 Đang chèn textbox vào XML...")
    for file, blocks, inpainted_path in results:
        if blocks:
            try:
                insert_textboxes_for_image(folder_path, file, blocks, file_type, inpainted_path)
            except Exception as e:
                print(f"⚠️ Lỗi khi chèn textbox vào XML cho {file}: {e}")

    # Clean up .ocr.json files to prevent them from being included in the final package
    for f in os.listdir(media_path):
        if f.endswith('.ocr.json'):
            try:
                os.remove(os.path.join(media_path, f))
            except Exception:
                pass

    print(f"✅ Hoàn tất dịch hình ảnh.")

def insert_textboxes_for_image(extracted_folder, image_filename, blocks, file_type='docx', inpainted_path=None):
    # Support DOCX, XLSX and PPTX
    if file_type not in ('docx', 'traditional', 'xlsx', 'pptx'):
        return
    sub_folders = {
        'xlsx': 'xl',
        'pptx': 'ppt',
        'docx': 'word',
        'traditional': 'word'
    }
    sub_folder = sub_folders.get(file_type, 'word')
    main_root = os.path.join(extracted_folder, sub_folder)
    if not os.path.exists(main_root):
        return
    # Determine search path
    if file_type == 'xlsx':
        search_path = os.path.join(main_root, "drawings")
    elif file_type == 'pptx':
        search_path = os.path.join(main_root, "slides")
    else:
        search_path = main_root
    for root_dir, dirs, files in os.walk(search_path):
        for file in files:
            if not file.endswith('.xml'):
                continue
            xml_file = os.path.join(root_dir, file)
            rels_dir = os.path.join(root_dir, '_rels')
            rels_path = os.path.join(rels_dir, file + '.rels')
            
            rel_map = {}
            if os.path.exists(rels_path):
                try:
                    rels_tree = ET.parse(rels_path)
                    for rel in rels_tree.findall('.//{http://schemas.openxmlformats.org/package/2006/relationships}Relationship'):
                        rid = rel.get('Id')
                        target = rel.get('Target')
                        if rid and target:
                            rel_map[rid] = target
                except Exception:
                    rel_map = {}

            parser = ET.XMLParser(remove_blank_text=True)
            try:
                tree = ET.parse(xml_file, parser)
            except Exception as e:
                print(f"⚠️ Không thể parse file XML {xml_file}: {e}")
                continue
            root = tree.getroot()
            
            ns = {
                'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
                'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
                'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
                'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
                'v': 'urn:schemas-microsoft-com:vml',
                'xdr': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
                'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'
            }
            changed = False

            # Search targets based on file type
            if file_type == 'xlsx':
                # Excel uses xdr:pic
                # Helper: map drawing to worksheet and build grid metrics for columns/rows
                worksheet_xml_path = None
                try:
                    xl_root = os.path.join(extracted_folder, 'xl')
                    ws_rels_dir = os.path.join(xl_root, 'worksheets', '_rels')
                    if os.path.isdir(ws_rels_dir):
                        for rel_file in os.listdir(ws_rels_dir):
                            if not rel_file.endswith('.rels'):
                                continue
                            rel_path_ws = os.path.join(ws_rels_dir, rel_file)
                            try:
                                rels_ws_tree = ET.parse(rel_path_ws)
                                for rel in rels_ws_tree.findall('.//{http://schemas.openxmlformats.org/package/2006/relationships}Relationship'):
                                    t = rel.get('Target') or ''
                                    # Normalize comparisons (e.g., '../drawings/drawing1.xml' vs 'drawings/drawing1.xml')
                                    t_norm = t.replace('..' + '/' , '')
                                    if t_norm.replace('\\', '/').endswith(('drawings/' + file)):
                                        # Found worksheet for this drawing
                                        ws_name = rel_file[:-5]  # strip '.rels'
                                        worksheet_xml_path = os.path.join(xl_root, 'worksheets', ws_name)
                                        raise StopIteration
                            except StopIteration:
                                break
                            except Exception:
                                continue
                except Exception:
                    worksheet_xml_path = None

                # Build grid metrics from worksheet (defaults and overrides)
                default_col_char = 8.43
                default_row_pt = 15.0
                col_overrides = []  # list of (min, max, widthChar)
                row_height_pt = {}  # map 1-based row index -> height pt

                if worksheet_xml_path and os.path.exists(worksheet_xml_path):
                    try:
                        ws_parser = ET.XMLParser(remove_blank_text=True)
                        ws_tree = ET.parse(worksheet_xml_path, ws_parser)
                        ws_root = ws_tree.getroot()
                        ws_ns = {
                            'ws': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
                        }
                        sfp = ws_root.find('ws:sheetFormatPr', ws_ns)
                        if sfp is not None:
                            if sfp.get('defaultColWidth') is not None:
                                try:
                                    default_col_char = float(sfp.get('defaultColWidth'))
                                except Exception:
                                    pass
                            if sfp.get('defaultRowHeight') is not None:
                                try:
                                    default_row_pt = float(sfp.get('defaultRowHeight'))
                                except Exception:
                                    pass
                        # Column overrides
                        cols_node = ws_root.find('ws:cols', ws_ns)
                        if cols_node is not None:
                            for col in cols_node.findall('ws:col', ws_ns):
                                try:
                                    cmin = int(float(col.get('min')))
                                    cmax = int(float(col.get('max')))
                                    if col.get('width') is not None:
                                        wch = float(col.get('width'))
                                        col_overrides.append((cmin, cmax, wch))
                                except Exception:
                                    continue
                        # Row overrides (heights in points)
                        sheetData = ws_root.find('ws:sheetData', ws_ns)
                        if sheetData is not None:
                            for row in sheetData.findall('ws:row', ws_ns):
                                try:
                                    r_idx = int(float(row.get('r')))
                                    if row.get('ht') is not None:
                                        row_height_pt[r_idx] = float(row.get('ht'))
                                except Exception:
                                    continue
                    except Exception:
                        pass

                # Conversions
                EMU_PER_PIXEL = 9525.0
                EMU_PER_POINT = 12700.0
                EMU_PER_INCH = 914400.0

                # Textbox internal margins (inches → EMUs)
                LEFT_MARGIN_EMU = int(0.1 * EMU_PER_INCH)
                RIGHT_MARGIN_EMU = int(0.05 * EMU_PER_INCH)
                TOP_MARGIN_EMU = int(0.0 * EMU_PER_INCH)
                BOTTOM_MARGIN_EMU = int(0.15 * EMU_PER_INCH)

                def col_char_width(col_idx_1based):
                    for cmin, cmax, wch in col_overrides:
                        if cmin <= col_idx_1based <= cmax:
                            return wch
                    return default_col_char

                def col_width_emu(col_idx_0based):
                    # Convert column width in characters to pixels (approximation)
                    wch = col_char_width(col_idx_0based + 1)
                    # Common approximation used by many tools: pixels ≈ floor(wch * 7 + 5)
                    px = int(wch * 7 + 5)
                    return int(px * EMU_PER_PIXEL)

                def row_height_emu(row_idx_0based):
                    # Row index in sheet is 1-based
                    pt = row_height_pt.get(row_idx_0based + 1, default_row_pt)
                    return int(pt * EMU_PER_POINT)

                def cumulative_cols_to_emu(col_idx_0based):
                    total = 0
                    for i in range(col_idx_0based):
                        total += col_width_emu(i)
                    return total

                def cumulative_rows_to_emu(row_idx_0based):
                    total = 0
                    for i in range(row_idx_0based):
                        total += row_height_emu(i)
                    return total

                def find_col_and_offset(abs_x_emu, max_cols=10000):
                    cum = 0
                    for c in range(max_cols):
                        w = col_width_emu(c)
                        if abs_x_emu < cum + w:
                            return c, int(abs_x_emu - cum)
                        cum += w
                    return 0, int(abs_x_emu)  # fallback

                def find_row_and_offset(abs_y_emu, max_rows=1048576):
                    cum = 0
                    # Limit for performance
                    for r in range(min(max_rows, 100000)):
                        h = row_height_emu(r)
                        if abs_y_emu < cum + h:
                            return r, int(abs_y_emu - cum)
                        cum += h
                    return 0, int(abs_y_emu)  # fallback

                def get_img_display_size_emu(anchor_node, img_cx_hint, img_cy_hint):
                    # If ext exists directly under anchor, use it
                    ext = anchor_node.find('xdr:ext', ns)
                    if ext is not None and ext.get('cx') and ext.get('cy'):
                        try:
                            return int(ext.get('cx')), int(ext.get('cy'))
                        except Exception:
                            pass
                    # If twoCellAnchor, compute from from/to using grid
                    frm = anchor_node.find('xdr:from', ns)
                    to = anchor_node.find('xdr:to', ns)
                    if frm is not None and to is not None:
                        try:
                            f_col = int(frm.find('xdr:col', ns).text)
                            f_colOff = int(frm.find('xdr:colOff', ns).text)
                            f_row = int(frm.find('xdr:row', ns).text)
                            f_rowOff = int(frm.find('xdr:rowOff', ns).text)
                            t_col = int(to.find('xdr:col', ns).text)
                            t_colOff = int(to.find('xdr:colOff', ns).text)
                            t_row = int(to.find('xdr:row', ns).text)
                            t_rowOff = int(to.find('xdr:rowOff', ns).text)
                            abs_fx = cumulative_cols_to_emu(f_col) + f_colOff
                            abs_tx = cumulative_cols_to_emu(t_col) + t_colOff
                            abs_fy = cumulative_rows_to_emu(f_row) + f_rowOff
                            abs_ty = cumulative_rows_to_emu(t_row) + t_rowOff
                            return max(0, abs_tx - abs_fx), max(0, abs_ty - abs_fy)
                        except Exception:
                            pass
                    # Fallback
                    return img_cx_hint, img_cy_hint

                # Collect existing cNvPr IDs to avoid collisions
                existing_ids = set()
                for cNvPr in root.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}cNvPr'):
                    try:
                        existing_ids.add(int(cNvPr.get('id', 0)))
                    except (ValueError, TypeError):
                        pass
                next_id = max(existing_ids, default=0) + 1

                for pic in root.findall('.//xdr:pic', ns):
                    blip = pic.find('.//a:blip', ns)
                    if blip is None: continue
                    rid = blip.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                    if not rid: continue
                    target = rel_map.get(rid)
                    if not target: continue
                    
                    target_name = os.path.basename(target)
                    if target_name.lower() != image_filename.lower():
                        continue

                    # Foundation for scale and position
                    # 1. Get Anchor position (Cell-based) - VERY IMPORTANT for Excel
                    anchor_node = pic.getparent()
                    frm_img = anchor_node.find('xdr:from', ns)
                    if frm_img is None: continue
                    
                    # If cx/cy weren't in xfrm, they might be in the anchor
                    # Try to obtain image display size (cx, cy) in EMU reliably
                    xfrm = pic.find('.//a:xfrm', ns)
                    img_cx, img_cy = 0, 0
                    if xfrm is not None:
                        ext = xfrm.find('a:ext', ns)
                        if ext is not None:
                            try:
                                img_cx = int(ext.get('cx', 0))
                                img_cy = int(ext.get('cy', 0))
                            except Exception:
                                img_cx, img_cy = 0, 0
                    img_cx, img_cy = get_img_display_size_emu(anchor_node, img_cx, img_cy)

                    img_col = frm_img.find('xdr:col', ns).text
                    img_row = frm_img.find('xdr:row', ns).text
                    img_colOff = int(frm_img.find('xdr:colOff', ns).text or 0)
                    img_rowOff = int(frm_img.find('xdr:rowOff', ns).text or 0)

                    # Get original pixel size
                    img_w, img_h = 0, 0
                    try:
                        # In XLSX, media is usually ../media/image1.png relative to drawings/
                        img_rel_path = target.replace('/', os.sep)
                        if img_rel_path.startswith('..'):
                            # remove the .. and join with the directory of the drawing file
                            # drawing file is at xl/drawings/drawing1.xml
                            # target is ../media/image1.png
                            # resulting path should be xl/media/image1.png
                            clean_rel = target.replace('../', '')
                            img_path = os.path.join(main_root, 'xl', clean_rel)
                        else:
                            img_path = os.path.join(main_root, img_rel_path)
                        
                        if not os.path.exists(img_path):
                             # brute force search in extracted_folder
                             target_filename = os.path.basename(target)
                             for r_f, d_f, f_f in os.walk(extracted_folder):
                                if target_filename in f_f:
                                    img_path = os.path.join(r_f, target_filename)
                                    break
                            
                        if os.path.exists(img_path):
                            with Image.open(img_path) as img_obj:
                                img_w, img_h = img_obj.size
                    except: pass

                    if img_w == 0: img_w = 1000 # Fallback
                    if img_h == 0: img_h = 1000

                    scale_x = img_cx / img_w if img_w > 0 else 1.0
                    scale_y = img_cy / img_h if img_h > 0 else 1.0

                    # Absolute sheet position (EMU) of the image top-left
                    try:
                        abs_img_x = cumulative_cols_to_emu(int(img_col)) + img_colOff
                        abs_img_y = cumulative_rows_to_emu(int(img_row)) + img_rowOff
                    except Exception:
                        # Fallback to 0 if something goes wrong
                        abs_img_x, abs_img_y = img_colOff, img_rowOff

                    for b in blocks:
                        left_px, top_px, right_px, bottom_px = b.get('bbox', [0,0,0,0])
                        w_emu = (right_px - left_px) * scale_x * 1.8  # Expand 20% to the right
                        h_emu = (bottom_px - top_px) * scale_y
                        # Absolute EMU position of block top-left on sheet
                        block_abs_x = abs_img_x + (left_px * scale_x)
                        block_abs_y = abs_img_y + (top_px * scale_y)

                        # Determine target cell and in-cell offsets (cell-based anchoring)
                        t_col, t_colOff = find_col_and_offset(int(block_abs_x))
                        t_row, t_rowOff = find_row_and_offset(int(block_abs_y))

                        text = b.get('translated') or b.get('original') or ''

                        # Calculate font size from SCALED textbox dimensions (like DOCX does)
                        # instead of using raw OCR pixel-based font_size which ignores display scaling
                        box_h_pt = h_emu / EMU_PER_POINT  # textbox height in points (already scaled)
                        box_w_pt = w_emu / EMU_PER_POINT  # textbox width in points (already scaled)
                        f_size_from_height = box_h_pt * 0.75  # 75% of box height
                        # Also check width to prevent text overflow
                        if len(text) > 0:
                            f_size_from_width = box_w_pt / (len(text) * 0.6)
                        else:
                            f_size_from_width = f_size_from_height
                        f_size_pt = min(f_size_from_height, f_size_from_width)
                        f_size_pt = max(4, min(f_size_pt, 36) + 0.5)  # clamp 4pt–36pt
                        f_size = f_size_pt * 100  # hundredths of a point for a:rPr sz

                        # Create xdr:oneCellAnchor
                        anchor = ET.SubElement(root, '{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}oneCellAnchor')
                        
                        # Use same col/row as image background to avoid clustering at corner
                        frm = ET.SubElement(anchor, '{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}from')
                        ET.SubElement(frm, '{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}col').text = str(int(t_col))
                        ET.SubElement(frm, '{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}colOff').text = str(int(t_colOff))
                        ET.SubElement(frm, '{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}row').text = str(int(t_row))
                        ET.SubElement(frm, '{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}rowOff').text = str(int(t_rowOff))
                        
                        ET.SubElement(anchor, '{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}ext', cx=str(int(w_emu)), cy=str(int(h_emu)))
                        
                        sp = ET.SubElement(anchor, '{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}sp', macro="", textlink="")
                        nvSpPr = ET.SubElement(sp, '{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}nvSpPr')
                        ET.SubElement(nvSpPr, '{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}cNvPr', id=str(next_id), name="Text Box")
                        next_id += 1
                        ET.SubElement(nvSpPr, '{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}cNvSpPr', txBox="1")
                        
                        spPr = ET.SubElement(sp, '{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}spPr')
                        xfrm_sp = ET.SubElement(spPr, '{http://schemas.openxmlformats.org/drawingml/2006/main}xfrm')
                        # For oneCellAnchor, a:off inside sp should be 0,0 because from handles position
                        ET.SubElement(xfrm_sp, '{http://schemas.openxmlformats.org/drawingml/2006/main}off', x="0", y="0")
                        ET.SubElement(xfrm_sp, '{http://schemas.openxmlformats.org/drawingml/2006/main}ext', cx=str(int(w_emu)), cy=str(int(h_emu)))

                        prstGeom = ET.SubElement(spPr, '{http://schemas.openxmlformats.org/drawingml/2006/main}prstGeom', prst="rect")
                        ET.SubElement(prstGeom, '{http://schemas.openxmlformats.org/drawingml/2006/main}avLst')
                        ET.SubElement(spPr, '{http://schemas.openxmlformats.org/drawingml/2006/main}noFill')

                        txBody = ET.SubElement(sp, '{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}txBody')
                        bodyPr = ET.SubElement(
                            txBody,
                            '{http://schemas.openxmlformats.org/drawingml/2006/main}bodyPr',
                            wrap="square",
                            anchor="t",
                            lIns=str(LEFT_MARGIN_EMU),
                            rIns=str(RIGHT_MARGIN_EMU),
                            tIns=str(TOP_MARGIN_EMU),
                            bIns=str(BOTTOM_MARGIN_EMU)
                        )
                        # "Resize shape to fit text"
                        ET.SubElement(bodyPr, '{http://schemas.openxmlformats.org/drawingml/2006/main}spAutoFit')
                        ET.SubElement(txBody, '{http://schemas.openxmlformats.org/drawingml/2006/main}lstStyle')
                        p = ET.SubElement(txBody, '{http://schemas.openxmlformats.org/drawingml/2006/main}p')
                        pPr = ET.SubElement(p, '{http://schemas.openxmlformats.org/drawingml/2006/main}pPr', algn="l")
                        lnSp = ET.SubElement(pPr, '{http://schemas.openxmlformats.org/drawingml/2006/main}lnSp')
                        ET.SubElement(lnSp, '{http://schemas.openxmlformats.org/drawingml/2006/main}spcPct', val="90000") # 90% spacing
                        r = ET.SubElement(p, '{http://schemas.openxmlformats.org/drawingml/2006/main}r')
                        rPr = ET.SubElement(r, '{http://schemas.openxmlformats.org/drawingml/2006/main}rPr', lang="en-US", sz=str(int(f_size)))
                        t = ET.SubElement(r, '{http://schemas.openxmlformats.org/drawingml/2006/main}t')
                        t.text = html.unescape(text)
                        
                        ET.SubElement(anchor, '{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}clientData')
                        changed = True

            elif file_type == 'pptx':
                # PPTX slides use p:pic inside p:spTree
                # p:sld -> p:cSld -> p:spTree -> p:pic

                # Collect existing cNvPr IDs to avoid collisions
                pptx_existing_ids = set()
                for existing_cNvPr in root.iter():
                    if ET.QName(existing_cNvPr.tag).localname == 'cNvPr':
                        try:
                            pptx_existing_ids.add(int(existing_cNvPr.get('id', 0)))
                        except (ValueError, TypeError):
                            pass
                pptx_next_id = max(pptx_existing_ids, default=0) + 1

                for pic in root.findall('.//p:pic', ns):
                    blip = pic.find('.//a:blip', ns)
                    if blip is None: continue
                    rid = blip.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                    if not rid: continue
                    target = rel_map.get(rid)
                    if not target: continue
                    
                    if os.path.basename(target).lower() != image_filename.lower():
                        continue
                    
                    # Parent should be p:spTree or similar container
                    spTree = pic.getparent()
                    if spTree is None: continue

                    # Get position and size from a:xfrm (usually inside p:spPr)
                    xfrm = pic.find('.//p:spPr/a:xfrm', ns)
                    if xfrm is None:
                        xfrm = pic.find('.//a:xfrm', ns)
                    
                    img_x, img_y, img_cx, img_cy = 0, 0, 0, 0
                    if xfrm is not None:
                        off = xfrm.find('a:off', ns)
                        ext = xfrm.find('a:ext', ns)
                        if off is not None:
                            img_x = int(off.get('x', 0))
                            img_y = int(off.get('y', 0))
                        if ext is not None:
                            img_cx = int(ext.get('cx', 0))
                            img_cy = int(ext.get('cy', 0))
                    
                    # Get actual image size
                    img_w, img_h = 1000, 1000
                    try:
                        # In PPTX, media is usually ../media/image1.png relative to slides/
                        clean_rel = target.replace('../', '')
                        img_path = os.path.join(main_root, clean_rel)
                        if not os.path.exists(img_path):
                             # brute force search in extracted_folder
                             target_filename = os.path.basename(target)
                             for r_f, d_f, f_f in os.walk(extracted_folder):
                                if target_filename in f_f:
                                    img_path = os.path.join(r_f, target_filename)
                                    break

                        if os.path.exists(img_path):
                            with Image.open(img_path) as img_obj:
                                img_w, img_h = img_obj.size
                    except: pass
                    
                    scale_x = img_cx / img_w if img_w > 0 else 1.0
                    scale_y = img_cy / img_h if img_h > 0 else 1.0

                    for b in blocks:
                        left_px, top_px, right_px, bottom_px = b.get('bbox', [0,0,0,0])
                        # Tăng size textbox lên 10%
                        w_emu = (right_px - left_px) * scale_x * 1.6
                        h_emu = (bottom_px - top_px) * scale_y
                        
                        # Abs position in EMU (shifted slightly to center the expanded box)
                        box_x = img_x + (left_px * scale_x) - ((right_px - left_px) * scale_x * 0.05)
                        box_y = img_y + (top_px * scale_y) - ((bottom_px - top_px) * scale_y * 0.05)

                        text = b.get('translated') or b.get('original') or ''
                        # sz in DrawingML is 1/100 pt. Original was -4pt, user requested another -2pt -> -6pt
                        EMU_PER_PT = 12700

                        box_height_pt = h_emu / EMU_PER_PT
                        box_width_pt = w_emu / EMU_PER_PT

                        text_lines = text.split("\n")
                        num_lines = len(text_lines)

                        # số ký tự dài nhất trong một dòng
                        max_chars = max(len(line) for line in text_lines) if text_lines else 1

                        # ---- TÍNH THEO CHIỀU CAO ----
                        height_based = (box_height_pt * 0.75) / max(num_lines, 1)

                        # ---- TÍNH THEO CHIỀU RỘNG ----
                        # 0.6 là hệ số chiếm chỗ trung bình của ký tự
                        width_based = box_width_pt / (max_chars * 0.6)

                        # ---- CHỌN GIÁ TRỊ NHỎ HƠN ----
                        calculated_pt = min(height_based, width_based)

                        # Clamp an toàn
                        calculated_pt = max(4, min(calculated_pt, 72))

                        f_size = int(calculated_pt * 100)

                        # Create p:sp
                        sp = ET.SubElement(spTree, '{http://schemas.openxmlformats.org/presentationml/2006/main}sp')
                        nvSpPr = ET.SubElement(sp, '{http://schemas.openxmlformats.org/presentationml/2006/main}nvSpPr')
                        ET.SubElement(nvSpPr, '{http://schemas.openxmlformats.org/presentationml/2006/main}cNvPr', id=str(pptx_next_id), name="Translation Box")
                        pptx_next_id += 1
                        ET.SubElement(nvSpPr, '{http://schemas.openxmlformats.org/presentationml/2006/main}cNvSpPr', txBox="1")
                        ET.SubElement(nvSpPr, '{http://schemas.openxmlformats.org/presentationml/2006/main}nvPr')

                        spPr = ET.SubElement(sp, '{http://schemas.openxmlformats.org/presentationml/2006/main}spPr')
                        xfrm_sp = ET.SubElement(spPr, '{http://schemas.openxmlformats.org/drawingml/2006/main}xfrm')
                        ET.SubElement(xfrm_sp, '{http://schemas.openxmlformats.org/drawingml/2006/main}off', x=str(int(box_x)), y=str(int(box_y)))
                        ET.SubElement(xfrm_sp, '{http://schemas.openxmlformats.org/drawingml/2006/main}ext', cx=str(int(w_emu)), cy=str(int(h_emu)))
                        
                        prstGeom = ET.SubElement(spPr, '{http://schemas.openxmlformats.org/drawingml/2006/main}prstGeom', prst="rect")
                        ET.SubElement(prstGeom, '{http://schemas.openxmlformats.org/drawingml/2006/main}avLst')
                        ET.SubElement(spPr, '{http://schemas.openxmlformats.org/drawingml/2006/main}noFill')
                        
                        txBody = ET.SubElement(sp, '{http://schemas.openxmlformats.org/presentationml/2006/main}txBody')
                        # Set normAutofit (Shrink text on overflow)
                        bodyPr = ET.SubElement(txBody, '{http://schemas.openxmlformats.org/drawingml/2006/main}bodyPr', wrap="square", rtlCol="0", anchor="t", lIns="0", tIns="0", rIns="0", bIns="0")
                        # fontScale="40000" allows shrinking down to 40% of original size if needed
                        # ET.SubElement(bodyPr, '{http://schemas.openxmlformats.org/drawingml/2006/main}normAutofit', fontScale="70000", lnSpcReduction="20000")
                        
                        ET.SubElement(txBody, '{http://schemas.openxmlformats.org/drawingml/2006/main}lstStyle')
                        p = ET.SubElement(txBody, '{http://schemas.openxmlformats.org/drawingml/2006/main}p')
                        pPr = ET.SubElement(p, '{http://schemas.openxmlformats.org/drawingml/2006/main}pPr', algn="l")
                        lnSp = ET.SubElement(pPr, '{http://schemas.openxmlformats.org/drawingml/2006/main}lnSp')
                        ET.SubElement(lnSp, '{http://schemas.openxmlformats.org/drawingml/2006/main}spcPct', val="90000")
                        r = ET.SubElement(p, '{http://schemas.openxmlformats.org/drawingml/2006/main}r')
                        # For Asian characters, might need specific font or language settings in DrawingML
                        rPr = ET.SubElement(r, '{http://schemas.openxmlformats.org/drawingml/2006/main}rPr', lang="en-US", sz=str(int(f_size)))
                        t = ET.SubElement(r, '{http://schemas.openxmlformats.org/drawingml/2006/main}t')
                        t.text = html.unescape(text)
                        
                        changed = True

            else:
                # DOCX: Use DrawingML group shape (wpg:wgp) to overlay textboxes
                # on images. By placing textboxes inside the same wp:inline group
                # as the image, positions are relative to the image's top-left corner,
                # so they're always correct regardless of paragraph alignment.
                NS_WPG = 'http://schemas.microsoft.com/office/word/2010/wordprocessingGroup'
                NS_WPS = 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape'
                NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
                NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
                NS_WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
                NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
                NS_PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture'

                # Collect existing cNvPr IDs to avoid collisions in DOCX
                docx_existing_ids = set()
                for existing_cNvPr in root.iter():
                    if ET.QName(existing_cNvPr.tag).localname == 'cNvPr':
                        try:
                            docx_existing_ids.add(int(existing_cNvPr.get('id', 0)))
                        except (ValueError, TypeError):
                            pass
                docx_next_id = max(docx_existing_ids, default=0) + 1

                for blip in root.findall(f'.//{{{NS_A}}}blip'):
                    rid = blip.get(f'{{{NS_R}}}embed')
                    if not rid:
                        continue
                    target = rel_map.get(rid)
                    if not target:
                        continue
                    if os.path.basename(target).lower() != image_filename.lower():
                        continue

                    logging.info(f"🔍 Found matching image {image_filename} in {xml_file} (rId: {rid})")

                    # Walk up to find key elements: pic:pic, a:graphicData, wp:inline/anchor
                    node = blip
                    pic_elem = None
                    graphic_data = None
                    wp_container = None  # wp:inline or wp:anchor
                    for _ in range(20):
                        node = node.getparent()
                        if node is None:
                            break
                        local = ET.QName(node.tag).localname
                        if local == 'pic' and pic_elem is None:
                            pic_elem = node
                        elif local == 'graphicData' and graphic_data is None:
                            graphic_data = node
                        elif local in ('inline', 'anchor'):
                            wp_container = node
                            break

                    if wp_container is None or graphic_data is None or pic_elem is None:
                        logging.warning(f"  ⚠️ Could not find wp:inline/anchor structure for {image_filename} (wp_container={wp_container is not None}, graphic_data={graphic_data is not None}, pic_elem={pic_elem is not None}), falling back to burn-in.")
                        try:
                            from ocr import draw_translated_text_on_image
                            img_path = os.path.join(main_root, target.replace('/', os.sep))
                            if not os.path.exists(img_path):
                                img_path = os.path.join(main_root, target)
                            if os.path.exists(img_path):
                                # Ưu tiên dùng font từ biến môi trường, sau đó thử đường dẫn hệ thống
                                font_path_fallback = os.getenv("font_path", "")
                                if not font_path_fallback or not os.path.exists(font_path_fallback):
                                    font_path_fallback = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc"
                                if not os.path.exists(font_path_fallback):
                                    font_path_fallback = os.path.join(current_dir, "OCR", "OCR_IMAGE", "NotoSerifCJK-Regular.ttc")
                                draw_translated_text_on_image(img_path, blocks, font_path_fallback if os.path.exists(font_path_fallback) else None)
                        except Exception as fe:
                            logging.error(f"  ❌ Fallback burn-in failed: {fe}")
                        continue

                    # 1. Get image pixel size
                    img_w, img_h = 1000, 1000
                    try:
                        # Normalize path: ../media/image1.png → word/../media/image1.png → resolved
                        img_path = os.path.normpath(os.path.join(main_root, target.replace('\\', '/')))
                        if not os.path.exists(img_path):
                            img_path = os.path.join(main_root, target.replace('/', os.sep))
                        if os.path.exists(img_path):
                            with Image.open(img_path) as img:
                                img_w, img_h = img.size
                        logging.info(f"  📏 Image pixel size: {img_w}x{img_h}")
                    except Exception as e:
                        logging.warning(f"  ⚠️ Cannot get image size: {e}")

                    # 2. Get display size in EMUs from wp:extent
                    extent = wp_container.find(f'{{{NS_WP}}}extent')
                    if extent is None:
                        extent = wp_container.find(f'.//{{{NS_WP}}}extent')
                    img_cx = int(extent.get('cx', 0)) if extent is not None else 0
                    img_cy = int(extent.get('cy', 0)) if extent is not None else 0

                    if img_cx == 0 or img_cy == 0:
                        # Fallback: use pic's a:ext or pixel * 9525 EMU/px
                        pic_ext = pic_elem.find(f'.//{{{NS_A}}}ext')
                        if pic_ext is not None:
                            img_cx = int(pic_ext.get('cx', img_w * 9525))
                            img_cy = int(pic_ext.get('cy', img_h * 9525))
                        else:
                            img_cx = img_w * 9525
                            img_cy = img_h * 9525

                    scale_x = img_cx / img_w if img_w > 0 else 1.0
                    scale_y = img_cy / img_h if img_h > 0 else 1.0
                    logging.info(f"  📐 Display: {img_cx}x{img_cy} EMU, scale: {scale_x:.4f}, {scale_y:.4f}")

                    # 3. Build wpg:wgp group = original pic + text overlays
                    new_graphic_data = ET.Element(f'{{{NS_A}}}graphicData')
                    new_graphic_data.set('uri', NS_WPG)

                    wgp = ET.SubElement(new_graphic_data, f'{{{NS_WPG}}}wgp')

                    # Group non-visual properties
                    grp_cNvPr = ET.SubElement(wgp, f'{{{NS_WPG}}}cNvPr')
                    grp_cNvPr.set('id', str(docx_next_id))
                    grp_cNvPr.set('name', f'OCR Group {image_filename}')
                    docx_next_id += 1
                    ET.SubElement(wgp, f'{{{NS_WPG}}}cNvGrpSpPr')

                    # Group shape properties - coordinate system matches EMU display size
                    grpSpPr = ET.SubElement(wgp, f'{{{NS_WPG}}}grpSpPr')
                    grp_xfrm = ET.SubElement(grpSpPr, f'{{{NS_A}}}xfrm')
                    ET.SubElement(grp_xfrm, f'{{{NS_A}}}off', x='0', y='0')
                    ET.SubElement(grp_xfrm, f'{{{NS_A}}}ext', cx=str(img_cx), cy=str(img_cy))
                    ET.SubElement(grp_xfrm, f'{{{NS_A}}}chOff', x='0', y='0')
                    ET.SubElement(grp_xfrm, f'{{{NS_A}}}chExt', cx=str(img_cx), cy=str(img_cy))

                    # Add original pic:pic (deep copy) as first child
                    pic_copy = copy.deepcopy(pic_elem)
                    # Ensure pic has proper xfrm covering full group area
                    pic_spPr = pic_copy.find(f'{{{NS_PIC}}}spPr')
                    if pic_spPr is not None:
                        pic_xfrm = pic_spPr.find(f'{{{NS_A}}}xfrm')
                        if pic_xfrm is not None:
                            off_el = pic_xfrm.find(f'{{{NS_A}}}off')
                            if off_el is not None:
                                off_el.set('x', '0')
                                off_el.set('y', '0')
                            ext_el = pic_xfrm.find(f'{{{NS_A}}}ext')
                            if ext_el is not None:
                                ext_el.set('cx', str(img_cx))
                                ext_el.set('cy', str(img_cy))
                    wgp.append(pic_copy)

                    # 4. Add wps:wsp text overlays for each OCR block
                    logging.info(f"  📥 Adding {len(blocks)} text overlays into group for {image_filename}")
                    for i, b in enumerate(blocks):
                        left_px, top_px, right_px, bottom_px = b.get('bbox', [0, 0, 0, 0])

                        # Convert pixel coords to EMU (in group coordinate space)
                        # Expand width to the right by 30% (left edge stays at original position)
                        box_x = int(left_px * scale_x)
                        box_y = int(top_px * scale_y)
                        orig_w = max(1, int((right_px - left_px) * scale_x))
                        box_cx = int(orig_w * 1.3)
                        # Clamp to image boundary
                        if box_x + box_cx > img_cx:
                            box_cx = max(1, img_cx - box_x)
                        box_cy = max(1, int((bottom_px - top_px) * scale_y))

                        text = b.get('translated') or b.get('original') or ''

                        # Calculate font size from textbox dimensions (EMU → pt)
                        # 1 pt = 12700 EMU. Font should fit within the box height.
                        box_h_pt = box_cy / 12700.0  # box height in points
                        box_w_pt = box_cx / 12700.0  # box width in points

                        # Font size ≈ 70-80% of box height (accounting for line spacing/ascenders)
                        f_size_from_height = box_h_pt * 0.75

                        # Also check width: estimate chars per line at given font size
                        # Average char width ≈ 0.65 * font_size (wider estimate for Vietnamese/CJK)
                        if len(text) > 0:
                            f_size_from_width = box_w_pt / (len(text) * 0.65)
                        else:
                            f_size_from_width = f_size_from_height

                        # Use the smaller of the two to ensure text fits
                        f_size = min(f_size_from_height, f_size_from_width)
                        f_size = max(4, min(f_size, 36))  # clamp between 4pt and 36pt

                        if i < 5 or i == len(blocks) - 1:
                            logging.info(f"    Block {i}: '{text[:30]}' at ({box_x}, {box_y}) EMU, font={f_size:.1f}pt, box={box_w_pt:.1f}x{box_h_pt:.1f}pt")

                        # Create wps:wsp text shape
                        wsp = ET.SubElement(wgp, f'{{{NS_WPS}}}wsp')

                        # Non-visual properties
                        cNvPr = ET.SubElement(wsp, f'{{{NS_WPS}}}cNvPr')
                        cNvPr.set('id', str(docx_next_id))
                        cNvPr.set('name', f'OCR TextBox {i}')
                        docx_next_id += 1
                        cNvSpPr = ET.SubElement(wsp, f'{{{NS_WPS}}}cNvSpPr', txBox='1')

                        # Shape properties (position + size in group coords)
                        spPr = ET.SubElement(wsp, f'{{{NS_WPS}}}spPr')
                        sp_xfrm = ET.SubElement(spPr, f'{{{NS_A}}}xfrm')
                        ET.SubElement(sp_xfrm, f'{{{NS_A}}}off', x=str(box_x), y=str(box_y))
                        ET.SubElement(sp_xfrm, f'{{{NS_A}}}ext', cx=str(box_cx), cy=str(box_cy))
                        prstGeom = ET.SubElement(spPr, f'{{{NS_A}}}prstGeom', prst='rect')
                        ET.SubElement(prstGeom, f'{{{NS_A}}}avLst')
                        ET.SubElement(spPr, f'{{{NS_A}}}noFill')
                        ln = ET.SubElement(spPr, f'{{{NS_A}}}ln')
                        ET.SubElement(ln, f'{{{NS_A}}}noFill')

                        # Text body
                        txbx = ET.SubElement(wsp, f'{{{NS_WPS}}}txbx')
                        txbxContent = ET.SubElement(txbx, f'{{{NS_W}}}txbxContent')
                        p_el = ET.SubElement(txbxContent, f'{{{NS_W}}}p')
                        pPr_el = ET.SubElement(p_el, f'{{{NS_W}}}pPr')
                        spacing_el = ET.SubElement(pPr_el, f'{{{NS_W}}}spacing')
                        spacing_el.set(f'{{{NS_W}}}before', '0')
                        spacing_el.set(f'{{{NS_W}}}after', '0')
                        spacing_el.set(f'{{{NS_W}}}line', '240')
                        spacing_el.set(f'{{{NS_W}}}lineRule', 'auto')
                        jc_el = ET.SubElement(pPr_el, f'{{{NS_W}}}jc')
                        jc_el.set(f'{{{NS_W}}}val', 'left')
                        r_el = ET.SubElement(p_el, f'{{{NS_W}}}r')
                        rPr_el = ET.SubElement(r_el, f'{{{NS_W}}}rPr')
                        rFonts_el = ET.SubElement(rPr_el, f'{{{NS_W}}}rFonts')
                        rFonts_el.set(f'{{{NS_W}}}ascii', 'Arial')
                        rFonts_el.set(f'{{{NS_W}}}hAnsi', 'Arial')
                        rFonts_el.set(f'{{{NS_W}}}cs', 'Arial')
                        sz_el = ET.SubElement(rPr_el, f'{{{NS_W}}}sz')
                        sz_el.set(f'{{{NS_W}}}val', str(int(f_size * 2)))  # w:sz is half-points
                        szCs_el = ET.SubElement(rPr_el, f'{{{NS_W}}}szCs')
                        szCs_el.set(f'{{{NS_W}}}val', str(int(f_size * 2)))
                        t_el = ET.SubElement(r_el, f'{{{NS_W}}}t')
                        t_el.text = html.unescape(text)

                        # Body properties: resize shape to fit text + do not rotate text
                        bodyPr = ET.SubElement(wsp, f'{{{NS_WPS}}}bodyPr')
                        bodyPr.set('wrap', 'square')
                        bodyPr.set('lIns', '0')
                        bodyPr.set('tIns', '0')
                        bodyPr.set('rIns', '0')
                        bodyPr.set('bIns', '0')
                        bodyPr.set('anchor', 'ctr')
                        bodyPr.set('anchorCtr', '0')
                        bodyPr.set('upright', '1')
                        ET.SubElement(bodyPr, f'{{{NS_A}}}spAutoFit')

                    # 5. Replace old graphicData with the new group graphicData
                    graphic = graphic_data.getparent()
                    graphic.remove(graphic_data)
                    graphic.append(new_graphic_data)

                    changed = True
                    logging.info(f"  ✅ Replaced image with group shape containing {len(blocks)} text overlays")

            if changed:
                tree.write(xml_file, pretty_print=True, xml_declaration=True, encoding='UTF-8')
