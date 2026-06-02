from .utils.add_text import *
from .utils.getElementDataframe import *
from .utils.inpaint import *
from .utils.preprocess_file import *
from .utils.translate import *
from .utils.OCR_azure import *
import json
import os
import time
import shutil
from .detect_lang import detect_language, LANGUAGES, language_pair
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache

def translate_pdf_ocr(input_pdf, target_language=None, source_language=None):
    pdf_output = input_pdf.replace(".pdf", f"_{target_language}.pdf")
    # Tạo thư mục ảnh tạm cạnh file PDF đầu vào (cross-platform, không hardcode Linux path)
    input_dir = os.path.dirname(os.path.abspath(input_pdf))
    image_folder = os.path.join(input_dir, "images_temp_ocr")
    os.makedirs(image_folder, exist_ok=True)
    json_path = input_pdf.replace(".pdf", "temp_jsonfile.json")
    df_paragraph_path = input_pdf.replace(".pdf", "temp_df_paragraph.csv")
    df_paragraph_translate_path=input_pdf.replace(".pdf", "temp_df_paragraph_translate.csv")
    df_line_style_path = input_pdf.replace(".pdf", "temp_df_line.csv")

    # OCR with azure
    analyze_layout_azure(input_pdf, json_path)
    #get dataframe
    with open(json_path, 'r', encoding='utf-8') as f:
        sample_json = json.load(f)

    if source_language is None:
        first_content = sample_json.get("content", [])[:1000]
        source_language = detect_language(first_content)


    _, df_paragraph, df_line_style = get_element_dataframe(sample_json)
    df_line_style.to_csv(df_line_style_path, index=False)
    df_paragraph.to_csv(df_paragraph_path, index=False)

    try:
        polygons_dict, pages_width, pages_height = get_polygons_from_json(json_path, type='line')
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
        
        process_pdf_fill_color(input_pdf, image_folder, polygons_dict, pages_width, pages_height,
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

    #Gộp ảnh thành PDF và thêm textbox từ CSV
    """
    Pipeline hoàn chỉnh:
    1. Gộp ảnh thành PDF
    2. Đọc dữ liệu từ CSV
    3. Thêm textbox vào PDF
    """
        
    glossary_id = None
    if source_language in LANGUAGES:
        print("Translate with glossary")
        pair_code = f"{source_language}-{target_language}" if f"{source_language}-{target_language}" in language_pair.keys() else f"{target_language}-{source_language}"
        if pair_code in language_pair:
            glossary_id = f"toray_translation_glossary_{language_pair[pair_code]}"
        else:
            print(f"ℹ No glossary for pair {source_language}->{target_language}. Translating without glossary.")
    else:
        print("Translate without glossary")
    if source_language != target_language:
        process_csv(
            input_path=df_paragraph_path,
            output_path=df_paragraph_translate_path,
            glossary_id=glossary_id,
            source_lang_code=source_language,
            target_lang_code=target_language
        )
        type_draw = "paragraph"
        content_draw_path = df_paragraph_translate_path
    else:
        type_draw = "line"
        content_draw_path = df_line_style_path
    
    
    dpi = 800
    
    # 🎯 ĐIỀU CHỈNH OFFSET TEXTBOX
    offset_x = 15      # Dịch textbox theo X (pt, âm=trái, dương=phải)
    offset_y = 10      # Dịch textbox theo Y (pt, âm=trên, dương=dưới)
    auto_font_size = True  # Tự động tính font size
        


    try:
        print(f"\n{'#'*70}")
        print("# LUỒNG: ẢNH → PDF → TEXTBOX (VỚI DỮ LIỆU CSV)")
        print(f"#'*70\n")
        
        # ===== BƯỚC 1: GỘP ẢNH THÀNH PDF =====
        base_pdf = images_to_pdf(image_folder, pdf_output + ".tmp", dpi=dpi)
        
        # ===== BƯỚC 3: THÊM TEXTBOX VÀO PDF =====
        add_textboxes_to_pdf_from_csv(
            base_pdf,
            pdf_output,
            content_draw_path,
            image_folder,
            offset_x=offset_x,
            offset_y=offset_y,
            dpi=dpi,
            auto_font_size=auto_font_size,
            type_draw=type_draw
        )
        
        # Xóa PDF tạm
        if os.path.exists(pdf_output + ".tmp"):
            os.remove(pdf_output + ".tmp")

        for filename in os.listdir(image_folder):
            file_path = os.path.join(image_folder, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.remove(file_path)      # xóa file
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)  # xóa folder con
            except Exception as e:
                print(f"Không thể xóa {file_path}. Lý do: {e}")
        print(f"✓ Đã xóa các file ảnh tạm trong {image_folder}")

        print(f"{'='*70}")
        print("✅ HOÀN TẤT LUỒNG!")
        print(f"{'='*70}")
        print(f"\n📄 PDF cuối cùng: {pdf_output}\n")

        if os.path.exists(json_path):
            os.remove(json_path)
        if os.path.exists(df_paragraph_path):
            os.remove(df_paragraph_path)
        if os.path.exists(df_paragraph_translate_path):
            os.remove(df_paragraph_translate_path)
        if os.path.exists(df_line_style_path):
            os.remove(df_line_style_path)

    
    except FileNotFoundError as e:
        print(f"❌ Lỗi: File không tìm thấy - {e}")
        raise
    except Exception as e:
        print(f"❌ Lỗi: {e}")
        import traceback
        traceback.print_exc()
        raise

    return source_language

    
if __name__ == "__main__":
    translate_pdf_ocr("/home/ubuntu/Toray_Multilanguage_transolator/Translate_v2/OCR/自転車の違反にも青切符2026年4月1日適用.pdf", target_language ="vi")
