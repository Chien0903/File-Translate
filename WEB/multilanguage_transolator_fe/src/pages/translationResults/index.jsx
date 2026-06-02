import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Spin } from "antd";
import { toast } from "react-toastify";
import { FaDownload, FaSave } from "react-icons/fa";
import { FiX } from "react-icons/fi";
import { buttonStyles } from "../../styles/buttonStyles";

const TranslationResults = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const { originalFile, originalLanguage, translatedFiles } = state || {};
  const [selectedLanguage, setSelectedLanguage] = useState("");

  useEffect(() => {
    if (!originalFile || !translatedFiles) {
      toast.error("No translation data provided.");
      setLoading(false);
      return;
    }
    setSelectedLanguage(translatedFiles[0].language);
    setLoading(false);
  }, [originalFile, translatedFiles]);

  const viewHistory = () => {
    navigate("/file-history");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center">
        <Spin size="large" />
        <p className="mt-[1rem] text-lg">Translating your document...</p>
        <p className="text-sm text-gray-500">This may take a few moments.</p>
      </div>
    );
  }

  const getViewerSrc = (uri) => {
    const ext = uri.split(".").pop().toLowerCase();
    if (ext === "pdf") {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(
        uri
      )}&embedded=true`;
    } else if (["docx", "xlsx", "pptx"].includes(ext)) {
      return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(
        uri
      )}`;
    }
    return uri;
  };

  const selectedFile = translatedFiles.find(
    (f) => f.language === selectedLanguage
  );
  const downloadUrl = selectedFile?.url;
  const downloadFilename = selectedFile?.filename;

  const getLanguageName = (code) => {
    const languageMap = {
      ja: "Japanese",
      "zh-CN": "Chinese (Simplified)",
      "zh-TW": "Chinese (Traditional)",
      en: "English",
      vi: "Vietnamese",
      bn: "Bengali",
      id: "Indonesian",
      hi: "Hindi",
      or: "Oriya",
      th: "Thai",
    };

    return languageMap[code] || code;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-full w-full flex flex-col bg-white rounded-2xl ">
        {/* Language Selection Panel */}
        <div className="flex flex-row p-4 gap-2 relative">
          {/* Origin Language Button */}
          <button className={`${buttonStyles.secondaryFixed} text-sm`}>
            <span className="mx-auto">{getLanguageName(originalLanguage)}</span>
          </button>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Target Languages */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {translatedFiles.map((file) => (
              <button
                key={file.language}
                onClick={() => setSelectedLanguage(file.language)}
                className={
                  file.language === selectedLanguage
                    ? buttonStyles.languageActive
                    : buttonStyles.languageInactive
                }
              >
                <span>{getLanguageName(file.language)}</span>
              </button>
            ))}
          </div>

          {/* Control buttons */}
          <div className="flex items-center gap-2 ml-2">
            <button
              className={buttonStyles.icon}
              onClick={viewHistory}
              title="View History"
            >
              <FaSave className="w-4 h-4" />
            </button>
            {downloadUrl && (
              <a href={downloadUrl} download={downloadFilename}>
                <button className={buttonStyles.icon} title="Download">
                  <FaDownload className="w-4 h-4" />
                </button>
              </a>
            )}
            <button
              className={buttonStyles.icon}
              onClick={() => navigate("/")}
              title="Close"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewer Panel */}
        <div className="flex-1 px-[1rem] pb-[1rem] relative">
          <div className="flex flex-1 h-full flex-col lg:flex-row gap-[1rem]">
            <div className="flex-1 h-full rounded overflow-auto">
              <iframe
                src={getViewerSrc(originalFile.uri)}
                className="w-full h-full"
                frameBorder="0"
                title="Original Viewer"
                scrolling="auto"
                style={{ overflow: "auto" }}
              />
            </div>
            <div className="flex-1 h-full rounded overflow-auto relative">
              <iframe
                src={getViewerSrc(selectedFile.url)}
                className="w-full h-full"
                frameBorder="0"
                title="Translated Viewer"
                scrolling="auto"
                style={{ overflow: "auto" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranslationResults;
