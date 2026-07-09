import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLibraryLanguages } from "../../hooks/useLibraryLanguages";
import {
  FiSearch,
  FiAlertCircle,
  FiArrowUp,
  FiArrowDown,
  FiFilter,
  FiX,
  FiEdit2,
  FiTrash2,
} from "react-icons/fi";
import { MdMenuBook } from "react-icons/md";
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
import {
  QueueThresholdModal,
  SuggestionQueueModal,
  DuplicateLibraryCompareModal,
  DuplicateAlertsModal,
} from "../../components/features/admin/LibrarySuggestionQueueModals";


const QUEUE_PAGE_SIZE = 8;

const CommonLibraryManagement = () => {
  const { libraryLanguages } = useLibraryLanguages();
  const { role } = useAuth();
  const [keywords, setKeywords] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("date_modified");
  const [sortDirection, setSortDirection] = useState("desc");
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [editingKeyword, setEditingKeyword] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [newKeyword, setNewKeyword] = useState({ translations: {} });

  const [isAddingKeyword, setIsAddingKeyword] = useState(false);
  const [loading, setLoading] = useState(true);

  // Column filter states
  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('libraryVisibleColumns');
    return saved ? JSON.parse(saved) : null; // null = show all enabled languages
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

  // Suggestion search (Common Library — Admin / Library Keeper)
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

  // When libraryLanguages loads, initialise or migrate visibleColumns
  useEffect(() => {
    if (libraryLanguages.length === 0) return;
    const enabledCodes = libraryLanguages.map((l) => l.code);
    if (visibleColumns === null) {
      setVisibleColumns(enabledCodes);
      return;
    }
    const hasAnyMatch = visibleColumns.some((k) => enabledCodes.includes(k));
    if (!hasAnyMatch) {
      setVisibleColumns(enabledCodes);
    }
  }, [libraryLanguages]);

  // Effective visible columns — intersect saved prefs with currently-enabled languages
  const effectiveVisibleColumns = useMemo(() => {
    if (!visibleColumns) return [];
    const enabledKeys = new Set(libraryLanguages.map((l) => l.code));
    return visibleColumns.filter((k) => enabledKeys.has(k));
  }, [visibleColumns, libraryLanguages]);

  // Save visible columns to localStorage
  useEffect(() => {
    if (visibleColumns !== null)
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
      const current = prev || libraryLanguages.map(l => l.code);
      if (current.includes(columnKey)) {
        if (effectiveVisibleColumns.length <= 1) {
          toast.warning("At least one language column must be visible", {
            style: { backgroundColor: "orange", color: "white" },
            icon: <FiAlertCircle />,
          });
          return current;
        }
        return current.filter(key => key !== columnKey);
      }
      return [...current, columnKey];
    });
  };

  const selectAllColumns = () => setVisibleColumns(libraryLanguages.map(l => l.code));
  const deselectAllColumns = () => setVisibleColumns(libraryLanguages.length > 0 ? [libraryLanguages[0].key] : []);

  const getVisibleLanguages = () =>
    libraryLanguages.filter(lang => effectiveVisibleColumns.includes(lang.code));

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
        if (queueSearchInput.trim() === prev) return prev;
        setQueuePage(1);
        return queueSearchInput.trim();
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
      const notifiedCount = res?.data?.threshold_notified_count ?? 0;
      toast.success(
        notifiedCount > 0
          ? `Queue threshold saved. ${notifiedCount} suggestion(s) sent to the review queue.`
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
      const searchInFields = Object.values(item.translations || {});
      return searchInFields.some((field) =>
        (field || "").toLowerCase().includes(searchTerm.toLowerCase())
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

      try {
        await notificationService.createNotificationForAll({
          title: "Keyword Updated",
          message: "A keyword in the library has been updated.",
          details: true,
          keyword_details: [{ id: editingKeyword.id, translations: editingKeyword.translations, action: "updated" }],
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

  const handleChange = (updatedKeyword) => {
    setEditingKeyword(updatedKeyword);
  };

  const handleAddKeyword = async () => {
    const translations = newKeyword.translations || {};
    const hasContent = Object.values(translations).some((v) => v && v.trim() !== "");
    if (!hasContent) {
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
      setNewKeyword({ translations: {} });
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
    const t = newKeyword.translations || {};
    return Object.values(t).some((val) => val && val.trim() !== "");
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
          <div className="h-full bg-indigo-700 animate-loading-bar"></div>
        </div>
      )}

      {/* Controls Frame with Search, Sort, and Action Buttons */}
      <div className="bg-white p-[0.5rem] rounded-t-lg">
        <div className="flex flex-wrap justify-between items-center gap-3">
          {/* Left: title + action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <MdMenuBook className="text-indigo-700" size={22} />
              <span className="text-base font-semibold text-indigo-700">
                Common Library
              </span>
            </div>

            <LibraryActionButtons
              keywords={keywords}
              role={role}
              gcsStatus={gcsStatus}
              onRefreshKeywords={handleRefreshGcsStatus}
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
          </div>

          {/* Right side - Search Control and Column Filter */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Column Filter */}
            <div className="relative" ref={columnFilterRef}>
              <button
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors text-sm"
                onClick={() => setShowColumnFilter(!showColumnFilter)}
                title="Filter visible columns"
              >
                <FiFilter className="text-gray-600" />
                <span className="font-medium text-gray-700">
                  {/* +1 for the English column, which is always shown (sticky, not toggleable) */}
                  Columns ({effectiveVisibleColumns.length + 1}/{libraryLanguages.length + 1})
                </span>
              </button>

              {showColumnFilter && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b border-gray-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-700 text-sm">Show/Hide Columns</h4>
                      <button
                        onClick={() => setShowColumnFilter(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <FiX size={16} />
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
                    {libraryLanguages.map((lang) => (
                      <label
                        key={lang.code}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={effectiveVisibleColumns.includes(lang.code)}
                          onChange={() => toggleColumnVisibility(lang.code)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700 flex-1">{lang.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Search Control */}
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
                <tr className="bg-indigo-700 text-white font-bold">
                  <th
                    className="p-2 border-b border-gray-300 text-center cursor-pointer hover:bg-indigo-800 transition-colors sticky left-0 z-30 bg-indigo-700 border-r border-white/20 text-xs"
                    style={{ width: 60, minWidth: 60 }}
                    onClick={() => handleSort("id")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      No {getSortIcon("id")}
                    </div>
                  </th>
                  <th
                    className="p-2 border-b border-gray-300 text-center border-r border-white/20 sticky left-[60px] z-30 bg-indigo-700 text-xs"
                    style={{ width: 220, minWidth: 220, boxShadow: '3px 0 8px rgba(0,0,0,0.15)' }}
                  >
                    English
                  </th>
                  {getVisibleLanguages().map((lang) => (
                    <th key={lang.code} className="p-2 border-b border-gray-300 text-center border-r border-white/20 text-xs" style={{ width: 200, minWidth: 200 }}>
                      {lang.label}
                    </th>
                  ))}
                  <th
                    className="p-2 border-b border-gray-300 text-center cursor-pointer hover:bg-indigo-800 transition-colors border-r border-white/20 text-xs"
                    style={{ width: 140, minWidth: 140 }}
                    onClick={() => handleSort("date_modified")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Modified {getSortIcon("date_modified")}
                    </div>
                  </th>
                  {(role === "Library Keeper" || role === "Admin") && (
                    <th
                      className="p-2 border-b border-gray-300 text-center border-r border-white/20 text-xs sticky right-0 z-30 bg-indigo-700"
                      style={{ width: 80, minWidth: 80, boxShadow: '-3px 0 8px rgba(0,0,0,0.15)' }}
                    >
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {currentItems.length === 0 && !loading ? (
                  <tr>
                    <td
                      colSpan={
                        3 +
                        getVisibleLanguages().length +
                        (role === "Library Keeper" || role === "Admin" ? 1 : 0)
                      }
                      className="py-16 text-center text-gray-400"
                    >
                      {searchTerm
                        ? "No keywords match your search."
                        : "The common library is empty."}
                    </td>
                  </tr>
                ) : (
                currentItems.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`cursor-pointer transition-all duration-150 hover:brightness-95 ${index % 2 === 0 ? "bg-white" : "bg-[#F8F8F8]"
                      }`}
                    onClick={() => setSelectedKeyword(item)}
                  >
                    <td
                      className="p-2 border-b border-gray-200 text-center sticky left-0 z-10 border-r text-sm font-medium text-gray-700"
                      style={{
                        backgroundColor: index % 2 === 0 ? 'white' : '#F8F8F8',
                      }}
                    >
                      {indexOfFirstItem + index + 1}
                    </td>
                    <td
                      className="p-2 border-b border-gray-200 text-left sticky left-[60px] z-10 border-r text-sm"
                      style={{
                        backgroundColor: index % 2 === 0 ? 'white' : '#F8F8F8',
                        boxShadow: '3px 0 8px rgba(0,0,0,0.05)',
                        maxWidth: '220px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={(item.translations || {})["en"] || ""}
                    >
                      {(item.translations || {})["en"] || <span className="text-gray-400 italic">—</span>}
                    </td>
                    {getVisibleLanguages().map((lang) => (
                      <td
                        key={lang.code}
                        className="p-2 border-b border-gray-200 text-left border-r border-gray-100 text-sm"
                        style={{
                          maxWidth: '200px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={(item.translations || {})[lang.code] || ""}
                      >
                        {(item.translations || {})[lang.code] || <span className="text-gray-300 italic">—</span>}
                      </td>
                    ))}
                    <td className="p-2 border-b border-gray-200 text-center border-r border-gray-100">
                      <span className="text-xs text-gray-600">{formatDate(item.updated_at)}</span>
                    </td>
                    {(role === "Library Keeper" || role === "Admin") && (
                      <td
                        className="p-2 border-b border-gray-200 text-center sticky right-0 z-10"
                        style={{
                          backgroundColor: index % 2 === 0 ? 'white' : '#F8F8F8',
                          boxShadow: '-3px 0 8px rgba(0,0,0,0.05)',
                        }}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            className="p-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(item);
                            }}
                            title="Edit"
                          >
                            <FiEdit2 className="text-blue-600 w-3.5 h-3.5" />
                          </button>
                          <button
                            className="p-1.5 bg-red-50 rounded-lg hover:bg-red-100 border border-red-200 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmModal({
                                isOpen: true,
                                keywordId: item.id,
                              });
                            }}
                            title="Delete"
                          >
                            <FiTrash2 className="text-red-600 w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
                )}
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
