# Báo Cáo Tiến Độ Đồ Án
## Hệ Thống Dịch Đa Ngôn Ngữ Tài Liệu — Multilanguage Translator (Toray)

---

## Lời Mở Đầu

Dự án được xây dựng nhằm giải quyết nhu cầu thực tế của công ty Toray — một tập đoàn đa quốc gia cần xử lý tài liệu bằng nhiều ngôn ngữ khác nhau trong nội bộ. Thay vì dùng các công cụ dịch thông thường không kiểm soát được thuật ngữ chuyên ngành, hệ thống này cho phép nhân viên tải file lên, chọn ngôn ngữ đích, và nhận về bản dịch chính xác có tích hợp từ điển thuật ngữ riêng của công ty.

---

## 1. Tổng Quan Hệ Thống

### Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Frontend | React + Vite |
| Backend | Django REST Framework |
| Cơ sở dữ liệu | PostgreSQL — AWS RDS |
| Lưu trữ file | AWS S3 |
| Dịch thuật | Google Cloud Translation API |
| Xác thực | JWT (SimpleJWT) + AWS Cognito SSO |

### Ngôn ngữ hỗ trợ

> Nhật · Anh · Việt · Trung phồn thể · Trung giản thể · Thái · Bengali · Hindi · Indonesia · Oriya

### Kiến trúc tổng thể

```
[Người dùng]
     │
     ▼
[React Frontend]  ──── JWT ────►  [Django Backend]
                                        │
                          ┌─────────────┼─────────────┐
                          ▼             ▼             ▼
                      [AWS S3]   [PostgreSQL]   [Google Cloud]
                    (lưu file)   (dữ liệu)    (dịch + glossary)
```

---

## 2. Các Tính Năng Đã Hoàn Thành

### 2.1 Hệ Thống Xác Thực

Hệ thống hỗ trợ hai hình thức đăng nhập:

- **Email + mật khẩu** dành cho tài khoản nội bộ
- **SSO qua AWS Cognito** cho phép đăng nhập bằng tài khoản công ty mà không cần nhớ thêm mật khẩu

Sau khi đăng nhập thành công, hệ thống cấp **Access Token** (có hiệu lực 15 phút) và **Refresh Token** (7 ngày). Khi Access Token hết hạn, client tự động xin cấp mới mà người dùng không cần đăng nhập lại — đây gọi là **Refresh Token Rotation**.

Phân quyền gồm 3 vai trò:
- `User` — dùng các tính năng dịch, quản lý thư viện riêng
- `Library Keeper` — duyệt từ khóa đề xuất
- `Admin` — toàn quyền quản trị hệ thống

---

### 2.2 Dịch File Tài Liệu

Đây là tính năng cốt lõi. Người dùng tải file lên, chọn một hoặc nhiều ngôn ngữ đích, hệ thống tự động xử lý và trả về file đã dịch lưu trên S3.

**Các định dạng được hỗ trợ:**

| Định dạng | Cách xử lý |
|---|---|
| `.docx` | Dịch trực tiếp, giữ nguyên định dạng văn bản |
| `.xlsx`, `.xls`, `.xlsm`, `.csv` | Chuyển sang XLSX → dịch |
| `.pptx` | Dịch từng slide |
| `.pdf` có text | Phát hiện tự động → chuyển sang DOCX → dịch → trả DOCX |
| `.pdf` scan / ảnh | Phát hiện tự động → OCR nhận diện chữ → dịch → trả PDF |

Điểm đặc biệt: hệ thống **tự động phân biệt** PDF có thể dịch trực tiếp hay cần qua OCR, người dùng không cần làm gì thêm.

---

### 2.3 Dịch Văn Bản Trực Tiếp

Tính năng nhỏ nhưng tiện lợi — người dùng dán đoạn văn bản vào ô nhập liệu, chọn ngôn ngữ đích, nhận kết quả ngay lập tức. Ngôn ngữ nguồn có thể để trống, hệ thống sẽ tự phát hiện.

---

### 2.4 Thư Viện Từ Khóa Chuyên Ngành

Đây là điểm khác biệt lớn nhất so với công cụ dịch thông thường.

**Thư viện chung (Common Library)**

Là bộ từ điển thuật ngữ kỹ thuật của công ty, dùng chung cho toàn bộ người dùng. Khi dịch, hệ thống tự tra bảng thuật ngữ này trước, đảm bảo các từ chuyên ngành được dịch nhất quán.

**Thư viện riêng (Private Library)**

Mỗi người dùng có thể xây dựng bộ từ khóa riêng cho công việc của mình, dùng song song hoặc thay thế thư viện chung khi dịch.

**Quy trình đề xuất thuật ngữ mới:**

```
User đề xuất từ khóa
        │
        ▼
   KeywordQueue (hàng chờ)
        │
   Đủ ngưỡng người đề xuất?
        │ Có
        ▼
 KeywordSuggestion (chờ duyệt)
        │
   Admin / Library Keeper duyệt
        │
   ┌────┴────┐
   ▼         ▼
Approved   Rejected
   │
   ▼
Cập nhật Glossary trên Google Cloud
```

Ngưỡng số người đề xuất có thể cấu hình linh hoạt — ví dụ nếu đặt là 3, thì cần ít nhất 3 người khác nhau đề xuất cùng một thuật ngữ thì mới đẩy lên hàng chờ duyệt. Cơ chế này giúp lọc bớt các đề xuất cá nhân, chỉ đưa vào thư viện chung những từ thực sự được nhiều người dùng.

---

### 2.5 Quản Trị Hệ Thống (Admin)

- Tạo, phân quyền, kích hoạt / vô hiệu tài khoản người dùng
- Xem thống kê từ khóa: từ nào được dùng nhiều nhất, tỉ lệ xuất hiện, biểu đồ theo thời gian
- Duyệt hàng chờ đề xuất thư viện chung
- Cấu hình ngưỡng đề xuất

---

### 2.6 Các Tính Năng Hỗ Trợ Khác

- **Lịch sử file dịch** — xem lại các file đã dịch trước đó, tải về lại
- **Chuyển đổi định dạng** — convert file mà không cần dịch
- **Hệ thống thông báo** — thông báo khi từ khóa đề xuất được duyệt/từ chối

---

## 3. Vấn Đề Gặp Phải & Hướng Giải Quyết

### Vấn đề 1: Xác thực — từ ALB sang JWT

**Bối cảnh:** Ban đầu hệ thống được thiết kế để chạy sau AWS Application Load Balancer, xác thực người dùng qua header do ALB chèn vào. Cách này hoạt động tốt trên production nhưng không thể test ở môi trường local vì không có ALB.

**Giải pháp:** Chuyển toàn bộ sang JWT thuần. Đặc biệt, thay vì lưu JWT refresh token ở phía client mà không kiểm soát được, nhóm đã thêm bảng `RefreshToken` trong database để lưu **hash của token**. Nhờ đó có thể chủ động thu hồi token bất kỳ lúc nào — ví dụ khi người dùng đổi mật khẩu hoặc bị phát hiện đăng nhập bất thường.

---

### Vấn đề 2: Phân biệt PDF text và PDF scan

**Bối cảnh:** Người dùng tải lên một file `.pdf` — nhưng không phải PDF nào cũng như nhau. PDF được xuất từ Word hay Excel thì có text thật bên trong, có thể dịch bình thường. PDF được scan từ máy photocopy thì thực chất là ảnh, không có text.

Nếu áp dụng sai pipeline — ví dụ dùng pipeline text cho PDF scan — kết quả dịch sẽ trống hoàn toàn.

**Giải pháp:** Viết hàm phân tích tự động từng trang PDF, kiểm tra 3 yếu tố:
1. Trang có chứa text thật không (native text)?
2. Trang có ảnh chiếm toàn bộ không (full-page image)?
3. Metadata file có dấu hiệu của công cụ OCR không?

Dựa trên kết quả, hệ thống tự chọn pipeline phù hợp mà không cần người dùng can thiệp.

---

### Vấn đề 3: Đồng bộ glossary đa ngôn ngữ lên Google Cloud

**Bối cảnh:** Hệ thống có 10 ngôn ngữ, nghĩa là có rất nhiều cặp ngôn ngữ cần glossary riêng (Nhật-Việt, Nhật-Anh, Anh-Việt, ...). Mỗi lần admin duyệt một từ khóa, cần cập nhật tất cả glossary liên quan trên Google Cloud Storage — nếu làm đồng bộ (synchronous) sẽ làm API bị treo lâu.

**Giải pháp:** Tách việc cập nhật glossary thành **tác vụ bất đồng bộ (async)** — admin duyệt xong nhận phản hồi ngay, việc cập nhật Google Cloud chạy ngầm ở background mà không làm chậm trải nghiệm người dùng.

---

### Vấn đề 4: Nhiều request dịch đồng thời bị lẫn dữ liệu

**Bối cảnh:** Khi nhiều người dùng cùng gửi yêu cầu dịch một lúc, nếu dùng biến toàn cục để lưu context (chế độ thư viện, user ID), các request có thể đọc nhầm context của nhau.

**Giải pháp:** Sử dụng **thread-local storage** — mỗi thread (tương ứng mỗi request) có vùng nhớ riêng biệt, đảm bảo context không bị trộn lẫn dù chạy song song.

---

## 4. Tiến Độ Tổng Thể

| Hạng mục | Trạng thái |
|---|---|
| Xác thực JWT + Cognito SSO | ✅ Hoàn thành |
| Dịch file DOCX / XLSX / PPTX | ✅ Hoàn thành |
| Dịch file PDF (text + scan/OCR) | ✅ Hoàn thành |
| Dịch văn bản trực tiếp | ✅ Hoàn thành |
| Thư viện từ khóa riêng | ✅ Hoàn thành |
| Thư viện chung + quy trình duyệt | ✅ Hoàn thành |
| Quản trị tài khoản | ✅ Hoàn thành |
| Thống kê từ khóa | ✅ Hoàn thành |
| Hệ thống thông báo | ✅ Hoàn thành |
| Lịch sử file dịch | ✅ Hoàn thành |
| Deploy production trên AWS | 🔄 Đang tiến hành |

---

## 5. Hướng Phát Triển Tiếp Theo

- Hoàn thiện luồng Cognito SSO trên môi trường production
- Tối ưu tốc độ với hàng đợi tác vụ bất đồng bộ (Celery + Redis) cho file lớn
- Thêm tính năng xem trước bản dịch trước khi tải xuống
- Mở rộng hỗ trợ thêm ngôn ngữ theo yêu cầu của Toray

---

*Ngày báo cáo: 03/06/2026*
