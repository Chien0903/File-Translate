import re
import pypdf as PyPDF2

OCR_KEYWORDS = ("ocr", "tesseract", "abbyy", "ocrmypdf", "ocrengine", "ocropus", "adobe pdf output intent", "ocr.scanned")
MIN_TEXT_CHARS = 20       # tối thiểu ký tự để coi là "có text có ý nghĩa"
FULL_PAGE_RATIO = 2.0     # nếu image_pixels / page_points >= ratio => coi là full-page image

def _safe_get(obj, key):
    try:
        return obj.get(key)
    except Exception:
        return None

def _resolve(obj):
    """Resolve indirect object if PyPDF2 returns an indirect object."""
    try:
        if hasattr(obj, "get_object"):
            return obj.get_object()
    except Exception:
        pass
    return obj

def _get_page_size_pts(page):
    try:
        # PyPDF2: page.mediabox has .width/.height
        w = float(page.mediabox.width)
        h = float(page.mediabox.height)
        return w, h
    except Exception:
        # fallback reading from dictionary
        try:
            mb = page.get("/MediaBox")
            if mb:
                mb = _resolve(mb)
                llx, lly, urx, ury = [float(n) for n in mb]
                return urx - llx, ury - lly
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
        xobject = resources.get("/XObject") or resources.get("/XObject")
        xobject = _resolve(xobject) if xobject is not None else None
        if not xobject:
            return False

        page_w_pts, page_h_pts = _get_page_size_pts(page)
        if not page_w_pts or not page_h_pts:
            # nếu không biết kích thước trang thì vẫn thử detect presence of large image by pixels
            page_w_pts, page_h_pts = 0, 0

        for key in xobject:
            obj = xobject[key]
            obj = _resolve(obj)
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
                    # nếu thiếu thông tin kích thước trang hoặc ảnh, fallback: coi presence of image as possible full-page if image large in pixels
                    if img_w and img_h:
                        if max(img_w, img_h) >= 1000:
                            return True
        return False
    except Exception:
        return False

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
if __name__ == "__main__":
    # pdf_file = r"D:\Dowloads\QĐ THÀNH LẬP ĐOÀN ĐÁNH GIÁ.pdf"
    # pdf_file = r"D:\Dowloads\KẾ HOẠCH ĐÁNH GIÁ.pdf"
    # pdf_file = r"D:\Dowloads\東レ仕様書TS-2402半袖 Tシャツ.pdf"
    # pdf_file = r"D:\Document\Lập trình\Projects\[ISE] Toray translator project\pdf\200785 - Saturday Stripe Skort-2ND PROTO COMMENTS 73025-en.pdf"
    # pdf_file = r"D:\Document\Lập trình\Projects\[ISE] Toray translator project\pdf\BTNB 工場概要 2025.7.1改訂.pdf"
    pdf_file = r"D:\Document\Lập trình\Projects\[ISE] Toray translator project\pdf\test.pdf"
    ok = is_pdf_truly_editable(pdf_file)
    if ok:
        print("PDF là editable (có trang native text).")
    else:
        print("PDF bị từ chối (toàn bộ file có khả năng là scan/OCR).")
