import os
import cv2
import numpy as np
from PIL import Image
import json
import pandas as pd
import ast
from pypdf import PdfWriter, PdfReader
from reportlab.lib.pagesizes import A4, letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from io import BytesIO
import fitz
import ast



# ============================================================================
# PHẦN 1: CHUYỂN ẢNH THÀNH PDF
# ============================================================================

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

import re


import fitz
import fitz


def wrap_text_to_width(text, font, font_size, max_width):
    words = text.split()
    lines = []
    current_line = ""

    for word in words:
        test_line = current_line + (" " if current_line else "") + word
        width = fitz.get_text_length(
            test_line,
            fontname=font,
            fontsize=font_size
        )

        if width <= max_width*0.98:
            current_line = test_line
        else:
            if current_line:
                lines.append(current_line)
                current_line = word
            else:
                # Nếu 1 từ quá dài -> buộc phải cắt ký tự
                temp = ""
                for ch in word:
                    test = temp + ch
                    w = fitz.get_text_length(
                        test,
                        fontname=font,
                        fontsize=font_size
                    )
                    if w <= max_width:
                        temp = test
                    else:
                        lines.append(temp)
                        temp = ch
                current_line = temp

    if current_line:
        lines.append(current_line)

    return lines


def is_vertical(rect, text, vertical_ratio_threshold = 1.5): 
    if len(text) > 1 and (rect.height / max(rect.width, 1)) > vertical_ratio_threshold: 
        return True 
    return False

def calculate_fontsize_auto(rect,
                            text,
                            font="helv",
                            min_size=8,
                            max_size=200,
                            height_factor=1.8,
                            vertical_ratio_threshold=1.5):

    if rect is None or not text.strip():
        return min_size, []

    box_width = rect.width
    box_height = rect.height

    if is_vertical(rect, text, vertical_ratio_threshold):
        box_width, box_height = rect.height, rect.width

    low = int(min_size)
    high = int(max_size)

    best_size = min_size
    best_lines = []

    while low <= high:
        mid = (low + high) // 2

        lines = wrap_text_to_width(text, font, mid, box_width)

        # kiểm tra chiều ngang thật sự
        max_line_width = 0
        for line in lines:
            w = fitz.get_text_length(
                line,
                fontname=font,
                fontsize=mid
            )
            max_line_width = max(max_line_width, w)

        total_height = len(lines) * mid * height_factor

        if max_line_width <= box_width and total_height <= box_height*0.95:
            best_size = mid
            best_lines = lines
            low = mid + 1
        else:
            high = mid - 1

    return best_size, best_lines

def calculate_font_size_from_scale(polygon, line_count, scale_y,
                                   height_factor=1.2,
                                   min_size=6,
                                   max_size=20):

    if len(polygon) < 4 or line_count <= 0:
        return 10

    y_coords = [polygon[i] for i in range(1, len(polygon), 2)]
    box_height_px = abs(max(y_coords) - min(y_coords))

    # Convert pixel -> PDF point
    box_height_pt = box_height_px * scale_y

    font_size = box_height_pt / (line_count * height_factor)

    font_size = max(min_size, min(font_size, max_size))

    return font_size * 0.9


def calculate_font_size_from_rect(rect,
                                  text,
                                  line_count,
                                  height_factor=1.2,
                                  min_size=6,
                                  max_size=20,
                                  safety_margin=2.0,
                                  vertical_ratio_threshold=2.5,
                                  char_width_ratio=0.55):
    """
    Tính font size (pt) để text vừa rect trong PDF.
    Tự động xử lý text dọc nếu rect quá cao so với rộng.

    Args:
        rect: fitz.Rect (đơn vị point)
        line_count: 
            - text ngang: số dòng
            - text dọc: số ký tự
        height_factor: hệ số leading (1.2 = single spacing)
        min_size: font nhỏ nhất
        max_size: font lớn nhất
        safety_margin: trừ thêm để tránh tràn
        vertical_ratio_threshold: nếu height/width > threshold → coi là text dọc
        char_width_ratio: ước lượng width của 1 ký tự ≈ font_size × ratio

    Returns:
        font_size (float)
    """

    if rect is None or line_count <= 0:
        return min_size, False

    box_width = rect.width
    box_height = rect.height
    

    if not is_vertical(rect=rect, text=text, vertical_ratio_threshold=vertical_ratio_threshold):
        # ===== TEXT NGANG =====
        font_size = box_height / (line_count * height_factor)
    else:
        # ===== TEXT DỌC =====
        # 1. Tính theo chiều cao (mỗi ký tự 1 dòng)
        font_by_height = box_height / (line_count * height_factor)

        # 2. Tính theo chiều rộng (phải đủ chứa 1 ký tự)
        font_by_width = box_width / char_width_ratio

        # Lấy giá trị nhỏ hơn để không tràn
        font_size = min(font_by_height, font_by_width) * 0.55

    # Giới hạn min/max
    font_size = max(min_size, min(font_size, max_size))

    # Trừ margin an toàn
    font_size = max(min_size, font_size - safety_margin)

    # Giảm thêm nhẹ để đảm bảo vừa
    font_size = font_size * (1 - font_size / 1000) * 0.9

    return font_size



# ---- relative luminance (WCAG) ----
def relative_luminance(rgb):
    def channel(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = rgb
    r, g, b = channel(r), channel(g), channel(b)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(rgb1, rgb2):
    L1 = relative_luminance(rgb1)
    L2 = relative_luminance(rgb2)
    lighter = max(L1, L2)
    darker = min(L1, L2)
    return (lighter + 0.05) / (darker + 0.05)


# ---- auto adjust ----
def auto_adjust_text_color(mean_bg_color, current_hex, min_ratio=0.25):
    """
    mean_bg_color: [R,G,B] 0-255
    current_hex: "#c1c1bd"
    return: PyMuPDF format (0-1 float tuple)
    """

    current_rgb = hex_to_rgb(current_hex)

    ratio = contrast_ratio(mean_bg_color, current_rgb)

    if ratio >= min_ratio:
        # convert sang 0-1 cho PyMuPDF
        return tuple(c/255 for c in current_rgb)

    # thử đen và trắng
    black = [0, 0, 0]
    white = [255, 255, 255]

    if contrast_ratio(mean_bg_color, black) > contrast_ratio(mean_bg_color, white):
        return (0, 0, 0)
    else:
        return (1, 1, 1)


def images_to_pdf(image_folder, output_pdf_path, dpi=200):
    """
    Chuyển danh sách ảnh thành PDF.
    
    Args:
        image_folder: thư mục chứa ảnh
        output_pdf_path: đường dẫn PDF output
        dpi: độ phân giải
    """
    print(f"{'='*70}")
    print("🖼️  CHUYỂN ẢNH THÀNH PDF")
    print(f"{'='*70}\n")
    
    # Lấy danh sách ảnh theo thứ tự
    image_files = sorted([f for f in os.listdir(image_folder) 
                         if f.endswith(('.png', '.jpg', '.jpeg'))])
    
    if not image_files:
        print("❌ Không tìm thấy ảnh nào")
        return None
    
    print(f"✓ Tìm thấy {len(image_files)} ảnh")
    
    # Lấy kích thước ảnh đầu tiên
    first_img = Image.open(os.path.join(image_folder, image_files[0]))
    img_width, img_height = first_img.size
    print(f"✓ Kích thước ảnh: {img_width} x {img_height}")
    
    # Chuyển đổi sang RGB
    images_to_convert = []
    for idx, img_file in enumerate(image_files):
        img_path = os.path.join(image_folder, img_file)
        img = Image.open(img_path)
        
        print(f"  [{idx+1}/{len(image_files)}] {img_file}")
        
        if img.mode != 'RGB':
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'RGBA':
                background.paste(img, mask=img.split()[-1])
            elif img.mode == 'P':
                img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1])
            else:
                background.paste(img)
            img = background
        
        images_to_convert.append(img)
    
    # Lưu PDF
    images_to_convert[0].save(
        output_pdf_path,
        save_all=True,
        append_images=images_to_convert[1:],
        quality=95,
        optimize=False,
        format='PDF'
    )
    
    print(f"\n✓ Đã tạo PDF: {output_pdf_path}\n")
    
    return output_pdf_path


# ============================================================================
# PHẦN 1.5: HỘ TRỢ HÀM
# ============================================================================

def draw_text_on_image(img, polygon_pts, text, font_size, text_color_rgb):
    """
    Vẽ text lên ảnh (PIL) tại vị trí polygon.
    
    Args:
        img: PIL Image (RGB)
        polygon_pts: list [(x0,y0), (x1,y1), ...] tọa độ pixel
        text: nội dung text
        font_size: kích thước font
        text_color_rgb: tuple (R, G, B) 0-255
    
    Returns:
        img: ảnh đã vẽ text
    """
    from PIL import ImageDraw, ImageFont
    import textwrap
    
    if not text or not polygon_pts:
        return img
    
    draw = ImageDraw.Draw(img)
    
    # Lấy bounding box
    x_coords = [p[0] for p in polygon_pts]
    y_coords = [p[1] for p in polygon_pts]
    x_min, x_max = int(min(x_coords)), int(max(x_coords))
    y_min, y_max = int(min(y_coords)), int(max(y_coords))
    
    box_width = x_max - x_min
    box_height = y_max - y_min
    
    # Load font — ưu tiên: env var → bundled NotoSerifCJK → Linux system → macOS → Windows → default
    _this_dir = os.path.dirname(os.path.abspath(__file__))
    _bundled_font = os.path.normpath(
        os.path.join(_this_dir, "..", "OCR", "OCR_IMAGE", "NotoSerifCJK-Regular.ttc")
    )
    font = None
    for _candidate in [
        os.getenv("font_path", ""),
        "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
        _bundled_font,
        "/System/Library/Fonts/Helvetica.ttc",
        "C:\\Windows\\Fonts\\arial.ttf",
    ]:
        if _candidate and os.path.exists(_candidate):
            try:
                font = ImageFont.truetype(_candidate, int(font_size))
                break
            except Exception:
                continue
    if font is None:
        font = ImageFont.load_default()

    # Wrap text
    chars_per_line = max(1, int(box_width / (font_size * 0.5)))
    wrapped_lines = textwrap.wrap(text, width=chars_per_line)

    # Vẽ text
    y_pos = y_min + 2
    for line in wrapped_lines:
        draw.text((x_min + 2, y_pos), line, font=font, fill=tuple(text_color_rgb))
        y_pos += int(font_size * 1.2)

    return img



# ============================================================================
# PHẦN 3: CHUYỂN ĐỘC ĐÓ SANG INCH
# ============================================================================

def get_page_dimensions_from_csv(df):
    """
    Lấy kích thước trang từ CSV (dựa vào bounding box của các polygon).
    
    Args:
        df: DataFrame
    
    Returns:
        dict: {page_num: (width_inch, height_inch)}
    """
    page_dims = {}
    
    for page_num in df['pageNumber'].unique():
        page_df = df[df['pageNumber'] == page_num]
        
        max_x = 0
        max_y = 0
        
        for idx, row in page_df.iterrows():
            try:
                if isinstance(row['polygon'], str):
                    polygon = ast.literal_eval(row['polygon'])
                else:
                    polygon = row['polygon']
                
                # Polygon là flat list [x0, y0, x1, y1, ...]
                for i in range(0, len(polygon), 2):
                    if i < len(polygon):
                        max_x = max(max_x, polygon[i])
                    if i+1 < len(polygon):
                        max_y = max(max_y, polygon[i+1])
            except:
                pass
        
        # Thêm margin
        page_dims[page_num] = (max_x + 0.5, max_y + 0.5)
    
    return page_dims






# ============================================================================
# PHẦN 4: THÊM TEXTBOX VÀO PDF
# ============================================================================

def add_textboxes_to_pdf_from_csv(base_pdf_path, output_pdf_path, csv_file_path, 
                                 image_folder, offset_x=0, offset_y=0, dpi=200, auto_font_size=True, type_draw="line"):
    """
    Thêm textbox vào PDF dựa vào dữ liệu CSV.
    
    Args:
        base_pdf_path: đường dẫn PDF base (ảnh)
        output_pdf_path: đường dẫn PDF output (với textbox)
        text_content_dict: dict {page_num: {row_idx: {polygon, content, ...}}}
        image_folder: thư mục chứa ảnh (để lấy kích thước thực tế)
        offset_x: dịch textbox theo X (pt)
        offset_y: dịch textbox theo Y (pt)
        dpi: độ phân giải khi convert PDF thành ảnh
        auto_font_size: tự động tính font size
    """
    print(f"{'='*70}")
    print("📝 THÊM TEXTBOX VÀO PDF")
    print(f"{'='*70}\n")
    
    # Mở PDF base
    doc = fitz.open(base_pdf_path)
    
    print(f"✓ Mở PDF: {base_pdf_path}")
    print(f"✓ Tổng {len(doc)} trang")
    # if offset_x != 0 or offset_y != 0:
    #     print(f"✓ Offset: X={offset_x} pt, Y={offset_y} pt")
    # print()
    
    # Lấy danh sách ảnh để biết kích thước thực tế
    image_files = sorted([f for f in os.listdir(image_folder) 
                         if f.endswith(('.png', '.jpg', '.jpeg'))])
    
    image_dims = {}
    for idx, img_file in enumerate(image_files):
        img_path = os.path.join(image_folder, img_file)
        img = Image.open(img_path)
        image_dims[idx + 1] = img.size  # (width_px, height_px)
    
    if type_draw == "line":
        """
        Đọc file CSV chứa thông tin content và polygon.
        
        Args:
            csv_file_path: đường dẫn CSV file
        
        Returns:
            df: DataFrame chứa dữ liệu
            text_content_dict: dict {page_num: {row_idx: {polygon, content, ...}}}
        """
        print(f"{'='*70}")
        print("📖 ĐỌC DỮ LIỆU TỪ CSV")
        print(f"{'='*70}\n")
        
        # Đọc CSV
        df = pd.read_csv(csv_file_path)
        
        print(f"✓ Tìm thấy {len(df)} hàng dữ liệu")
        print(f"✓ Các cột: {', '.join(df.columns.tolist())}\n")
        
        # Tổ chức dữ liệu theo page
        text_content_dict = {}
        
        for idx, row in df.iterrows():
            page_num = int(row['pageNumber'])
            
            if page_num not in text_content_dict:
                text_content_dict[page_num] = {}
            
            # Parse polygon từ string sang list
            try:
                if isinstance(row['polygon'], str):
                    polygon = ast.literal_eval(row['polygon'])
                else:
                    polygon = row['polygon']
            except:
                print(f"⚠ Lỗi parse polygon hàng {idx}")
                polygon = []
            
            # Lưu thông tin
            text_content_dict[page_num][idx] = {
                'polygon': polygon,
                'content': str(row['content']) if pd.notna(row['content']) else '',
                'color': row['color'] if 'color' in row and pd.notna(row['color']) else '#000000',
                'fontWeight': row['fontWeight'] if 'fontWeight' in row and pd.notna(row['fontWeight']) else 'normal',
                'fontStyle': row['fontStyle'] if 'fontStyle' in row and pd.notna(row['fontStyle']) else 'normal',
                'backgroundColor': row['backgroundColor'] if 'backgroundColor' in row and pd.notna(row['backgroundColor']) else '#ffffff',
                'line_count': int(row['line_count']) if 'line_count' in row and pd.notna(row['line_count']) else 1,
            }
        
        # In thông tin
        # for page_num in sorted(text_content_dict.keys()):
        #     items = text_content_dict[page_num]
        #     print(f"📄 Trang {page_num}: {len(items)} textbox(es)")
        #     for item_idx, item_data in items.items():
        #         content = item_data['content'][:40]
        #         print(f"  - {content}{'...' if len(item_data['content']) > 40 else ''}")
        #         if item_data["color"] != "#000000":
        #             print(item_data["color"])
        
        # print()
    else:
        print(f"{'='*70}")
        print("📖 ĐỌC DỮ LIỆU TỪ CSV")
        print(f"{'='*70}\n")

        df = pd.read_csv(csv_file_path)

        print(f"✓ Tìm thấy {len(df)} hàng dữ liệu")
        print(f"✓ Các cột: {', '.join(df.columns.tolist())}\n")

        text_content_dict = {}

        # ================================
        # DUYỆT THEO PAGE
        # ================================
        for page_num in sorted(df['pageNumber'].unique()):

            df_page = df[df['pageNumber'] == page_num].copy()

            if page_num not in text_content_dict:
                text_content_dict[page_num] = {}

            # ================================
            # XỬ LÝ TABLE TRƯỚC
            # ================================
            table_fontsize_map = {}

            page = doc[int(page_num) - 1]
        
            print(f"📄 Trang {page_num}:")
            
            if page_num not in text_content_dict:
                print(f"  ⚠ Không có dữ liệu cho trang {page_num}")
                continue
            
            items = text_content_dict[page_num]
            
            # Lấy kích thước ảnh pixel
            if page_num in image_dims:
                img_width_px, img_height_px = image_dims[page_num]
            else:
                print(f"  ⚠ Không tìm thấy ảnh cho trang {page_num}")
                continue
            
            # Lấy kích thước PDF
            pdf_page_height = page.rect.height
            pdf_page_width = page.rect.width
            
            print(f"  Ảnh: {img_width_px} x {img_height_px} px (DPI={dpi})")
            print(f"  PDF: {pdf_page_width:.1f} x {pdf_page_height:.1f} pt")
            
            # Tỷ lệ từ pixel sang PDF points
            scale_x = pdf_page_width / img_width_px
            scale_y = pdf_page_height / img_height_px
            
            print(f"  Scale: X={scale_x:.4f}, Y={scale_y:.4f}\n")

            if 'table_index' in df_page.columns:

                table_ids = df_page['table_index'].dropna().unique()

                for table_id in table_ids:
                    df_table = df_page[df_page['table_index'] == table_id]

                    font_sizes = []

                    for idx, row in df_table.iterrows():

                        try:
                            polygon = ast.literal_eval(row['polygon']) if isinstance(row['polygon'], str) else row['polygon']
                        except:
                            continue

                        if not polygon or len(polygon) < 4:
                            continue

                        x_coords = [polygon[i] for i in range(0, len(polygon), 2) if i < len(polygon)]
                        y_coords = [polygon[i] for i in range(1, len(polygon), 2) if i < len(polygon)]
                        
                        if not x_coords or not y_coords:
                            print(f"      ⚠ Polygon rỗng")
                            continue
                        
                        x_min, x_max = min(x_coords), max(x_coords)
                        y_min, y_max = min(y_coords), max(y_coords)
                        
                        # Chuyển từ inch sang pixel
                        x_min_px = x_min * dpi
                        y_min_px = y_min * dpi
                        x_max_px = x_max * dpi
                        y_max_px = y_max * dpi
                        
                        # Chuyển từ pixel sang PDF points
                        x_min_pt = x_min_px * scale_x
                        y_min_pt = y_min_px * scale_y
                        x_max_pt = x_max_px * scale_x
                        y_max_pt = y_max_px * scale_y
                        
                        # Áp dụng offset
                        x_min_pt += offset_x
                        y_min_pt += offset_y
                        x_max_pt += offset_x
                        y_max_pt += offset_y
                        # Không đảo Y - dùng trực tiếp
                        rect = fitz.Rect(x_min_pt, y_min_pt, x_max_pt, y_max_pt)
                        line_count = int(row['line_count']) if pd.notna(row.get('line_count')) else 1

                        font_size, _ = calculate_fontsize_auto(
                            rect=rect,
                            text=row['content']
                        )
                        print(f"in the table {table_id}, text: {row['content']} has font_size {font_size}")

                        font_sizes.append(font_size)
                    
                    if font_sizes:
                        table_fontsize_map[table_id] = min(font_sizes)

            # ================================
            # ADD TO DICT (TẤT CẢ CONTENT)
            # ================================
            for idx, row in df_page.iterrows():

                try:
                    polygon = ast.literal_eval(row['polygon']) if isinstance(row['polygon'], str) else row['polygon']
                except:
                    polygon = []

                table_id = row.get('table_index', None)

                # Nếu thuộc bảng → lấy font chung
                if table_id in table_fontsize_map:
                    final_fontsize = table_fontsize_map[table_id]
                else:
                    final_fontsize = None  # Không phải bảng

                text_content_dict[page_num][idx] = {
                    'polygon': polygon,
                    'content': str(row['content']) if pd.notna(row['content']) else '',
                    'color': row['color'] if 'color' in row and pd.notna(row['color']) else '#000000',
                    'fontWeight': row['fontWeight'] if 'fontWeight' in row and pd.notna(row['fontWeight']) else 'normal',
                    'fontStyle': row['fontStyle'] if 'fontStyle' in row and pd.notna(row['fontStyle']) else 'normal',
                    'backgroundColor': row['backgroundColor'] if 'backgroundColor' in row and pd.notna(row['backgroundColor']) else '#ffffff',
                    'line_count': int(row['line_count']) if pd.notna(row.get('line_count')) else 1,
                    'fontSize': final_fontsize
                }

    # Duyệt từng trang
    for page_num in range(1, len(doc) + 1):
        page = doc[page_num - 1]
        
        print(f"📄 Trang {page_num}:")
        
        if page_num not in text_content_dict:
            print(f"  ⚠ Không có dữ liệu cho trang {page_num}")
            continue
        
        items = text_content_dict[page_num]
        
        # Lấy kích thước ảnh pixel
        if page_num in image_dims:
            img_width_px, img_height_px = image_dims[page_num]
        else:
            print(f"  ⚠ Không tìm thấy ảnh cho trang {page_num}")
            continue
        
        # Lấy kích thước PDF
        pdf_page_height = page.rect.height
        pdf_page_width = page.rect.width
        
        print(f"  Ảnh: {img_width_px} x {img_height_px} px (DPI={dpi})")
        print(f"  PDF: {pdf_page_width:.1f} x {pdf_page_height:.1f} pt")
        
        # Tỷ lệ từ pixel sang PDF points
        scale_x = pdf_page_width / img_width_px
        scale_y = pdf_page_height / img_height_px
        
        print(f"  Scale: X={scale_x:.4f}, Y={scale_y:.4f}\n")
        
        textbox_count = 0
        
        # Thêm textbox cho từng item
        for item_idx, item_data in items.items():
            polygon = item_data['polygon']
            content = item_data['content']
            color = item_data.get('color', '#000000')
            bg_color = item_data.get('backgroundColor', '#ffffff')
            
            if not content or not polygon:
                continue
            
            textbox_count += 1
            
            # print(f"  [{textbox_count}] {content[:40]}{'...' if len(content) > 40 else ''}")
            
            # Polygon là flat list [x0, y0, x1, y1, ...] tính theo INCH
            # Lấy min/max
            x_coords = [polygon[i] for i in range(0, len(polygon), 2) if i < len(polygon)]
            y_coords = [polygon[i] for i in range(1, len(polygon), 2) if i < len(polygon)]
            
            if not x_coords or not y_coords:
                print(f"      ⚠ Polygon rỗng")
                continue
            
            x_min, x_max = min(x_coords), max(x_coords)
            y_min, y_max = min(y_coords), max(y_coords)
            
            # Chuyển từ inch sang pixel
            x_min_px = x_min * dpi
            y_min_px = y_min * dpi
            x_max_px = x_max * dpi
            y_max_px = y_max * dpi
            
            # Chuyển từ pixel sang PDF points
            x_min_pt = x_min_px * scale_x
            y_min_pt = y_min_px * scale_y
            x_max_pt = x_max_px * scale_x
            y_max_pt = y_max_px * scale_y
            
            # Áp dụng offset
            x_min_pt += offset_x
            y_min_pt += offset_y
            x_max_pt += offset_x
            y_max_pt += offset_y
            # Không đảo Y - dùng trực tiếp
            rect = fitz.Rect(x_min_pt, y_min_pt, x_max_pt, y_max_pt)
            vertical = is_vertical(rect, content)
            # Tính font size tự động dựa vào line_count
            if item_data.get('fontSize') is not None:
                font_size = item_data['fontSize']
                line_count = item_data.get('line_count', 1)
                if vertical:
                    max_width = rect.height
                else:
                    max_width = rect.width
                lines = wrap_text_to_width(content, font="helv", font_size=font_size, max_width=max_width)
            else:
                if auto_font_size:
                    if type_draw == "paragraph":
                        font_size, lines = calculate_fontsize_auto(rect, content, height_factor=2)
                    else:
                        # Polygon tính theo inch
                        font_size = calculate_font_size_from_rect(
                            rect,
                            content,
                            line_count,
                            height_factor=1.1,
                            min_size=6,
                            max_size=200,
                        )
                        font_size = max(6, font_size)  # Đảm bảo font_size >= 6
                else:
                    font_size = 18
            
            # Chuyển màu từ hex sang RGB
            try:
                # render riêng vùng rect
                pix = page.get_pixmap(clip=rect, dpi=72)

                # chuyển sang numpy array
                img = np.frombuffer(pix.samples, dtype=np.uint8)
                img = img.reshape(pix.height, pix.width, pix.n)

                # tính màu trung bình
                mean_color = img.mean(axis=(0, 1))

                current_rgb = hex_to_rgb(color)

                ratio = contrast_ratio(mean_color, current_rgb)

                if ratio < 1.0:
                    text_color = tuple(c / 255.0 for c in text_color_rgb)
                # thử đen và trắng
                black = [0, 0, 0]
                white = [255, 255, 255]

                if contrast_ratio(mean_color, black) > contrast_ratio(mean_color, white):
                    text_color = (0, 0, 0)
                else:
                    text_color = (1, 1, 1)
            except:
                print("error when conver hex to rgb")
                text_color = (0, 0, 0)
                text_color_rgb = (0, 0, 0)
            
            # Thêm FreeText annotation (textbox tương tác)
            try:
                # print(f"content :{content} has fontsize :{font_size}")
                # Tạo annotation với fontsize đúng
                if vertical:
                    if type_draw == "paragraph":
                        annotation = page.add_freetext_annot(
                            rect,
                            content,
                            fontsize=font_size,
                            fontname="helv",
                            text_color=text_color,
                            fill_color=None,
                            align=1,          # center
                            rotate=90,  
                            # border_color=(0, 0, 0),
                            # border_width=0.5
                        )
                    else:
                        annotation = page.add_freetext_annot(
                            rect,
                            "\n".join(content),
                            fontsize=font_size,
                            fontname="helv",
                            text_color=text_color,
                            fill_color=None,
                            # border_color=(0, 0, 0),
                            # border_width=0.5
                        )
                else:
                    if type_draw == "paragraph":
                        annotation = page.add_freetext_annot(
                            rect,
                            "\n".join(lines),
                            fontsize=font_size,
                            fontname="helv",
                            text_color=text_color,
                            fill_color=None,
                            # border_color=(0, 0, 0),
                            # border_width=0.5
                        )
                    else:
                        annotation = page.add_freetext_annot(
                            rect,
                            content,
                            fontsize=font_size,
                            fontname="helv",
                            text_color=text_color,
                            fill_color=None,
                            # border_color=(0, 0, 0),
                            # border_width=0.5
                        )
                annotation.set_border(width=0)
                # Update annotation - PyMuPDF sẽ tự render appearance
                annotation.update()
                
            except Exception as e:
                print(f"      ⚠ Lỗi thêm textbox: {e}")
        
        if textbox_count == 0:
            print(f"  ⚠ Không có textbox để thêm")
        # else:
        #     print(f"  ✓ Đã thêm {textbox_count} textbox(es)")

    
    # Lưu PDF lần 1
    doc.save(output_pdf_path)
    doc.close()
    
    # Mở lại PDF để regenerate appearance của annotations
    try:
        doc = fitz.open(output_pdf_path)
        for page_num in range(len(doc)):
            page = doc[page_num]
            # Regenerate appearance của tất cả annotations
            for annot in page.annots():
                if annot.type[0] == 13:  # FreeText annotation
                    annot.update()
        
        # Lưu lại
        doc.save(output_pdf_path, incremental=False)
        doc.close()
    except:
        pass  # Nếu lỗi thì bỏ qua
    
    print(f"\n✓ Đã lưu PDF với textbox: {output_pdf_path}\n")


# ============================================================================
# MAIN: LUỒNG HOÀN CHỈNH
# ============================================================================

def main():

    pdf_output = "/Users/loclinh/Documents/TORAY/OCR/newapp1/output_final_vi_1.pdf"
    # xóa chữ
    input_pdf = "/Users/loclinh/Documents/TORAY/OCR/自転車の違反にも青切符2026年4月1日適用.pdf"
    output_folder = "/Users/loclinh/Documents/TORAY/OCR/newapp1/output_images"
    image_folder = output_folder
    json_path = "/Users/loclinh/Documents/TORAY/OCR/newapp1/input/自転車の違反にも青切符2026年4月1日適用.pdf.json"
    df_paragraph_path = "/Users/loclinh/Documents/TORAY/OCR/newapp1/output/paragraph1.csv"
    df_paragraph_translate_path="/Users/loclinh/Documents/TORAY/OCR/newapp1/output/paragraph1_translated.csv"
    df_line_style_path = "/Users/loclinh/Documents/TORAY/OCR/newapp1/output/line_style1.csv"

    # #get dataframe
    # with open(json_path, 'r', encoding='utf-8') as f:
    #     sample_json = json.load(f)
    # df_style, df_paragraph, df_line_style = get_element_dataframe(sample_json)
    # # print(df_table)
    # print(df_paragraph["role"].unique())
    # # df_paragraph.to_csv(df_paragraph_path, index=False)
    # df_line_style.to_csv(df_line_style_path, index=False)

    df, text_content_dict = read_content_from_csv(df_paragraph_translate_path, type_draw="paragraph")

    print(text_content_dict[1])


if __name__ == "__main__":
    main()
