import pandas as pd
from itertools import combinations

# Danh sách cột ngôn ngữ (5 cột)
languages = [
    "English",
    "Japanese",
    "Vietnamese",
    "Chinese (Traditional)",
    "Chinese (Simplified)",
]

def pair_statistic(input_path, min_percentage: float = 2.0):
    """Thống kê từng sheet cặp ngôn ngữ, tính tần suất xuất hiện và lọc theo ngưỡng phần trăm.

    input_path: đường dẫn file Excel đầu vào, gồm các cột languages ở trên.
    min_percentage: ngưỡng phần trăm tối thiểu để giữ lại (mặc định 2.0%).
    """
    df = pd.read_excel(input_path)
    total_rows = len(df)
    output_path = input_path.replace('.xlsx', "_pairs.xlsx")

    with pd.ExcelWriter(output_path) as writer:
        # Tạo tất cả các cặp ngôn ngữ
        for lang1, lang2 in combinations(languages, 2):
            # Bỏ qua nếu cột không tồn tại trong input
            if lang1 not in df.columns or lang2 not in df.columns:
                continue

            pair_df = df[[lang1, lang2]].copy()
            pair_df.columns = [lang1, lang2]

            # Đếm số lần xuất hiện và sắp xếp giảm dần
            pair_counts = (
                pair_df
                .value_counts()
                .reset_index(name="Count")
            )
            if total_rows > 0:
                pair_counts["Percentage"] = (pair_counts["Count"] / total_rows * 100).round(2)
            else:
                pair_counts["Percentage"] = 0.0

            # Lọc các dòng có phần trăm >= min_percentage
            filtered = pair_counts[pair_counts["Percentage"] >= float(min_percentage)]
            filtered = filtered.sort_values(by="Percentage", ascending=False)

            sheet_name = f"{lang1}-{lang2}"
            filtered.to_excel(writer, sheet_name=sheet_name, index=False)

    return output_path

def suggestion_statistic(input_path, min_percentage: float = 2.0):
    """Gộp tất cả sheet cặp ngôn ngữ thành 1 sheet gồm 5 cột ngôn ngữ.

    Kết quả: mỗi dòng chứa giá trị cho 1-2 cột (từ cặp), các cột còn lại để trống.
    """
    pair_statistic_path = pair_statistic(input_path, min_percentage=min_percentage)
    excel = pd.ExcelFile(pair_statistic_path)
    output_file = input_path.replace(".xlsx", "_prefill.xlsx")

    all_rows = []

    for sheet_name in excel.sheet_names:
        df = excel.parse(sheet_name)
        # Lấy tên cặp ngôn ngữ từ tên sheet, ví dụ: English-Vietnamese
        try:
            lang1, lang2 = sheet_name.split("-")
        except ValueError:
            # Sheet name không đúng định dạng cặp, bỏ qua
            continue

        # Chuẩn hóa tên cột đầu vào nếu tồn tại đủ cột
        if df.shape[1] >= 2:
            # Chỉ lấy 2 cột đầu (giá trị cặp)
            df = df.iloc[:, :2]
            df.columns = ["Lang1", "Lang2"]
        else:
            continue

        for _, row in df.iterrows():
            new_row = {
                "English": "",
                "Japanese": "",
                "Vietnamese": "",
                "Chinese (Traditional)": "",
                "Chinese (Simplified)": "",
            }
            new_row[lang1] = row["Lang1"]
            new_row[lang2] = row["Lang2"]
            all_rows.append(new_row)

    final_df = pd.DataFrame(all_rows, columns=languages)
    final_df.to_excel(output_file, index=False)

    return output_file

if __name__ == "__main__":
    # Ví dụ chạy tay: cập nhật đường dẫn và ngưỡng theo nhu cầu
    user_suggestion_file = r"C:\\Users\\User\\OneDrive - Hanoi University of Science and Technology\\Documents\\Lập trình cơ bản\\Projects\\[ISE] Toray translator project\\Libary_statistic\\suggestion.xlsx"
    suggestion_statistic(user_suggestion_file, min_percentage=2.0)