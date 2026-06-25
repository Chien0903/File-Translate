import { useState, useRef, useEffect } from "react";
import { MdCloudUpload, MdSyncAlt, MdKeyboardArrowDown, MdDescription, MdClose } from "react-icons/md";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import translationService from "../../services/translationService";

const FORMAT_OPTIONS = ["PDF", "Word (DOCX)", "Excel (XLSX)", "PowerPoint (PPTX)"];

const FORMAT_EXT_MAP = {
  "PDF": "pdf",
  "Word (DOCX)": "docx",
  "Excel (XLSX)": "xlsx",
  "PowerPoint (PPTX)": "pptx",
};

const FormatDropdown = ({ label, value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-gray-300 transition-colors min-w-[160px]"
      >
        <span className="flex-1 text-left">{value}</span>
        <MdKeyboardArrowDown size={16} className={`text-gray-400 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-white border border-gray-100 rounded-xl shadow-lg z-20 min-w-[160px]">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors
                ${value === opt ? "text-indigo-700 font-medium" : "text-gray-700"}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ControlsBar = ({ fromFormat, toFormat, onFromChange, onToChange, onSwap }) => (
  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-4">
    <div className="flex flex-wrap items-end gap-4">
      <FormatDropdown label="From" value={fromFormat} options={FORMAT_OPTIONS} onChange={onFromChange} />
      <div className="flex items-center pt-5">
        <button
          onClick={onSwap}
          className="p-2 rounded-full border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
          title="Swap formats"
        >
          <MdSyncAlt size={16} />
        </button>
      </div>
      <FormatDropdown label="To" value={toFormat} options={FORMAT_OPTIONS} onChange={onToChange} />
    </div>
  </div>
);

const FormatConversionPage = () => {
  const navigate = useNavigate();
  const [fromFormat, setFromFormat] = useState("PDF");
  const [toFormat, setToFormat] = useState("Word (DOCX)");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [converting, setConverting] = useState(false);
  const fileInputRef = useRef(null);

  const swapFormats = () => {
    setFromFormat(toFormat);
    setToFormat(fromFormat);
  };

  const handleFileSelect = async (f) => {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf") {
      toast.error("Only PDF files are supported.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const fakeProgress = setInterval(() => {
        setUploadProgress((prev) => (prev < 95 ? prev + 5 : prev));
      }, 500);

      const formData = new FormData();
      formData.append("file", f);
      const response = await translationService.uploadToS3(formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      clearInterval(fakeProgress);
      setUploadProgress(100);
      setFile({ uri: response.data.publicUrl, fileType: ext, originalFileName: f.name });

      setTimeout(() => { setUploading(false); setUploadProgress(0); }, 500);
    } catch (error) {
      toast.error("Upload failed: " + (error.response?.data?.error || error.message));
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleConvert = async () => {
    if (!file) { toast.error("Please upload a file first."); return; }

    setConverting(true);
    try {
      const targetExt = FORMAT_EXT_MAP[toFormat] || toFormat.toLowerCase();
      const response = await translationService.convertFile({
        file_url: file.uri,
        target_format: targetExt,
        original_filename: file.originalFileName,
      });

      if (response.data.success) {
        navigate("/conversion-results", {
          state: {
            originalFile: file,
            inputFormat: fromFormat,
            outputFormat: toFormat,
            convertedFile: {
              url: response.data.converted_file.url,
              name: response.data.converted_file.filename,
              originalFileName: response.data.converted_file.original_filename,
              fileType: response.data.converted_file.format.toLowerCase(),
            },
          },
        });
      } else {
        throw new Error(response.data.error || "Conversion failed");
      }
    } catch (error) {
      toast.error("Conversion failed: " + (error.response?.data?.error || error.message), { autoClose: 6000 });
    } finally {
      setConverting(false);
    }
  };

  if (file) {
    return (
      <div className="p-6 flex flex-col h-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Format Conversion</h1>
        <p className="text-gray-400 text-sm mb-4">Convert documents between common office formats.</p>
        <ControlsBar fromFormat={fromFormat} toFormat={toFormat} onFromChange={setFromFormat} onToChange={setToFormat} onSwap={swapFormats} />

        <div className="flex-1 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <MdDescription size={18} className="text-indigo-500" />
              <span className="font-medium truncate max-w-xs">{file.originalFileName}</span>
              <span className="text-gray-400 text-xs">({fromFormat} → {toFormat})</span>
            </div>
            <button onClick={() => setFile(null)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <MdClose size={16} />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-8">
            <button
              onClick={handleConvert}
              disabled={converting}
              className={`px-8 py-2.5 bg-indigo-700 text-white rounded-full font-semibold text-sm hover:bg-indigo-800 transition-colors ${converting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {converting ? "Converting..." : "Convert File"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Format Conversion</h1>
      <p className="text-gray-400 text-sm mb-4">Convert documents between common office formats.</p>
      <ControlsBar fromFormat={fromFormat} toFormat={toFormat} onFromChange={setFromFormat} onToChange={setToFormat} onSwap={swapFormats} />

      {uploading ? (
        <div className="border-2 border-dashed border-gray-200 bg-white rounded-2xl p-16 text-center">
          <div className="relative w-28 h-28 mx-auto mb-4">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#E9F9F9" strokeWidth="10" />
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
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFileSelect(e.dataTransfer.files[0]); }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files[0])}
          />
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MdCloudUpload size={28} className="text-indigo-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-800 mb-1">Upload your document</h3>
          <p className="text-gray-400 text-sm mb-5">PDF only · Max 10 MB</p>
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

export default FormatConversionPage;
