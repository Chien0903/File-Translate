from pdf2docx import Converter
from .translate_docx import translate_docx
from docx2pdf import convert
from .detect_lang import LANGUAGES
import os
# Đường dẫn tới file PDF nguồn và file DOCX đích


# Chuyển đổi PDF sang DOCX
def pdf_to_docx(pdf_file, docx_file):
    # Chuyển đổi PDF sang DOCX
    cv = Converter(pdf_file)
    cv.convert(docx_file, start=0, end=None)
    cv.close()
    
def docx_to_pdf(docx_file):
    # Chuyển đổi DOCX sang PDF
    pdf_output = docx_file.replace(".docx", ".pdf")
    convert(docx_file, pdf_output)

if __name__ == "__main__":
    pdf_file = r"C:\Users\User\OneDrive - Hanoi University of Science and Technology\Documents\Lập trình cơ bản\Projects\[ISE] Toray translator project\pdf\The Ultimate IQ Test Book-trang-3.pdf"
    docx_file = pdf_file.replace(".pdf", ".docx")

    # Chuyển đổi PDF sang DOCX
    pdf_to_docx(pdf_file, docx_file)
    print(f"Đã chuyển đổi {pdf_file} sang {docx_file}")
    # Dịch nội dung 
    
    translate_docx(docx_file)
    for lang in LANGUAGES.keys():
        target_path = docx_file.replace(".docx", f"_{lang}.docx")
        if os.path.exists(target_path):
            docx_to_pdf(target_path)
                # Xóa file DOCX sau khi đã chuyển sang PDF
        try:
            os.remove(target_path)
            print(f"Đã xóa file {target_path}")
        except Exception as e:
            print(f"Lỗi khi xóa {target_path}: {e}")
    try:
        os.remove(docx_file)
        print(f"Đã xóa file {docx_file}")
    except Exception as e:
        print(f"Lỗi khi xóa {docx_file}: {e}")