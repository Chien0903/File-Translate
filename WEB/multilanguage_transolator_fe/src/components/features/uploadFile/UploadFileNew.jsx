import { useState } from "react";
import { useNavigate } from "react-router-dom";
import translationService from "../../../services/translationService";
import { Spin } from "antd";
import { toast } from "react-toastify";
import LanguageSelector from "./LanguageSelector";
import { buttonStyles } from "../../../styles/buttonStyles";
import FileUploadContainer from "../../common/FileUploadContainer";

const LANGUAGE_CODES = {
  English: "en",
  Japanese: "ja",
  "Chinese (Simplified)": "zh-CN",
  "Chinese (Traditional)": "zh-TW",
  Vietnamese: "vi",
  // Order for newly added languages
  Bengali: "bn",
  Indonesian: "id",
  Hindi: "hi",
  Oriya: "or",
  Thai: "th",
};

const UploadFileNew = () => {
  const [translating, setTranslating] = useState(false);
  const [selectedOriginLanguage, setSelectedOriginLanguage] =
    useState("Origin Language");
  const [availableTargetLanguages, setAvailableTargetLanguages] = useState([
    "English",
    "Japanese",
    "Chinese (Simplified)",
    "Chinese (Traditional)",
    "Vietnamese",
    "Bengali",
    "Indonesian",
    "Hindi",
    "Oriya",
    "Thai",
  ]);

  const [selectedTargetLanguages, setSelectedTargetLanguages] = useState([]);
  const [file, setFile] = useState(null);
  const [libraryMode, setLibraryMode] = useState(
    () => {
      let mode = localStorage.getItem("libraryMode");
      if (mode === "thk") mode = "common"; // Migrate old local storage
      return mode || "common";
    }
  );
  const navigate = useNavigate();

  const handleFileUpload = (fileData) => {
    setFile(fileData);
  };

  const handleTranslateClick = async () => {
    if (!file) {
      toast.error("Please upload a file before translating.");
      return;
    }
    if (selectedTargetLanguages.length === 0) {
      toast.error("Please select at least one target language.");
      return;
    }

    setTranslating(true);

    try {
      let fileUrlToTranslate = file.uri;

      if (file.fileType === "pdf" && file.docxUrl) {
        fileUrlToTranslate = file.docxUrl;
      }

      const payload = {
        file_url: fileUrlToTranslate,
        origin_language:
          selectedOriginLanguage === "Origin Language"
            ? null
            : LANGUAGE_CODES[selectedOriginLanguage],
        target_languages: selectedTargetLanguages.map((l) => LANGUAGE_CODES[l]),
        original_file_name: file.originalFileName,
        library_mode: libraryMode,
      };

      console.log("Payload for translation:", payload);
      const response = await translationService.translateFile(payload);
      console.log("Translation response:", response.data);

      navigate("/translation-results", {
        state: {
          originalFile: file,
          originalLanguage: selectedOriginLanguage,
          translatedFiles: response.data.translated_files,
        },
      });
    } catch (error) {
      console.error("Translation error:", error);

      // Extract detailed error information
      let errorTitle = "Translation Failed";
      let errorDescription = "An unexpected error occurred. Please try again.";

      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        switch (status) {
          case 400:
            errorTitle = "Invalid Request";
            errorDescription = data?.detail || data?.error ||
              "The file or translation settings are invalid. Please check:\n" +
              "• File format is supported (PDF, DOCX, XLSX, PPTX)\n" +
              "• Target languages are selected\n" +
              "• File is not corrupted";
            break;

          case 413:
            errorTitle = "File Too Large";
            errorDescription = "The uploaded file exceeds the maximum size limit. Please try with a smaller file (max 10MB).";
            break;

          case 415:
            errorTitle = "Unsupported File Format";
            errorDescription = data?.detail ||
              "This file format is not supported. Please upload PDF, DOCX, XLSX, or PPTX files only.";
            break;

          case 429:
            errorTitle = "Too Many Requests";
            errorDescription = "You have exceeded the translation limit. Please wait a few minutes and try again.";
            break;

          case 500:
            errorTitle = "Server Error";
            errorDescription = data?.detail || data?.error ||
              "The translation service encountered an error. Possible reasons:\n" +
              "• File contains unsupported characters or formatting\n" +
              "• File structure is too complex\n" +
              "• Translation service is temporarily unavailable\n\n" +
              "Please try:\n" +
              "• Simplifying the document\n" +
              "• Converting to a different format\n" +
              "• Trying again in a few moments";
            break;

          case 503:
            errorTitle = "Service Unavailable";
            errorDescription = "The translation service is temporarily unavailable. Please try again in a few moments.";
            break;

          default:
            errorDescription = data?.detail || data?.error ||
              `Server returned error code ${status}. Please contact support if this persists.`;
        }
      } else if (error.request) {
        errorTitle = "Network Error";
        errorDescription = "Unable to connect to the translation service. Please check:\n" +
          "• Your internet connection\n" +
          "• The server is running\n" +
          "• No firewall is blocking the connection";
      } else {
        errorDescription = error.message || "An unexpected error occurred. Please try again.";
      }

      toast.error(`${errorTitle}: ${errorDescription}`, { autoClose: 8000 });
    } finally {
      setTranslating(false);
    }
  };

  const handleLibraryModeChange = (mode) => {
    localStorage.setItem("libraryMode", mode);
    setLibraryMode(mode);
  };

  const renderLibrarySelector = () => (
    <div className="flex items-center gap-4 mt-3 px-1">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Library:
      </span>
      {[
        { value: "private", label: "Private Library" },
        { value: "common", label: "THK Library" },
        { value: "none", label: "No Library" },
      ].map(({ value, label }) => (
        <label
          key={value}
          className="flex items-center gap-1.5 cursor-pointer select-none group"
          onClick={() => handleLibraryModeChange(value)}
        >
          <div
            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors duration-150 ${
              libraryMode === value
                ? "border-[#004098]"
                : "border-gray-300 group-hover:border-[#004098]"
            }`}
          >
            {libraryMode === value && (
              <div className="w-2 h-2 rounded-full bg-[#004098]" />
            )}
          </div>
          <span
            className={`text-sm font-medium transition-colors duration-150 ${
              libraryMode === value ? "text-[#004098]" : "text-gray-400"
            }`}
          >
            {label}
          </span>
        </label>
      ))}
    </div>
  );

  const renderHeader = () => (
    <div className="w-full rounded-t-2xl p-4">
      <div className="flex flex-row justify-between w-full">
        <LanguageSelector
          selectedOriginLanguage={selectedOriginLanguage}
          onOriginLanguageChange={setSelectedOriginLanguage}
          selectedTargetLanguages={selectedTargetLanguages}
          onTargetLanguagesChange={setSelectedTargetLanguages}
          availableTargetLanguages={availableTargetLanguages}
          onAvailableTargetLanguagesChange={setAvailableTargetLanguages}
        />
        {file && (
          <div className="flex items-center">
            <button
              onClick={() => handleFileUpload(null)}
              className={`${buttonStyles.iconSecondary} ml-3`}
              title="Remove file"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
      {renderLibrarySelector()}
    </div>
  );

  const renderFileContent = () => (
    // Empty - we don't want file content inside the upload container for translate
    <></>
  );

  if (file) {
    // When file is uploaded, show it outside the container
    return (
      <div className="w-full h-full flex flex-col bg-white flex-1 items-center justify-center rounded-2xl relative">
        {/* Header with language selector and remove button */}
        {renderHeader()}

        {/* File Preview - outside the upload container */}
        <div className="flex flex-col flex-1 w-[98%] rounded-lg gap-2">
          <div
            className="iframe-container flex-1"
            style={{ height: "calc(70vh - 100px)", overflow: "hidden" }}
          >
            {(file.fileType === "docx" ||
              (file.fileType === "pdf" && file.docxUrl)) && (
                <iframe
                  src={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(
                    file.fileType === "pdf" && file.docxUrl
                      ? file.docxUrl
                      : file.uri
                  )}`}
                  style={{ width: "100%", height: "100%" }}
                  frameBorder="0"
                  title="DOCX Viewer"
                />
              )}

            {(file.fileType === "xlsx" ||
              file.fileType === "xlsm" ||
              file.fileType === "xlsb" ||
              file.fileType === "xls" ||
              file.fileType === "pptx") && (
                <iframe
                  src={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(
                    file.uri
                  )}`}
                  style={{ width: "100%", height: "100%" }}
                  frameBorder="0"
                  title={`${file.fileType.toUpperCase()} Viewer`}
                />
              )}

            {file.fileType === "pdf" && !file.docxUrl && (
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(
                  file.uri
                )}&embedded=true`}
                style={{ width: "100%", height: "100%" }}
                frameBorder="0"
                title="PDF Viewer"
              />
            )}

            {file.fileType === "csv" && (
              <div className="w-full h-full bg-white p-4 overflow-auto">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="mb-4">
                    <svg
                      className="w-16 h-16 mx-auto text-green-500 mb-2"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M3 4a1 1 0 011-1h12a1 1 0 011 1v1a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 3a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V7zm8 0a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1h-6a1 1 0 01-1-1V7z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">
                    CSV File Ready for Translation
                  </h3>
                  <p className="text-gray-600 mb-4">{file.originalFileName}</p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      📊 CSV files will be processed to preserve data structure
                      during translation
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Translate Button */}
        <div className="w-full p-2 flex justify-center">
          {translating ? (
            <Spin size="large" />
          ) : (
            <button
              className={buttonStyles.primaryFixed}
              onClick={handleTranslateClick}
            >
              Translate
            </button>
          )}
        </div>
      </div>
    );
  }

  // When no file, show the upload container
  return (
    <FileUploadContainer
      onFileUpload={handleFileUpload}
      acceptedFormats={["pdf", "docx", "xlsx", "xls", "pptx", "ppt"]}
    >
      {{
        header: renderHeader(),
        fileContent: renderFileContent,
      }}
    </FileUploadContainer>
  );
};

export default UploadFileNew;
