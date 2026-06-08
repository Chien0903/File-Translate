import { useState, useEffect, useRef } from "react";
import {
  FiSearch,
  FiAlertCircle,
  FiArrowUp,
  FiArrowDown,
  FiFilter,
  FiPlus,
  FiSend,
  FiCheck,
  FiRefreshCw,
  FiX,
  FiInfo,
  FiEdit2,
  FiTrash2,
} from "react-icons/fi";
import { FaFileImport, FaFileDownload, FaFileExport } from "react-icons/fa";
import { MdBookmark, MdHourglassEmpty, MdCheckCircle, MdCancel } from "react-icons/md";
import * as XLSX from "xlsx";
import keywordService from "../../services/keywordService";
import { toast } from "react-toastify";
import Pagination from "../../components/Pagination";
import {
  SuggestStatusBadge,
  KeywordDetailModal,
  SuggestConfirmModal,
  KeywordFormModal,
  DeleteModal,
  StatusLegend,
  ALL_LANGUAGES,
  EMPTY_KEYWORD,
} from "../../components/features/privateLibrary";

// ---- helpers ----
// Returns true if this keyword CAN be selected for suggestion
const canSuggest = (kw) =>
  !kw.suggestion_status ||
  kw.suggestion_status === "rejected";

const IMPORT_LANGUAGE_FIELDS = [
  "japanese",
  "english",
  "vietnamese",
  "chinese_traditional",
  "chinese_simplified",
  "bengali",
  "indonesian",
  "hindi",
  "oriya",
  "thai",
];

const buildKeywordSignature = (item) =>
  IMPORT_LANGUAGE_FIELDS.map((field) =>
    String(item?.[field] ?? "")
      .trim()
      .toLowerCase()
  ).join("||");

// ---- Main Page ----
const PrivateLibrary = () => {
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("updated_at");
  const [sortDirection, setSortDirection] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSuggesting, setIsSuggesting] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailKeyword, setDetailKeyword] = useState(null);
  const [suggestConfirmList, setSuggestConfirmList] = useState(null); // array of kw objects to confirm

  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const statusFilterRef = useRef(null);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem("privateLibraryVisibleColumns");
    return saved ? JSON.parse(saved) : ALL_LANGUAGES.map((l) => l.key);
  });

  const columnFilterRef = useRef(null);
  const legendRef = useRef(null);
  const tableContainerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("privateLibraryVisibleColumns", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    const handler = (e) => {
      if (columnFilterRef.current && !columnFilterRef.current.contains(e.target))
        setShowColumnFilter(false);
    };
    if (showColumnFilter) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColumnFilter]);

  useEffect(() => {
    const handler = (e) => {
      if (legendRef.current && !legendRef.current.contains(e.target))
        setShowLegend(false);
    };
    if (showLegend) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showLegend]);

  useEffect(() => {
    const handler = (e) => {
      if (statusFilterRef.current && !statusFilterRef.current.contains(e.target))
        setShowStatusFilter(false);
    };
    if (showStatusFilter) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showStatusFilter]);

  const fetchKeywords = async () => {
    setLoading(true);
    try {
      const res = await keywordService.getPrivateKeywords();
      setKeywords(res.data);
    } catch {
      toast.error("Failed to load your private library.", {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKeywords(); }, []);

  // ---- Import Handlers ----
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        japanese: "",
        english: "",
        vietnamese: "",
        chinese_traditional: "",
        chinese_simplified: "",
        bengali: "",
        indonesian: "",
        hindi: "",
        oriya: "",
        thai: "",
      },
    ];
    const instructionsData = [
      { Step: "1", Instruction: "Fill in the keyword data in the 'Keywords' sheet" },
      { Step: "2", Instruction: "At least one language field must be filled per row" },
      { Step: "3", Instruction: "You can delete the sample data rows (first 2 rows)" },
      { Step: "4", Instruction: "Supported columns: japanese, english, vietnamese, chinese_traditional, chinese_simplified, bengali, indonesian, hindi, oriya, thai" },
      { Step: "5", Instruction: "Column names are flexible (e.g., 'Japanese' or 'jp' also work)" },
      { Step: "6", Instruction: "Save as .xlsx or .xls format" },
      { Step: "7", Instruction: "Import will create private keywords directly in your Private Library" },
      { Step: "8", Instruction: "You can later select keywords and submit to Suggestion queue if needed" },
    ];
    const workbook = XLSX.utils.book_new();
    const keywordsSheet = XLSX.utils.json_to_sheet(templateData);
    keywordsSheet["!cols"] = Array(10).fill({ wch: 20 });
    XLSX.utils.book_append_sheet(workbook, keywordsSheet, "Keywords");
    const instructionsSheet = XLSX.utils.json_to_sheet(instructionsData);
    instructionsSheet["!cols"] = [{ wch: 8 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");
    XLSX.writeFile(workbook, "keyword_import_template.xlsx");
    toast.success("Template downloaded successfully!", {
      style: { backgroundColor: "green", color: "white" },
      icon: <FiAlertCircle />,
      autoClose: 4000,
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (!validTypes.some((t) => file.type === t) && !file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error("Please select a valid Excel file (.xlsx or .xls)", {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
      event.target.value = "";
      return;
    }
    setIsImporting(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(ws);
      if (jsonData.length === 0) {
        toast.error("The Excel file is empty or has no valid data", { style: { backgroundColor: "red", color: "white" }, icon: <FiAlertCircle /> });
        return;
      }
      const findField = (row, standardName, alternatives) => {
        if (row[standardName]) return row[standardName];
        for (const alt of alternatives) {
          const key = Object.keys(row).find((k) => k.toLowerCase().replace(/[^a-z]/g, "") === alt.toLowerCase().replace(/[^a-z]/g, ""));
          if (key && row[key]) return row[key];
        }
        return "";
      };
      const processedData = [];
      const errors = [];
      jsonData.forEach((row, index) => {
        const n = {
          japanese: findField(row, "japanese", ["Japanese", "jp", "ja"]),
          english: findField(row, "english", ["English", "en", "eng"]),
          vietnamese: findField(row, "vietnamese", ["Vietnamese", "vi", "vn"]),
          chinese_traditional: findField(row, "chinese_traditional", ["Chinese Traditional", "zh-tw", "zh_tw"]),
          chinese_simplified: findField(row, "chinese_simplified", ["Chinese Simplified", "zh-cn", "zh_cn"]),
          bengali: findField(row, "bengali", ["Bengali", "bn"]),
          indonesian: findField(row, "indonesian", ["Indonesian", "id"]),
          hindi: findField(row, "hindi", ["Hindi", "hi"]),
          oriya: findField(row, "oriya", ["Oriya", "or"]),
          thai: findField(row, "thai", ["Thai", "th"]),
        };
        if (Object.values(n).every((v) => !v || v.toString().trim() === "")) return;
        const hasContent = Object.values(n).some((v) => v?.toString().trim());
        if (!hasContent) { errors.push(`Row ${index + 2}: At least one language field must be filled`); return; }
        processedData.push(Object.fromEntries(Object.entries(n).map(([k, v]) => [k, v?.toString().trim() || ""])));
      });
      if (errors.length > 0) {
        toast.error(`Import validation errors:\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? "\n..." : ""}`, { style: { backgroundColor: "red", color: "white" }, icon: <FiAlertCircle />, autoClose: 8000 });
        return;
      }
      if (processedData.length === 0) {
        toast.error("No valid data found in the Excel file", { style: { backgroundColor: "red", color: "white" }, icon: <FiAlertCircle /> });
        return;
      }
      setImportPreviewData(processedData);
      setShowImportPreview(true);
    } catch (err) {
      console.error(err);
      toast.error("Error processing the Excel file. Please check the format.", { style: { backgroundColor: "red", color: "white" }, icon: <FiAlertCircle /> });
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  const handleConfirmImport = async () => {
    setShowImportPreview(false);
    setIsImporting(true);
    let successCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const existingBySignature = new Map(
      keywords.map((kw) => [buildKeywordSignature(kw), kw])
    );

    for (const keyword of importPreviewData) {
      try {
        const signature = buildKeywordSignature(keyword);
        const existing = existingBySignature.get(signature);

        if (existing?.id) {
          await keywordService.updatePrivateKeyword(existing.id, keyword);
          updatedCount++;
        } else {
          const created = await keywordService.createPrivateKeyword(keyword);
          createdCount++;
          const createdKeyword = created?.data;
          if (createdKeyword?.id) {
            existingBySignature.set(signature, createdKeyword);
          }
        }
        successCount++;
      } catch (err) {
        errorCount++;
        console.error("Error creating private keyword:", err);
      }
    }
    setIsImporting(false);
    setImportPreviewData([]);
    if (successCount > 0) {
      toast.success(
        `Import completed: ${createdCount} created, ${updatedCount} updated${errorCount > 0 ? `, ${errorCount} failed` : ""}.`,
        { style: { backgroundColor: "green", color: "white" }, icon: <FiAlertCircle />, autoClose: 6000 }
      );
      fetchKeywords();
    } else {
      toast.error("Failed to import any private keywords. Please check your Excel file format.", { style: { backgroundColor: "red", color: "white" }, icon: <FiAlertCircle />, autoClose: 6000 });
    }
  };

  const handleCancelImport = () => {
    setShowImportPreview(false);
    setImportPreviewData([]);
    setIsImporting(false);
  };

  const handleExport = () => {
    if (keywords.length === 0) {
      toast.error("No keywords to export.", {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
      return;
    }
    const exportData = keywords.map((kw) => ({
      english: kw.english || "",
      japanese: kw.japanese || "",
      vietnamese: kw.vietnamese || "",
      chinese_traditional: kw.chinese_traditional || "",
      chinese_simplified: kw.chinese_simplified || "",
      bengali: kw.bengali || "",
      indonesian: kw.indonesian || "",
      hindi: kw.hindi || "",
      oriya: kw.oriya || "",
      thai: kw.thai || "",
      suggestion_status: kw.suggestion_status || "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet["!cols"] = Array(11).fill({ wch: 20 });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Private Library");
    XLSX.writeFile(workbook, "private_library_export.xlsx");
    toast.success("Exported successfully!", {
      style: { backgroundColor: "green", color: "white" },
      icon: <FiAlertCircle />,
    });
  };

  // ---- Sorting & Filtering ----
  const filteredKeywords = keywords
    .filter((item) => {
      const fields = [
        item.english, item.japanese, item.vietnamese,
        item.chinese_traditional, item.chinese_simplified,
        item.bengali, item.indonesian, item.hindi, item.oriya, item.thai,
      ];
      const matchSearch = fields.some((f) =>
        (f || "").toLowerCase().includes(searchTerm.toLowerCase())
      );
      const matchStatus =
        statusFilter === "all" ? true :
        statusFilter === "none" ? !item.suggestion_status :
        item.suggestion_status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      if (sortField === "id")
        return sortDirection === "asc" ? a.id - b.id : b.id - a.id;
      if (sortField === "updated_at") {
        const av = a.updated_at || "", bv = b.updated_at || "";
        return sortDirection === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return 0;
    });

  useEffect(() => { setCurrentPage(1); }, [searchTerm, sortField, sortDirection, statusFilter]);

  const totalPages = Math.ceil(filteredKeywords.length / itemsPerPage) || 1;
  const validPage = Math.max(1, Math.min(currentPage, totalPages));
  const currentItems = filteredKeywords.slice(
    (validPage - 1) * itemsPerPage,
    validPage * itemsPerPage
  );
  const suggestableOnPage = currentItems.filter(canSuggest);

  const getVisibleLanguages = () =>
    ALL_LANGUAGES.filter((l) => visibleColumns.includes(l.key));

  const toggleColumnVisibility = (key) => {
    setVisibleColumns((prev) => {
      if (prev.includes(key)) {
        if (prev.length <= 1) {
          toast.warning("At least one language column must be visible.");
          return prev;
        }
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDirection("asc"); }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <FiArrowUp className="opacity-30" />;
    return sortDirection === "asc" ? <FiArrowUp /> : <FiArrowDown />;
  };

  // ---- Selection (only suggestable items) ----
  const toggleSelect = (id, kw) => {
    if (!canSuggest(kw)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const suggestableIds = suggestableOnPage.map((i) => i.id);
    const allSelected = suggestableIds.every((id) => selectedIds.has(id));
    if (allSelected && suggestableIds.length > 0) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        suggestableIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        suggestableIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const allSuggestableSelected =
    suggestableOnPage.length > 0 &&
    suggestableOnPage.every((i) => selectedIds.has(i.id));

  // ---- Status summary counts ----
  const statusCounts = keywords.reduce(
    (acc, kw) => {
      const s = kw.suggestion_status;
      if (s === "pending") acc.pending++;
      else if (s === "approved") acc.approved++;
      else if (s === "rejected") acc.rejected++;
      else acc.none++;
      return acc;
    },
    { none: 0, pending: 0, approved: 0, rejected: 0 }
  );

  // ---- CRUD ----
  const handleAdd = async (form) => {
    try {
      const res = await keywordService.createPrivateKeyword(form);
      setKeywords((prev) => [res.data, ...prev]);
      setShowAddModal(false);
      toast.success("Keyword added to your private library!", {
        style: { backgroundColor: "green", color: "white" },
        icon: <FiCheck />,
      });
    } catch {
      toast.error("Failed to add keyword.", {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
    }
  };

  const handleEdit = async (form) => {
    try {
      const res = await keywordService.updatePrivateKeyword(editingKeyword.id, form);
      setKeywords((prev) => prev.map((k) => (k.id === res.data.id ? res.data : k)));
      setEditingKeyword(null);
      toast.success("Keyword updated!", {
        style: { backgroundColor: "green", color: "white" },
        icon: <FiCheck />,
      });
    } catch {
      toast.error("Failed to update keyword.", {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
    }
  };

  const handleDelete = async () => {
    try {
      await keywordService.deletePrivateKeyword(deleteTarget);
      setKeywords((prev) => prev.filter((k) => k.id !== deleteTarget));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget);
        return next;
      });
      setDeleteTarget(null);
      toast.success("Keyword deleted.", {
        style: { backgroundColor: "green", color: "white" },
        icon: <FiCheck />,
      });
    } catch {
      toast.error("Failed to delete keyword.", {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
    }
  };

  // ---- Suggest selected — step 1: open confirm modal ----
  const handleSuggest = () => {
    if (selectedIds.size === 0) return;
    const toConfirm = keywords.filter((kw) => selectedIds.has(kw.id));
    setSuggestConfirmList(toConfirm);
  };

  // ---- Suggest selected — step 2: actually submit ----
  const handleSuggestConfirm = async () => {
    if (!suggestConfirmList || suggestConfirmList.length === 0) return;
    setIsSuggesting(true);
    try {
      const res = await keywordService.suggestPrivateKeywords(
        suggestConfirmList.map((kw) => kw.id)
      );

      const data = res.data;
      if (data.suggested_ids?.length > 0) {
        toast.success(data.message, {
          style: { backgroundColor: "green", color: "white" },
          icon: <FiSend />,
        });
      } else {
        toast.info(data.message, {
          style: { backgroundColor: "#004098", color: "white" },
          icon: <FiInfo />,
        });
      }

      setSuggestConfirmList(null);
      setSelectedIds(new Set());
      await fetchKeywords();
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Failed to submit suggestions.",
        { style: { backgroundColor: "red", color: "white" }, icon: <FiAlertCircle /> }
      );
    } finally {
      setIsSuggesting(false);
    }
  };

  // ---- Drag to scroll ----
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };
  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollContainerRef.current.scrollLeft = scrollLeft - (x - startX) * 2;
  };

  const formatDate = (d) => {
    if (!d) return "";
    const date = new Date(d);
    return isNaN(date.getTime())
      ? d
      : `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${String(date.getFullYear()).slice(2)}`;
  };

  // Row background colour based on suggest status
  const rowBg = (item, index) => {
    const s = item.suggestion_status;
    if (s === "approved") return "bg-green-50";
    if (s === "pending") return "bg-yellow-50";
    if (s === "rejected") return "bg-red-50/40";
    return index % 2 === 0 ? "bg-white" : "bg-[#F8F8F8]";
  };

  const stickyBg = (item, index) => {
    const s = item.suggestion_status;
    if (s === "approved") return "#f0fdf4";
    if (s === "pending") return "#fefce8";
    if (s === "rejected") return "#fff5f5";
    return index % 2 === 0 ? "white" : "#F8F8F8";
  };

  return (
    <div className="flex flex-1 flex-col h-full gap-[0.25rem]">
      {/* Loading bar */}
      {loading && (
        <div className="fixed top-0 left-0 w-full h-1 bg-gray-200 z-50">
          <div className="h-full bg-[#004098CC] animate-loading-bar" />
        </div>
      )}

      {/* Top controls */}
      <div className="bg-white p-[0.5rem] rounded-t-lg">
        <div className="flex flex-wrap justify-between items-center gap-3">
          {/* Left: title + action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <MdBookmark className="text-[#004098]" size={22} />
              <span className="text-base font-semibold text-[#004098]">
                My Private Library
              </span>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#004098] text-white rounded-full text-sm font-medium hover:bg-[#003276] transition-colors shadow-sm"
            >
              <FiPlus size={15} />
              Add Keyword
            </button>

            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 text-white rounded-full text-sm font-medium hover:bg-indigo-600 transition-colors shadow-sm"
              title="Download Excel template for import"
            >
              <FaFileDownload size={14} />
              Get Template
            </button>

            <button
              onClick={handleImportClick}
              disabled={isImporting}
              className={`flex items-center gap-1.5 px-4 py-2 text-white rounded-full text-sm font-medium transition-colors shadow-sm ${isImporting ? "bg-gray-400 cursor-not-allowed" : "bg-purple-500 hover:bg-purple-600"}`}
              title="Import keywords from Excel file"
            >
              {isImporting ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                  Importing...
                </>
              ) : (
                <>
                  <FaFileImport size={14} />
                  Import
                </>
              )}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls"
              style={{ display: "none" }}
            />

            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#359740] text-white rounded-full text-sm font-medium hover:bg-[#2e8237] transition-colors shadow-sm"
              title="Export all keywords to Excel"
            >
              <FaFileExport size={14} />
              Export
            </button>

            <button
              onClick={fetchKeywords}
              className="p-2 text-gray-500 hover:text-[#004098] hover:bg-gray-100 rounded-full transition-colors"
              title="Refresh"
            >
              <FiRefreshCw size={16} />
            </button>
          </div>

          {/* Right: status summary + column filter + search */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status filter */}
            <div className="relative" ref={statusFilterRef}>
              <button
                className={`flex items-center gap-2 px-4 py-2 border rounded-full transition-colors text-sm ${
                  statusFilter !== "all"
                    ? "bg-[#004098] border-[#004098] text-white hover:bg-[#003276]"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setShowStatusFilter(!showStatusFilter)}
              >
                <FiFilter size={14} className={statusFilter !== "all" ? "text-white" : "text-gray-600"} />
                <span className="font-medium">
                  {statusFilter === "all" ? "Status" :
                   statusFilter === "none" ? "Not submitted" :
                   statusFilter === "pending" ? "Pending" :
                   statusFilter === "approved" ? "Accepted" : "Rejected"}
                </span>
              </button>
              {showStatusFilter && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1">
                  {[
                    { value: "all", label: "All", color: "text-gray-700" },
                    { value: "none", label: "Not submitted", color: "text-gray-500" },
                    { value: "pending", label: "Pending", color: "text-yellow-600" },
                    { value: "approved", label: "Accepted", color: "text-green-600" },
                    { value: "rejected", label: "Rejected", color: "text-red-500" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setStatusFilter(opt.value); setShowStatusFilter(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${opt.color} ${
                        statusFilter === opt.value ? "bg-gray-100 font-semibold" : ""
                      }`}
                    >
                      {statusFilter === opt.value && <FiCheck size={13} />}
                      {statusFilter !== opt.value && <span className="w-[13px]" />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Column filter */}
            <div className="relative" ref={columnFilterRef}>
              <button
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors text-sm"
                onClick={() => setShowColumnFilter(!showColumnFilter)}
              >
                <FiFilter className="text-gray-600" />
                <span className="font-medium text-gray-700">
                  Columns ({visibleColumns.length}/{ALL_LANGUAGES.length})
                </span>
              </button>
              {showColumnFilter && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b border-gray-200 p-3 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-700 text-sm">Show/Hide Columns</h4>
                    <button onClick={() => setShowColumnFilter(false)} className="text-gray-400 hover:text-gray-600">
                      <FiX size={16} />
                    </button>
                  </div>
                  <div className="p-2">
                    {ALL_LANGUAGES.map((lang) => (
                      <label
                        key={lang.key}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={visibleColumns.includes(lang.key)}
                          onChange={() => toggleColumnVisibility(lang.key)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700 flex-1">{lang.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative w-72">
              <FiSearch className="absolute left-3 top-2.5 text-gray-500 z-10" />
              <input
                type="text"
                placeholder="Search in all languages..."
                className="p-2 pl-10 border border-gray-300 rounded-full w-full bg-white text-black placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && keywords.length > 0 && (
        <div className="bg-white px-4 py-2.5 flex flex-wrap items-center gap-4 border-t border-gray-100 text-sm">
          <div className="flex items-center gap-1.5 text-gray-600">
            <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
            <span>Total:</span>
            <span className="font-semibold text-gray-800">{keywords.length}</span>
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1.5 text-blue-600">
            <FiSend size={13} />
            <span>Submitted:</span>
            <span className="font-semibold">{statusCounts.pending + statusCounts.approved + statusCounts.rejected}</span>
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1.5 text-yellow-600">
            <MdHourglassEmpty size={15} />
            <span>Pending:</span>
            <span className="font-semibold">{statusCounts.pending}</span>
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1.5 text-green-600">
            <MdCheckCircle size={15} />
            <span>Accepted:</span>
            <span className="font-semibold">{statusCounts.approved}</span>
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1.5 text-red-500">
            <MdCancel size={15} />
            <span>Rejected:</span>
            <span className="font-semibold">{statusCounts.rejected}</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white p-[0.5rem] rounded-b-lg flex-1 flex flex-col min-h-0 shadow-sm">
        <div
          ref={tableContainerRef}
          className="flex-1 flex flex-col min-h-0 overflow-hidden border border-gray-200"
        >
          <div
            ref={scrollContainerRef}
            className={`overflow-auto flex-1 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
          >
            <table className="min-w-full border-collapse bg-white">
              <thead className="sticky top-0 z-20">
                <tr className="bg-[#004098] text-white font-bold">
                  {/* No. */}
                  <th
                    className="p-2 border-b border-gray-300 text-center cursor-pointer hover:bg-[#003875] sticky left-0 z-30 bg-[#004098] border-r border-white/20 text-xs"
                    style={{ width: 60, minWidth: 60 }}
                    onClick={() => handleSort("id")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      No {getSortIcon("id")}
                    </div>
                  </th>
                  {/* English */}
                  <th
                    className="p-2 border-b border-gray-300 text-center border-r border-white/20 sticky left-[60px] z-30 bg-[#004098] text-xs"
                    style={{ width: 220, minWidth: 220, boxShadow: "3px 0 8px rgba(0,0,0,0.15)" }}
                  >
                    English
                  </th>
                  {/* Language columns */}
                  {getVisibleLanguages().map((lang) => (
                    <th
                      key={lang.key}
                      className="p-2 border-b border-gray-300 text-center border-r border-white/20 text-xs"
                      style={{ width: 180, minWidth: 180 }}
                    >
                      {lang.label}
                    </th>
                  ))}
                  {/* Modified */}
                  <th
                    className="p-2 border-b border-gray-300 text-center cursor-pointer hover:bg-[#003875] border-r border-white/20 text-xs"
                    style={{ width: 100, minWidth: 100 }}
                    onClick={() => handleSort("updated_at")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Modified {getSortIcon("updated_at")}
                    </div>
                  </th>
                  {/* Actions */}
                  <th
                    className="p-2 border-b border-gray-300 text-center border-r border-white/20 text-xs sticky right-[110px] z-30 bg-[#004098]"
                    style={{ width: 80, minWidth: 80 }}
                  >
                    Actions
                  </th>
                  {/* Suggest column header */}
                  <th
                    className="p-2 border-b border-gray-300 text-xs sticky right-0 z-30 bg-[#004098]"
                    style={{ width: 110, minWidth: 110, boxShadow: "-3px 0 8px rgba(0,0,0,0.15)" }}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={allSuggestableSelected}
                          onChange={toggleSelectAll}
                          disabled={suggestableOnPage.length === 0}
                          className="w-3.5 h-3.5 accent-green-400 cursor-pointer disabled:opacity-40"
                          title="Select all suggestable on this page"
                        />
                        <span className="font-normal opacity-90">Suggest</span>
                        {/* Info icon */}
                        <div className="relative" ref={legendRef}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowLegend((v) => !v); }}
                            className="text-white/60 hover:text-white transition-colors"
                            title="Status legend"
                          >
                            <FiInfo size={11} />
                          </button>
                          {showLegend && (
                            <StatusLegend onClose={() => setShowLegend(false)} />
                          )}
                        </div>
                      </div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length === 0 && !loading ? (
                  <tr>
                    <td
                      colSpan={5 + getVisibleLanguages().length}
                      className="py-16 text-center text-gray-400"
                    >
                      {searchTerm
                        ? "No keywords match your search."
                        : 'Your private library is empty. Click "Add Keyword" to get started.'}
                    </td>
                  </tr>
                ) : (
                  currentItems.map((item, index) => {
                    const isSelected = selectedIds.has(item.id);
                    const suggestable = canSuggest(item);
                    const ss = item.suggestion_status;

                    return (
                      <tr
                        key={item.id}
                        className={`transition-all duration-150 hover:brightness-95 cursor-pointer ${rowBg(item, index)}`}
                        onClick={() => setDetailKeyword(item)}
                      >
                        {/* No. */}
                        <td
                          className="p-2 border-b border-gray-200 text-center sticky left-0 z-10 border-r text-sm font-medium text-gray-700"
                          style={{ backgroundColor: stickyBg(item, index) }}
                        >
                          {(validPage - 1) * itemsPerPage + index + 1}
                        </td>
                        {/* English */}
                        <td
                          className="p-2 border-b border-gray-200 text-left sticky left-[60px] z-10 border-r text-sm"
                          style={{
                            backgroundColor: stickyBg(item, index),
                            boxShadow: "3px 0 8px rgba(0,0,0,0.05)",
                            maxWidth: 220,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={item.english || ""}
                        >
                          {item.english || (
                            <span className="text-gray-400 italic">—</span>
                          )}
                        </td>
                        {/* Language columns */}
                        {getVisibleLanguages().map((lang) => (
                          <td
                            key={lang.key}
                            className="p-2 border-b border-gray-200 text-left border-r border-gray-100 text-sm"
                            style={{
                              maxWidth: 180,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={item[lang.key] || ""}
                          >
                            {item[lang.key] || (
                              <span className="text-gray-300 italic">—</span>
                            )}
                          </td>
                        ))}
                        {/* Modified */}
                        <td className="p-2 border-b border-gray-200 text-center border-r border-gray-100">
                          <span className="text-xs text-gray-600">
                            {formatDate(item.updated_at)}
                          </span>
                        </td>
                        {/* Actions */}
                        <td
                          className="p-2 border-b border-gray-200 text-center border-r border-gray-100 sticky right-[110px] z-10"
                          style={{ backgroundColor: stickyBg(item, index) }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              className="p-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200 transition-all"
                              onClick={() => setEditingKeyword(item)}
                              title="Edit"
                            >
                              <FiEdit2 className="text-blue-600 w-3.5 h-3.5" />
                            </button>
                            <button
                              className="p-1.5 bg-red-50 rounded-lg hover:bg-red-100 border border-red-200 transition-all"
                              onClick={() => setDeleteTarget(item.id)}
                              title="Delete"
                            >
                              <FiTrash2 className="text-red-600 w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        {/* Suggest checkbox + status badge */}
                        <td
                          className="p-2 border-b border-gray-200 text-center align-middle sticky right-0 z-10"
                          style={{
                            backgroundColor: stickyBg(item, index),
                            boxShadow: "-3px 0 8px rgba(0,0,0,0.05)",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            {ss && <SuggestStatusBadge status={ss} />}
                            {suggestable ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(item.id, item)}
                                className="w-4 h-4 accent-green-600 cursor-pointer"
                                title={
                                  ss === "rejected"
                                    ? "Rejected — check to suggest again"
                                    : "Check to suggest to the shared library"
                                }
                              />
                            ) : (
                              !ss && <span className="text-gray-300 text-xs">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && currentItems.length > 0 && (
            <Pagination
              currentPage={validPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      </div>

      {/* Bottom action banner */}
      {selectedIds.size > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-green-800">
            <FiSend size={14} />
            <span>
              <strong>{selectedIds.size}</strong> keyword{selectedIds.size > 1 ? "s" : ""} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-xs text-green-700 border border-green-300 rounded-full hover:bg-green-100 transition-colors whitespace-nowrap"
            >
              Clear
            </button>
            <button
              onClick={handleSuggest}
              disabled={isSuggesting}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white rounded-full text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              <FiSend size={13} />
              {isSuggesting ? "Submitting..." : `Suggest (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <KeywordFormModal
          initial={EMPTY_KEYWORD}
          title="Add Keyword to Private Library"
          onSave={handleAdd}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {editingKeyword && (
        <KeywordFormModal
          initial={editingKeyword}
          title="Edit Keyword"
          suggestionStatus={editingKeyword.suggestion_status}
          onSave={handleEdit}
          onClose={() => setEditingKeyword(null)}
        />
      )}

      {deleteTarget !== null && (
        <DeleteModal
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Detail Modal */}
      {detailKeyword && (
        <KeywordDetailModal
          keyword={detailKeyword}
          onClose={() => setDetailKeyword(null)}
          onEdit={(kw) => setEditingKeyword(kw)}
        />
      )}

      {/* Suggest Confirm Modal */}
      {suggestConfirmList && (
        <SuggestConfirmModal
          keywords={suggestConfirmList}
          onConfirm={handleSuggestConfirm}
          onCancel={() => setSuggestConfirmList(null)}
          isSubmitting={isSuggesting}
        />
      )}

      {/* Import Preview Modal */}
      {showImportPreview && (
        <div
          className="fixed inset-0 flex justify-center items-center z-50"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={handleCancelImport}
        >
          <div
            className="bg-white p-6 rounded-lg shadow-xl max-w-6xl w-11/12 max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <FaFileImport className="text-purple-500 text-2xl" />
                <h3 className="text-lg text-[#004098] font-bold">
                  Preview Import Data ({importPreviewData.length} keywords)
                </h3>
              </div>
              <button onClick={handleCancelImport} className="text-gray-400 hover:text-gray-600">
                <FiX size={20} />
              </button>
            </div>
            <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-sm">
              <p className="text-yellow-700">
                <strong>Please review the keywords below before importing.</strong>{" "}
                These will be added as suggestions and require Library Keeper approval before being added to Common Library.
              </p>
            </div>
            <div className="overflow-auto max-h-[55vh] mb-6 border border-gray-200 rounded-lg">
              <table className="w-full border-collapse bg-white min-w-max">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#004098] text-white font-bold text-sm">
                    <th className="p-3 text-center border-r border-white/20 w-14">No</th>
                    <th className="p-3 text-center border-r border-white/20 min-w-[140px]">English</th>
                    {["Japanese","Vietnamese","Chinese Traditional","Chinese Simplified","Bengali","Indonesian","Hindi","Oriya","Thai"].map((l) => (
                      <th key={l} className="p-3 text-center border-r border-white/20 min-w-[140px]">{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importPreviewData.map((item, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="p-3 border-r border-b border-gray-200 text-center text-sm text-gray-600">{index + 1}</td>
                      <td className="p-3 border-r border-b border-gray-200 text-sm text-gray-700">{item.english || <span className="text-gray-400 italic">—</span>}</td>
                      {["japanese","vietnamese","chinese_traditional","chinese_simplified","bengali","indonesian","hindi","oriya","thai"].map((key) => (
                        <td key={key} className="p-3 border-r border-b border-gray-200 text-sm text-gray-700">
                          {item[key] || <span className="text-gray-400 italic">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-center gap-4 pt-4 border-t border-gray-200">
              <button
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                onClick={handleCancelImport}
              >
                Cancel
              </button>
              <button
                className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-60"
                onClick={handleConfirmImport}
                disabled={isImporting}
              >
                {isImporting ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Importing...
                  </span>
                ) : "Confirm Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivateLibrary;
