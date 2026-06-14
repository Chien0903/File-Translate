# Hướng dẫn compile báo cáo LaTeX

## Yêu cầu

- TeX distribution: MikTeX (Windows) hoặc TeX Live (Linux/Mac)
- Các gói cần thiết: times, babel-vietnamese, fontenc T5, hyperref, listings, booktabs, tabularx, longtable, tocloft, titlesec, setspace

## Bước cần làm trước khi compile

### 1. Điền thông tin cá nhân trong `main.tex`

Tìm và thay các placeholder sau:
```
\newcommand{\studentname}{[TÊN SINH VIÊN]}          → Họ tên đầy đủ
\newcommand{\studentid}{[MSSV]}                      → Mã số sinh viên
\newcommand{\studentemail}{[email@sis.hust.edu.vn]}  → Email HUST
\newcommand{\supervisor}{[HỌC VỊ. TÊN GVHD]}        → Giảng viên hướng dẫn
```
Và trong `chapters/cover.tex`:
```
[KÝ HIỆU LỚP]   → Ký hiệu lớp học
[KHOÁ]           → Khoá học (vd: 66)
```

### 2. Thêm logo HUST

Đặt file `hust_logo.png` (logo ĐHBKHN) vào thư mục `figures/`.
Tải từ trang web chính thức của trường.

### 3. Thêm hình minh họa (tùy chọn)

Thư mục `figures/` để chứa các hình ảnh/screenshot giao diện.
Các vị trí `\fbox{...Image Description...}` là placeholder cho hình thật.
Thay bằng `\includegraphics[width=\textwidth]{ten_hinh}` khi có hình.

## Compile

```bash
# Lần 1: compile chính
pdflatex main.tex

# Compile bibliography
bibtex main

# Lần 2 và 3: cập nhật references và ToC
pdflatex main.tex
pdflatex main.tex
```

Hoặc dùng `latexmk`:
```bash
latexmk -pdf -pdflatex="pdflatex -interaction=nonstopmode" main.tex
```

## Cấu trúc thư mục

```
report/
├── main.tex                  ← File chính
├── references.bib            ← Tài liệu tham khảo (IEEE)
├── README_COMPILE.md         ← File này
├── figures/                  ← Hình ảnh (tạo thư mục này)
│   └── hust_logo.png
└── chapters/
    ├── cover.tex             ← Trang bìa
    ├── acknowledgement.tex   ← Lời cảm ơn
    ├── abstract_vie.tex      ← Tóm tắt tiếng Việt
    ├── abstract_eng.tex      ← Abstract tiếng Anh
    ├── acronyms.tex          ← Danh mục từ viết tắt
    ├── chapter1.tex          ← Chương 1: Giới thiệu
    ├── chapter2.tex          ← Chương 2: Phân tích yêu cầu
    ├── chapter3.tex          ← Chương 3: Công nghệ
    ├── chapter4.tex          ← Chương 4: Thiết kế & Triển khai
    ├── chapter5.tex          ← Chương 5: Đóng góp nổi bật
    ├── chapter6.tex          ← Chương 6: Kết luận
    └── appendix.tex          ← Phụ lục
```

## Nội dung cần bổ sung thủ công

Các mục sau được đánh dấu `Agent: [NEED_MANUAL_REVIEW]` hoặc `fbox{...Image Description...}`:

1. **Hình ảnh/screenshot giao diện** tại tất cả `\fbox{Image Description:...}` trong các chương
2. **Lời cảm ơn** chi tiết trong `acknowledgement.tex`
3. **Thông tin lớp/khoá** trong `cover.tex`
4. Điều chỉnh **số trang ước tính** nếu cần theo yêu cầu của từng chương
