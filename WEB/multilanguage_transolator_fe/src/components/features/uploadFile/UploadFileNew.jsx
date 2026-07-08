import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import translationService from "../../../services/translationService";
import { Spin } from "antd";
import { toast } from "react-toastify";
import { useCompanyLanguages } from "../../../hooks/useCompanyLanguages";
import { Document, Page, pdfjs } from "react-pdf";
import {
  MdCloudUpload,
  MdDescription,
  MdClose,
  MdKeyboardArrowDown,
  MdCheck,
} from "react-icons/md";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;


const PDFPreview = ({ url }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageWidth, setPageWidth] = useState(600);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setPageWidth(entry.contentRect.width - 32);
    });
    observer.observe(containerRef.current);
    setPageWidth(containerRef.current.clientWidth - 32);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, overflow: "auto", background: "#f0f0f0", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px", gap: "8px" }}
    >
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        onLoadError={(err) => console.error("PDF load error:", err)}
        loading={<div style={{ padding: "32px", color: "#888", textAlign: "center" }}>Đang tải PDF...</div>}
        error={<div style={{ padding: "32px", color: "#e00", textAlign: "center" }}>Không thể render PDF. Kiểm tra console để biết lỗi.</div>}
      >
        {numPages && Array.from({ length: numPages }, (_, i) => (
          <div key={i} style={{ marginBottom: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
            <Page
              pageNumber={i + 1}
              width={Math.max(pageWidth, 300)}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </div>
        ))}
      </Document>
    </div>
  );
};

const GlossaryToggle = ({ value, onChange }) => {
  const opts = [
    { v: "private", label: "Private Library" },
    { v: "common", label: "Common Library" },
    { v: "none", label: "No Library" },
  ];
  return (
    <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap
            ${value === o.v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
};

const LangDropdown = ({ label, value, options, onChange, multi = false, selected = [], prefixMap = {} }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const displayValue = multi
    ? selected.length === 0 ? "Select languages" : `${selected.length} selected`
    : value || label;

  const codePrefix = !multi && prefixMap[value] ? (
    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 rounded px-1 py-0.5 mr-1.5">{prefixMap[value]}</span>
  ) : null;

  return (
    <div className="relative" ref={ref}>
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-gray-300 transition-colors min-w-[140px]"
        >
          {codePrefix}
          <span className="flex-1 text-left">{displayValue}</span>
          <MdKeyboardArrowDown size={16} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="absolute top-full mt-1 left-0 bg-white border border-gray-100 rounded-xl shadow-lg z-30 min-w-[180px] max-h-64 overflow-y-auto">
          {options.map((opt) => {
            const isSelected = multi ? selected.includes(opt) : value === opt;
            return (
              <button
                key={opt}
                onClick={() => {
                  if (multi) {
                    onChange(isSelected ? selected.filter((l) => l !== opt) : [...selected, opt]);
                  } else {
                    onChange(opt);
                    setOpen(false);
                  }
                }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors
                  ${isSelected ? "text-indigo-700 font-medium" : "text-gray-700"}`}
              >
                {prefixMap[opt] && (
                  <span className="text-xs font-bold text-indigo-500 bg-indigo-50 rounded px-1 w-7 text-center">{prefixMap[opt]}</span>
                )}
                <span className="flex-1">{opt}</span>
                {isSelected && <MdCheck size={16} className="text-indigo-600 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ControlsBar = ({ nameList, originLang, onOriginChange, targetOptions, targetLangs, onTargetChange, libraryMode, onLibraryChange, prefixMap }) => (
  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-4">
    <div className="flex flex-wrap items-end gap-4">
      <LangDropdown label="Origin Language" value={originLang} options={nameList} onChange={onOriginChange} prefixMap={prefixMap} />
      <LangDropdown label="Target Languages" value="" options={targetOptions} onChange={onTargetChange} multi selected={targetLangs} prefixMap={prefixMap} />
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Glossary</p>
        <GlossaryToggle value={libraryMode} onChange={onLibraryChange} />
      </div>
    </div>
  </div>
);

const UploadFileNew = () => {
  const { codeByName, nameList, prefixByName } = useCompanyLanguages();
  const [translating, setTranslating] = useState(false);
  const [selectedOriginLanguage, setSelectedOriginLanguage] = useState("");
  const [selectedTargetLanguages, setSelectedTargetLanguages] = useState([]);
  const [availableTargetLanguages, setAvailableTargetLanguages] = useState([]);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [libraryMode, setLibraryMode] = useState(() => {
    let m = localStorage.getItem("libraryMode");
    if (m === "thk") m = "common";
    return m || "common";
  });
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (nameList.length > 0) setAvailableTargetLanguages(nameList);
  }, [nameList]);

  const handleOriginChange = (lang) => {
    setSelectedOriginLanguage(lang);
    let filtered = nameList.filter((l) => l !== lang);
    if (lang === "Chinese (Traditional)") filtered = filtered.filter((l) => l !== "Chinese (Simplified)");
    if (lang === "Chinese (Simplified)") filtered = filtered.filter((l) => l !== "Chinese (Traditional)");
    setAvailableTargetLanguages(filtered);
    setSelectedTargetLanguages([]);
  };

  const handleLibraryChange = (v) => {
    localStorage.setItem("libraryMode", v);
    setLibraryMode(v);
  };

  const handleFileSelect = async (f) => {
    if (!f) return;
    const ext = f.name.split(".").pop().toLowerCase();
    const allowed = ["pdf", "docx", "xlsx", "xls", "pptx", "ppt"];
    if (!allowed.includes(ext)) {
      toast.error(`Unsupported file type: .${ext}`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Blob URL for local preview (same-origin, works with PDF.js without CORS)
      const previewUri = URL.createObjectURL(f);

      const fakeProgress = setInterval(() => {
        setUploadProgress((prev) => (prev < 90 ? prev + 10 : prev));
      }, 300);

      const formData = new FormData();
      formData.append("file", f);
      const response = await translationService.uploadToS3(formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      clearInterval(fakeProgress);
      setUploadProgress(100);
      setFile({ uri: response.data.publicUrl, previewUri, originalFileName: f.name, fileType: ext });
      setTimeout(() => { setUploading(false); setUploadProgress(0); }, 400);
    } catch (error) {
      toast.error("Upload failed: " + (error.response?.data?.error || error.message));
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  };

  const handleTranslateClick = async () => {
    if (!file) { toast.error("Please upload a file first."); return; }
    if (selectedTargetLanguages.length === 0) { toast.error("Please select at least one target language."); return; }
    setTranslating(true);
    try {
      const payload = {
        file_url: file.uri,
        origin_language: selectedOriginLanguage ? codeByName[selectedOriginLanguage] : null,
        target_languages: selectedTargetLanguages.map((l) => codeByName[l]),
        original_file_name: file.originalFileName,
        library_mode: libraryMode,
      };
      const response = await translationService.translateFile(payload);
      const detectedLang = response.data.source_language;
      navigate("/translation-results", {
        state: {
          originalFile: file,
          originalLanguage: selectedOriginLanguage || detectedLang,
          translatedFiles: response.data.translated_files,
        },
      });
    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data;
      const msg = data?.detail || data?.error || `Translation failed (${status || "unknown error"})`;
      toast.error(msg, { autoClose: 8000 });
    } finally {
      setTranslating(false);
    }
  };


  if (file) {
    return (
      <div className="p-6 flex flex-col h-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">File Translation</h1>
        <p className="text-gray-400 text-sm mb-4">Upload a document to translate it into one or more languages.</p>
        <ControlsBar
          nameList={nameList}
          originLang={selectedOriginLanguage}
          onOriginChange={handleOriginChange}
          targetOptions={availableTargetLanguages}
          targetLangs={selectedTargetLanguages}
          onTargetChange={setSelectedTargetLanguages}
          libraryMode={libraryMode}
          onLibraryChange={handleLibraryChange}
          prefixMap={prefixByName}
        />

        <div className="flex-1 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          {/* File bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <MdDescription size={18} className="text-indigo-500" />
              <span className="font-medium truncate max-w-xs">{file.originalFileName}</span>
            </div>
            <button onClick={() => setFile(null)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <MdClose size={16} />
            </button>
          </div>

          {/* Preview */}
          <div className="flex-1" style={{ minHeight: "500px", position: "relative" }}>
            {file.fileType === "pdf" && (
              <PDFPreview url={file.previewUri} />
            )}
            {["docx", "xlsx", "xls", "xlsm", "xlsb", "pptx", "ppt"].includes(file.fileType) && (
              <iframe
                src={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(file.uri)}`}
                title="Document Viewer"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
              />
            )}
          </div>
        </div>

        <div className="flex justify-center mt-4">
          {translating ? (
            <Spin size="large" />
          ) : (
            <button
              onClick={handleTranslateClick}
              className="px-8 py-2.5 bg-indigo-700 text-white rounded-full font-semibold text-sm hover:bg-indigo-800 transition-colors"
            >
              Translate
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">File Translation</h1>
      <p className="text-gray-400 text-sm mb-4">Upload a document to translate it into one or more languages.</p>
      <ControlsBar
        nameList={nameList}
        originLang={selectedOriginLanguage}
        onOriginChange={handleOriginChange}
        targetOptions={availableTargetLanguages}
        targetLangs={selectedTargetLanguages}
        onTargetChange={setSelectedTargetLanguages}
        libraryMode={libraryMode}
        onLibraryChange={handleLibraryChange}
        prefixMap={prefixByName}
      />

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.xlsx,.xls,.pptx,.ppt"
        onChange={(e) => handleFileSelect(e.target.files[0])}
      />

      {uploading ? (
        <div className="border-2 border-dashed border-gray-200 bg-white rounded-2xl p-16 text-center">
          <div className="relative w-28 h-28 mx-auto mb-4">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#E9F0FF" strokeWidth="10" />
              <circle
                cx="50" cy="50" r="40" fill="none" stroke="#4338CA" strokeWidth="10"
                strokeDasharray={`${uploadProgress * 2.51} 251`}
                strokeDashoffset="0" transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-medium text-gray-700">{uploadProgress}%</span>
            </div>
          </div>
          <p className="text-indigo-700 font-semibold">Uploading... {uploadProgress}%</p>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer
            ${dragging ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50"}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MdCloudUpload size={28} className="text-indigo-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-800 mb-1">Upload your document</h3>
          <p className="text-gray-400 text-sm mb-5">PDF, DOCX, XLSX, PPTX · Max 10 MB</p>
          <button
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            className="px-5 py-2 border border-indigo-600 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors"
          >
            Browse files
          </button>
          <p className="text-gray-300 text-xs mt-3">or drag and drop a file here</p>
        </div>
      )}
    </div>
  );
};

export default UploadFileNew;
