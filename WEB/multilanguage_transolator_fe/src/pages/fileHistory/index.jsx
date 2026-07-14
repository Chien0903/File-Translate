import { useState, useEffect, useRef } from "react";
import { useEnabledLanguages } from "../../hooks/useEnabledLanguages";
import { FiDownload, FiExternalLink, FiShare2, FiSearch, FiFolder, FiFolderPlus } from "react-icons/fi";
import { MdClose, MdDescription } from "react-icons/md";
import Pagination from "../../components/Pagination";
import translationService from "../../services/translationService";
import { toast } from "react-toastify";
import pdfIcon from "../../assets/icons/FilePdf.png";
import wordIcon from "../../assets/icons/FileDoc.png";
import excelIcon from "../../assets/icons/FileXls.png";

const PowerPointIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24">
    <path fill="#D24726" d="M21 2H3c-.6 0-1 .4-1 1v18c0 .6.4 1 1 1h18c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1z" />
    <path fill="white" d="M6.5 7h4c1.4 0 2.5 1.1 2.5 2.5S11.9 12 10.5 12H8v3H6.5V7zm1.5 3.5h2c.6 0 1-.4 1-1s-.4-1-1-1H8v2z" />
  </svg>
);

const fileIcons = {
  pdf: <img src={pdfIcon} alt="PDF" className="w-6 h-6" />,
  docx: <img src={wordIcon} alt="Word" className="w-6 h-6" />,
  xlsx: <img src={excelIcon} alt="Excel" className="w-6 h-6" />,
  pptx: <PowerPointIcon />,
};

const ALL_FOLDERS = "";
const UNCATEGORIZED = "__uncategorized__";

const LangBadge = ({ code, prefixMap = {}, filled = false }) => (
  <span className={`px-2 py-0.5 rounded-md text-xs font-bold
    ${filled ? "bg-indigo-700 text-white" : "bg-indigo-50 text-indigo-600"}`}>
    {prefixMap[code] || code?.toUpperCase()}
  </span>
);

const FileHistory = () => {
  const { prefixByCode } = useEnabledLanguages();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOriginalFile, setSelectedOriginalFile] = useState(null);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(ALL_FOLDERS);
  const [fileToMove, setFileToMove] = useState(null);
  const [moveFolderInput, setMoveFolderInput] = useState("");
  const [movingFolder, setMovingFolder] = useState(false);
  const [folders, setFolders] = useState([]);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(() => { fetchHistoryData(); fetchFolders(); }, []);

  const fetchHistoryData = async () => {
    try {
      setLoading(true);
      const response = await translationService.getFileHistory();
      setHistoryData(response.data);
      setError(null);
    } catch {
      setError("Could not load history data.");
      toast.error("Could not load translation history.");
    } finally {
      setLoading(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const response = await translationService.getFolders();
      setFolders(response.data);
    } catch {
      // Folder list is a non-critical enhancement; fail silently.
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      setCreatingFolder(true);
      await translationService.createFolder(name);
      toast.success(`Folder "${name}" created.`);
      setNewFolderName("");
      setShowNewFolder(false);
      fetchFolders();
    } catch {
      toast.error("Could not create folder.");
    } finally {
      setCreatingFolder(false);
    }
  };

  const getOriginalFiles = () => historyData.map((g) => ({
    id: g.id, name: g.original_file_name, type: g.file_type,
    date: new Date(g.created_at).toLocaleDateString("en-US"),
    url: g.original_file_url, translations_count: g.translations.length,
    language: g.original_language, folder: g.folder || "", rawData: g,
  }));

  const folderList = [...new Set([...folders, ...historyData.map((g) => g.folder).filter(Boolean)])].sort();

  const filteredFiles = getOriginalFiles()
    .filter((f) => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((f) => {
      if (selectedFolder === ALL_FOLDERS) return true;
      if (selectedFolder === UNCATEGORIZED) return !f.folder;
      return f.folder === selectedFolder;
    })
    .sort((a, b) => {
      const aVal = sortField === "name" ? a.name.toLowerCase() : sortField === "date" ? new Date(a.date) : a.id;
      const bVal = sortField === "name" ? b.name.toLowerCase() : sortField === "date" ? new Date(b.date) : b.id;
      return sortOrder === "asc" ? (aVal < bVal ? -1 : 1) : (aVal > bVal ? -1 : 1);
    });

  useEffect(() => { setCurrentPage(1); }, [searchTerm, sortField, sortOrder, selectedFolder]);

  const totalPages = Math.ceil(filteredFiles.length / ITEMS_PER_PAGE) || 1;
  const currentItems = filteredFiles.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleDownload = async (file, langCode, actualType = null) => {
    const ext = actualType || file.name.split(".").pop();
    const base = file.name.split(".").slice(0, -1).join(".");
    const newName = langCode ? `${base}_${langCode}.${ext}` : `${base}.${ext}`;
    try {
      const res = await fetch(file.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = newName;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { toast.error("Download failed."); }
  };

  const handleMove = async () => {
    const folder = moveFolderInput.trim();
    try {
      setMovingFolder(true);
      await translationService.moveFileToFolder(fileToMove.url, folder);
      toast.success(folder ? `Moved to "${folder}".` : "Removed from folder.");
      setFileToMove(null);
      fetchHistoryData();
      fetchFolders();
    } catch {
      toast.error("Move failed.");
    } finally {
      setMovingFolder(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await translationService.deleteFileHistory(id);
      toast.success("File deleted.");
      fetchHistoryData();
      setFileToDelete(null);
    } catch { toast.error("Delete failed."); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Translation History</h1>
          <p className="text-gray-400 text-sm mt-0.5">All your translated files in one place.</p>
        </div>
        {filteredFiles.length > 0 && (
          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-full">
            {filteredFiles.length} files
          </span>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {/* Search */}
        <div className="px-5 py-4 border-b border-gray-50 space-y-3">
          <div className="relative max-w-sm">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
          </div>

          {/* Folder filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: ALL_FOLDERS, label: "All files" },
              { key: UNCATEGORIZED, label: "Uncategorized" },
              ...folderList.map((f) => ({ key: f, label: f })),
            ].map((chip) => (
              <button
                key={chip.key}
                onClick={() => setSelectedFolder(chip.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedFolder === chip.key
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {chip.label}
              </button>
            ))}
            <button
              onClick={() => setShowNewFolder(true)}
              className="px-3 py-1 rounded-full text-xs font-medium border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 flex items-center gap-1"
            >
              <FiFolderPlus size={13} /> New folder
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-400 text-sm">
            {error}
            <button onClick={fetchHistoryData} className="block mx-auto mt-2 text-indigo-600 hover:underline">Try again</button>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="py-16 text-center">
            <MdDescription size={36} className="mx-auto text-gray-200 mb-2" />
            <p className="text-gray-300 text-sm">{searchTerm ? "No matching results" : "No files translated yet"}</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-12 px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-50">
              <div className="col-span-4">File</div>
              <div className="col-span-2 text-center">Folder</div>
              <div className="col-span-1 text-center">Origin</div>
              <div className="col-span-2 text-center">Translations</div>
              <div className="col-span-1 text-center">Date</div>
              <div className="col-span-2 text-center">Actions</div>
            </div>

            {/* Table rows */}
            <div className="divide-y divide-gray-50">
              {currentItems.map((file) => (
                <div
                  key={file.id}
                  className="grid grid-cols-12 px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors items-center"
                  onClick={() => setSelectedOriginalFile(file)}
                >
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0">{fileIcons[file.type] || <MdDescription size={24} className="text-gray-300" />}</div>
                    <span className="text-sm text-gray-800 truncate font-medium">{file.name}</span>
                  </div>
                  <div className="col-span-2 flex justify-center">
                    {file.folder ? (
                      <span className="px-2 py-0.5 rounded-md text-xs bg-amber-50 text-amber-700 truncate max-w-full">
                        {file.folder}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <LangBadge code={file.language} prefixMap={prefixByCode} />
                  </div>
                  <div className="col-span-2 text-center">
                    <span className="text-sm text-gray-500">{file.translations_count}</span>
                  </div>
                  <div className="col-span-1 text-center text-sm text-gray-400">{file.date}</div>
                  <div className="col-span-2 flex justify-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFileToMove(file);
                        setMoveFolderInput(file.folder || "");
                      }}
                      className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      title="Move to folder"
                    >
                      <FiFolderPlus size={15} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(file, null); }}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Download"
                    >
                      <FiDownload size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-400">Showing {currentItems.length} of {filteredFiles.length}</span>
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Translations modal */}
      {selectedOriginalFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedOriginalFile(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900">Translations</h2>
                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-md">{selectedOriginalFile.name}</p>
              </div>
              <button onClick={() => setSelectedOriginalFile(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                <MdClose size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {selectedOriginalFile.rawData.translations.length === 0 ? (
                <div className="py-12 text-center text-gray-300 text-sm">No translations available.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {selectedOriginalFile.rawData.translations.map((t, idx) => {
                    const baseName = selectedOriginalFile.name.split(".").slice(0, -1).join(".");
                    const translatedName = `${baseName}_${t.language_code}.${t.file_type}`;
                    return (
                      <div key={t.id} className="flex items-center gap-4 px-6 py-3.5">
                        <span className="text-xs text-gray-300 w-6">{idx + 1}</span>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {fileIcons[t.file_type] || <MdDescription size={20} className="text-gray-300" />}
                          <span className="text-sm text-gray-700 truncate">{translatedName}</span>
                        </div>
                        <LangBadge code={t.language_code} prefixMap={prefixByCode} filled />
                        <span className="text-xs text-gray-300">{new Date(t.created_at).toLocaleDateString()}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDownload({ url: t.translated_file_url, name: selectedOriginalFile.name }, t.language_code, t.file_type)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Download"
                          >
                            <FiDownload size={14} />
                          </button>
                          <button
                            onClick={() => window.open(`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(t.translated_file_url)}`, "_blank")}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Open in new tab"
                          >
                            <FiExternalLink size={14} />
                          </button>
                          <button
                            onClick={() => setFileToDelete({ id: t.id, name: translatedName })}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <MdClose size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New folder */}
      {showNewFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowNewFolder(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-96 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FiFolderPlus className="text-indigo-500" /> New folder
            </h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); }}
              placeholder="Folder name"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setShowNewFolder(false)} className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleCreateFolder}
                disabled={creatingFolder || !newFolderName.trim()}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {creatingFolder ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to folder */}
      {fileToMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setFileToMove(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-96 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <FiFolder className="text-amber-500" /> Move to folder
            </h3>
            <p className="text-xs text-gray-400 mb-4 truncate">{fileToMove.name}</p>
            <input
              type="text"
              list="folder-suggestions"
              value={moveFolderInput}
              onChange={(e) => setMoveFolderInput(e.target.value)}
              placeholder="Type a folder name or pick one below"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent mb-4"
              autoFocus
            />
            <datalist id="folder-suggestions">
              {folderList.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
            <div className="flex gap-3">
              <button onClick={() => setFileToMove(null)} className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleMove}
                disabled={movingFolder}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {movingFolder ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-80 p-6 text-center">
            <h3 className="font-semibold text-gray-900 mb-2">Delete file?</h3>
            <p className="text-sm text-gray-400 mb-5">"{fileToDelete.name}" will be permanently deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setFileToDelete(null)} className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleDelete(fileToDelete.id)} className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileHistory;
