import { useState, useEffect, useRef } from "react";
import {
  FiDownload,
  FiExternalLink,
  FiSearch,
  FiShare2,
  FiArrowUp,
  FiArrowDown,
} from "react-icons/fi";
import Pagination from "../../components/Pagination";
import LoadingBar from "../../components/LoadingBar";
import translationService from "../../services/translationService";
import { toast } from "react-toastify";
import pdfIcon from "../../assets/icons/FilePdf.png";
import wordIcon from "../../assets/icons/FileDoc.png";
import excelIcon from "../../assets/icons/FileXls.png";

// PowerPoint icon component using SVG
const PowerPointIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    className="w-[1.75rem] h-[1.75rem]"
  >
    <path
      fill="#D24726"
      d="M21 2H3c-.6 0-1 .4-1 1v18c0 .6.4 1 1 1h18c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1z"
    />
    <path
      fill="white"
      d="M6.5 7h4c1.4 0 2.5 1.1 2.5 2.5S11.9 12 10.5 12H8v3H6.5V7zm1.5 3.5h2c.6 0 1-.4 1-1s-.4-1-1-1H8v2z"
    />
  </svg>
);

const fileIcons = {
  pdf: <img src={pdfIcon} alt="PDF" className="w-[1.75rem] h-[1.75rem]" />,
  docx: <img src={wordIcon} alt="Word" className="w-[1.75rem] h-[1.75rem]" />,
  xlsx: <img src={excelIcon} alt="Excel" className="w-[1.75rem] h-[1.75rem]" />,
  pptx: <PowerPointIcon />,
};

const languageMap = {
  vi: "Vietnamese",
  ja: "Japanese",
  en: "English",
  "zh-CN": "Chinese (Simplified)",
  "zh-TW": "Chinese (Traditional)",
};

const getLanguageName = (code) => {
  return languageMap[code];
};

const FileHistory = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const tableContainerRef = useRef(null);
  const [showTranslationsModal, setShowTranslationsModal] = useState(false);
  const [selectedOriginalFile, setSelectedOriginalFile] = useState(null);

  useEffect(() => {
    fetchHistoryData();
  }, []);

  const fetchHistoryData = async () => {
    try {
      setLoading(true);
      const response = await translationService.getFileHistory();
      setHistoryData(response.data);
      setError(null);
    } catch {
      setError("Could not load history data. Please try again later.");
      toast.error("Could not load translation history. Please try again later.");
    } finally {
      setLoading(false);
    }
  };


  const getOriginalFiles = () => {
    if (!historyData || historyData.length === 0) return [];

    return historyData.map((group) => ({
      id: group.id,
      name: group.original_file_name,
      type: group.file_type, // Giữ nguyên file type gốc cho original files
      date: new Date(group.created_at).toLocaleDateString("en-US"),
      url: group.original_file_url,
      translations_count: group.translations.length,
      language: group.original_language,
      rawData: group,
    }));
  };
  const handleOriginalFileClick = (file) => {
    setSelectedOriginalFile(file);
    setShowTranslationsModal(true);
  };

  const handleCloseTranslationsModal = () => {
    setShowTranslationsModal(false);
    setSelectedOriginalFile(null);
  };

  const filteredFiles = getOriginalFiles()
    .filter((file) => {
      return file.name.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      let aVal, bVal;

      switch (sortField) {
        case "id":
          aVal = a.id;
          bVal = b.id;
          break;
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "date":
          aVal = new Date(a.date);
          bVal = new Date(b.date);
          break;
        default:
          aVal = a.id;
          bVal = b.id;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

  // Reset currentPage when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredFiles.length / ITEMS_PER_PAGE) || 1;
  const validCurrentPage = Math.max(1, Math.min(currentPage, totalPages));
  const indexOfFirstItem = (validCurrentPage - 1) * ITEMS_PER_PAGE;
  const filteredItems = filteredFiles.slice(indexOfFirstItem, indexOfFirstItem + ITEMS_PER_PAGE);

  const handlePageChange = (newPage) => {
    setCurrentPage(Math.max(1, Math.min(newPage, totalPages)));
  };

  const handleDownload = async (file, languageCode, actualFileType = null) => {
    const originalExt = file.name.split(".").pop();
    const actualExt = actualFileType || originalExt;

    const nameParts = file.name.split(".");
    nameParts.pop(); // Remove original extension
    const baseName = nameParts.join(".");

    const newFileName = languageCode
      ? `${baseName}_${languageCode}.${actualExt}`
      : `${baseName}.${actualExt}`;

    try {
      const response = await fetch(file.url, { method: "GET" });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", newFileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("We couldn't download the file. Please try again.");
    }
  };

  const handleOpenInNewTab = (file) => {
    let actualFileType;
    if (file.type) {
      actualFileType = file.type;
    } else {
      actualFileType = file.name.split(".").pop().toLowerCase();
    }

    let viewerUrl;
    if (actualFileType === "pdf") {
      viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(
        file.url
      )}&embedded=true`;
    } else {
      viewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(
        file.url
      )}`;
    }

    window.open(viewerUrl, "_blank");
  };

  const handleShareFile = async (file) => {
    try {
      let actualFileType;
      if (file.type) {
        actualFileType = file.type;
      } else {
        actualFileType = file.name.split(".").pop().toLowerCase();
      }

      let viewerUrl;
      if (actualFileType === "pdf") {
        viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(
          file.url
        )}&embedded=true`;
      } else {
        viewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(
          file.url
        )}`;
      }

      await navigator.clipboard.writeText(viewerUrl);
      toast.success("File view link has been copied to clipboard");
    } catch {
      toast.error("Could not copy file view link. Please try again.");
    }
  };

  const handleDelete = async (fileId) => {
    try {
      await translationService.deleteFileHistory(fileId);
      toast.success("File has been successfully deleted from the database");
      fetchHistoryData();
      setFileToDelete(null);
    } catch {
      toast.error("Could not delete file. Please try again later.");
    }
  };

  // Handle sort order change
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Get sort icon for column header
  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <FiArrowUp className="ml-2 text-gray-400" />;
    }
    return sortOrder === "asc" ? (
      <FiArrowUp className="ml-2 text-white" />
    ) : (
      <FiArrowDown className="ml-2 text-white" />
    );
  };

  return (
    <div className="flex flex-1 flex-col h-full gap-[0.25rem]">
      <div className="bg-white p-[1rem] rounded-t-lg">
        <div className="flex flex-wrap items-center justify-between gap-[1rem]">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-gray-800">File History</h1>
          </div>

          <div className="flex flex-wrap items-center gap-[1rem]">
            <div className="relative w-[16rem]">
              <FiSearch className="absolute left-[0.75rem] top-[0.75rem] text-gray-500 z-10" />
              <input
                type="text"
                placeholder="Search"
                className="p-[0.5rem] pl-[2.5rem] border border-gray-300 rounded-full w-full bg-white text-black placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {loading && <LoadingBar />}

      <div className="bg-white p-[0.5rem] rounded-b-lg flex-1 flex flex-col">
        <div ref={tableContainerRef} className="flex-1 h-full flex flex-col">
          {error ? (
            <div className="text-center py-10 text-red-500">
              <p>{error}</p>
              <button
                onClick={fetchHistoryData}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Try Again
              </button>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              {searchTerm
                ? "No matching results found"
                : "No files have been translated yet. Translate files to see history."}
            </div>
          ) : (
            <div className="overflow-hidden flex-1">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse bg-white rounded-lg table-fixed min-w-[800px]">
                  <thead>
                    <tr className="bg-[#004098CC] text-white font-bold">
                      <th
                        className="p-[0.75rem] border-b border-gray-300 w-[5%] text-center min-w-[50px] cursor-pointer hover:bg-[#003875] transition-colors"
                        onClick={() => handleSort("id")}
                      >
                        <div className="flex items-center justify-center">
                          ID
                          {getSortIcon("id")}
                        </div>
                      </th>
                      <th
                        className="p-[0.75rem] border-b border-gray-300 w-[39%] text-center min-w-[250px] cursor-pointer hover:bg-[#003875] transition-colors"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center justify-center">
                          Name
                          {getSortIcon("name")}
                        </div>
                      </th>
                      <th className="p-[0.75rem] border-b border-gray-300 w-[10%] text-center min-w-[80px]">
                        Language
                      </th>
                      <th className="p-[0.75rem] border-b border-gray-300 w-[8%] text-center min-w-[70px]">
                        Translations
                      </th>
                      <th
                        className="p-[0.75rem] border-b border-gray-300 w-[12%] text-center min-w-[90px] cursor-pointer hover:bg-[#003875] transition-colors"
                        onClick={() => handleSort("date")}
                      >
                        <div className="flex items-center justify-center">
                          Date
                          {getSortIcon("date")}
                        </div>
                      </th>
                      <th className="p-[0.75rem] border-b border-gray-300 w-[26%] text-center min-w-[200px]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((file, index) => (
                      <tr
                        key={file.id}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors duration-150 ${
                          index % 2 === 0 ? "bg-white" : "bg-[#F8F8F8]"
                        }`}
                        onClick={() => handleOriginalFileClick(file)}
                      >
                        <td className="p-[0.75rem] border-b border-gray-200 text-center w-[5%]">
                          {indexOfFirstItem + index + 1}
                        </td>
                        <td className="p-[0.75rem] border-b border-gray-200 text-left w-[39%]">
                          <div className="flex items-center space-x-[0.5rem] min-w-0">
                            <div className="flex-shrink-0">
                              {fileIcons[file.type] || <span>📄</span>}
                            </div>
                            <span
                              className="truncate block min-w-0 flex-1"
                              title={file.name}
                            >
                              {file.name}
                            </span>
                          </div>
                        </td>
                        <td className="p-[0.75rem] border-b border-gray-200 text-center w-[10%]">
                          {getLanguageName(file.language)}
                        </td>
                        <td className="p-[0.75rem] border-b border-gray-200 text-center w-[8%]">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                            {file.translations_count}
                          </span>
                        </td>
                        <td className="p-[0.75rem] border-b border-gray-200 text-center w-[12%]">
                          {file.date}
                        </td>
                        <td className="p-[0.75rem] border-b border-gray-200 text-center w-[26%]">
                          <div className="flex justify-center space-x-[1rem]">
                            <button
                              className="p-[0.5rem] bg-blue-100 rounded-md hover:bg-blue-200 flex items-center justify-center transition-colors"
                              title="Download"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleDownload(file, null); // File gốc, không cần language code
                              }}
                            >
                              <FiDownload className="text-blue-600 w-[1.25rem] h-[1.25rem]" />
                            </button>
                            <button
                              className="p-[0.5rem] bg-green-100 rounded-md hover:bg-green-200 flex items-center justify-center transition-colors"
                              title="Open in new tab"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenInNewTab(file);
                              }}
                            >
                              <FiExternalLink className="text-green-600 w-[1.25rem] h-[1.25rem]" />
                            </button>
                            <button
                              className="p-[0.5rem] bg-orange-100 rounded-md hover:bg-orange-200 flex items-center justify-center transition-colors"
                              title="Share file"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleShareFile(file);
                              }}
                            >
                              <FiShare2 className="text-orange-600 w-[1.25rem] h-[1.25rem]" />
                            </button>
                            <button
                              className="p-[0.5rem] bg-red-100 rounded-md hover:bg-red-200 flex items-center justify-center transition-colors"
                              title="Delete file"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFileToDelete(file);
                              }}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-red-600 w-[1.25rem] h-[1.25rem]"
                              >
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {!loading && !error && filteredFiles.length > 0 && (
          <div>
            <Pagination
              currentPage={validCurrentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>

      {showTranslationsModal && selectedOriginalFile && (
        <div
          className="fixed inset-0 flex justify-center items-center z-50"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          onClick={handleCloseTranslationsModal}
        >
          <div
            className="bg-white p-[1.5rem] rounded-lg shadow-xl w-11/12 max-w-6xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold truncate pr-4 min-w-0 flex-1">
                Translations for &quot;
                <span className="truncate" title={selectedOriginalFile.name}>
                  {selectedOriginalFile.name}
                </span>
                &quot;
              </h2>
              <button
                onClick={handleCloseTranslationsModal}
                className="p-2 text-gray-500 hover:text-gray-700 flex-shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="bg-gray-100 p-3 rounded mb-4">
              <p className="mb-1">
                <strong>Original File:</strong>
                <span className="ml-2 break-all">
                  {selectedOriginalFile.name}
                </span>
              </p>
              <p className="mb-1">
                <strong>Language:</strong>{" "}
                {getLanguageName(selectedOriginalFile.language)}
              </p>
              <p className="mb-0">
                <strong>Date:</strong> {selectedOriginalFile.date}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse bg-white rounded-lg table-fixed">
                <thead>
                  <tr className="bg-[#004098CC] text-white font-bold">
                    <th className="p-[0.75rem] border-b border-gray-300 w-[5%] text-center">
                      ID
                    </th>
                    <th className="p-[0.75rem] border-b border-gray-300 w-[39%] text-center">
                      Name
                    </th>
                    <th className="p-[0.75rem] border-b border-gray-300 w-[12%] text-center">
                      Language
                    </th>
                    <th className="p-[0.75rem] border-b border-gray-300 w-[13%] text-center">
                      Date
                    </th>
                    <th className="p-[0.75rem] border-b border-gray-300 w-[30%] text-center">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOriginalFile.rawData.translations.length > 0 ? (
                    selectedOriginalFile.rawData.translations.map(
                      (translation, idx) => (
                        <tr
                          key={translation.id}
                          className={`hover:bg-gray-50 transition-colors duration-150 ${
                            idx % 2 === 0 ? "bg-white" : "bg-[#F8F8F8]"
                          }`}
                        >
                          <td className="p-[0.75rem] border-b border-gray-200 text-center w-[5%]">
                            {idx + 1}
                          </td>
                          <td className="p-[0.75rem] border-b border-gray-200 text-left w-[39%]">
                            <div className="flex items-center space-x-[0.5rem] min-w-0">
                              <div className="flex-shrink-0">
                                {fileIcons[translation.file_type] || <span>📄</span>}
                              </div>
                              <span
                                className="truncate block min-w-0 flex-1"
                                title={(() => {
                                  const nameParts =
                                    selectedOriginalFile.name.split(".");
                                  nameParts.pop();
                                  const baseName = nameParts.join(".");
                                  return `${baseName}_${translation.language_code}.${translation.file_type}`;
                                })()}
                              >
                                {(() => {
                                  const nameParts =
                                    selectedOriginalFile.name.split(".");
                                  nameParts.pop();
                                  const baseName = nameParts.join(".");
                                  return `${baseName}_${translation.language_code}.${translation.file_type}`;
                                })()}
                              </span>
                            </div>
                          </td>
                          <td className="p-[0.75rem] border-b border-gray-200 text-center w-[12%]">
                            {getLanguageName(translation.language_code)}
                          </td>
                          <td className="p-[0.75rem] border-b border-gray-200 text-center w-[13%]">
                            {new Date(
                              translation.created_at
                            ).toLocaleDateString("en-US")}
                          </td>
                          <td className="p-[0.75rem] border-b border-gray-200 text-center w-[30%]">
                            <div className="flex justify-center space-x-[1rem]">
                              <button
                                className="p-[0.5rem] bg-blue-100 rounded-md hover:bg-blue-200 flex items-center justify-center transition-colors"
                                title="Download"
                                onClick={async () => {
                                  await handleDownload(
                                    {
                                      url: translation.translated_file_url,
                                      name: selectedOriginalFile.name,
                                    },
                                    translation.language_code,
                                    translation.file_type
                                  );
                                }}
                              >
                                <FiDownload className="text-blue-600 w-[1.25rem] h-[1.25rem]" />
                              </button>
                              <button
                                className="p-[0.5rem] bg-green-100 rounded-md hover:bg-green-200 flex items-center justify-center transition-colors"
                                title="Open in new tab"
                                onClick={() => {
                                  handleOpenInNewTab(
                                    {
                                      url: translation.translated_file_url,
                                      name: selectedOriginalFile.name,
                                      type: translation.file_type,
                                    },
                                    false
                                  );
                                }}
                              >
                                <FiExternalLink className="text-green-600 w-[1.25rem] h-[1.25rem]" />
                              </button>
                              <button
                                className="p-[0.5rem] bg-orange-100 rounded-md hover:bg-orange-200 flex items-center justify-center transition-colors"
                                title="Share file"
                                onClick={async () => {
                                  await handleShareFile(
                                    {
                                      url: translation.translated_file_url,
                                      name: selectedOriginalFile.name,
                                      type: translation.file_type,
                                    },
                                    false
                                  );
                                }}
                              >
                                <FiShare2 className="text-orange-600 w-[1.25rem] h-[1.25rem]" />
                              </button>
                              <button
                                className="p-[0.5rem] bg-red-100 rounded-md hover:bg-red-200 flex items-center justify-center transition-colors"
                                title="Delete file"
                                onClick={() =>
                                  setFileToDelete({
                                    id: translation.id,
                                    name: selectedOriginalFile.name,
                                  })
                                }
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="text-red-600 w-[1.25rem] h-[1.25rem]"
                                >
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  <line x1="10" y1="11" x2="10" y2="17" />
                                  <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )
                  ) : (
                    <tr>
                      <td
                        colSpan="5"
                        className="p-[0.75rem] text-center text-gray-500"
                      >
                        No translations available for this file.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedFile && (
        <div
          className="fixed inset-0 flex justify-center items-center z-50"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.7)" }}
          onClick={() => setSelectedFile(null)}
        >
          <div
            className="bg-white p-[1.5rem] rounded-lg shadow-xl max-w-2xl w-11/12 max-h-[90vh] overflow-auto text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-[1rem]">FILE DETAILS</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse bg-white shadow-md rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-[0.75rem] border-b border-gray-300 text-center">
                      Property
                    </th>
                    <th className="p-[0.75rem] border-b border-gray-300 text-center">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    <td className="p-[0.75rem] border-b border-gray-200 text-center">
                      File Name
                    </td>
                    <td className="p-[0.75rem] border-b border-gray-200 text-center">
                      <div className="flex items-center space-x-[0.5rem] justify-center">
                        {fileIcons[selectedFile.type] || <span>📄</span>}
                        <span>{selectedFile.name}</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="bg-[#F8F8F8]">
                    <td className="p-[0.75rem] border-b border-gray-200 text-center">
                      Language
                    </td>
                    <td className="p-[0.75rem] border-b border-gray-200 text-center">
                      {selectedFile.lang}
                    </td>
                  </tr>
                  <tr className="bg-white">
                    <td className="p-[0.75rem] border-b border-gray-200 text-center">
                      Date
                    </td>
                    <td className="p-[0.75rem] border-b border-gray-200 text-center">
                      {selectedFile.date}
                    </td>
                  </tr>
                  <tr className="bg-[#F8F8F8]">
                    <td className="p-[0.75rem] border-b border-gray-200 text-center">
                      File Type
                    </td>
                    <td className="p-[0.75rem] border-b border-gray-200 text-center">
                      {selectedFile.type?.toUpperCase() || "UNKNOWN"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-[1rem] flex justify-center space-x-[1rem]">
              <button
                className="px-[1rem] py-[0.5rem] bg-blue-500 text-white rounded flex items-center"
                onClick={async () => {
                  await handleDownload(selectedFile, null); // File gốc, không cần language code
                }}
              >
                <FiDownload className="mr-[0.5rem]" /> Download
              </button>
              <button
                className="px-[1rem] py-[0.5rem] bg-green-500 text-white rounded flex items-center"
                onClick={() => handleOpenInNewTab(selectedFile)}
              >
                <FiExternalLink className="mr-[0.5rem]" /> Open in new tab
              </button>
              <button
                className="px-[1rem] py-[0.5rem] bg-orange-500 text-white rounded flex items-center"
                onClick={async () => {
                  await handleShareFile(selectedFile);
                }}
              >
                <FiShare2 className="mr-[0.5rem]" /> Share
              </button>
              <button
                className="px-[1rem] py-[0.5rem] bg-red-500 text-white rounded flex items-center"
                onClick={() => setFileToDelete(selectedFile)}
              >
                Delete
              </button>
              <button
                className="px-[1rem] py-[0.5rem] bg-gray-500 text-white rounded"
                onClick={() => setSelectedFile(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {fileToDelete && (
        <div
          className="fixed inset-0 flex justify-center items-center"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <div
            className="bg-white p-[1.5rem] rounded shadow-lg w-[24rem] text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-[1rem]">Confirm Delete</h3>
            <p className="mb-[1.5rem]">
              Are you sure you want to delete the file &quot;
              {fileToDelete.name}&quot;?
            </p>
            <div className="flex justify-center space-x-[1rem]">
              <button
                className="px-[1rem] py-[0.5rem] bg-red-500 text-white rounded hover:bg-red-600"
                onClick={() => handleDelete(fileToDelete.id)}
              >
                Delete
              </button>
              <button
                className="px-[1rem] py-[0.5rem] bg-gray-500 text-white rounded hover:bg-gray-600"
                onClick={() => setFileToDelete(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileHistory;
