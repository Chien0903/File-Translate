import os
import cv2
import numpy as np
import json
from PIL import Image

try:
    import fitz  # PyMuPDF — cross-platform, không cần Poppler
    _USE_FITZ = True
except ImportError:
    from pdf2image import convert_from_path  # fallback nếu không có fitz
    _USE_FITZ = False


def _convert_pdf_to_pil_images(pdf_path: str, dpi: int = 200):
    """Chuyển PDF thành list PIL Images. Dùng PyMuPDF nếu có, fallback sang pdf2image."""
    if _USE_FITZ:
        doc = fitz.open(pdf_path)
        pages = []
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        for page in doc:
            pix = page.get_pixmap(matrix=mat, alpha=False)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            pages.append(img)
        doc.close()
        return pages
    else:
        return convert_from_path(pdf_path, dpi=dpi)


def inches_to_pix(poly_inch, page_w, page_h, dpi=200):
    """
    Chuyển tọa độ từ inch (PDF) sang pixel (ảnh).
    """
    px_pts = []
    for i in range(0, len(poly_inch), 2):
        x_in = poly_inch[i]
        y_in = poly_inch[i+1]

        px = int(x_in * dpi)
        py = int(y_in * dpi)

        px_pts.append((px, py))
    return px_pts


def offset_polygon(polygon_pts, offset_x=0, offset_y=0):
    """
    Dịch polygon theo X, Y.
    
    Args:
        polygon_pts: list [(x0,y0), (x1,y1), ...] điểm khung
        offset_x: dịch theo trục X (dương=phải, âm=trái)
        offset_y: dịch theo trục Y (dương=dưới, âm=trên)
    
    Returns:
        offset_pts: list điểm sau khi dịch
    """
    if offset_x == 0 and offset_y == 0:
        return polygon_pts
    
    offset_pts = []
    for x, y in polygon_pts:
        offset_pts.append((x + offset_x, y + offset_y))
    
    return offset_pts


def shrink_polygon_cv2(polygon_pts, shrink_pixels=5):
    """
    Thu nhỏ polygon bằng OpenCV morphological erosion.
    
    Args:
        polygon_pts: list [(x0,y0), (x1,y1), ...] điểm khung
        shrink_pixels: số pixel cần thu nhỏ
    
    Returns:
        shrunk_pts: list điểm sau khi thu nhỏ
    """
    if len(polygon_pts) < 3 or shrink_pixels == 0:
        return polygon_pts
    
    # Tạo ảnh mask với polygon
    pts_array = np.array(polygon_pts, dtype=np.int32)
    
    # Tìm bounding box để biết kích thước ảnh
    x_coords = [p[0] for p in polygon_pts]
    y_coords = [p[1] for p in polygon_pts]
    min_x, max_x = min(x_coords), max(x_coords)
    min_y, max_y = min(y_coords), max(y_coords)
    
    # Thêm margin để tránh cắt
    margin = abs(shrink_pixels) + 10
    img_h = int(max_y - min_y) + margin * 2
    img_w = int(max_x - min_x) + margin * 2
    
    # Tạo mask
    mask = np.zeros((img_h, img_w), dtype=np.uint8)
    
    # Shift polygon để fit vào ảnh mask
    shifted_pts = pts_array - np.array([min_x, min_y]) + margin
    cv2.fillPoly(mask, [shifted_pts.astype(np.int32)], 255)
    
    # Erosion để shrink
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, 
                                       (abs(shrink_pixels) * 2 + 1, abs(shrink_pixels) * 2 + 1))
    eroded = cv2.erode(mask, kernel, iterations=1)
    
    # Tìm contour từ ảnh eroded
    contours, _ = cv2.findContours(eroded, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        print("  ⚠ Shrink quá lớn, polygon biến mất. Dùng polygon gốc.")
        return polygon_pts
    
    # Lấy contour lớn nhất
    largest_contour = max(contours, key=cv2.contourArea)
    
    # Chuyển lại tọa độ gốc
    shrunk_pts = []
    for pt in largest_contour:
        x = int(pt[0][0] + min_x - margin)
        y = int(pt[0][1] + min_y - margin)
        shrunk_pts.append((x, y))
    
    return shrunk_pts


def expand_polygon_cv2(polygon_pts, expand_pixels=5):
    """
    Mở rộng polygon bằng OpenCV morphological dilation.
    
    Args:
        polygon_pts: list [(x0,y0), (x1,y1), ...] điểm khung
        expand_pixels: số pixel cần mở rộng
    
    Returns:
        expanded_pts: list điểm sau khi mở rộng
    """
    if len(polygon_pts) < 3 or expand_pixels == 0:
        return polygon_pts
    
    # Tạo ảnh mask với polygon
    pts_array = np.array(polygon_pts, dtype=np.int32)
    
    # Tìm bounding box
    x_coords = [p[0] for p in polygon_pts]
    y_coords = [p[1] for p in polygon_pts]
    min_x, max_x = min(x_coords), max(x_coords)
    min_y, max_y = min(y_coords), max(y_coords)
    
    # Thêm margin
    margin = expand_pixels + 10
    img_h = int(max_y - min_y) + margin * 2
    img_w = int(max_x - min_x) + margin * 2
    
    # Tạo mask
    mask = np.zeros((img_h, img_w), dtype=np.uint8)
    
    # Shift polygon
    shifted_pts = pts_array - np.array([min_x, min_y]) + margin
    cv2.fillPoly(mask, [shifted_pts.astype(np.int32)], 255)
    
    # Dilation để expand
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, 
                                       (expand_pixels * 2 + 1, expand_pixels * 2 + 1))
    dilated = cv2.dilate(mask, kernel, iterations=1)
    
    # Tìm contour từ ảnh dilated
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        print("  ⚠ Expand thất bại. Dùng polygon gốc.")
        return polygon_pts
    
    # Lấy contour lớn nhất
    largest_contour = max(contours, key=cv2.contourArea)
    
    # Chuyển lại tọa độ gốc
    expanded_pts = []
    for pt in largest_contour:
        x = int(pt[0][0] + min_x - margin)
        y = int(pt[0][1] + min_y - margin)
        expanded_pts.append((x, y))
    
    return expanded_pts


def get_dominant_color(img, polygon_pts, color_shrink_pixels=0):
    """
    Tìm màu dominant (phổ biến nhất) trong khung polygon.
    
    Args:
        img: ảnh OpenCV (BGR)
        polygon_pts: list [(x0,y0), (x1,y1), ...] điểm khung
        color_shrink_pixels: thu nhỏ vùng lấy màu (dương=shrink, âm=expand, 0=dùng polygon gốc)
    
    Returns:
        color: tuple (B, G, R) - màu dominant (INT)
    """
    # Nếu color_shrink_pixels != 0, shrink/expand vùng lấy màu
    color_pts = polygon_pts
    if color_shrink_pixels > 0:
        color_pts = shrink_polygon_cv2(polygon_pts, color_shrink_pixels)
    elif color_shrink_pixels < 0:
        color_pts = expand_polygon_cv2(polygon_pts, -color_shrink_pixels)
    
    # Tạo mask từ polygon
    h, w = img.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)
    pts_array = np.array(color_pts, dtype=np.int32)
    cv2.fillPoly(mask, [pts_array], 255)
    
    # Lấy pixel trong polygon
    pixels_in_polygon = img[mask == 255]
    
    if len(pixels_in_polygon) == 0:
        print("  ⚠ Polygon rỗng, dùng màu trắng mặc định")
        return (255, 255, 255)  # Trắng (BGR)
    
    # Reshape thành danh sách màu
    pixels_list = pixels_in_polygon.reshape(-1, 3)
    
    # Tìm màu phổ biến nhất (với tolerance)
    # Nhóm các màu gần nhau (tolerance 10)
    colors_rounded = np.round(pixels_list / 10) * 10
    colors_rounded = colors_rounded.astype(int)
    
    # Đếm tần suất
    color_counts = {}
    for color in colors_rounded:
        color_tuple = tuple(color)
        color_counts[color_tuple] = color_counts.get(color_tuple, 0) + 1
    
    # Màu phổ biến nhất
    dominant_color = max(color_counts, key=color_counts.get)
    
    # ✅ Chuyển thành tuple của int
    dominant_color = tuple(int(x) for x in dominant_color)
    
    # print(f"  🎨 Màu dominant: BGR{dominant_color} | RGB{dominant_color[::-1]}")
    
    return dominant_color


def fill_polygon_with_color(img, polygon_pts, color=None):
    """
    Vẽ (fill) một polygon với màu chỉ định.
    Nếu không chỉ định màu, sẽ tìm màu dominant trong polygon.
    
    Args:
        img: ảnh OpenCV (BGR)
        polygon_pts: list [(x0,y0), (x1,y1), ...] điểm khung
        color: tuple (B, G, R) hoặc None để tự động tìm
    
    Returns:
        img: ảnh đã fill
    """
    # Nếu không có màu, tìm màu dominant
    if color is None:
        color = get_dominant_color(img, polygon_pts)
    else:
        # ✅ Chuyển color thành tuple nếu cần
        color = tuple(int(x) for x in color)
    
    # Fill polygon
    pts_array = np.array(polygon_pts, dtype=np.int32)
    cv2.fillPoly(img, [pts_array], color)
    
    return img


def inpaint_image(img, polygons_pdf, page_width_in, page_height_in, dpi=200,
                  inpaint_radius=3, method=cv2.INPAINT_TELEA):
    """
    Inpaint polygon dựa trên coords PDF theo inch.
    """
    h, w = img.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)

    for flat in polygons_pdf:
        pts = inches_to_pix(flat, page_width_in, page_height_in, dpi)
        pts_array = np.array(pts, dtype=np.int32)
        cv2.fillPoly(mask, [pts_array], 255)

    result = cv2.inpaint(img, mask, inpaint_radius, method)
    return result


def fill_polygons_with_detected_color(img, polygons_pdf, page_width_in, page_height_in, 
                                     dpi=200, shrink_pixels=0, color_shrink_pixels=0,
                                     offset_x=0, offset_y=0):
    """
    Fill các polygon với màu background được nhận diện.
    
    Args:
        img: ảnh OpenCV (BGR)
        polygons_pdf: list polygon dạng flat [x0,y0,x1,y1,...]
        page_width_in: chiều ngang trang PDF (inch)
        page_height_in: chiều cao trang PDF (inch)
        dpi: độ phân giải
        shrink_pixels: thu nhỏ polygon khi fill (dương=shrink, âm=expand)
        color_shrink_pixels: thu nhỏ vùng lấy màu (dương=shrink, âm=expand)
        offset_x: dịch theo X
        offset_y: dịch theo Y
    
    Returns:
        img: ảnh đã fill
    """
    for idx, flat in enumerate(polygons_pdf):
        # print(f"  Polygon {idx + 1}/{len(polygons_pdf)}:")
        pts = inches_to_pix(flat, page_width_in, page_height_in, dpi)
        
        # Dịch polygon nếu cần
        if offset_x != 0 or offset_y != 0:
            # print(f"    📍 Offset X={offset_x}, Y={offset_y}")
            pts = offset_polygon(pts, offset_x, offset_y)
        
        # Thu nhỏ hoặc mở rộng polygon khi fill nếu cần
        if shrink_pixels > 0:
            # print(f"    📍 Thu nhỏ (fill) {shrink_pixels} pixel")
            pts = shrink_polygon_cv2(pts, shrink_pixels)
        elif shrink_pixels < 0:
            # print(f"    📍 Mở rộng (fill) {-shrink_pixels} pixel")
            pts = expand_polygon_cv2(pts, -shrink_pixels)
        
        # Tìm màu dominant trong polygon (với thu nhỏ riêng nếu cần)
        # if color_shrink_pixels > 0:
        #     print(f"    🎨 Lấy màu từ vùng thu nhỏ {color_shrink_pixels} pixel")
        # elif color_shrink_pixels < 0:
        #     print(f"    🎨 Lấy màu từ vùng mở rộng {-color_shrink_pixels} pixel")
        
        color = get_dominant_color(img, pts, color_shrink_pixels)
        
        # ✅ Đảm bảo color là tuple của int
        color = tuple(int(x) for x in color)
        
        # Fill polygon với màu đó
        img = fill_polygon_with_color(img, pts, color)
    
    return img


def get_polygons_from_json(json_file_path, type='paragraph'):
    """
    Đọc file JSON chứa thông tin polygons cho từng trang.
    """
    with open(json_file_path, 'r', encoding='utf-8') as f:
        ocr_data = json.load(f)
    
    poligondict = {}
    pages_width = []
    pages_height = []
    
    for page in ocr_data.get('pages', []):
        pages_width.append(page['width'])
        pages_height.append(page['height'])
    
    if type == 'paragraph':
        para_data = ocr_data.get('paragraphs', [])
        for item in para_data:
            page_num = item["boundingRegions"][0]['pageNumber']
            if page_num not in poligondict:
                poligondict[page_num] = []
            poligondict[page_num].append(item["boundingRegions"][0]['polygon'])
    
    elif type == 'line':
        line_data = ocr_data.get('pages', [])
        for page in line_data:
            page_num = page['pageNumber']
            if page_num not in poligondict:
                poligondict[page_num] = []
            for item in page.get('lines', []):
                poligondict[page_num].append(item['polygon'])
    
    elif type == 'word':
        word_data = ocr_data.get('pages', [])
        for page in word_data:
            page_num = page['pageNumber']
            if page_num not in poligondict:
                poligondict[page_num] = []
            for item in page.get('words', []):
                poligondict[page_num].append(item['polygon'])
    
    return poligondict, pages_width, pages_height


def process_pdf_fill_color(input_pdf, output_folder, polygons_dict, pages_width, pages_height,
                           method='fill_color', shrink_pixels=0, color_shrink_pixels=0,
                           offset_x=0, offset_y=0):
    """
    Xử lý PDF: fill polygon với màu background hoặc inpaint.
    
    Args:
        input_pdf: đường dẫn file PDF
        output_folder: thư mục lưu ảnh
        polygons_dict: dict {page_number: [polygons]}
        pages_width: list chiều rộng các trang
        pages_height: list chiều cao các trang
        method: 'fill_color' (vẽ đè) hoặc 'inpaint' (inpaint)
        shrink_pixels: thu nhỏ polygon khi fill (dương=shrink, âm=expand)
        color_shrink_pixels: thu nhỏ vùng lấy màu (dương=shrink, âm=expand)
        offset_x: dịch X
        offset_y: dịch Y
    """
    dpi = 800
    os.makedirs(output_folder, exist_ok=True)

    pages = _convert_pdf_to_pil_images(input_pdf, dpi=dpi)

    for i, pil_img in enumerate(pages):
        page_num = i + 1
        print(f"\n{'='*70}")
        print(f"📄 Đang xử lý trang {page_num}/{len(pages)}...")
        print(f"{'='*70}")
        
        img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        h, w = img.shape[:2]
        print(f"✓ Ảnh trang {page_num}: {w} px × {h} px")

        polygons = polygons_dict.get(page_num, [])
        page_w_in = pages_width[i]
        page_h_in = pages_height[i]
        
        if polygons:
            print(f"✓ Tìm thấy {len(polygons)} polygon(s)")
            
            if method == 'fill_color':
                # print(f"\n🎨 Chế độ: Nhận diện màu và vẽ đè")
                # if shrink_pixels > 0:
                #     print(f"📍 Thu nhỏ (fill): {shrink_pixels} pixel")
                # elif shrink_pixels < 0:
                #     print(f"📍 Mở rộng (fill): {-shrink_pixels} pixel")
                # if color_shrink_pixels > 0:
                #     print(f"🎨 Thu nhỏ (color): {color_shrink_pixels} pixel")
                # elif color_shrink_pixels < 0:
                #     print(f"🎨 Mở rộng (color): {-color_shrink_pixels} pixel")
                # if offset_x != 0 or offset_y != 0:
                #     print(f"📍 Offset: X={offset_x}, Y={offset_y}")
                # print()
                img = fill_polygons_with_detected_color(img, polygons, page_w_in, page_h_in, 
                                                       dpi=dpi, shrink_pixels=shrink_pixels,
                                                       color_shrink_pixels=color_shrink_pixels,
                                                       offset_x=offset_x, offset_y=offset_y)
            
            elif method == 'inpaint':
                print(f"\n🔨 Chế độ: Inpaint\n")
                img = inpaint_image(img, polygons, page_w_in, page_h_in, dpi=dpi,
                                   inpaint_radius=3, method=cv2.INPAINT_TELEA)
            
            print(f"\n✓ Hoàn tất xử lý")
        else:
            print(f"⚠ Không có polygon để xử lý")

        out_path = os.path.join(output_folder, f"page_{page_num:03d}.png")
        cv2.imwrite(out_path, img)
        print(f"✓ Đã lưu: {out_path}")

    print(f"\n{'='*70}")
    print("✅ Hoàn tất toàn bộ quá trình!")
    print(f"{'='*70}\n")


if __name__ == "__main__":
    input_pdf = "/Users/loclinh/Documents/TORAY/OCR/自転車の違反にも青切符2026年4月1日適用.pdf"
    output_folder = "/Users/loclinh/Documents/TORAY/OCR/newapp1/output_images"
    json_file_path = "/Users/loclinh/Documents/TORAY/OCR/newapp/input/自転車の違反にも青切符2026年4月1日適用.pdf.json"
    
    try:
        polygons_dict, pages_width, pages_height = get_polygons_from_json(json_file_path, type='line')
        print(f"✓ Đã load JSON: {len(polygons_dict)} trang có dữ liệu\n")
        
        # 🎯 ĐIỀU CHỈNH TẠI ĐÂY
        # shrink_pixels: thu nhỏ polygon khi fill
        #   - 0: không thay đổi
        #   - 5: thu nhỏ 5 pixel
        #   - -5: mở rộng 5 pixel
        #
        # color_shrink_pixels: thu nhỏ vùng lấy màu background
        #   - 0: dùng polygon gốc để lấy màu
        #   - 5: thu nhỏ vùng lấy màu 5 pixel (để tránh lấy màu từ viền)
        #   - -5: mở rộng vùng lấy màu 5 pixel
        #
        # offset_x, offset_y: dịch vị trí
        #   - offset_x > 0: dịch sang phải
        #   - offset_x < 0: dịch sang trái
        #   - offset_y > 0: dịch xuống dưới
        #   - offset_y < 0: dịch lên trên
        
        process_pdf_fill_color(input_pdf, output_folder, polygons_dict, pages_width, pages_height,
                              method='fill_color',           # 🎨 Vẽ đè với màu detected
                              shrink_pixels=0,              # 📍 Thu nhỏ polygon 5 pixel khi fill
                              color_shrink_pixels=-18,        # 🎨 Thu nhỏ vùng lấy màu 3 pixel
                              offset_x=1,                   # 📍 Không dịch X
                              offset_y=-2)                   # 📍 Không dịch Y
        
    except FileNotFoundError as e:
        print(f"❌ Lỗi: File không tìm thấy - {e}")
    except json.JSONDecodeError as e:
        print(f"❌ Lỗi: JSON không hợp lệ - {e}")
    except Exception as e:
        print(f"❌ Lỗi: {e}")
        import traceback
        traceback.print_exc()
