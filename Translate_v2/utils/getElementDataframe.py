import pandas as pd

def first_not_null(series):
    return series.dropna().iloc[0] if not series.dropna().empty else None


def merge_style_by_interval(df_content, df_style):
    df = df_content.copy()
    df = df.replace({None: pd.NA})
    exclude_cols = {"offset", "length", "end_offset"}

    style_cols = [
        col
        for col in df_style.columns
        if col not in exclude_cols
    ]

    # tạo cột rỗng nếu chưa có
    for col in style_cols:
        if col not in df.columns:
            df[col] = pd.NA

    for idx, row in df.iterrows():
        matches = df_style[
            (row["offset"] < df_style["end_offset"]) &
            (row["end_offset"] > df_style["offset"])
        ]

        if matches.empty:
            continue

        for col in style_cols:
            if pd.isna(row[col]):
                val = matches[col].dropna()
                if not val.empty:
                    df.at[idx, col] = val.iloc[0]
    return df


def get_element_dataframe(json_data):
    if isinstance(json_data, str):
        json_data = json.loads(json_data)
    
    # get style 
    style_data = {"offset": [],
                  "length": [],
                  "color": [],
                  "fontStyle": [],
                  "similarFontFamily": [],
                  "fontWeight": [],
                  "backgroundColor": [],
                  "end_offset": []}
    for style in json_data.get("styles"):
        for span in style.get("spans"):
            style_data["offset"].append(span.get("offset"))
            style_data["length"].append(span.get("length"))
            style_data["end_offset"].append(span.get("offset") + span.get("length"))
            style_data["color"].append(style.get("color", None))
            style_data["fontStyle"].append(style.get("fontStyle", None))
            style_data["similarFontFamily"].append(style.get("similarFontFamily", None))
            style_data["fontWeight"].append(style.get("fontWeight", None))
            style_data["backgroundColor"].append(style.get("backgroundColor", None))
    df_style = pd.DataFrame(style_data)
    df_style_merged = (
        df_style
        .groupby(["offset", "length"], as_index=False)
        .agg({
            "color": first_not_null,
            "fontStyle": first_not_null,
            "similarFontFamily": first_not_null,
            "fontWeight": first_not_null,
            "backgroundColor": first_not_null,
            "end_offset": first_not_null
        })
    )



    # get line
    line_layout = {"offset": [],
                   "length": [],
                   "end_offset": [],
                   "content": [],
                   "polygon": []}
    for page in json_data.get("pages", []):
        for line in page.get("lines", []):
            line_layout["offset"].append(line.get("spans")[0].get("offset"))
            line_layout["length"].append(line.get("spans")[0].get("length"))
            line_layout["end_offset"].append(line.get("spans")[0].get("offset") + line.get("spans")[0].get("length"))
            line_layout["content"].append(line.get("content"))
            line_layout["polygon"].append(line.get("polygon"))
    df_line = pd.DataFrame(line_layout)


    # ================================
    # 1️⃣ TABLE LAYOUT
    # ================================

    table_layout = {
        "table_index": [],
        "pageNumber": [],
        "polygon": [],
        "offset": [],
        "length": [],
        "end_offset": [],
        "content": [],
        "paragraph_index": [],
        "role": []
    }

    for table_index, table in enumerate(json_data.get("tables", [])):
        for cell in table.get("cells", []):
            if cell.get("content", "").strip() == "":
                continue

            offset = cell.get("spans")[0].get("offset")
            length = cell.get("spans")[0].get("length")

            table_layout["table_index"].append(table_index)
            table_layout["pageNumber"].append(cell.get("boundingRegions")[0].get("pageNumber"))
            table_layout["polygon"].append(cell.get("boundingRegions")[0].get("polygon"))
            table_layout["offset"].append(offset)
            table_layout["length"].append(length)
            table_layout["end_offset"].append(offset + length)
            table_layout["content"].append(cell.get("content"))
            table_layout["paragraph_index"].append(
                cell.get("elements", [None])[-1].split("/")[-1]
                if cell.get("elements") else None
            )
            table_layout["role"].append(cell.get("kind", None))

    df_table = pd.DataFrame(table_layout)


    # ================================
    # 2️⃣ PARAGRAPH LAYOUT
    # ================================

    paragraph_layout = {
        "paragraph_index": [],
        "pageNumber": [],
        "polygon": [],
        "offset": [],
        "length": [],
        "end_offset": [],
        "content": [],
        "role": []
    }

    for paragraph_index, paragraph in enumerate(json_data.get("paragraphs", [])):

        offset = paragraph.get("spans")[0].get("offset")
        length = paragraph.get("spans")[0].get("length")

        paragraph_layout["paragraph_index"].append(paragraph_index)
        paragraph_layout["pageNumber"].append(paragraph.get("boundingRegions")[0].get("pageNumber"))
        paragraph_layout["polygon"].append(paragraph.get("boundingRegions")[0].get("polygon"))
        paragraph_layout["offset"].append(offset)
        paragraph_layout["length"].append(length)
        paragraph_layout["end_offset"].append(offset + length)
        paragraph_layout["content"].append(paragraph.get("content"))
        paragraph_layout["role"].append(paragraph.get("role", None))

    df_paragraph = pd.DataFrame(paragraph_layout)


    # ================================
    # 3️⃣ ĐẾM LINE TRONG PARAGRAPH (GIỮ NGUYÊN)
    # ================================

    df_para_indexed = df_paragraph.reset_index().rename(columns={"index": "para_index"})

    df_line["key"] = 1
    df_para_indexed["key"] = 1

    df_join = df_line.merge(
        df_para_indexed,
        on="key",
        suffixes=("_line", "_para")
    )

    df_join = df_join[
        (df_join["offset_line"] >= df_join["offset_para"]) &
        (df_join["end_offset_line"] <= df_join["end_offset_para"])
    ]

    count_series = df_join.groupby("para_index").size()

    df_para_indexed["line_count"] = (
        df_para_indexed["para_index"]
        .map(count_series)
        .fillna(0)
        .astype(int)
    )

    df_para_indexed = df_para_indexed.drop(columns=["key"])

    df_paragraph = df_para_indexed.rename(
        columns={
            "offset_para": "offset",
            "end_offset_para": "end_offset"
        }
    )


    # ================================
    # 4️⃣ MERGE STYLE
    # ================================

    df_paragraph = merge_style_by_interval(df_paragraph, df_style_merged)


    # ================================
    # 5️⃣ MERGE TABLE → PARAGRAPH
    # ================================

    df_paragraph["key"] = 1
    df_table["key"] = 1

    df_para_table = df_paragraph.merge(
        df_table[["table_index", "offset", "end_offset", "polygon", "key"]],
        on="key",
        suffixes=("_para", "_table")
    )

    # Lọc paragraph nằm hoàn toàn trong cell table
    df_para_table = df_para_table[
        (df_para_table["offset_para"] >= df_para_table["offset_table"]) &
        (df_para_table["end_offset_para"] <= df_para_table["end_offset_table"])
    ]

    df_para_table = df_para_table[[
        "paragraph_index",
        "table_index",
        "polygon_table"
    ]]

    # Merge lại
    df_paragraph = df_paragraph.merge(
        df_para_table,
        on="paragraph_index",
        how="left"
    )

    # Ưu tiên polygon của table nếu có
    df_paragraph["polygon"] = df_paragraph["polygon_table"].combine_first(
        df_paragraph["polygon"]
    )

    df_paragraph = df_paragraph.drop(columns=["polygon_table", "key"])


    # ================================
    # ✅ KẾT QUẢ
    # ================================

    # df_paragraph có:
    # - line_count
    # - table_index (NaN nếu không thuộc table)
    # - polygon ưu tiên:
    #       Table polygon > Paragraph polygon

    # ==============================
    # CREATE df_line_style
    # ==============================

    # Copy để tránh ảnh hưởng df_line gốc
    df_line_style = df_line.copy()

    # Merge style theo interval
    df_line_style = merge_style_by_interval(df_line_style, df_style_merged)

    # Thêm line_index
    df_line_style = df_line_style.reset_index().rename(columns={"index": "line_index"})

    # Thêm pageNumber nếu muốn giống paragraph
    page_numbers = []
    for page in json_data.get("pages", []):
        for line in page.get("lines", []):
            page_numbers.append(page.get("pageNumber"))

    df_line_style["pageNumber"] = page_numbers

    # Thêm line_count = 1 (vì mỗi line là 1 dòng)
    df_line_style["line_count"] = 1

    # Sắp xếp lại thứ tự cột cho giống paragraph
    ordered_cols = [
        "line_index",
        "pageNumber",
        "polygon",
        "offset",
        "length",
        "end_offset",
        "content",
        "line_count",
        "color",
        "fontStyle",
        "similarFontFamily",
        "fontWeight",
        "backgroundColor"
    ]

    df_line_style = df_line_style[[col for col in ordered_cols if col in df_line_style.columns]]


    return df_style_merged, df_paragraph, df_line_style

if __name__ == "__main__":
    import json
    json_path = "/Users/loclinh/Documents/TORAY/OCR/newapp1/input/自転車の違反にも青切符2026年4月1日適用.pdf.json"
    with open(json_path, 'r', encoding='utf-8') as f:
        sample_json = json.load(f)
    df_style, df_paragraph, df_line_style = get_element_dataframe(sample_json)
    # print(df_table)
    print(df_paragraph["role"].unique())
    df_paragraph.to_csv("/Users/loclinh/Documents/TORAY/OCR/newapp1/output/paragraph1.csv", index=False)
    df_line_style.to_csv("/Users/loclinh/Documents/TORAY/OCR/newapp1/output/line_style1.csv", index=False)