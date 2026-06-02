import logging
import os
from fastapi import HTTPException
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont, ImageEnhance
import cv2
import numpy as np

from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest
from azure.core.credentials import AzureKeyCredential
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from detect_lang import detect_language, LANGUAGES, language_pair
from translate_text import translate_text_with_glossary, translate_texts_batch, translate_texts_batch

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
def setup_azure_client():
    load_dotenv()
    endpoint = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
    key = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_KEY")
    if not endpoint or not key:
        raise EnvironmentError("Azure Document Intelligence endpoint/key not set in environment variables")
    client = DocumentIntelligenceClient(endpoint=endpoint, credential=AzureKeyCredential(key))
    return client

def load_image_and_draw(image_path):
    pil_image = Image.open(image_path)
    # If image has alpha channel (RGBA), composite onto white background
    # to prevent transparent pixels from becoming black when converting to RGB
    if pil_image.mode == 'RGBA':
        bg = Image.new('RGB', pil_image.size, (255, 255, 255))
        bg.paste(pil_image, mask=pil_image.split()[3])  # use alpha as mask
        pil_image = bg
    else:
        pil_image = pil_image.convert("RGB")
    draw = ImageDraw.Draw(pil_image)
    return pil_image, draw

def load_font(font_path=None, font_size=20):
    if font_path and os.path.exists(font_path):
        try:
            font = ImageFont.truetype(font_path, font_size)
        except Exception as e:
            logging.warning(f"Font load error: {e}. Using default font.")
            font = ImageFont.load_default()
    else:
        font = ImageFont.load_default()
        logging.warning(f"Font load error, using default font.")
    return font

def get_text_size(font, text):
    try:
        bbox = font.getbbox(text)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
    except AttributeError:
        text_width, text_height = font.getsize(text)
    return text_width, text_height

def _extract_vertices_from_item(item):
    # Azure SDK returns polygon points for lines/words. Try common attribute names.
    verts = []
    def add_point(x, y):
        try:
            verts.append((int(round(x)), int(round(y))))
        except Exception:
            pass

    # Prefer polygon, then bounding_polygon, then bounding_box
    poly = None
    if hasattr(item, "polygon") and item.polygon:
        poly = item.polygon
    elif hasattr(item, "bounding_polygon") and item.bounding_polygon:
        poly = item.bounding_polygon
    elif hasattr(item, "bounding_box") and item.bounding_box:
        poly = item.bounding_box

    if poly is not None:
        # Case: flattened list of numbers [x1, y1, x2, y2, ...]
        if isinstance(poly, (list, tuple)) and poly and all(isinstance(v, (int, float)) for v in poly):
            for i in range(0, len(poly) - 1, 2):
                add_point(poly[i], poly[i + 1])
        else:
            # Elements may be objects with .x/.y, dicts, tuples, or single floats (flat sequence)
            # Try to parse element-wise; if we detect single floats, re-interpret as flat list
            seen_float = False
            for p in poly:
                if hasattr(p, "x") and hasattr(p, "y"):
                    add_point(p.x, p.y)
                elif isinstance(p, dict) and "x" in p and "y" in p:
                    add_point(p["x"], p["y"])
                elif isinstance(p, (list, tuple)) and len(p) >= 2:
                    add_point(p[0], p[1])
                elif isinstance(p, (int, float)):
                    seen_float = True
                else:
                    # unknown element type; try to coerce if possible
                    try:
                        x = getattr(p, "x", None)
                        y = getattr(p, "y", None)
                        if x is not None and y is not None:
                            add_point(x, y)
                    except Exception:
                        pass
            # If we saw floats as elements, try interpreting poly as a flattened list
            if seen_float:
                flat = [float(v) for v in poly]
                for i in range(0, len(flat) - 1, 2):
                    add_point(flat[i], flat[i + 1])

    # fallback to a small box at origin if nothing found
    if not verts:
        verts = [(0, 0), (0, 0), (0, 0), (0, 0)]
    return verts

def get_text_color(image_roi):
    if image_roi.size == 0:
        return (0, 0, 0)
    
    pixels = image_roi.reshape(-1, 3)
    if len(pixels) < 10:
        return (0, 0, 0)
        
    pixels = np.float32(pixels)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
    K = 2
    try:
        _, labels, centers = cv2.kmeans(pixels, K, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
    except Exception:
        return (0, 0, 0)
        
    centers = np.uint8(centers)
    counts = np.bincount(labels.flatten())
    
    # Sort by count. The most frequent one is likely the background.
    sorted_indices = np.argsort(counts)
    bg_color_index = sorted_indices[-1]
    bg_color = centers[bg_color_index]
    
    # Calculate luminance to determine high contrast text color
    # RGB luminance formula
    luminance = 0.299 * bg_color[0] + 0.587 * bg_color[1] + 0.114 * bg_color[2]
    
    if luminance > 128:
        return (0, 0, 0)  # Black text for light background
    else:
        return (255, 255, 255)  # White text for dark background

def erase_text_hybrid(cv_image, results):
    """Erase detected text from the image using a hybrid approach.
    
    For each text block:
      1. Extract the ROI (bounding box region)
      2. Use K-means clustering INSIDE the ROI to separate text pixels
         from background pixels (the dominant cluster = background)
      3. Check background complexity (std deviation):
         - Simple bg (std < 30): fill text pixels with the bg color
         - Complex bg (std >= 30): inpaint with text-only mask + adaptive radius
    
    This avoids the black-background problem because:
      - Background color is sampled from WITHIN the ROI (not from external
        borders that may contain dark garments/swatches)
      - Only text pixels are masked (not the entire rectangle)
      - Inpainting fills tiny gaps instead of huge rectangles
    """
    h, w = cv_image.shape[:2]
    
    for it in results:
        left, top, right, bottom = it['bbox']
        left_c, top_c = max(0, left), max(0, top)
        right_c, bottom_c = min(w, right), min(h, bottom)
        if right_c <= left_c or bottom_c <= top_c:
            continue
        
        roi = cv_image[top_c:bottom_c, left_c:right_c].copy()
        roi_h, roi_w = roi.shape[:2]
        
        if roi_h < 3 or roi_w < 3:
            continue
        
        # K-means on the ROI pixels to find text vs background clusters
        pixels = roi.reshape(-1, 3).astype(np.float32)
        if len(pixels) < 10:
            continue
        
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
        K = 2
        try:
            _, labels, centers = cv2.kmeans(
                pixels, K, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS
            )
        except Exception:
            # Fallback: skip this block
            continue
        
        counts = np.bincount(labels.flatten())
        
        # Background = most frequent cluster, Text = least frequent
        bg_idx = int(np.argmax(counts))
        text_idx = 1 - bg_idx
        bg_color = centers[bg_idx].astype(np.uint8)
        
        # Create text-only mask within the ROI
        labels_2d = labels.reshape(roi_h, roi_w)
        text_mask = (labels_2d == text_idx).astype(np.uint8) * 255
        
        # Dilate the text mask slightly to cover anti-aliased edges
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        text_mask = cv2.dilate(text_mask, kernel, iterations=1)
        
        # Check background complexity
        bg_pixel_mask = (labels.flatten() == bg_idx)
        bg_pixels = pixels[bg_pixel_mask]
        bg_std = float(np.std(bg_pixels, axis=0).mean()) if len(bg_pixels) > 0 else 0
        
        if bg_std < 30:
            # SIMPLE background: fill text pixels with the dominant bg color
            roi[text_mask == 255] = bg_color
            # Smooth the filled region with a mild blur to blend edges
            blurred_roi = cv2.GaussianBlur(roi, (3, 3), 0.8)
            # Only apply blur on the text mask region
            mask_3ch = cv2.merge([text_mask, text_mask, text_mask])
            roi = np.where(mask_3ch == 255, blurred_roi, roi)
        else:
            # COMPLEX background: inpaint with text-only mask + adaptive radius
            radius = max(3, min(roi_h, roi_w) // 4)
            try:
                roi = cv2.inpaint(roi, text_mask, inpaintRadius=radius, flags=cv2.INPAINT_NS)
            except Exception:
                # Last resort: fill with bg color
                roi[text_mask == 255] = bg_color
        
        cv_image[top_c:bottom_c, left_c:right_c] = roi
    
    return cv_image


def draw_translated_text_on_image(image_path, blocks, font_path=None):
    """
    Burn translated text directly into the image file.
    Useful as a fallback when XML-based textboxes cannot be anchored.
    """
    if not blocks:
        return
    
    try:
        pil_image = Image.open(image_path)
        # If image has alpha channel (RGBA), composite onto white background
        if pil_image.mode == 'RGBA':
            bg = Image.new('RGB', pil_image.size, (255, 255, 255))
            bg.paste(pil_image, mask=pil_image.split()[3])
            pil_image = bg
        else:
            pil_image = pil_image.convert("RGB")
        draw = ImageDraw.Draw(pil_image)
        cv_img = np.array(pil_image)
        
        for b in blocks:
            text = b.get('translated') or b.get('original') or ""
            if not text:
                continue
                
            # Use vertices for polygon if available, else bbox
            verts = b.get('vertices', [])
            if verts:
                xs = [v[0] for v in verts]
                ys = [v[1] for v in verts]
                left, top, right, bottom = min(xs), min(ys), max(xs), max(ys)
            else:
                left, top, right, bottom = b.get('bbox', [0, 0, 0, 0])
                
            # Determine text color based on background luminance
            # Use a slightly larger ROI to get better background context
            roi = cv_img[max(0, top):min(cv_img.shape[0], bottom), 
                         max(0, left):min(cv_img.shape[1], right)]
            text_color = get_text_color(roi)
            
            f_size = int(b.get('font_size', 12))
            font = load_font(font_path, f_size)
            
            # Position: center of the bounding box
            text_w, text_h = get_text_size(font, text)
            center_x = left + (right - left) // 2
            center_y = top + (bottom - top) // 2
            
            try:
                # Use 'mm' anchor if supported (Pillow >= 9.0)
                # Drawing with a small stroke can sometimes help readability but may look bold
                draw.text((center_x, center_y), text, fill=text_color, font=font, anchor="mm")
            except Exception:
                # Fallback implementation for older Pillow
                draw.text((center_x - text_w // 2, center_y - text_h // 2), 
                          text, fill=text_color, font=font)
        
        # Apply global sharpness enhancement to make the text pop
        enhancer = ImageEnhance.Sharpness(pil_image)
        pil_image = enhancer.enhance(2.0)
        
        # Save with high quality parameters to avoid compression artifacts around text
        if image_path.lower().endswith(('.jpg', '.jpeg')):
            pil_image.save(image_path, quality=95, subsampling=0)
        else:
            pil_image.save(image_path)
            
        logging.info(f"Successfully burned sharpened translated text into: {image_path}")
    except Exception as e:
        logging.warning(f"Failed to burn text onto image {image_path}: {e}")
# The pipeline now: 1) extract all blocks and their bboxes, 2) translate texts in parallel,
# 3) build a combined mask and inpaint once, 4) return block metadata + saved inpainted image path.
def _image_has_text(np_image):
        """Lightweight heuristic to detect presence of text-like regions.
        Only returns False when it's very likely there's no text to avoid false negatives."""
        try:
            h, w = np_image.shape[:2]
            if h < 30 or w < 30:
                return False
            gray = cv2.cvtColor(np_image, cv2.COLOR_RGB2GRAY)

            edges = cv2.Canny(gray, 80, 200)
            edge_density = float(np.count_nonzero(edges)) / float(h * w)

            thr = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C,
                                        cv2.THRESH_BINARY_INV, 31, 15)
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
            morph = cv2.dilate(thr, kernel, iterations=1)
            contours, _ = cv2.findContours(morph, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            large_cnt = []
            for c in contours:
                x, y, cw, ch = cv2.boundingRect(c)
                if cw >= 8 and ch >= 8:
                    large_cnt.append(c)
            text_area = sum(float(cv2.contourArea(c)) for c in large_cnt)
            area_ratio = text_area / float(h * w)

            if edge_density > 0.005:
                return True
            if len(large_cnt) > 15:
                return True
            if area_ratio > 0.0015:
                return True
            return False
        except Exception:
            # If heuristic fails, err on the side of processing
            return True

def detect_text_with_coords(image_path, target_lang, source_lang = None,output_path=None, font_path=None, font_size=10, max_font_size=14):
    pil_image, draw = load_image_and_draw(image_path)

    # if pil_image.width < 150 or pil_image.height < 150:
    #     logging.info(f"Image {image_path} is too small ({pil_image.width}x{pil_image.height}), skipping OCR.")
    #     return [], None

    # Skip early if the image doesn't appear to contain text
    cv_image_pre = np.array(pil_image)
    if not _image_has_text(cv_image_pre):
        logging.info(f"No text-like regions found, skipping OCR: {image_path}")
        return [], None

    client = setup_azure_client()

    # Send file bytes to Azure Document Intelligence (prebuilt-read)
    with open(image_path, "rb") as f:
        bytes_data = f.read()

    poller = client.begin_analyze_document("prebuilt-layout", AnalyzeDocumentRequest(bytes_source=bytes_data))
    result = poller.result()

    # Collect all detected text for language detection
    all_lines = []
    blocks = []
    for page in result.pages:
        for line in page.lines:
            text = getattr(line, "content", getattr(line, "text", ""))
            all_lines.append(text)
            blocks.append(line)
    all_text = " ".join([t for t in all_lines if t])
    if not all_text:
        logging.info(f"No text detected in image: {image_path}")
        return [], None  # thoát sớm nếu không có text

    low_text = all_text.lower()
    # Danh sách các text/logo không muốn OCR/dịch
    rejected = [
        "innovation by chemistry",
        "fast retailing"
    ]
    if any(r in low_text for r in rejected) and len(all_lines) < 5:
        logging.info(f"Detected likely logo/brand text '{all_text}', skipping translation to preserve original image.")
        return [], None

    if not source_lang:
        source_lang = detect_language(all_text)
    if source_lang not in LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported source language: {source_lang}")
    print(f"Detected language: {LANGUAGES[source_lang]}")
    
    candidate1 = f"{source_lang}-{target_lang}"
    candidate2 = f"{target_lang}-{source_lang}"
    pair_code = None
    if candidate1 in language_pair:
        pair_code = candidate1
    elif candidate2 in language_pair:
        pair_code = candidate2

    if pair_code:
        try:
            glossary_id = f"toray_translation_glossary_{language_pair[pair_code]}"
        except Exception as e:
            logging.warning(f"Glossary lookup failed for pair {pair_code}: {e}")
            glossary_id = None
    else:
        logging.warning(f"No glossary mapping for language pairs: {candidate1} or {candidate2}")
        glossary_id = None

    # Build block metadata list (bbox + original text)
    block_infos = []
    for block in blocks:
        text = getattr(block, "content", getattr(block, "text", "")) or ""
        text = text.strip()
        if not text:
            continue
        verts = _extract_vertices_from_item(block)
        xs = [v[0] for v in verts]
        ys = [v[1] for v in verts]
        left, top, right, bottom = int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))
        
        block_w = max(1, right - left)
        block_h = max(1, bottom - top)

        # Improved font size calculation:
        # Typically, font size (in pixels) should be around 70-80% of the line height
        # to account for ascenders/descenders and padding.
        # We use min(block_w, block_h) to handles both horizontal and vertical text layouts.
        line_height = min(block_w, block_h)
        estimated_pt = line_height * 0.75

        # Limit the font size within [8, max_font_size] range
        # Using float with one decimal for better precision
        computed_font_size = round(max(8.0, min(float(max_font_size), estimated_pt)), 1)

        block_infos.append({
            "original": text,
            "translated": None,
            "bbox": [left, top, right, bottom],
            "vertices": verts,
            "font_size": computed_font_size
        })

    # Translate all blocks in batch for much better performance
    if block_infos:
        texts_to_translate = [item['original'] for item in block_infos]
        logging.info(f"Batch translating {len(texts_to_translate)} blocks from image...")
        
        translated_texts = translate_texts_batch(texts_to_translate, glossary_id, source_lang, target_lang)
        
        for item, translated in zip(block_infos, translated_texts):
            item['translated'] = translated if translated else item['original']
    
    results = block_infos

    # Erase text using hybrid approach:
    # - K-means inside each ROI to separate text vs background
    # - Simple bg → fill text pixels with dominant bg color
    # - Complex bg → inpaint with text-only mask + adaptive radius
    cv_image = np.array(pil_image)

    try:
        cv_image = erase_text_hybrid(cv_image, results)
        pil_inpainted = Image.fromarray(cv_image)
        enhancer = ImageEnhance.Sharpness(pil_inpainted)
        pil_inpainted = enhancer.enhance(1.5)
    except Exception as e:
        logging.warning(f"Hybrid text erasure failed: {e}")
        pil_inpainted = pil_image

    if not output_path:
        output_path = os.path.splitext(image_path)[0] + "_no_text.png"
        output_path = output_path.replace("input", "output")

    try:
        pil_inpainted.save(output_path)
        logging.info(f"Saved inpainted image to {output_path}")
    except Exception as e:
        logging.warning(f"Saving inpainted image failed: {e}")

    # Return block metadata + path to inpainted image
    # print(f"Text of {image_path}: {results}")
    return results, output_path

if __name__ == "__main__":
    font_path = r"D:\Document\Code\Projects\TorayTranslator\Translate\OCR\OCR_IMAGE\NotoSerifCJK-Regular.ttc"
    detect_text_with_coords(
        r"D:\Document\Code\Projects\TorayTranslator\Translate\OCR\OCR_IMAGE\input\image11.emf",
        target_lang="vi",
        font_path=font_path,
        font_size=14
    )
