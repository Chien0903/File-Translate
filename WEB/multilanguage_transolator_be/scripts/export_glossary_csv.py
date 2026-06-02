import os
import sys
import csv
from datetime import datetime

# Cho phép import module glossary trong cùng thư mục
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)

from glossary import fetch_glossary_rows_from_gcs  # noqa: E402


HEADERS = ["en", "ja", "vi", "zh-CN", "zh-TW"]


def export_glossary_csv(output_path: str | None = None,
                        bucket_name: str | None = None,
                        object_name: str | None = None) -> str:
    """
    Tải glossary từ GCS và ghi ra file CSV cục bộ theo định dạng cột:
    en, ja, vi, zh-CN, zh-TW.

    - output_path: đường dẫn file CSV đầu ra. Nếu None sẽ tạo tên theo timestamp.
    - bucket_name: tên bucket GCS (mặc định lấy từ env AWS_STORAGE_BUCKET_NAME hoặc "toray-buckets").
    - object_name: tên object trên GCS (mặc định "glossary_term.csv").

    Trả về đường dẫn file CSV đã ghi.
    """
    # Ưu tiên lấy từ env INPUT_URI nếu không truyền tham số
    if bucket_name is None or object_name is None:
        input_uri = os.getenv("INPUT_URI")
        if input_uri and input_uri.startswith("gs://"):
            # Parse dạng gs://bucket/object
            without_scheme = input_uri[len("gs://"):]
            parts = without_scheme.split("/", 1)
            if len(parts) == 2:
                bucket_name = parts[0]
                object_name = parts[1]
        # Nếu vẫn chưa có bucket, thử đọc BUCKET_NAME
        if bucket_name is None:
            bucket_name = os.getenv("BUCKET_NAME")
        # Nếu vẫn chưa có object_name, dùng mặc định
        if object_name is None:
            object_name = "glossary_term.csv"

    rows = fetch_glossary_rows_from_gcs(bucket_name=bucket_name, object_name=object_name)

    if output_path is None:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = os.path.join(os.getcwd(), f"glossary_term_export_{ts}.csv")

    # Đảm bảo thư mục tồn tại
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    with open(output_path, mode="w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=HEADERS)
        writer.writeheader()
        for r in rows:
            writer.writerow({
                "en": r.get("en", ""),
                "ja": r.get("ja", ""),
                "vi": r.get("vi", ""),
                "zh-CN": r.get("zh-CN", ""),
                "zh-TW": r.get("zh-TW", ""),
            })

    print(f"✅ Exported glossary CSV: {output_path}")
    return output_path


if __name__ == "__main__":
    # Sử dụng: python export_glossary_csv.py [output_path]
    out = sys.argv[1] if len(sys.argv) > 1 else None
    export_glossary_csv(output_path=out)


