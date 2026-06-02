import os
import requests
from google.cloud import translate_v2 as translate
from dotenv import load_dotenv

load_dotenv()

   # Kiểm tra kết nối internet cơ bản
def check_internet_connection():
    try:
        response = requests.get("https://www.google.com", timeout=5)
        print(f"Kết nối internet: OK (Status code: {response.status_code})")
        return True
    except requests.exceptions.RequestException as e:
        print(f"Lỗi kết nối internet: {str(e)}")
        return False

# Kiểm tra kết nối đến Google Cloud API
def check_google_cloud_connection():
    try:
        response = requests.get("https://translation.googleapis.com", timeout=5)
        print(f"Kết nối đến Google Cloud API: OK (Status code: {response.status_code})")
        return True
    except requests.exceptions.RequestException as e:
        print(f"Lỗi kết nối đến Google Cloud API: {str(e)}")
        return False

# Kiểm tra xác thực Google Cloud
def check_google_auth():
    # Lấy đường dẫn từ biến môi trường
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    
    if not credentials_path:
        print("Lỗi: GOOGLE_APPLICATION_CREDENTIALS không được thiết lập trong file .env")
        return False
        
    print(f"Kiểm tra file credentials: {'Tồn tại' if os.path.exists(credentials_path) else 'Không tồn tại'}")
    
    # Đặt biến môi trường
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
    
    try:
        # Tạo client
        translate_client = translate.Client()
        
        # Thử dịch một chuỗi đơn giản
        text = 'Hello, world!'
        target = 'vi'
        
        translation = translate_client.translate(text, target_language=target)
        print(f"Xác thực Google Cloud: OK")
        print(f"Dịch thử nghiệm: '{text}' -> '{translation['translatedText']}'")
        return True
    except Exception as e:
        print(f"Lỗi xác thực Google Cloud: {str(e)}")
        return False

if __name__ == "__main__":
    print("=== KIỂM TRA KẾT NỐI ===")
    check_internet_connection()
    check_google_cloud_connection()
    check_google_auth()