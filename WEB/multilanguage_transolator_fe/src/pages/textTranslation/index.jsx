import { useState, useRef, useEffect } from "react";
import { toast } from "react-toastify";
import {
  MdTranslate,
  MdContentCopy,
  MdClear,
  MdSwapHoriz,
  MdHistory,
} from "react-icons/md";
import { ICON_SIZES } from "../../constants/constants";
import { buttonStyles } from "../../styles/buttonStyles";
import translationService from "../../services/translationService";
const LANGUAGE_CODES = {
  "Auto Detect": "auto",
  English: "en",
  Vietnamese: "vi",
  Japanese: "ja",
  "Chinese (Simplified)": "zh-CN",
  "Chinese (Traditional)": "zh-TW",
  Bengali: "bn",
  Indonesian: "id",
  Hindi: "hi",
  Oriya: "or",
  Thai: "th",
};

const languages = Object.keys(LANGUAGE_CODES);

const TextTranslation = () => {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("Auto Detect");
  const [targetLanguage, setTargetLanguage] = useState("Target Language");
  const [isLoading, setIsLoading] = useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const [availableTargetLanguages, setAvailableTargetLanguages] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [libraryMode, setLibraryMode] = useState(() => {
    let mode = localStorage.getItem("textLibraryMode") || localStorage.getItem("libraryMode");
    if (mode === "thk") mode = "common";
    return mode || "common";
  });
  const [translationHistory, setTranslationHistory] = useState(() => {
    // Load lịch sử từ localStorage khi khởi tạo
    try {
      const saved = localStorage.getItem("translationHistory");
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Error loading translation history:", error);
      return [];
    }
  });

  const sourceDropdownRef = useRef(null);
  const targetDropdownRef = useRef(null);
  const historyModalRef = useRef(null);

  useEffect(() => {
    const initialTargetLanguages = languages.filter(
      (lang) => lang !== "Auto Detect"
    );
    setAvailableTargetLanguages(initialTargetLanguages);
  }, []);

  // Tự động lưu lịch sử vào localStorage mỗi khi thay đổi
  useEffect(() => {
    try {
      localStorage.setItem(
        "translationHistory",
        JSON.stringify(translationHistory)
      );
    } catch (error) {
      console.error("Error saving translation history:", error);
    }
  }, [translationHistory]);

  const updateAvailableTargetLanguages = (selectedSourceLang, currentTargetLang = targetLanguage) => {
    let filtered = languages.filter(
      (lang) => lang !== "Auto Detect" && lang !== selectedSourceLang
    );

    if (selectedSourceLang === "Chinese (Traditional)") {
      filtered = filtered.filter((l) => l !== "Chinese (Simplified)");
    }
    if (selectedSourceLang === "Chinese (Simplified)") {
      filtered = filtered.filter((l) => l !== "Chinese (Traditional)");
    }

    setAvailableTargetLanguages(filtered);

    if (
      currentTargetLang !== "Target Language" &&
      !filtered.includes(currentTargetLang)
    ) {
      setTargetLanguage("Target Language");
    }
  };
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        sourceDropdownRef.current &&
        !sourceDropdownRef.current.contains(event.target)
      ) {
        setShowSourceDropdown(false);
      }
      if (
        targetDropdownRef.current &&
        !targetDropdownRef.current.contains(event.target)
      ) {
        setShowTargetDropdown(false);
      }
      if (
        historyModalRef.current &&
        !historyModalRef.current.contains(event.target)
      ) {
        setShowHistory(false);
      }
    }

    if (showSourceDropdown || showTargetDropdown || showHistory) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSourceDropdown, showTargetDropdown, showHistory]);

  const handleSourceLanguageSelect = (language) => {
    setSourceLanguage(language);
    setShowSourceDropdown(false);

    if (language !== "Auto Detect") {
      updateAvailableTargetLanguages(language);
    } else {
      // Reset to all languages except Auto Detect
      const allTargets = languages.filter((l) => l !== "Auto Detect");
      setAvailableTargetLanguages(allTargets);
    }
  };

  const handleTargetLanguageSelect = (language) => {
    setTargetLanguage(language);
    setShowTargetDropdown(false);
  };

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;

    if (targetLanguage === "Target Language") {
      toast.warning("Please select a target language");
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        source_text: sourceText,
        target_language: LANGUAGE_CODES[targetLanguage],
        library_mode: libraryMode,
      };

      // Add source language if not auto-detect
      if (sourceLanguage !== "Auto Detect") {
        payload.source_language = LANGUAGE_CODES[sourceLanguage];
      }

      console.log("Sending translation request:", payload);

      const response = await translationService.translateText(payload);
      console.log("Translation response:", response.data);

      const translated = response.data.translated_text;
      const detectedSourceLang = response.data.source_language;

      setTranslatedText(translated);

      // Update source language if it was auto-detected
      if (sourceLanguage === "Auto Detect") {
        const detectedLangName = Object.keys(LANGUAGE_CODES).find(
          (key) => LANGUAGE_CODES[key] === detectedSourceLang
        );
        if (detectedLangName) {
          setSourceLanguage(detectedLangName);
        }
      }

      const historyItem = {
        id: Date.now(),
        sourceText: sourceText,
        translatedText: translated,
        sourceLanguage:
          sourceLanguage === "Auto Detect"
            ? Object.keys(LANGUAGE_CODES).find(
                (key) => LANGUAGE_CODES[key] === detectedSourceLang
              ) || sourceLanguage
            : sourceLanguage,
        targetLanguage: targetLanguage,
        timestamp: new Date().toLocaleString(),
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
      };

      setTranslationHistory((prev) => [historyItem, ...prev.slice(0, 19)]);
    } catch (error) {
      console.error("Translation error:", error);

      let errorMessage = "Translation failed. Please try again.";
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwapLanguages = () => {
    if (
      sourceLanguage !== "Auto Detect" &&
      targetLanguage !== "Target Language"
    ) {
      const tempSourceLang = sourceLanguage;
      const tempTargetLang = targetLanguage;

      setSourceLanguage(tempTargetLang);
      setTargetLanguage(tempSourceLang);
      updateAvailableTargetLanguages(tempTargetLang);

      const tempText = sourceText;
      setSourceText(translatedText);
      setTranslatedText(tempText);
    }
  };

  const handleCopyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const handleClearText = () => {
    setSourceText("");
    setTranslatedText("");
  };

  const handleLoadFromHistory = (historyItem) => {
    setSourceText(historyItem.sourceText);
    setTranslatedText(historyItem.translatedText);
    setSourceLanguage(historyItem.sourceLanguage);
    setTargetLanguage(historyItem.targetLanguage);

    // Update available target languages based on the loaded source language
    if (historyItem.sourceLanguage !== "Auto Detect") {
      updateAvailableTargetLanguages(historyItem.sourceLanguage, historyItem.targetLanguage);
    }

    setShowHistory(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 p-2 sm:p-4 lg:p-6">
      <div
        className={`max-w-6xl mx-auto w-full transition-all duration-300 ${
          showHistory ? "lg:mr-80" : ""
        }`}
      >
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4">
          <div className="flex flex-col sm:flex-row justify-between items-center w-full gap-3 sm:gap-4">
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-medium text-gray-600 mb-2 sm:hidden">
                Source Language
              </label>
              <div className="relative" ref={sourceDropdownRef}>
                <button
                  className={`${buttonStyles.secondaryFixed} text-sm w-full sm:w-40 py-2`}
                  onClick={() => setShowSourceDropdown(!showSourceDropdown)}
                >
                  <span className="mx-auto">{sourceLanguage}</span>
                </button>
                {showSourceDropdown && (
                  <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg w-full sm:w-40 z-20 overflow-hidden">
                    <ul className="py-1">
                      {languages.map((lang, index) => (
                        <li
                          key={lang}
                          className={`py-2.5 px-2 cursor-pointer text-center ${
                            sourceLanguage === lang
                              ? "bg-[#F0F7FF] text-[#0066CC]"
                              : "hover:bg-[#F8FBFF] text-gray-700"
                          } ${index !== 0 ? "border-t border-[#E6F0FF]" : ""}`}
                          onClick={() => handleSourceLanguageSelect(lang)}
                        >
                          <span className="text-sm block w-full">{lang}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-center">
              <button
                onClick={handleSwapLanguages}
                disabled={
                  sourceLanguage === "Auto Detect" ||
                  targetLanguage === "Target Language"
                }
                className={`p-2 rounded-full transition-all duration-200 ${
                  sourceLanguage === "Auto Detect" ||
                  targetLanguage === "Target Language"
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                }`}
                title="Swap languages"
              >
                <MdSwapHoriz size={20} />
              </button>
            </div>

            <div className="w-full sm:w-auto">
              <label className="block text-xs font-medium text-gray-600 mb-2 sm:hidden">
                Target Language
              </label>
              <div className="relative" ref={targetDropdownRef}>
                <button
                  className={`${buttonStyles.secondaryFixed} text-sm w-full sm:w-40 py-2`}
                  onClick={() => setShowTargetDropdown(!showTargetDropdown)}
                >
                  <span className="mx-auto">{targetLanguage}</span>
                </button>
                {showTargetDropdown && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg w-full sm:w-40 z-20 overflow-hidden">
                    <ul className="py-1">
                      {availableTargetLanguages.map((lang, index) => (
                        <li
                          key={lang}
                          className={`py-2.5 px-2 cursor-pointer text-center ${
                            targetLanguage === lang
                              ? "bg-[#F0F7FF] text-[#0066CC]"
                              : "hover:bg-[#F8FBFF] text-gray-700"
                          } ${index !== 0 ? "border-t border-[#E6F0FF]" : ""}`}
                          onClick={() => handleTargetLanguageSelect(lang)}
                        >
                          <span className="text-sm block w-full">{lang}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-start gap-4 mt-4 px-1 border-t border-gray-100 pt-3">
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
                onClick={() => {
                  localStorage.setItem("textLibraryMode", value);
                  setLibraryMode(value);
                }}
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

        </div>

        <div className="space-y-4">
          <div className="grid gap-4 lg:gap-6 grid-cols-1 xl:grid-cols-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 relative">
                <textarea
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Enter text to translate..."
                  className="w-full h-64 lg:h-80 resize-none border border-gray-200 rounded-lg p-4 pr-12 text-gray-700 placeholder-gray-400 text-sm lg:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                {sourceText && (
                  <button
                    onClick={handleClearText}
                    className="absolute top-6 right-6 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    title="Clear text"
                  >
                    <MdClear size={18} />
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 relative">
                <div className="w-full h-64 lg:h-80 border border-gray-200 rounded-lg p-4 pr-12 text-gray-700 whitespace-pre-wrap text-sm lg:text-base overflow-y-auto bg-gray-50">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-gray-500">Translating...</span>
                      </div>
                    </div>
                    ) : translatedText ? (
                      <pre className="whitespace-pre-wrap text-gray-700 text-sm lg:text-base leading-relaxed break-words">
                        {translatedText}
                      </pre>
                    ) : (
                      <span className="text-gray-400 text-sm lg:text-base">
                        Translation will appear here...
                      </span>
                    )}
                </div>
                {translatedText && (
                  <button
                    onClick={() => handleCopyToClipboard(translatedText)}
                    className="absolute top-6 right-6 p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"
                    title="Copy translation"
                  >
                    <MdContentCopy size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
            <button
              onClick={handleTranslate}
              disabled={!sourceText.trim() || isLoading}
              className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${
                !sourceText.trim() || isLoading
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md"
              }`}
            >
              <MdTranslate size={ICON_SIZES.INTERFACE_MEDIUM} />
              <span>Translate</span>
            </button>

            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${
                showHistory
                  ? "bg-gray-600 text-white hover:bg-gray-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:shadow-md"
              }`}
            >
              <MdHistory size={ICON_SIZES.INTERFACE_MEDIUM} />
              <span>History</span>
            </button>
          </div>
        </div>

        {showHistory && (
          <div
            ref={historyModalRef}
            className="fixed inset-0 lg:inset-auto lg:top-[4.5rem] lg:right-0 lg:w-80 lg:h-[calc(100vh-4.5rem)] bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col"
          >
            <div className="bg-white border-b border-gray-200 px-4 py-4 lg:px-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">
                  Translation History
                </h3>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <MdClear size={ICON_SIZES.INTERFACE_MEDIUM} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {translationHistory.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <MdHistory size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 font-medium mb-2">
                    No translation history
                  </p>
                  <p className="text-sm text-gray-400">
                    Your translations will appear here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {translationHistory.map((item) => (
                    <div
                      key={item.id}
                      className="px-4 py-4 lg:px-6 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleLoadFromHistory(item)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="font-medium text-blue-600">
                            {item.sourceLanguage}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="font-medium text-blue-600">
                            {item.targetLanguage}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {item.date || item.timestamp.split(",")[0]}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-sm text-gray-800 line-clamp-3 leading-relaxed">
                            {item.sourceText}
                          </p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-sm text-blue-700 line-clamp-3 leading-relaxed">
                            {item.translatedText}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-gray-400">
                          {item.time || item.timestamp.split(",")[1]?.trim()}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyToClipboard(item.translatedText);
                          }}
                          className="text-gray-400 hover:text-blue-600 p-1 rounded transition-colors"
                          title="Copy translation"
                        >
                          <MdContentCopy size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 px-4 py-4 lg:px-6 bg-gray-50">
              <button
                onClick={() => {
                  setTranslationHistory([]);
                  localStorage.removeItem("translationHistory");
                }}
                className="text-sm text-red-600 hover:text-red-700 w-full text-center py-2 px-4 rounded-lg hover:bg-red-50 transition-colors font-medium"
                disabled={translationHistory.length === 0}
              >
                Clear all history
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TextTranslation;
