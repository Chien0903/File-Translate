import { useState, useEffect, useRef, useCallback } from "react";
import {
  FiSearch,
  FiAlertCircle,
  FiArrowUp,
  FiArrowDown,
  FiFilter,
  FiX,
} from "react-icons/fi";
import keywordService from "../../services/keywordService";
import notificationService from "../../services/notificationService";
import { toast } from "react-toastify";
import Pagination from "../../components/Pagination";
import LibraryActionButtons from "../../components/features/admin/LibraryActionButtons";
import { useAuth } from "../../hooks/useAuth";
import KeywordDetailModal from "../../components/features/admin/KeywordDetailModal";
import KeywordEditModal from "../../components/features/admin/KeywordEditModal";
import KeywordAddModal from "../../components/features/admin/KeywordAddModal";
import DeleteConfirmModal from "../../components/features/admin/DeleteConfirmModal";
import GcsStatusModal from "../../components/features/admin/GcsStatusModal";
import {
  QueueThresholdModal,
  SuggestionQueueModal,
  DuplicateLibraryCompareModal,
  DuplicateAlertsModal,
} from "../../components/features/admin/LibrarySuggestionQueueModals";

// Define all available languages
const ALL_LANGUAGES = [
  { key: 'japanese', label: 'Japanese', emoji: '🇯🇵' },
  { key: 'vietnamese', label: 'Vietnamese', emoji: '🇻🇳' },
  { key: 'chinese_traditional', label: 'Chinese Traditional', emoji: '🇹🇼' },
  { key: 'chinese_simplified', label: 'Chinese Simplified', emoji: '🇨🇳' },
  { key: 'bengali', label: 'Bengali', emoji: '🇧🇩' },
  { key: 'indonesian', label: 'Indonesian', emoji: '🇮🇩' },
  { key: 'hindi', label: 'Hindi', emoji: '🇮🇳' },
  { key: 'oriya', label: 'Oriya', emoji: '🇮🇳' },
  { key: 'thai', label: 'Thai', emoji: '🇹🇭' }
];

const QUEUE_PAGE_SIZE = 8;

const CommonLibraryManagement = () => {
  const { role } = useAuth();
  const [keywords, setKeywords] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("date_modified");
  const [sortDirection, setSortDirection] = useState("desc");
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [editingKeyword, setEditingKeyword] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [newKeyword, setNewKeyword] = useState({
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
  });

  const [isAddingKeyword, setIsAddingKeyword] = useState(false);
  const [loading, setLoading] = useState(true);

  // Column filter states
  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('libraryVisibleColumns');
    return saved ? JSON.parse(saved) : ALL_LANGUAGES.map(lang => lang.key);
  });
  const columnFilterRef = useRef(null);

  const tableContainerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    isOpen: false,
    keywordId: null,
  });

  // GCS Upload states
  const [gcsStatus, setGcsStatus] = useState(null);
  const [showGcsInfo, setShowGcsInfo] = useState(false);

  // Suggestion search (THK Library — Admin / Library Keeper)
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [queueItems, setQueueItems] = useState([]);
  const [queuePage, setQueuePage] = useState(1);
  const [queueSearchInput, setQueueSearchInput] = useState("");
  const [queueSearch, setQueueSearch] = useState("");
  const [queueTotal, setQueueTotal] = useState(0);
  const [queueTotalPages, setQueueTotalPages] = useState(1);
  const [queueMinSuggesters, setQueueMinSuggesters] = useState(2);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [approvingQueueId, setApprovingQueueId] = useState(null);
  const [compareModal, setCompareModal] = useState({
    open: false,
    payload: null,
    pendingId: null,
  });

  // Duplicate alerts
  const [showDupAlerts, setShowDupAlerts] = useState(false);
  const [dupAlerts, setDupAlerts] = useState([]);
  const [dupAlertCount, setDupAlertCount] = useState(0);
  const [loadingDupAlerts, setLoadingDupAlerts] = useState(false);
  const [dupAlertBusyId, setDupAlertBusyId] = useState(null);

  // Save visible columns to localStorage
  useEffect(() => {
    localStorage.setItem('libraryVisibleColumns', JSON.stringify(visibleColumns));
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

  // Handle column sort (only for sortable columns)
  const handleSort = (field) => {
    if (!["id", "date_modified"].includes(field)) return;

    if (sortField === field) {
      // Same field, toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, start with ascending
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Get sort icon for sortable columns only
  const getSortIcon = (field) => {
    if (!["id", "date_modified"].includes(field)) return null;

    if (sortField !== field) {
      return <FiArrowUp className="opacity-30" />;
    }
    return sortDirection === "asc" ? <FiArrowUp /> : <FiArrowDown />;
  };


  // Reset currentPage when search or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortField, sortDirection]);

  // Di chuyển fetchKeywords ra ngoài để có thể sử dụng làm callback
  const fetchKeywords = async () => {
    try {
      const res = await keywordService.getSuggestions({ status: "approved", page_size: 5000 });
      const data = res.data;
      const approvedKeywords = Array.isArray(data) ? data : (data.results || []);
      setKeywords(approvedKeywords);
    } catch (error) {
      console.error("Error fetching keywords:", error);
      toast.error("Failed to fetch common keywords!", {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchGCSStatus = async () => {
      try {
        const response = await keywordService.getGCSStatus();
        setGcsStatus(response.data);
      } catch (err) {
        console.error("Failed to fetch GCS status:", err);
      }
    };

    fetchKeywords();
    fetchGCSStatus();
  }, []);

  useEffect(() => {
    if (role !== "Admin" && role !== "Library Keeper") return;
    keywordService.getSuggestionQueueSettings().then((res) => {
      setQueueMinSuggesters(res.data.min_suggesters_for_queue ?? 2);
    }).catch(() => {});
  }, [role]);

  const fetchDuplicateAlerts = useCallback(async (silent = false) => {
    if (role !== "Admin" && role !== "Library Keeper") return;
    if (!silent) setLoadingDupAlerts(true);
    try {
      const res = await keywordService.getDuplicateAlerts();
      setDupAlerts(res.data.alerts || []);
      setDupAlertCount(res.data.total ?? 0);
    } catch {
      if (!silent) console.error("Failed to load duplicate alerts");
    } finally {
      if (!silent) setLoadingDupAlerts(false);
    }
  }, [role]);

  useEffect(() => {
    fetchDuplicateAlerts(true);
  }, [fetchDuplicateAlerts]);

  useEffect(() => {
    if (role !== "Admin" && role !== "Library Keeper") return;
    const id = setInterval(() => fetchDuplicateAlerts(true), 15000);
    return () => clearInterval(id);
  }, [role, fetchDuplicateAlerts]);

  /** Debounce search; reset to page 1 when the debounced query changes. */
  useEffect(() => {
    const t = setTimeout(() => {
      setQueueSearch((prev) => {
        if (queueSearchInput === prev) return prev;
        setQueuePage(1);
        return queueSearchInput;
      });
    }, 400);
    return () => clearTimeout(t);
  }, [queueSearchInput]);

  const fetchQueueDetails = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingQueue(true);
      try {
        const params = {
          page: queuePage,
          page_size: QUEUE_PAGE_SIZE,
        };
        if (queueSearch.trim()) params.search = queueSearch.trim();
        const res = await keywordService.getSuggestionQueue(params);
        setQueueItems(res.data.suggestions || []);
        const total = res.data.total ?? 0;
        setQueueTotal(total);
        setQueueTotalPages(res.data.total_pages ?? 1);
        if (
          res.data.page != null &&
          typeof res.data.page === "number" &&
          res.data.page !== queuePage
        ) {
          setQueuePage(res.data.page);
        }
      } catch (err) {
        if (!silent) {
          console.error(err);
          toast.error("Failed to load suggestions.", {
            style: { backgroundColor: "red", color: "white" },
            icon: <FiAlertCircle />,
          });
        }
      } finally {
        if (!silent) setLoadingQueue(false);
      }
    },
    [queuePage, queueSearch]
  );

  /** Load results when search or page changes while modal is open. */
  useEffect(() => {
    if (!showQueueModal) return;
    if (role !== "Admin" && role !== "Library Keeper") return;
    // Always fetch when modal is open so Step-1 user chips have data
    // even before keyword search starts.
    fetchQueueDetails(false);
  }, [showQueueModal, queuePage, queueSearch, fetchQueueDetails, role]);

  const handleOpenSuggestionQueue = () => {
    setQueuePage(1);
    setQueueSearchInput("");
    setQueueSearch("");
    setShowQueueModal(true);
  };

  const handleApproveFromQueue = async (id) => {
    setApprovingQueueId(id);
    try {
      await keywordService.approveSuggestion(id);
      toast.success("Keyword added to the library.", {
        style: { backgroundColor: "green", color: "white" },
        icon: <FiAlertCircle />,
      });
      await fetchQueueDetails(true);
      await fetchKeywords();
    } catch (e) {
      if (
        e.response?.status === 409 &&
        e.response?.data?.detail === "duplicate_conflict"
      ) {
        setCompareModal({
          open: true,
          pendingId: id,
          payload: e.response.data,
        });
      } else {
        const msg =
          e.response?.data?.error ||
          e.response?.data?.detail ||
          "Could not approve this suggestion.";
        toast.error(msg, {
          style: { backgroundColor: "red", color: "white" },
          icon: <FiAlertCircle />,
        });
      }
    } finally {
      setApprovingQueueId(null);
    }
  };

  const handleRejectFromQueue = async (id) => {
    if (
      !window.confirm(
        "Reject and delete this suggestion? This cannot be undone."
      )
    )
      return;
    setApprovingQueueId(id);
    try {
      await keywordService.deleteKeyword(id);
      toast.success("Suggestion rejected.", {
        style: { backgroundColor: "green", color: "white" },
        icon: <FiAlertCircle />,
      });
      await fetchQueueDetails(true);
    } catch (e) {
      toast.error(
        e.response?.data?.detail || "Could not delete this suggestion.",
        {
          style: { backgroundColor: "red", color: "white" },
          icon: <FiAlertCircle />,
        }
      );
    } finally {
      setApprovingQueueId(null);
    }
  };

  const handleSaveQueueThreshold = async (v) => {
    if (Number.isNaN(v) || v < 2) {
      toast.warning("Minimum value is 2.", {
        style: { backgroundColor: "orange", color: "white" },
        icon: <FiAlertCircle />,
      });
      return;
    }
    setThresholdSaving(true);
    try {
      const res = await keywordService.patchSuggestionQueueSettings(v);
      setQueueMinSuggesters(v);
      const autoApprovedCount = res?.data?.auto_approved_count ?? 0;
      toast.success(
        autoApprovedCount > 0
          ? `Queue threshold saved. ${autoApprovedCount} keyword(s) auto-added.`
          : "Queue threshold saved.",
        {
          style: { backgroundColor: "green", color: "white" },
          icon: <FiAlertCircle />,
        }
      );
      await fetchKeywords();
      await fetchDuplicateAlerts(true);
      setShowThresholdModal(false);
    } catch (e) {
      toast.error(
        e.response?.data?.error || "Could not save settings.",
        {
          style: { backgroundColor: "red", color: "white" },
          icon: <FiAlertCircle />,
        }
      );
    } finally {
      setThresholdSaving(false);
    }
  };

  const handleDuplicateResolution = async (resolution) => {
    const id = compareModal.pendingId;
    if (!id) return;
    setApprovingQueueId(id);
    try {
      const tid =
        compareModal.payload?.duplicates?.[0]?.conflict_ids?.[0];
      await keywordService.approveSuggestion(id, {
        duplicate_resolution: resolution,
        ...(resolution === "use_pending" && tid
          ? { replace_target_id: tid }
          : {}),
      });
      toast.success(
        resolution === "keep_library"
          ? "Library entry kept."
          : "Library updated from the suggestion.",
        {
          style: { backgroundColor: "green", color: "white" },
          icon: <FiAlertCircle />,
        }
      );
      setCompareModal({ open: false, payload: null, pendingId: null });
      await fetchQueueDetails(true);
      await fetchKeywords();
    } catch (e) {
      toast.error(
        e.response?.data?.error ||
          e.response?.data?.detail ||
          "Could not resolve duplicate.",
        {
          style: { backgroundColor: "red", color: "white" },
          icon: <FiAlertCircle />,
        }
      );
    } finally {
      setApprovingQueueId(null);
    }
  };

  const handleOpenDuplicateAlerts = () => {
    setShowDupAlerts(true);
    fetchDuplicateAlerts(false);
  };

  const handleDupAlertApprove = async (suggestionId, resolution, notifId) => {
    setDupAlertBusyId(notifId);
    try {
      await keywordService.approveSuggestion(suggestionId, {
        duplicate_resolution: resolution,
      });
      await keywordService.dismissDuplicateAlert(notifId);
      toast.success(
        resolution === "keep_library"
          ? "Library entry kept. Suggestion rejected."
          : "Library updated from the suggestion.",
        {
          style: { backgroundColor: "green", color: "white" },
          icon: <FiAlertCircle />,
        }
      );
      await fetchDuplicateAlerts(true);
      await fetchKeywords();
    } catch (e) {
      toast.error(
        e.response?.data?.error ||
          e.response?.data?.detail ||
          "Could not process this alert.",
        {
          style: { backgroundColor: "red", color: "white" },
          icon: <FiAlertCircle />,
        }
      );
    } finally {
      setDupAlertBusyId(null);
    }
  };

  const handleDupAlertDismiss = async (notifId) => {
    setDupAlertBusyId(notifId);
    try {
      await keywordService.dismissDuplicateAlert(notifId);
      toast.success("Alert dismissed.", {
        style: { backgroundColor: "green", color: "white" },
        icon: <FiAlertCircle />,
      });
      await fetchDuplicateAlerts(true);
    } catch {
      toast.error("Could not dismiss alert.", {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
    } finally {
      setDupAlertBusyId(null);
    }
  };

  // Filter and sort keywords
  const filteredKeywords = keywords
    .filter((item) => {
      const searchInFields = [
        item.japanese || "",
        item.english || "",
        item.vietnamese || "",
        item.chinese_traditional || "",
        item.chinese_simplified || "",
        item.bengali || "",
        item.indonesian || "",
        item.hindi || "",
        item.oriya || "",
        item.thai || "",
      ];

      return searchInFields.some((field) =>
        field.toLowerCase().includes(searchTerm.toLowerCase())
      );
    })
    .sort((a, b) => {
      let valueA, valueB;

      switch (sortField) {
        case "id":
          valueA = a.id;
          valueB = b.id;
          return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
        case "date_modified":
          valueA = a.updated_at || a.date_modified || "";
          valueB = b.updated_at || b.date_modified || "";
          return sortDirection === "asc"
            ? valueA.localeCompare(valueB)
            : valueB.localeCompare(valueA);
        default:
          return a.id - b.id; // Default sort by ID ascending
      }
    });

  const handleDelete = async (id) => {
    try {
      await keywordService.deleteKeyword(id);
      const res = await keywordService.getSuggestions({ status: "approved", page_size: 5000 });
      const data = res.data;
      const approvedKeywords = Array.isArray(data) ? data : (data.results || []);
      setKeywords(approvedKeywords);

      toast.success("Common keyword deleted successfully!", {
        style: { backgroundColor: "green", color: "white" },
        icon: <FiAlertCircle />,
      });
    } catch (error) {
      console.error("Error deleting keyword:", error);
      toast.error("Failed to delete common keyword!", {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
    } finally {
      setDeleteConfirmModal({ isOpen: false, keywordId: null });
    }
  };

  const handleEdit = (keyword) => {
    setEditingKeyword({ ...keyword });
  };

  const handleSave = async () => {
    try {
      const res = await keywordService.updateKeyword(editingKeyword.id, editingKeyword);
      setKeywords(
        keywords.map((item) =>
          item.id === editingKeyword.id ? res.data : item
        )
      );

      // Tạo notification cho tất cả users về việc sửa từ khóa
      try {
        await notificationService.createNotificationForAll({
          title: "Keyword Updated",
          message: "A keyword in the library has been updated.",
          details: true,
          keyword_details: [
            {
              id: editingKeyword.id,
              japanese: editingKeyword.japanese || "",
              english: editingKeyword.english || "",
              vietnamese: editingKeyword.vietnamese || "",
              chinese_traditional: editingKeyword.chinese_traditional || "",
              chinese_simplified: editingKeyword.chinese_simplified || "",
              bengali: editingKeyword.bengali || "",
              indonesian: editingKeyword.indonesian || "",
              hindi: editingKeyword.hindi || "",
              oriya: editingKeyword.oriya || "",
              thai: editingKeyword.thai || "",
              action: "updated",
              updated_at: new Date().toISOString(),
            },
          ],
        });
      } catch (notificationError) {
        console.error("Failed to create notification:", notificationError);
      }

      setEditingKeyword(null);
      toast.success("Common keyword updated successfully!", {
        style: { backgroundColor: "green", color: "white" },
        icon: <FiAlertCircle />,
      });
    } catch (error) {
      console.error("Error updating keyword:", error);
      toast.error("Failed to update common keyword!", {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditingKeyword({ ...editingKeyword, [name]: value });
  };

  const handleAddKeyword = async () => {
    const filledLanguages = Object.values(newKeyword).filter(
      (val) => val.trim() !== ""
    );
    if (filledLanguages.length === 0) {
      toast.error("Please enter at least one language field!", {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
      return;
    }

    try {
      await keywordService.createSuggestion(newKeyword);
      toast.success("Suggestion submitted successfully!", {
        style: { backgroundColor: "green", color: "white" },
        icon: <FiAlertCircle />,
      });
      setIsAddingKeyword(false);
      setNewKeyword({
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
      });
      // Refresh danh sách keywords sau khi submit thành công
      fetchKeywords();
    } catch (error) {
      const errorMsg =
        error.response?.data?.detail ||
        Object.values(error.response?.data || {}).join(", ") ||
        "Failed to submit suggestion!";
      toast.error(errorMsg, {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
    }
  };

  // Callback functions for the action buttons component
  const handleRefreshGcsStatus = (newGcsStatus) => {
    setGcsStatus(newGcsStatus);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Return original if invalid date

    // Format as MM/DD/YY
    return `${(date.getMonth() + 1).toString().padStart(2, "0")}/${date
      .getDate()
      .toString()
      .padStart(2, "0")}/${date.getFullYear().toString().substring(2)}`;
  };

  const totalPages = Math.ceil(filteredKeywords.length / ITEMS_PER_PAGE) || 1;
  const validCurrentPage = Math.max(1, Math.min(currentPage, totalPages));
  const indexOfFirstItem = (validCurrentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = filteredKeywords.slice(indexOfFirstItem, indexOfFirstItem + ITEMS_PER_PAGE);

  const handlePageChange = (newPage) => {
    setCurrentPage(Math.max(1, Math.min(newPage, totalPages)));
  };

  const isFormValid = () => {
    return Object.values(newKeyword).some((val) => val.trim() !== "");
  };

  // Drag to scroll handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll-fast
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <div className="flex flex-1 flex-col h-full gap-[0.25rem]">
      {/* Loading Bar */}
      {loading && (
        <div className="fixed top-0 left-0 w-full h-1 bg-gray-200 z-50">
          <div className="h-full bg-[#004098CC] animate-loading-bar"></div>
        </div>
      )}

      {/* Controls Frame with Search, Sort, and Action Buttons */}
      <div className="bg-white p-[0.5rem] rounded-t-lg">
        <div className="flex flex-wrap justify-between items-center gap-[1rem]">
          <LibraryActionButtons
            keywords={keywords}
            role={role}
            gcsStatus={gcsStatus}
            onRefreshKeywords={handleRefreshGcsStatus}
            onShowGcsInfo={() => setShowGcsInfo(!showGcsInfo)}
            onOpenSuggestionQueue={
              role === "Admin" || role === "Library Keeper"
                ? handleOpenSuggestionQueue
                : undefined
            }
            onOpenQueueThreshold={
              role === "Admin" || role === "Library Keeper"
                ? () => setShowThresholdModal(true)
                : undefined
            }
          />

          {/* Right side - Search Control and Column Filter */}
          <div className="flex flex-wrap items-center gap-[1rem]">
            {/* Column Filter */}
            <div className="relative" ref={columnFilterRef}>
              <button
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
                onClick={() => setShowColumnFilter(!showColumnFilter)}
                title="Filter visible columns"
              >
                <FiFilter className="text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
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

            {/* Search Control */}
            <div className="relative w-[20rem]">
              <FiSearch className="absolute left-[0.75rem] top-[0.75rem] text-gray-500 z-10" />
              <input
                type="text"
                placeholder="Search in all languages..."
                className="p-[0.5rem] pl-[2.5rem] border border-gray-300 rounded-full w-full bg-white text-black placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content Frame with Table */}
      <div className="bg-white p-[0.5rem] rounded-b-lg flex-1 flex flex-col min-h-0 shadow-sm">
        <div ref={tableContainerRef} className="flex-1 flex flex-col min-h-0 overflow-hidden border border-gray-200 ">
          <div
            ref={scrollContainerRef}
            className={`overflow-auto flex-1 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
          >
            <table className="min-w-full border-collapse bg-white">
              <thead className="sticky top-0 z-20">
                <tr className="bg-[#004098] text-white font-bold">
                  <th
                    className="p-[0.5rem] border-b border-gray-300 text-center cursor-pointer hover:bg-[#003875] transition-colors sticky left-0 z-30 bg-[#004098] border-r border-white/20"
                    style={{ width: '70px', minWidth: '70px' }}
                    onClick={() => handleSort("id")}
                  >
                    <div className="flex items-center justify-center gap-1 text-xs">
                      <span>No</span>
                      {getSortIcon("id")}
                    </div>
                  </th>
                  <th
                    className="p-[0.5rem] border-b border-gray-300 text-center cursor-pointer border-r border-white/20 sticky left-[70px] z-30 bg-[#004098]"
                    style={{ width: '220px', minWidth: '220px', boxShadow: '3px 0 8px rgba(0,0,0,0.15)' }}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>English</span>
                    </div>
                  </th>
                  {getVisibleLanguages().map((lang) => (
                    <th key={lang.key} className="p-[0.5rem] border-b border-gray-300 text-center border-r border-white/20" style={{ width: '200px', minWidth: '200px' }}>
                      <div className="flex items-center justify-center gap-1 text-sm">
                        <span>{lang.label}</span>
                      </div>
                    </th>
                  ))}
                  <th
                    className="p-[0.5rem] border-b border-gray-300 text-center cursor-pointer hover:bg-[#003875] transition-colors border-r border-white/20"
                    style={{ width: '140px', minWidth: '140px' }}
                    onClick={() => handleSort("date_modified")}
                  >
                    <div className="flex items-center justify-center gap-1 text-xs">
                      <span>Modified</span>
                      {getSortIcon("date_modified")}
                    </div>
                  </th>
                  {(role === "Library Keeper" || role === "Admin") && (
                    <th
                      className="p-[0.5rem] border-b border-gray-300 text-center text-xs sticky right-0 z-30 bg-[#004098]"
                      style={{ width: '130px', minWidth: '130px', boxShadow: '-3px 0 8px rgba(0,0,0,0.15)' }}
                    >
                      Action
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {currentItems.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`cursor-pointer transition-all duration-150 hover:bg-blue-50/40 ${index % 2 === 0 ? "bg-white" : "bg-[#F8F8F8]"
                      }`}
                    onClick={() => setSelectedKeyword(item)}
                  >
                    <td
                      className={`p-[0.75rem] border-b border-gray-200 text-center sticky left-0 z-10 border-r`}
                      style={{
                        backgroundColor: index % 2 === 0 ? 'white' : '#F8F8F8',
                      }}
                    >
                      <span className="text-sm font-medium text-gray-700">{indexOfFirstItem + index + 1}</span>
                    </td>
                    <td
                      className={`p-[0.75rem] border-b border-gray-200 text-left sticky left-[70px] z-10 border-r`}
                      style={{
                        backgroundColor: index % 2 === 0 ? 'white' : '#F8F8F8',
                        boxShadow: '3px 0 8px rgba(0,0,0,0.05)',
                        maxWidth: '220px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={item.english || ""}
                    >
                      {item.english || <span className="text-gray-400 italic">—</span>}
                    </td>
                    {getVisibleLanguages().map((lang) => (
                      <td
                        key={lang.key}
                        className="p-[0.75rem] border-b border-gray-200 text-left border-r border-gray-100"
                        style={{
                          maxWidth: '200px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={item[lang.key] || ""}
                      >
                        {item[lang.key] || <span className="text-gray-400 italic">—</span>}
                      </td>
                    ))}
                    <td className="p-[0.75rem] border-b border-gray-200 text-center border-r border-gray-100">
                      <span className="text-xs font-medium text-gray-600">{formatDate(item.updated_at)}</span>
                    </td>
                    {(role === "Library Keeper" || role === "Admin") && (
                      <td
                        className="p-[0.75rem] border-b border-gray-200 text-center sticky right-0 z-10"
                        style={{
                          backgroundColor: index % 2 === 0 ? 'white' : '#F8F8F8',
                          boxShadow: '-3px 0 8px rgba(0,0,0,0.05)',
                        }}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="p-2 bg-blue-50 rounded-lg hover:bg-blue-100 hover:scale-110 flex items-center justify-center transition-all duration-200 border border-blue-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(item);
                            }}
                            title="Edit Keyword"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="text-blue-600 w-4 h-4"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            className="p-2 bg-red-50 rounded-lg hover:bg-red-100 hover:scale-110 flex items-center justify-center transition-all duration-200 border border-red-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmModal({
                                isOpen: true,
                                keywordId: item.id,
                              });
                            }}
                            title="Delete Keyword"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="text-red-600 w-4 h-4"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && currentItems.length > 0 && (
            <Pagination
              currentPage={validCurrentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </div>

      {/* Keyword Detail Modal */}
      {selectedKeyword && (
        <KeywordDetailModal
          keyword={selectedKeyword}
          visibleLanguages={getVisibleLanguages()}
          onClose={() => setSelectedKeyword(null)}
        />
      )}

      {/* Keyword Edit Modal */}
      {editingKeyword && (role === "Library Keeper" || role === "Admin") && (
        <KeywordEditModal
          keyword={editingKeyword}
          onChange={handleChange}
          onSave={handleSave}
          onClose={() => setEditingKeyword(null)}
        />
      )}

      {/* Keyword Add Modal */}
      {isAddingKeyword && (
        <KeywordAddModal
          newKeyword={newKeyword}
          onFieldChange={setNewKeyword}
          onSubmit={handleAddKeyword}
          onClose={() => setIsAddingKeyword(false)}
          isFormValid={isFormValid()}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal.isOpen &&
        (role === "Library Keeper" || role === "Admin") && (
          <DeleteConfirmModal
            isOpen={deleteConfirmModal.isOpen}
            onConfirm={() => handleDelete(deleteConfirmModal.keywordId)}
            onCancel={() => setDeleteConfirmModal({ isOpen: false, keywordId: null })}
          />
        )}

      {/* GCS Status Info Modal */}
      {showGcsInfo && (
        <GcsStatusModal
          gcsStatus={gcsStatus}
          onClose={() => setShowGcsInfo(false)}
        />
      )}

      {(role === "Admin" || role === "Library Keeper") && (
        <>
          <QueueThresholdModal
            isOpen={showThresholdModal}
            onClose={() => setShowThresholdModal(false)}
            minSuggesters={queueMinSuggesters}
            onSave={handleSaveQueueThreshold}
            saving={thresholdSaving}
          />
          <SuggestionQueueModal
            isOpen={showQueueModal}
            onClose={() => setShowQueueModal(false)}
            items={queueItems}
            total={queueTotal}
            page={queuePage}
            pageSize={QUEUE_PAGE_SIZE}
            totalPages={queueTotalPages}
            loading={loadingQueue}
            searchQuery={queueSearchInput}
            onSearchChange={setQueueSearchInput}
            onPageChange={setQueuePage}
            onApprove={handleApproveFromQueue}
            onReject={handleRejectFromQueue}
            approvingId={approvingQueueId}
            onOpenDuplicateAlerts={handleOpenDuplicateAlerts}
            duplicateAlertCount={dupAlertCount}
          />
          <DuplicateLibraryCompareModal
            isOpen={compareModal.open}
            onClose={() =>
              setCompareModal({ open: false, payload: null, pendingId: null })
            }
            existingApproved={compareModal.payload?.existing_approved}
            pendingSuggestion={compareModal.payload?.pending_suggestion}
            duplicates={compareModal.payload?.duplicates}
            onKeepLibrary={() => handleDuplicateResolution("keep_library")}
            onUseSuggestion={() => handleDuplicateResolution("use_pending")}
            busy={approvingQueueId !== null}
          />
          <DuplicateAlertsModal
            isOpen={showDupAlerts}
            onClose={() => setShowDupAlerts(false)}
            alerts={dupAlerts}
            loading={loadingDupAlerts}
            onApprove={handleDupAlertApprove}
            onDismiss={handleDupAlertDismiss}
            busyId={dupAlertBusyId}
          />
        </>
      )}

    </div>
  );
};

export default CommonLibraryManagement;
