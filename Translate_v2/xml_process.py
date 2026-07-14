import shutil
import zipfile
import os
from fastapi import HTTPException
def copy_and_extract(file_path):
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"File {file_path} không tồn tại.")

    # Lấy thư mục và tên file gốc
    file_dir = os.path.dirname(file_path)
    file_name = os.path.splitext(os.path.basename(file_path))[0]

    # Tạo file .zip từ file .docx
    zip_path = os.path.join(file_dir, f"{file_name}_copy.zip")
    shutil.copyfile(file_path, zip_path)

    # Tạo folder để extract (cùng thư mục với file gốc)
    extract_dir = os.path.join(file_dir, f"{file_name}_extracted")
    os.makedirs(extract_dir, exist_ok=True)

    # Giải nén file zip
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_dir)

    return extract_dir
def compress_folder(folder_path,file_path,  output_path):
    if not os.path.isdir(folder_path):
        raise FileNotFoundError(f"Folder {folder_path} không tồn tại.")

    file_extension = file_path.split(".")[-1].lower()

    if file_extension == "pdf":
        temp_zip_path = output_path.replace('.pdf', '.zip')

    elif file_extension == "docx":
        temp_zip_path = output_path.replace('.docx', '.zip')
    elif file_extension == "xlsx":
        temp_zip_path = output_path.replace('.xlsx', '.zip')
    elif file_extension == "pptx":
        temp_zip_path = output_path.replace('.pptx', '.zip')
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    # Đảm bảo thư mục chứa file zip tồn tại
    zip_dir = os.path.dirname(temp_zip_path)
    if zip_dir and not os.path.exists(zip_dir):
        os.makedirs(zip_dir)

    # Nếu file zip tạm đã tồn tại, xóa đi
    if os.path.exists(temp_zip_path):
        os.remove(temp_zip_path)

    # Tiến hành nén folder thành file zip
    with zipfile.ZipFile(temp_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                file_path = os.path.join(root, file)
                # Bỏ qua file đã biến mất hoặc không thể truy cập
                if not os.path.exists(file_path):
                    continue
                # ZIP (và OOXML mà Word/Excel/PowerPoint đọc) luôn dùng '/' làm dấu phân cách
                # bên trong archive. os.path.relpath() trên Windows trả về '\\', nếu ghi thẳng
                # vào zip thì Office không nhận diện được cấu trúc thư mục (word/document.xml
                # bị hiểu nhầm thành 1 file tên "word\document.xml" nằm ở gốc) -> file dịch ra
                # bị báo "corrupted, cannot be opened" dù nội dung text đã dịch đúng.
                arcname = os.path.relpath(file_path, folder_path).replace(os.sep, '/')
                try:
                    zipf.write(file_path, arcname)
                except (FileNotFoundError, PermissionError, OSError) as e:
                    # Tránh vỡ quy trình do file thiếu/bị khóa tạm thời (ví dụ fonts .odttf,
                    # hoặc antivirus đang quét file giữa chừng)
                    print(f"⚠️ Bỏ qua file khi nén (không đọc được): {file_path} — {e}")
                    continue

    # Kiểm tra file zip đã được tạo chưa    
    if not os.path.isfile(temp_zip_path):
        raise FileNotFoundError(f"Không tạo được file zip tạm tại {temp_zip_path}")

    # Nếu file docx đích đã tồn tại, xóa đi
    if os.path.exists(output_path):
        os.remove(output_path)

    # Đổi tên file zip thành file docx
    shutil.move(temp_zip_path, output_path)

    return output_path