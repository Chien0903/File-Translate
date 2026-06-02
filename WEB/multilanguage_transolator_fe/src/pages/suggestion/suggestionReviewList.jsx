import { useEffect, useState, useRef, useMemo } from "react";
import keywordService from "../../services/keywordService";
import notificationService from "../../services/notificationService";
import { toast } from "react-toastify";
import {
  FiCheckCircle,
  FiAlertCircle,
  FiEdit2,
  FiTrash2,
  FiDownload,
  FiSave,
  FiUpload,
  FiFilter,
  FiX,
  FiArrowUp,
  FiArrowDown,
} from "react-icons/fi";
import Pagination from "../../components/Pagination";
import Button from "../../components/common/Button";
import * as XLSX from "xlsx";

// Define all available languages
const ALL_LANGUAGES = [
  { key: 'japanese', label: 'Japanese' },
  { key: 'vietnamese', label: 'Vietnamese' },
  { key: 'chinese_traditional', label: 'Chinese Traditional' },
  { key: 'chinese_simplified', label: 'Chinese Simplified' },
  { key: 'bengali', label: 'Bengali' },
  { key: 'indonesian', label: 'Indonesian' },
  { key: 'hindi', label: 'Hindi' },
  { key: 'oriya', label: 'Oriya' },
  { key: 'thai', label: 'Thai' }
];

const ITEMS_PER_PAGE = 10;

const SuggestionReviewList = () => {
  const [allSuggestions, setAllSuggestions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSuggestions, setSelectedSuggestions] = useState([]);
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("created_at");
  const [sortDirection, setSortDirection] = useState("desc");
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Column filter states
  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('suggestionVisibleColumns');
    return saved ? JSON.parse(saved) : ALL_LANGUAGES.map(lang => lang.key);
  });
  const columnFilterRef = useRef(null);

  // Session storage keys for persistent state
  const STORAGE_KEYS = {
    editingId: "suggestion_editing_id",
    editedData: "suggestion_edited_data",
    currentPage: "suggestion_current_page",
  };

  // Utility functions for session storage
  const saveEditingState = (id, data, page) => {
    if (id) {
      sessionStorage.setItem(STORAGE_KEYS.editingId, id.toString());
      sessionStorage.setItem(STORAGE_KEYS.editedData, JSON.stringify(data));
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.editingId);
      sessionStorage.removeItem(STORAGE_KEYS.editedData);
    }
    sessionStorage.setItem(STORAGE_KEYS.currentPage, page.toString());
  };

  const restoreEditingState = () => {
    const savedEditingId = sessionStorage.getItem(STORAGE_KEYS.editingId);
    const savedEditedData = sessionStorage.getItem(STORAGE_KEYS.editedData);
    const savedCurrentPage = sessionStorage.getItem(STORAGE_KEYS.currentPage);

    return {
      editingId: savedEditingId ? parseInt(savedEditingId) : null,
      editedData: savedEditedData ? JSON.parse(savedEditedData) : {},
      currentPage: savedCurrentPage ? parseInt(savedCurrentPage) : 1,
    };
  };

  const clearEditingState = () => {
    sessionStorage.removeItem(STORAGE_KEYS.editingId);
    sessionStorage.removeItem(STORAGE_KEYS.editedData);
    sessionStorage.removeItem(STORAGE_KEYS.currentPage);
  };

  // Save visible columns to localStorage
  useEffect(() => {
    localStorage.setItem('suggestionVisibleColumns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Handle click outside to close column filter
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (columnFilterRef.current && !columnFilterRef.current.contains(event.target)) {
        setShowColumnFilter(false);
      }
    };

    if (showColumnFilter) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColumnFilter]);

  // Toggle column visibility
  const toggleColumnVisibility = (columnKey) => {
    setVisibleColumns(prev => {
      if (prev.includes(columnKey)) {
        // Don't allow hiding all columns
        if (prev.length <= 1) {
          toast.warning("At least one language column must be visible", {
            style: { backgroundColor: "orange", color: "white" },
            icon: <FiAlertCircle />,
          });
          return prev;
        }
        return prev.filter(key => key !== columnKey);
      } else {
        return [...prev, columnKey];
      }
    });
  };

  // Select all columns
  const selectAllColumns = () => {
    setVisibleColumns(ALL_LANGUAGES.map(lang => lang.key));
  };

  // Deselect all columns (keep at least one)
  const deselectAllColumns = () => {
    // Keep only the first language
    setVisibleColumns([ALL_LANGUAGES[0].key]);
  };

  // Get filtered languages based on visibility
  const getVisibleLanguages = () => {
    return ALL_LANGUAGES.filter(lang => visibleColumns.includes(lang.key));
  };

  // Handle column sort
  const handleSort = (field) => {
    if (sortField === field) {
      // Same field, toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, default to descending for created_at, ascending for others
      setSortField(field);
      setSortDirection(field === "created_at" ? "desc" : "asc");
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    
    // Format as MM/DD/YY HH:mm
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const year = date.getFullYear().toString().substring(2);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    
    return `${month}/${day}/${year} ${hours}:${minutes}`;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle shortcuts when not editing
      if (editingId) return;

      // Ctrl/Cmd + D for bulk delete toggle
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        setBulkDeleteMode((prev) => !prev);
      }

      // Escape to exit bulk mode
      if (e.key === "Escape" && bulkDeleteMode) {
        setBulkDeleteMode(false);
        setSelectedSuggestions([]);
      }

      // Ctrl/Cmd + A to select all (in bulk mode)
      if ((e.ctrlKey || e.metaKey) && e.key === "a" && bulkDeleteMode) {
        e.preventDefault();
        handleSelectAll();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [bulkDeleteMode, editingId]);

  // Derived data — filter + sort computed without extra state
  const filteredSuggestions = useMemo(() => {
    let result = [...allSuggestions];
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter((s) =>
        [s.japanese, s.english, s.vietnamese, s.chinese_traditional,
         s.chinese_simplified, s.bengali, s.indonesian, s.hindi, s.oriya, s.thai]
        .some((f) => (f || "").toLowerCase().includes(lower))
      );
    }
    return result.sort((a, b) => {
      if (sortField === "created_at") {
        return sortDirection === "asc"
          ? new Date(a.created_at || 0) - new Date(b.created_at || 0)
          : new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      return sortDirection === "asc" ? a.id - b.id : b.id - a.id;
    });
  }, [allSuggestions, searchTerm, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredSuggestions.length / ITEMS_PER_PAGE));
  const validPage = Math.max(1, Math.min(currentPage, totalPages));
  const currentItems = filteredSuggestions.slice(
    (validPage - 1) * ITEMS_PER_PAGE,
    validPage * ITEMS_PER_PAGE
  );

  // Initial data fetch
  useEffect(() => {
    fetchSuggestions();
  }, []);

  const findPageContainingSuggestion = (suggestionId) => {
    const idx = allSuggestions.findIndex((s) => s.id === suggestionId);
    return idx === -1 ? null : Math.floor(idx / ITEMS_PER_PAGE) + 1;
  };

  // Restore editing state after data is loaded
  useEffect(() => {
    if (!loading && allSuggestions.length > 0) {
      const savedState = restoreEditingState();

      if (savedState.editingId) {
        // Check if the saved editing item still exists
        const suggestionExists = allSuggestions.find(
          (sug) => sug.id === savedState.editingId
        );
        if (suggestionExists) {
          setEditingId(savedState.editingId);
          setEditedData(savedState.editedData);

          // Find the correct page containing this suggestion
          const correctPage = findPageContainingSuggestion(
            savedState.editingId
          );
          if (correctPage && correctPage !== currentPage) {
            setCurrentPage(correctPage);
          }
        } else {
          // Clear invalid state
          clearEditingState();
        }
      }
    }
  }, [loading, allSuggestions]);

  // Reset page to 1 when search or sort changes
  useEffect(() => { setCurrentPage(1); }, [searchTerm, sortField, sortDirection]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const res = await keywordService.getSuggestions({ status: "pending", page_size: 5000 });
      const resData = res.data;
      const fetched = Array.isArray(resData) ? resData : (resData.results || []);
      setAllSuggestions(fetched);
      setSelectedSuggestions((prev) =>
        prev.filter((id) => fetched.some((s) => s.id === id))
      );
    } catch (err) {
      toast.error("Failed to fetch suggestions from server", {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    const page = Math.max(1, Math.min(newPage, totalPages));
    setCurrentPage(page);
    if (editingId) {
      saveEditingState(editingId, editedData, page);
    } else {
      sessionStorage.setItem(STORAGE_KEYS.currentPage, page.toString());
    }
  };

  const handleStartEdit = (sug) => {
    // Store current scroll position
    const scrollTop = containerRef.current?.scrollTop || 0;

    // Clear search when starting to edit
    setSearchTerm("");

    setEditingId(sug.id);
    setEditedData({ ...sug });

    // Save editing state to session storage
    saveEditingState(sug.id, { ...sug }, currentPage);

    // Restore scroll position after state update
    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = scrollTop;
      }
    }, 0);
  };

  const handleInputChange = (field, value) => {
    const updatedData = { ...editedData, [field]: value };
    setEditedData(updatedData);

    // Save updated state to session storage
    if (editingId) {
      saveEditingState(editingId, updatedData, currentPage);
    }
  };

  const handleDeleteSuggestion = async (suggestionId) => {
    if (window.confirm("Are you sure you want to delete this suggestion?")) {
      try {
        await keywordService.deleteKeyword(suggestionId);
        toast.success("Suggestion deleted successfully!", {
          style: { backgroundColor: "green", color: "white" },
          icon: <FiCheckCircle />,
        });

        setAllSuggestions((prev) => prev.filter((item) => item.id !== suggestionId));
        await fetchSuggestions();
      } catch (error) {
        console.error("Error deleting suggestion:", error);
        toast.error("Failed to delete suggestion!", {
          style: { backgroundColor: "red", color: "white" },
          icon: <FiAlertCircle />,
        });
      }
    }
  };

  const handleSelectSuggestion = (suggestionId) => {
    setSelectedSuggestions((prev) => {
      if (prev.includes(suggestionId)) {
        return prev.filter((id) => id !== suggestionId);
      } else {
        return [...prev, suggestionId];
      }
    });
  };

  const handleSelectAll = () => {
    const allIds = allSuggestions.map((sug) => sug.id);
    const allSelected = allIds.every((id) => selectedSuggestions.includes(id));

    if (allSelected) {
      // Deselect all items in entire table
      setSelectedSuggestions([]);
    } else {
      // Select all items in entire table
      setSelectedSuggestions(allIds);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedSuggestions.length === 0) {
      toast.warning("Please select suggestions to delete!", {
        style: { backgroundColor: "orange", color: "white" },
        icon: <FiAlertCircle />,
      });
      return;
    }

    if (
      window.confirm(
        `Are you sure you want to delete ${selectedSuggestions.length} selected suggestions?`
      )
    ) {
      try {
        // Delete all selected suggestions
        await Promise.all(
          selectedSuggestions.map((id) => keywordService.deleteKeyword(id))
        );

        toast.success(
          `Successfully deleted ${selectedSuggestions.length} suggestions!`,
          {
            style: { backgroundColor: "green", color: "white" },
            icon: <FiCheckCircle />,
          }
        );

        setAllSuggestions((prev) =>
          prev.filter((item) => !selectedSuggestions.includes(item.id))
        );
        setSelectedSuggestions([]);
        setBulkDeleteMode(false);
        await fetchSuggestions();
      } catch (error) {
        console.error("Error deleting suggestions:", error);
        toast.error("Failed to delete some suggestions!", {
          style: { backgroundColor: "red", color: "white" },
          icon: <FiAlertCircle />,
        });
      }
    }
  };

  const handleExportExcel = () => {
    if (allSuggestions.length === 0) {
      toast.warning("No data to export!", {
        style: { backgroundColor: "orange", color: "white" },
        icon: <FiAlertCircle />,
      });
      return;
    }

    try {
      // Prepare data for Excel export
      const exportData = allSuggestions.map((suggestion, index) => ({
        No: index + 1,
        Japanese: suggestion.japanese || "",
        English: suggestion.english || "",
        Vietnamese: suggestion.vietnamese || "",
        "Chinese (Traditional)": suggestion.chinese_traditional || "",
        "Chinese (Simplified)": suggestion.chinese_simplified || "",
        Bengali: suggestion.bengali || "",
        Indonesian: suggestion.indonesian || "",
        Hindi: suggestion.hindi || "",
        Oriya: suggestion.oriya || "",
        Thai: suggestion.thai || "",
        Status: suggestion.status || "",
        "Created Date": suggestion.created_at
          ? new Date(suggestion.created_at).toLocaleDateString()
          : "",
        ID: suggestion.id || "",
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Auto-size columns
      const colWidths = [
        { wch: 5 }, // No
        { wch: 20 }, // Japanese
        { wch: 20 }, // English
        { wch: 20 }, // Vietnamese
        { wch: 25 }, // Chinese (Traditional)
        { wch: 25 }, // Chinese (Simplified)
        { wch: 20 }, // Bengali
        { wch: 20 }, // Indonesian
        { wch: 20 }, // Hindi
        { wch: 20 }, // Oriya
        { wch: 20 }, // Thai
        { wch: 10 }, // Status
        { wch: 15 }, // Created Date
        { wch: 10 }, // ID
      ];
      worksheet["!cols"] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Keyword Suggestions");

      // Generate filename with current date
      const currentDate = new Date().toISOString().split("T")[0];
      const filename = `keyword_suggestions_${currentDate}.xlsx`;

      // Save file
      XLSX.writeFile(workbook, filename);

      toast.success("Excel file exported successfully!", {
        style: { backgroundColor: "green", color: "white" },
        icon: <FiCheckCircle />,
      });
    } catch (error) {
      console.error("Error exporting Excel:", error);
      toast.error("Failed to export Excel file!", {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
    }
  };

  const handleImportExcel = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check file type
    const fileExtension = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls"].includes(fileExtension)) {
      toast.error("Please select a valid Excel file (.xlsx or .xls)", {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast.error("Excel file is empty!", {
          style: { backgroundColor: "red", color: "white" },
          icon: <FiAlertCircle />,
        });
        return;
      }

      // Validate and process data
      const processedData = [];
      const errors = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNumber = i + 2; // +2 because Excel rows start from 1 and we have header

        // Skip rows without ID (new suggestions)
        if (!row.ID) {
          // Create new suggestion
          const newSuggestion = {
            japanese: row.Japanese || "",
            english: row.English || "",
            vietnamese: row.Vietnamese || "",
            chinese_traditional: row["Chinese (Traditional)"] || "",
            chinese_simplified: row["Chinese (Simplified)"] || "",
            bengali: row.Bengali || "",
            indonesian: row.Indonesian || "",
            hindi: row.Hindi || "",
            oriya: row.Oriya || "",
            thai: row.Thai || "",
          };

          // Check if at least one field has content (not all empty)
          const hasAnyContent = Object.values(newSuggestion).some(
            (value) => value && value.trim() !== ""
          );

          if (!hasAnyContent) {
            errors.push(`Row ${rowNumber}: All language fields are empty`);
          } else {
            processedData.push({ type: "create", data: newSuggestion });
          }
        } else {
          // Update existing suggestion
          const existingSuggestion = allSuggestions.find(
            (sug) => sug.id === parseInt(row.ID)
          );
          if (!existingSuggestion) {
            errors.push(
              `Row ${rowNumber}: Suggestion with ID ${row.ID} not found`
            );
            continue;
          }

          const updatedSuggestion = {
            id: parseInt(row.ID),
            japanese: row.Japanese || "",
            english: row.English || "",
            vietnamese: row.Vietnamese || "",
            chinese_traditional: row["Chinese (Traditional)"] || "",
            chinese_simplified: row["Chinese (Simplified)"] || "",
            bengali: row.Bengali || "",
            indonesian: row.Indonesian || "",
            hindi: row.Hindi || "",
            oriya: row.Oriya || "",
            thai: row.Thai || "",
          };

          // Check if at least one field has content (not all empty)
          const hasAnyContent = Object.values({
            japanese: updatedSuggestion.japanese,
            english: updatedSuggestion.english,
            vietnamese: updatedSuggestion.vietnamese,
            chinese_traditional: updatedSuggestion.chinese_traditional,
            chinese_simplified: updatedSuggestion.chinese_simplified,
            bengali: updatedSuggestion.bengali,
            indonesian: updatedSuggestion.indonesian,
            hindi: updatedSuggestion.hindi,
            oriya: updatedSuggestion.oriya,
            thai: updatedSuggestion.thai,
          }).some((value) => value && value.trim() !== "");

          if (!hasAnyContent) {
            errors.push(`Row ${rowNumber}: All language fields are empty`);
          } else {
            processedData.push({ type: "update", data: updatedSuggestion });
          }
        }
      }

      if (errors.length > 0) {
        toast.error(
          `Import failed with ${errors.length} errors. Check console for details.`,
          {
            style: { backgroundColor: "red", color: "white" },
            icon: <FiAlertCircle />,
          }
        );
        console.error("Import errors:", errors);
        return;
      }

      if (processedData.length === 0) {
        toast.warning("No valid data to import!", {
          style: { backgroundColor: "orange", color: "white" },
          icon: <FiAlertCircle />,
        });
        return;
      }

      // Confirm import
      const createCount = processedData.filter(
        (item) => item.type === "create"
      ).length;
      const updateCount = processedData.filter(
        (item) => item.type === "update"
      ).length;

      const confirmMessage =
        `Import ${processedData.length} suggestions?\n` +
        `- New suggestions: ${createCount}\n` +
        `- Updated suggestions: ${updateCount}`;

      if (!window.confirm(confirmMessage)) {
        return;
      }

      // Process import
      await processImportData(processedData);
    } catch (error) {
      console.error("Error reading Excel file:", error);
      toast.error("Failed to read Excel file!", {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
    } finally {
      // Reset file input
      event.target.value = "";
    }
  };

  const processImportData = async (data) => {
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const item of data) {
        try {
          if (item.type === "create") {
            // Create new suggestion
            await keywordService.createSuggestion(item.data);
          } else if (item.type === "update") {
            // Update existing suggestion
            await keywordService.updateSuggestion(item.data.id, item.data);
          }
          successCount++;
        } catch (error) {
          console.error(`Error processing item:`, item, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} suggestions!`, {
          style: { backgroundColor: "green", color: "white" },
          icon: <FiCheckCircle />,
        });

        // Refresh data
        await fetchSuggestions();
      }

      if (errorCount > 0) {
        toast.warning(
          `${errorCount} suggestions failed to import. Check console for details.`,
          {
            style: { backgroundColor: "orange", color: "white" },
            icon: <FiAlertCircle />,
          }
        );
      }
    } catch (error) {
      console.error("Error processing import data:", error);
      toast.error("Failed to import data!", {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
    }
  };

  const handleSaveDraft = async () => {
    try {
      // Save the current data as draft
      await keywordService.updateSuggestion(editingId, editedData);

      // Update local state without full refresh
      const updatedSuggestions = allSuggestions.map((sug) =>
        sug.id === editingId ? { ...sug, ...editedData } : sug
      );
      setAllSuggestions(updatedSuggestions);

      // Update session storage with saved data
      saveEditingState(editingId, editedData, currentPage);

      toast.success("Draft saved successfully!", {
        style: { backgroundColor: "blue", color: "white" },
        icon: <FiSave />,
      });
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save draft!", {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
    }
  };

  const handleSubmitReview = async () => {
    // Kiểm tra tất cả các trường ngôn ngữ
    const requiredFields = [
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
    const emptyFields = requiredFields.filter(
      (field) => !editedData[field] || editedData[field].trim() === ""
    );
  
    if (emptyFields.length > 0) {
      toast.error(
        `Please fill in all language fields: ${emptyFields.join(", ")}`,
        {
          style: { backgroundColor: "red", color: "white" },
          icon: <FiAlertCircle />,
        }
      );
      return;
    }
  
    try {
      // First update the suggestion content
      await keywordService.updateSuggestion(editingId, editedData);
  
      // Then approve the suggestion
      await keywordService.approveSuggestion(editingId);
  
      // Create notification for all users about the new keyword
      try {
        await notificationService.createNotification({
          title: "New Keyword Added",
          message: `A new keyword has been added to the library.`,
          details: true,
          keyword_details: [
            {
              id: editingId,
              japanese: editedData.japanese,
              english: editedData.english,
              vietnamese: editedData.vietnamese,
              chinese_traditional: editedData.chinese_traditional,
              chinese_simplified: editedData.chinese_simplified,
              bengali: editedData.bengali,
              indonesian: editedData.indonesian,
              hindi: editedData.hindi,
              oriya: editedData.oriya,
              thai: editedData.thai,
            },
          ],
        });
      } catch (notificationError) {
        console.error("Failed to create notification:", notificationError);
      }
  
      toast.success("Successfully added to keyword library!", {
        style: { backgroundColor: "green", color: "white" },
        icon: <FiCheckCircle />,
      });
  
      setAllSuggestions((prev) => prev.filter((sug) => sug.id !== editingId));
      clearEditingState();
      setEditingId(null);
      await fetchSuggestions();
    } catch (error) {
      console.error("Error adding to library:", error);
      const apiError = error?.response?.data;
      if (
        apiError?.duplicates &&
        Array.isArray(apiError.duplicates) &&
        apiError.duplicates.length > 0
      ) {
        const lines = apiError.duplicates
          .map((d) => `- ${d.field}: "${d.value}"`)
          .join("\n");
        toast.error(`Keyword already exists in library:\n${lines}`, {
          style: { backgroundColor: "red", color: "white" },
          icon: <FiAlertCircle />,
          autoClose: 6000,
        });
      } else if (apiError?.error) {
        toast.error(apiError.error, {
          style: { backgroundColor: "red", color: "white" },
          icon: <FiAlertCircle />,
        });
      } else {
        toast.error("Keyword already exists in library", {
          style: { backgroundColor: "red", color: "white" },
          icon: <FiAlertCircle />,
        });
      }
    }
  };
  

  // Thêm hàm kiểm tra tất cả các field đã được điền
  const isAllFieldsFilled = () => {
    const requiredFields = [
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
    return requiredFields.every(
      (field) => editedData[field] && editedData[field].trim() !== ""
    );
  };

  // Thêm hàm kiểm tra có thay đổi nào được thực hiện hay không
  const hasChanges = () => {
    if (!editingId) return false;

    const originalSuggestion = allSuggestions.find(
      (sug) => sug.id === editingId
    );
    if (!originalSuggestion) return false;

    const requiredFields = [
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

    return requiredFields.some((field) => {
      const original = originalSuggestion[field] || "";
      const edited = editedData[field] || "";
      return original.trim() !== edited.trim();
    });
  };

  // Handle cancel editing
  const handleCancelEdit = () => {
    clearEditingState();
    setEditingId(null);
    setEditedData({});
  };

  // Xác định trạng thái nút chính
  const getMainButtonState = (suggestionId) => {
    if (editingId !== suggestionId) {
      return {
        text: "Review",
        icon: <FiEdit2 />,
        variant: "info",
        action: () =>
          handleStartEdit(allSuggestions.find((s) => s.id === suggestionId)),
      };
    }

    if (isAllFieldsFilled()) {
      return {
        text: "Submit",
        icon: <FiCheckCircle />,
        variant: "success",
        action: handleSubmitReview,
      };
    }

    return {
      text: "Save",
      icon: <FiSave />,
      variant: "info",
      action: handleSaveDraft,
      disabled: !hasChanges(),
    };
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 flex-col h-full gap-[0.25rem]">
        {/* Compact Header */}
        <div className="bg-white p-[0.75rem] rounded-t-lg border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900">
                Keyword Suggestions Review
              </h1>
              {!loading && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span>
                    Total:{" "}
                    <span className="font-medium">{allSuggestions.length}</span>
                  </span>
                  {bulkDeleteMode && selectedSuggestions.length > 0 && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                      {selectedSuggestions.length} selected
                    </span>
                  )}
                  <span className="text-gray-500">
                    Page {validPage} of {totalPages}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Column Filter */}
              <div className="relative" ref={columnFilterRef}>
                <button
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                  onClick={() => setShowColumnFilter(!showColumnFilter)}
                  title="Filter visible columns"
                >
                  <FiFilter className="text-gray-600" />
                  <span className="font-medium text-gray-700">
                    Columns ({visibleColumns.length}/{ALL_LANGUAGES.length})
                  </span>
                </button>

                {showColumnFilter && (
                  <div className="absolute right-0 mt-2 w-[280px] bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-[400px] overflow-y-auto">
                    <div className="sticky top-0 bg-white border-b border-gray-200 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-700 text-sm">Show/Hide Columns</h4>
                        <button
                          onClick={() => setShowColumnFilter(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <FiX size={18} />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={selectAllColumns}
                          className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                        >
                          Select All
                        </button>
                        <button
                          onClick={deselectAllColumns}
                          className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div className="p-2">
                      {ALL_LANGUAGES.map((lang) => (
                        <label
                          key={lang.key}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={visibleColumns.includes(lang.key)}
                            onChange={() => toggleColumnVisibility(lang.key)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 flex-1">{lang.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search keywords..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 px-3 py-2 pl-9 pr-9 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004098] focus:border-[#004098] transition-colors"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {searchTerm && (
                <div className="text-xs text-gray-600 whitespace-nowrap">
                  <span className="font-medium">{filteredSuggestions.length}</span>{" "}
                  results
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  className="flex items-center px-4 py-2 rounded-full text-white bg-blue-500 hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleImportExcel}
                  title="Import from Excel"
                  disabled={loading}
                >
                  <FiUpload className="mr-2" /> Import
                </button>

                <button
                  className="flex items-center px-4 py-2 rounded-full text-white bg-green-500 hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleExportExcel}
                  title="Export to Excel"
                  disabled={loading || allSuggestions.length === 0}
                >
                  <FiDownload className="mr-2" /> Export
                </button>

                {!bulkDeleteMode ? (
                  <button
                    className="flex items-center px-4 py-2 rounded-full text-white bg-blue-500 hover:bg-blue-600 transition-colors"
                    onClick={() => setBulkDeleteMode(true)}
                    title="Enable bulk delete mode (Ctrl+D)"
                  >
                    <FiTrash2 className="mr-2" /> Bulk Del
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      className="flex items-center px-4 py-2 rounded-full text-white bg-gray-500 hover:bg-gray-600 transition-colors"
                      onClick={() => {
                        setBulkDeleteMode(false);
                        setSelectedSuggestions([]);
                      }}
                      title="Exit bulk mode (Esc)"
                    >
                      Cancel
                    </button>
                    {selectedSuggestions.length > 0 && (
                      <button
                        className="flex items-center px-4 py-2 rounded-full text-white bg-red-500 hover:bg-red-600 transition-colors"
                        onClick={handleDeleteSelected}
                      >
                        <FiTrash2 className="mr-2" /> Delete (
                        {selectedSuggestions.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div
          ref={containerRef}
          className="bg-white rounded-b-lg flex-1 flex flex-col min-h-0 shadow-sm border border-gray-200"
        >
          <div className="overflow-auto flex-1 py-[0.5rem] scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
            <table className="w-full border-collapse bg-white min-w-max">
              <thead className="sticky top-0 z-20">
                <tr className="bg-[#004098] text-white font-semibold shadow-sm">
                  {bulkDeleteMode && (
                    <th className="p-[0.5rem] border-b border-blue-600 text-center sticky left-0 z-30 bg-[#004098] border-r border-white/20" style={{ width: '40px', minWidth: '40px' }}>
                      <input
                        type="checkbox"
                        checked={
                          allSuggestions.length > 0 &&
                          allSuggestions.every((sug) =>
                            selectedSuggestions.includes(sug.id)
                          )
                        }
                        onChange={handleSelectAll}
                        className="w-4 h-4 cursor-pointer accent-blue-600 rounded"
                      />
                    </th>
                  )}
                  <th
                    className={`p-[0.5rem] border-b border-blue-600 text-center font-semibold text-sm sticky z-30 bg-[#004098] border-r border-white/20 ${bulkDeleteMode ? 'left-[40px]' : 'left-0'}`}
                    style={{ width: '70px', minWidth: '70px' }}
                  >
                    No
                  </th>
                  <th
                    className={`p-[0.75rem] border-b border-blue-600 text-center font-semibold sticky z-30 bg-[#004098] border-r border-white/20 ${bulkDeleteMode ? 'left-[110px]' : 'left-[70px]'}`}
                    style={{ width: '220px', minWidth: '220px', boxShadow: '3px 0 8px rgba(0,0,0,0.15)' }}
                  >
                    English
                  </th>
                  {getVisibleLanguages().map((lang) => (
                    <th key={lang.key} className="p-[0.75rem] border-b border-blue-600 text-center font-semibold border-r border-white/20" style={{ width: '200px', minWidth: '200px' }}>
                      {lang.label}
                    </th>
                  ))}
                  <th 
                    className="p-[0.5rem] border-b border-blue-600 text-center font-semibold text-sm border-r border-white/20 cursor-pointer hover:bg-[#003875] transition-colors" 
                    style={{ width: '140px', minWidth: '140px' }}
                    onClick={() => handleSort("created_at")}
                    title="Sort by creation time"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Time</span>
                      {sortField === "created_at" ? (
                        sortDirection === "asc" ? <FiArrowUp size={14} /> : <FiArrowDown size={14} />
                      ) : (
                        <FiArrowUp size={14} className="opacity-30" />
                      )}
                    </div>
                  </th>
                  <th className="p-[0.5rem] border-b border-blue-600 text-center font-semibold text-sm sticky right-0 z-30 bg-[#004098] border-l border-white/20" style={{ width: '130px', minWidth: '130px', boxShadow: '-3px 0 8px rgba(0,0,0,0.15)' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={13} className="p-4">
                      <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden fixed top-0 left-0">
                        <div className="h-full bg-[#004098CC] animate-loading-bar"></div>
                      </div>
                    </td>
                  </tr>
                ) : currentItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={13}
                      className="p-12 text-center"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <FiAlertCircle className="w-12 h-12 text-gray-400" />
                        <div className="text-center">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            No pending suggestions
                          </h3>
                          <p className="text-gray-600">
                            All suggestions have been reviewed or there are no
                            suggestions yet.
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentItems.map((sug, index) => (
                    <tr
                      key={sug.id}
                      className={`transition-all duration-200 hover:bg-blue-50 hover:shadow-sm border-b border-gray-100 ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50"
                      } ${
                        selectedSuggestions.includes(sug.id)
                          ? "ring-2 ring-blue-200 bg-blue-25"
                          : ""
                      }`}
                    >
                      {bulkDeleteMode && (
                        <td className={`p-[0.5rem] border-r border-gray-100 text-center sticky left-0 z-10 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"} ${selectedSuggestions.includes(sug.id) ? "bg-blue-25" : ""}`} style={{ width: '40px' }}>
                          <input
                            type="checkbox"
                            checked={selectedSuggestions.includes(sug.id)}
                            onChange={() => handleSelectSuggestion(sug.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 cursor-pointer accent-blue-600 rounded transition-transform hover:scale-110"
                          />
                        </td>
                      )}
                      <td 
                        className={`p-[0.5rem] border-r border-gray-100 text-center font-medium text-gray-700 text-sm sticky z-10 ${bulkDeleteMode ? 'left-[40px]' : 'left-0'} ${index % 2 === 0 ? "bg-white" : "bg-gray-50"} ${selectedSuggestions.includes(sug.id) ? "bg-blue-25" : ""}`}
                        style={{ width: '70px' }}
                      >
                        {(validPage - 1) * ITEMS_PER_PAGE + index + 1}
                      </td>
                      
                      {/* English Column (Sticky) */}
                      <td
                        className={`p-[0.75rem] border-r border-gray-100 text-center align-top sticky z-10 ${bulkDeleteMode ? 'left-[110px]' : 'left-[70px]'} ${index % 2 === 0 ? "bg-white" : "bg-gray-50"} ${selectedSuggestions.includes(sug.id) ? "bg-blue-25" : ""}`}
                        style={{ height: "80px", maxHeight: "80px", width: '220px', boxShadow: '3px 0 8px rgba(0,0,0,0.05)' }}
                      >
                        {editingId === sug.id ? (
                          <textarea
                            value={editedData.english || ""}
                            onChange={(e) =>
                              handleInputChange('english', e.target.value)
                            }
                            onFocus={(e) => {
                              e.preventDefault();
                              const container = containerRef.current;
                              if (container) {
                                const currentScrollTop = container.scrollTop;
                                setTimeout(() => {
                                  container.scrollTop = currentScrollTop;
                                }, 0);
                              }
                            }}
                            className="w-full border-2 border-blue-300 rounded-lg p-3 text-sm resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all duration-200 bg-blue-50"
                            rows={2}
                            style={{ height: "50px", maxHeight: "50px" }}
                            placeholder="Enter English..."
                          />
                        ) : (
                          <div
                            className="truncate max-w-[200px] mx-auto flex items-center justify-center text-gray-800 px-2"
                            style={{ height: "50px", maxHeight: "50px" }}
                            title={sug.english || "-"}
                          >
                            {sug.english || (
                              <span className="text-gray-400 italic">
                                Empty
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {getVisibleLanguages().map((lang) => (
                        <td
                          key={lang.key}
                          className="p-[0.75rem] border-r border-gray-100 text-center align-top"
                          style={{ height: "80px", maxHeight: "80px", width: '200px' }}
                        >
                          {editingId === sug.id ? (
                            <textarea
                              value={editedData[lang.key] || ""}
                              onChange={(e) =>
                                handleInputChange(lang.key, e.target.value)
                              }
                              onFocus={(e) => {
                                e.preventDefault();
                                const container = containerRef.current;
                                if (container) {
                                  const currentScrollTop = container.scrollTop;
                                  setTimeout(() => {
                                    container.scrollTop = currentScrollTop;
                                  }, 0);
                                }
                              }}
                              className="w-full border-2 border-blue-300 rounded-lg p-3 text-sm resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all duration-200 bg-blue-50"
                              rows={2}
                              style={{ height: "50px", maxHeight: "50px" }}
                              placeholder={`Enter ${lang.label}...`}
                            />
                          ) : (
                            <div
                              className="truncate max-w-[200px] mx-auto flex items-center justify-center text-gray-800 px-2"
                              style={{ height: "50px", maxHeight: "50px" }}
                              title={sug[lang.key] || "-"}
                            >
                              {sug[lang.key] || (
                                <span className="text-gray-400 italic">
                                  Empty
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      ))}
                      
                      {/* Time Column */}
                      <td className="p-[0.75rem] border-r border-gray-100 text-center align-middle" style={{ height: "80px", maxHeight: "80px", width: '140px' }}>
                        <div className="flex items-center justify-center h-full">
                          <span className="text-xs text-gray-600" title={sug.created_at}>
                            {formatDate(sug.created_at)}
                          </span>
                        </div>
                      </td>

                      <td className={`p-2 text-center sticky right-0 z-10 border-l border-gray-100 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"} ${selectedSuggestions.includes(sug.id) ? "bg-blue-25" : ""}`} style={{ width: '130px', boxShadow: '-3px 0 8px rgba(0,0,0,0.05)' }}>
                        <div className="flex flex-row space-x-1 justify-center">
                          {(() => {
                            const buttonState = getMainButtonState(sug.id);
                            return (
                              <Button
                                variant={buttonState.variant}
                                onClick={buttonState.action}
                                icon={buttonState.icon}
                                disabled={buttonState.disabled || false}
                                size="compact"
                                className="min-w-[60px]"
                              >
                                {buttonState.text}
                              </Button>
                            );
                          })()}

                          {editingId === sug.id ? (
                            <Button
                              variant="secondary"
                              onClick={handleCancelEdit}
                              size="compact"
                              className="min-w-[60px]"
                            >
                              Cancel
                            </Button>
                          ) : (
                            <Button
                              variant="danger"
                              onClick={() => handleDeleteSuggestion(sug.id)}
                              icon={<FiTrash2 />}
                              size="compact"
                              className="min-w-[60px]"
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && filteredSuggestions.length > 0 && (
            <Pagination
              currentPage={validPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}

          {/* Hidden file input for Excel import */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx,.xls"
            style={{ display: "none" }}
          />

        </div>
      </div>
    </div>
  );
};

export default SuggestionReviewList;
