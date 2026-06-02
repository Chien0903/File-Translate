import os
import shutil
import sys
import docx
import openpyxl
import pypdf as PyPDF2
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny,IsAuthenticated
from dotenv import load_dotenv
import tempfile
import uuid
import requests
from ..models.translated_file import TranslatedFile
from ..models.keyword import PrivateKeyword
from ..services.upload_to_s3 import upload_file_path_to_s3
import logging

# Cấu hình logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Thêm Translate_v2 vào PYTHONPATH
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '../../../../'))
translate_v2_dir = os.path.join(project_root, 'Translate_v2')
if project_root not in sys.path:
    sys.path.append(project_root)
if translate_v2_dir not in sys.path:
    sys.path.append(translate_v2_dir)

try:
    from Translate_v2.translate_docx import translate_docx
    from Translate_v2.translate_xlsx import translate_xlsx
    from Translate_v2.translate_pptx import translate_pptx
    from Translate_v2.translate_pdf_ocr import translate_pdf_ocr
    from Translate_v2.detect_lang import detect_language, extract_content, LANGUAGES
    # CRITICAL: import from bare 'translate_text' (NOT 'Translate_v2.translate_text')
    # because translate_docx_traditional.py uses "from translate_text import ..."
    # Both must resolve to the SAME module instance to share _translation_context thread-local.
    import translate_text as _translate_text_module
    translate_text_with_glossary = _translate_text_module.translate_text_with_glossary
    set_translation_context = _translate_text_module.set_translation_context
    clear_translation_context = _translate_text_module.clear_translation_context
    from Translate_v2.create_glossary import language_pair
    # Sử dụng ConvertAPI cho chuyển đổi PDF -> DOCX trong luồng dịch
    from ..services.convert_api import pdf_to_docx as convertapi_pdf_to_docx
    logger.info("✅ Đã import thành công các module cần thiết")
except ImportError as e:
    logger.error(f"❌ Lỗi khi import module: {str(e)}")
    raise

load_dotenv()

# Lấy giá trị từ biến môi trường
PROJECT_ID = os.getenv("PROJECT_ID")
GOOGLE_CREDENTIALS_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = GOOGLE_CREDENTIALS_PATH

OCR_KEYWORDS = ("ocr", "tesseract", "abbyy", "ocrmypdf", "ocrengine", "ocropus", "adobe pdf output intent", "ocr.scanned")
MIN_TEXT_CHARS = 20       # tối thiểu ký tự để coi là "có text có ý nghĩa"
FULL_PAGE_RATIO = 2.0     # nếu image_pixels / page_points >= ratio => coi là full-page image

def _metadata_indicates_ocr(reader):
    try:
        # PyPDF2 PdfReader.metadata returns a DocumentInformation-like mapping (e.g. '/Producer', '/Creator', '/Title', ...)
        md = reader.metadata
        if not md:
            return False
        joined = " ".join(str(v).lower() for v in md.values() if v)
        for kw in OCR_KEYWORDS:
            if kw in joined:
                return True
    except Exception:
        pass
    return False

def _resolve(obj):
    """Resolve a pypdf IndirectObject to its concrete value."""
    try:
        if hasattr(obj, 'get_object'):
            return obj.get_object()
    except Exception:
        pass
    return obj

def _safe_get(obj, key):
    """Safely get a key from a pypdf dictionary object."""
    try:
        if obj is None:
            return None
        return obj.get(key)
    except Exception:
        return None

def _get_page_size_pts(page):
    """Return (width_pts, height_pts) for a pypdf PageObject."""
    try:
        mb = page.mediabox
        return float(mb.width), float(mb.height)
    except Exception:
        pass
    try:
        mb = _resolve(page.get("/MediaBox"))
        if mb and len(mb) >= 4:
            return float(mb[2]) - float(mb[0]), float(mb[3]) - float(mb[1])
    except Exception:
        pass
    return None, None

def _page_full_page_image(page, ratio_threshold=FULL_PAGE_RATIO):
    """
    Trả về True nếu page có ít nhất 1 XObject image có kích thước pixel so với page points lớn hơn threshold.
    heuristic: image_width_pixels / page_width_pts >= ratio_threshold AND same for height
    """
    try:
        resources = page.get("/Resources")
        resources = _resolve(resources) if resources is not None else None
        if not resources:
            return False
        xobject = resources.get("/XObject")
        xobject = _resolve(xobject) if xobject is not None else None
        if not xobject:
            return False

        page_w_pts, page_h_pts = _get_page_size_pts(page)
        if not page_w_pts or not page_h_pts:
            page_w_pts, page_h_pts = 0, 0

        for key in xobject:
            obj = _resolve(xobject[key])
            subtype = _safe_get(obj, "/Subtype")
            if subtype and str(subtype).lower().endswith("image"):
                img_w = _safe_get(obj, "/Width")
                img_h = _safe_get(obj, "/Height")
                try:
                    img_w = float(img_w) if img_w is not None else None
                    img_h = float(img_h) if img_h is not None else None
                except Exception:
                    img_w, img_h = None, None

                if img_w and img_h and page_w_pts and page_h_pts:
                    w_ratio = img_w / page_w_pts
                    h_ratio = img_h / page_h_pts
                    if w_ratio >= ratio_threshold and h_ratio >= ratio_threshold:
                        return True
                else:
                    # fallback khi thiếu kích thước trang: dùng pixel size của ảnh
                    if img_w and img_h and max(img_w, img_h) >= 1000:
                        return True
        return False
    except Exception:
        return False
    

def is_pdf_truly_editable(pdf_path: str) -> bool:
    """
    Trả về True chỉ khi PDF có ít nhất 1 trang native text (text gốc, không phải OCR overlay).
    Nếu toàn bộ trang là image-only hoặc OCR-overlay => reject (False).
    """
    with open(pdf_path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        total = len(reader.pages)
        native_text_pages = 0
        ocr_overlay_pages = 0
        image_only_pages = 0
        ambiguous_pages = 0

        for i, page in enumerate(reader.pages, start=1):
            # extract text
            try:
                text = page.extract_text() or ""
                text = text.strip()
            except Exception:
                text = ""

            has_text = len(text) >= MIN_TEXT_CHARS

            has_full_image = _page_full_page_image(page)

            # classify
            if has_text and not has_full_image:
                native_text_pages += 1
            elif has_text and has_full_image:
                ocr_overlay_pages += 1
            elif (not has_text) and has_full_image:
                image_only_pages += 1
            else:
                ambiguous_pages += 1

        # Check metadata for OCR hints
        meta_ocr = _metadata_indicates_ocr(reader)
        if meta_ocr:
            print("Metadata suggests OCR/ocr tool present.")

        # Decision:
        if native_text_pages > 0:
            print(f"Native text pages: {native_text_pages}/{total} => ACCEPT (editable).")
            return True

        # Không có trang native text:
        print(f"No native text pages. ocr_overlay={ocr_overlay_pages}, image_only={image_only_pages}, ambiguous={ambiguous_pages}")
        if ocr_overlay_pages > 0:
            print("Detected OCR overlay pages -> REJECT (OCR-editable/scan).")
            return False
        if image_only_pages > 0:
            print("Detected image-only pages (scan) -> REJECT.")
            return False
        # ambiguous (no text and no detected XObject images)
        print("No text and no large image detected across pages -> REJECT (ambiguous/empty).")
        return False

# ======= Hàm dịch tài liệu =======
def translate_document(file_path: str, target_language: str, original_file_url: str, original_language: str = None, original_file_name: str = None):
    file_extension = file_path.split(".")[-1].lower()
    logger.info(f"🔄 Bắt đầu dịch file: {file_path}")
    logger.info(f"📝 Định dạng file: {file_extension}")
    
    # Sử dụng ngôn ngữ được chọn hoặc auto-detect nếu không có
    if original_language:
        logger.info(f"🌍 Sử dụng ngôn ngữ được chọn: {original_language}")
        source_language = original_language
    else:
        if file_extension in ["pdf", "xls", "xlsm", "xlsb", "csv"]:
            # Các định dạng cần chuyển đổi trước khi detect
            source_language = None
        else:
            try:
                source_language = detect_language(extract_content(file_path))
                logger.info(f"🌍 Ngôn ngữ phát hiện được: {source_language}")
            except Exception as e:
                logger.error(f"❌ Lỗi khi phát hiện ngôn ngữ: {str(e)}")
                raise

    # Tạo đường dẫn file tạm
    base_name = file_path.rsplit(".", 1)[0]
    translated_file_path = f"{base_name}_{target_language}.{file_extension}"
    logger.info(f"📂 Đường dẫn file dịch: {translated_file_path}")

    temp_files = []  # Danh sách các file tạm cần xóa

    # Chỉ gọi một lần, dùng lại ở cả routing lẫn xác định final_extension
    pdf_is_editable = is_pdf_truly_editable(file_path) if file_extension == "pdf" else None

    try:
        if file_extension == "pdf":
            if pdf_is_editable:
                logger.info("🔄 Xử lý file PDF (ConvertAPI → DOCX)")
                # Tạo thư mục tạm để chứa file DOCX sau convert
                convert_output_dir = tempfile.mkdtemp()
                temp_files.append(convert_output_dir)  # sẽ xóa cả thư mục ở finally

                # Gọi ConvertAPI để chuyển PDF → DOCX (lưu file vào convert_output_dir)
                success = convertapi_pdf_to_docx(file_path, convert_output_dir)
                if not success:
                    logger.error("❌ ConvertAPI: chuyển PDF sang DOCX thất bại")
                    raise Exception("Failed to convert PDF to DOCX via ConvertAPI")

                # Tìm file DOCX đã convert
                converted_docx_files = [
                    os.path.join(convert_output_dir, f) for f in os.listdir(convert_output_dir)
                    if f.lower().endswith('.docx')
                ]
                if not converted_docx_files:
                    logger.error("❌ ConvertAPI: không tìm thấy file DOCX sau khi convert")
                    raise Exception("No DOCX produced by ConvertAPI")

                docx_path = converted_docx_files[0]
                logger.info(f"✅ Đã chuyển PDF sang DOCX: {docx_path}")

                # Detect language sau khi convert (nếu chưa có)
                if source_language is None:
                    try:
                        source_language = detect_language(extract_content(docx_path))
                        logger.info(f"🌍 Ngôn ngữ phát hiện được sau convert: {source_language}")
                    except Exception as e:
                        logger.error(f"❌ Lỗi khi phát hiện ngôn ngữ sau convert: {str(e)}")
                        raise

                # Dịch DOCX cho ngôn ngữ đích cụ thể
                translate_docx(docx_path, target_language, source_language)
                logger.info("✅ Đã dịch DOCX")

                # Trả về file DOCX đã dịch (không chuyển lại thành PDF)
                translated_docx_path = docx_path.replace(".docx", f"_{target_language}.docx")
                logger.info(f"✅ File PDF được dịch và trả về dưới dạng DOCX: {translated_docx_path}")
                translated_file_path = translated_docx_path
            else:
                logger.info("🔄 Running OCR pipeline...")
                try:
                    detected_lang = translate_pdf_ocr(file_path, target_language, source_language)
                    # Cập nhật source_language nếu OCR detect được (trường hợp user không chọn ngôn ngữ gốc)
                    if detected_lang and not source_language:
                        source_language = detected_lang
                        logger.info(f"🌍 Ngôn ngữ phát hiện từ OCR: {source_language}")
                    translate_pdf_file = file_path.replace(".pdf", f"_{target_language}.pdf")
                    logger.info(f"✅ File PDF được dịch bằng OCR và trả về dưới dạng PDF: {translate_pdf_file}")
                    translated_file_path = translate_pdf_file
                except Exception as e:
                    logger.warning(f"OCR pipeline failed:{e}")
                    raise Exception(f"Pipeline OCR failed: {e}")

        elif file_extension == "docx":
            logger.info("🔄 Xử lý file DOCX")
            # Dịch DOCX cho ngôn ngữ đích cụ thể
            translate_docx(file_path, target_language, source_language)
            logger.info("✅ Đã dịch DOCX")
            
        elif file_extension == "xlsx":
            logger.info("🔄 Xử lý file XLSX")
            translate_xlsx(file_path, target_language, source_language)
            logger.info("✅ Đã dịch XLSX")
            
        elif file_extension in ["xlsm", "xlsb", "xls", "csv"]:
            logger.info("🔄 Chuyển đổi bảng tính sang XLSX bằng ConvertAPI")
            from ..services.convert_api import to_xlsx
            temp_dir = tempfile.mkdtemp()
            converted_xlsx = to_xlsx(file_path, temp_dir)
            temp_files.append(converted_xlsx)
            logger.info(f"✅ Đã chuyển sang XLSX: {converted_xlsx}")
            # Detect language sau khi convert (nếu chưa có)
            if source_language is None:
                try:
                    source_language = detect_language(extract_content(converted_xlsx))
                    logger.info(f"🌍 Ngôn ngữ phát hiện được sau convert: {source_language}")
                except Exception as e:
                    logger.error(f"❌ Lỗi khi phát hiện ngôn ngữ sau convert: {str(e)}")
                    raise
            translate_xlsx(converted_xlsx, target_language, source_language)
            logger.info("✅ Đã dịch XLSX sau chuyển đổi")
            translated_file_path = converted_xlsx.replace(".xlsx", f"_{target_language}.xlsx")
            
        
        elif file_extension == "pptx":
            logger.info("🔄 Xử lý file PPTX")
            translate_pptx(file_path, target_language, source_language)
            logger.info("✅ Đã dịch PPTX")
            
        else:
            logger.error(f"❌ Định dạng file không được hỗ trợ: {file_extension}")
            raise Exception("Unsupported file type")

        # Kiểm tra file dịch có tồn tại không
        if not os.path.exists(translated_file_path):
            logger.error(f"❌ Không tìm thấy file dịch: {translated_file_path}")
            # Kiểm tra xem file gốc có bị thay đổi không
            if os.path.exists(file_path):
                logger.info("✅ File gốc vẫn tồn tại")
                # Thử tạo file dịch từ file gốc
                if file_extension == "docx":
                    translate_docx(file_path, target_language, source_language)
                elif file_extension == "xlsx":
                    translate_xlsx(file_path, target_language, source_language)
                elif file_extension == "pptx":
                    translate_pptx(file_path, target_language, source_language)
                logger.info("🔄 Đã thử dịch lại file")
            else:
                logger.error("❌ File gốc không tồn tại")
            raise Exception(f"Translated file not found: {translated_file_path}")

        # Kiểm tra kích thước file dịch
        file_size = os.path.getsize(translated_file_path)
        if file_size == 0:
            logger.error("❌ File dịch có kích thước 0 bytes")
            raise Exception("Translated file is empty")

        logger.info(f"✅ File dịch tồn tại và có kích thước {file_size} bytes")

        # Tạo object name + upload lên S3
        bucket_name = os.getenv('AWS_STORAGE_BUCKET_NAME')
        # PDF editable → trả DOCX | PDF scan → giữ PDF | các định dạng khác → giữ nguyên
        final_extension = (
            "docx" if file_extension == "pdf" and pdf_is_editable
            else "xlsx" if file_extension in ["xlsm", "xlsb", "xls", "csv"]
            else file_extension
        )
        hash_name = f"{uuid.uuid4().hex}.{final_extension}"
        object_name = f"translated/{hash_name}"
        
        # Tạo tên file gốc với extension phù hợp và hậu tố ngôn ngữ để lưu Content-Disposition
        if original_file_name:
            original_basename = os.path.splitext(original_file_name)[0]
        else:
            original_basename = os.path.splitext(os.path.basename(file_path))[0]
        original_filename_for_download = f"{original_basename}_{target_language}.{final_extension}"
        
        logger.info(f"📤 Đang upload file lên S3: {object_name}")
        
        s3_url = upload_file_path_to_s3(translated_file_path, bucket_name, object_name, original_filename_for_download)

        # Nếu upload thất bại => raise Exception để dừng lại
        if not s3_url:
            logger.error("❌ Upload file lên S3 thất bại")
            raise Exception("Failed to upload translated file to S3")

        logger.info(f"✅ Đã upload file lên S3 thành công: {s3_url}")

        return {
            "translated_file_url": s3_url,
            "original_file_url": original_file_url,
            "original_file_name": original_file_name or os.path.basename(file_path),
            "target_language": target_language,
            "original_language": source_language or "unknown",  # fallback tránh NOT NULL constraint
            "file_type": final_extension,
        }
    except Exception as e:
        logger.error(f"❌ Lỗi trong quá trình dịch: {str(e)}")
        raise e
    finally:
        # Dọn dẹp file tạm
        for temp_file in temp_files:
            try:
                if os.path.exists(temp_file):
                    if os.path.isdir(temp_file):
                        shutil.rmtree(temp_file, ignore_errors=True)
                        logger.info(f"🧹 Đã xóa thư mục tạm: {temp_file}")
                    else:
                        os.remove(temp_file)
                        logger.info(f"🧹 Đã xóa file tạm: {temp_file}")
            except Exception as e:
                logger.warning(f"⚠️ Không thể xóa tài nguyên tạm {temp_file}: {str(e)}")

        # Xóa file dịch nếu tồn tại
        try:
            if os.path.exists(translated_file_path):
                os.remove(translated_file_path)
                logger.info(f"🧹 Đã xóa file dịch tạm: {translated_file_path}")
        except Exception as e:
            logger.warning(f"⚠️ Không thể xóa file dịch tạm {translated_file_path}: {str(e)}")

# Removed _serialize_private_keywords


# ======= API View =======
class TranslateFileView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file_url = request.data.get("file_url")
        target_languages = request.data.get("target_languages") or []
        original_file_name = request.data.get("original_file_name")
        origin_language = request.data.get("origin_language")  # Nhận ngôn ngữ gốc từ frontend

        library_mode = request.data.get("library_mode", "common")

        if not file_url or not target_languages:
            return JsonResponse({"detail": "Missing file_url or target_languages"}, status=400)

        if not isinstance(target_languages, list):
            return JsonResponse({"detail": "target_languages must be a list"}, status=400)
            
        if library_mode not in ["none", "common", "private"]:
            return JsonResponse({"detail": f"Invalid library_mode: {library_mode}"}, status=400)
            
        if library_mode == "private":
            if not PrivateKeyword.objects.filter(user=request.user).exists():
                return JsonResponse({"detail": "You do not have a private library. Please add keywords to your private library first."}, status=400)

        file_ext = file_url.rsplit(".", 1)[-1].lower()
        file_name = original_file_name or os.path.basename(file_url)
        # Tạo file tạm duy nhất theo request để tránh va chạm/xóa nhầm
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_ext}")
        temp_path = temp_file.name
        temp_file.close()

        try:
            resp = requests.get(file_url)
            resp.raise_for_status()
            with open(temp_path, "wb") as f:
                f.write(resp.content)

            # Set thread-local translation context
            set_translation_context(
                library_mode=library_mode,
                user_id=request.user.id,
            )
            logger.info(f"🔧 Translation context: Mode={library_mode}, User ID={request.user.id}")

            results = []
            for lang in target_languages:
                try:
                    result = translate_document(temp_path, lang, file_url, origin_language, file_name)
                    TranslatedFile.objects.create(
                        user=request.user,
                        original_file_url=file_url,
                        original_file_name=file_name,
                        translated_file_url=result["translated_file_url"],
                        original_language=result["original_language"],
                        target_language=lang,
                        file_type=result["file_type"],
                    )
                    # Tạo tên file download với extension phù hợp  
                    base_name = os.path.splitext(file_name)[0]
                    file_extension = result["file_type"]
                    download_filename = f"{base_name}_{lang}.{file_extension}"

                    results.append({
                        "language": lang,
                        "url": result["translated_file_url"],
                        "filename": download_filename
                    })
                except Exception as e:
                    logger.error(f"❌ Lỗi khi dịch sang ngôn ngữ {lang}: {str(e)}")
                    continue

            if not results:
                return JsonResponse({"detail": "Failed to translate to any target language"}, status=500)

            return JsonResponse({"translated_files": results}, status=200)
        except Exception as e:
            logger.error(f"❌ Lỗi trong quá trình xử lý: {str(e)}")
            return JsonResponse({"detail": str(e)}, status=500)
        finally:
            clear_translation_context()
            if os.path.exists(temp_path):
                os.remove(temp_path)


# ======= Text Translation API View =======
class TranslateTextView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        API endpoint để dịch text thuần túy
        
        Request body:
        {
            "source_text": "Hello world",
            "source_language": "en",  # optional, sẽ auto-detect nếu không có
            "target_language": "vi"   # required
        }
        """
        try:
            source_text = request.data.get("source_text", "").strip()
            source_language = request.data.get("source_language")
            target_language = request.data.get("target_language")
            library_mode = request.data.get("library_mode", "common")

            # Validate input
            if not source_text:
                return JsonResponse({
                    "error": "source_text is required"
                }, status=400)

            if not target_language:
                return JsonResponse({
                    "error": "target_language is required"
                }, status=400)

            # Validate target language
            if target_language not in LANGUAGES:
                return JsonResponse({
                    "error": f"Unsupported target language: {target_language}. Supported: {list(LANGUAGES.keys())}"
                }, status=400)

            # Auto-detect source language if not provided
            if not source_language:
                try:
                    source_language = detect_language(source_text)
                    logger.info(f"🌍 Auto-detected source language: {source_language}")
                except Exception as e:
                    logger.warning(f"⚠️ Could not detect language, defaulting to 'en': {str(e)}")
                    source_language = "en"
            
            # Do not hard-restrict source language: allow non-listed languages (non-glossary)
            if source_language not in LANGUAGES:
                logger.info(f"ℹ Source language '{source_language}' is not in configured glossary LANGUAGES; proceeding without glossary.")
                
            if library_mode not in ["none", "common", "private"]:
                return JsonResponse({"error": f"Invalid library_mode: {library_mode}"}, status=400)
                
            if library_mode == "private":
                if not PrivateKeyword.objects.filter(user=request.user).exists():
                    return JsonResponse({"error": "You do not have a private library. Please add keywords to your private library first."}, status=400)

            # Check if source and target are the same
            if source_language == target_language:
                return JsonResponse({
                    "translated_text": source_text,
                    "source_language": source_language,
                    "target_language": target_language,
                    "message": "Source and target languages are the same"
                }, status=200)

            # Determine glossary (fallback to non-glossary if pair missing)
            glossary_id = None
            if source_language in LANGUAGES:
                pair_code = f"{source_language}-{target_language}"
                if pair_code not in language_pair:
                    pair_code = f"{target_language}-{source_language}"
                if pair_code in language_pair:
                    glossary_id = f"toray_translation_glossary_{language_pair[pair_code]}"
                    logger.info(f"📚 Using glossary: {glossary_id}")
                else:
                    logger.info(f"ℹ No glossary for pair {source_language}->{target_language}. Translating without glossary.")
            
            logger.info(f"🔄 Translating text from {source_language} to {target_language}")
            logger.info(f"📝 Source text: {source_text[:100]}{'...' if len(source_text) > 100 else ''}")
            
            set_translation_context(library_mode=library_mode, user_id=request.user.id)
            try:
                # Perform translation
                translated_text = translate_text_with_glossary(
                    text=source_text,
                    glossary_id=glossary_id,
                    source_lang_code=source_language,
                    target_lang_code=target_language
                )
            finally:
                clear_translation_context()

            if not translated_text:
                return JsonResponse({
                    "error": "Translation failed - empty result"
                }, status=500)

            logger.info(f"✅ Translation successful")
            logger.info(f"📝 Translated text: {translated_text[:100]}{'...' if len(translated_text) > 100 else ''}")

            return JsonResponse({
                "translated_text": translated_text,
                "source_language": source_language,
                "target_language": target_language,
                "source_text": source_text
            }, status=200)

        except Exception as e:
            logger.error(f"❌ Error in text translation: {str(e)}")
            return JsonResponse({
                "error": f"Translation failed: {str(e)}"
            }, status=500)
