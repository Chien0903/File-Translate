import cv2
import numpy as np


def flat_to_points(flat):
    """
    Chuyển list flat [x0, y0, x1, y1, ...] thành list điểm [(x0,y0),(x1,y1),...].
    """
    assert len(flat) % 2 == 0, "Danh sách phải có số phần tử chẵn"
    return [(flat[i], flat[i+1]) for i in range(0, len(flat), 2)]


def inpaint_image(img, polygons, inpaint_radius=3, method=cv2.INPAINT_TELEA):
    """
    Inpaint vùng polygon trong ảnh.
    """
    polygons = flat_to_points(polygons) if isinstance(polygons[0], (int, float)) else polygons
    mask = np.zeros(img.shape[:2], dtype=np.uint8)
    for poly in polygons:
        pts = np.array(poly, dtype=np.int32)
        cv2.fillPoly(mask, [pts], 255)
    return cv2.inpaint(img, mask, inpaint_radius, method)
