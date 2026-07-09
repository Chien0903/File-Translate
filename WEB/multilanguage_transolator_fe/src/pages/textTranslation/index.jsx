import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import {
  MdSwapHoriz,
  MdContentCopy,
  MdClose,
  MdHistory,
  MdAutoAwesome,
  MdKeyboardArrowDown,
  MdCheck,
} from "react-icons/md";
import translationService from "../../services/translationService";
import { useEnabledLanguages } from "../../hooks/useEnabledLanguages";

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

const LangSelect = ({ label, value, options, onChange, prefixMap = {} }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      {label && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-gray-300 min-w-[150px]"
      >
        {prefixMap[value] && (
          <span className="text-xs font-bold text-indigo-500 bg-indigo-50 rounded px-1">{prefixMap[value]}</span>
        )}
        <span className="flex-1 text-left">{value || "Select language"}</span>
        <MdKeyboardArrowDown size={16} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-white border border-gray-100 rounded-xl shadow-lg z-30 min-w-[180px] max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors
                ${value === opt ? "text-indigo-700 font-medium" : "text-gray-700"}`}
            >
              {prefixMap[opt] && (
                <span className="text-xs font-bold text-indigo-500 bg-indigo-50 rounded px-1 w-10 text-center">{prefixMap[opt]}</span>
              )}
              <span className="flex-1">{opt}</span>
              {value === opt && <MdCheck size={14} className="text-indigo-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const TextTranslation = () => {
  const { codeByName, nameList, prefixByName } = useEnabledLanguages();

  const allSourceLanguages = useMemo(() => ["Auto Detect", ...nameList], [nameList]);
  const codeMap = useMemo(() => ({ ...codeByName, "Auto Detect": "auto" }), [codeByName]);
  const nameByCode = useMemo(() => Object.fromEntries(Object.entries(codeByName).map(([k, v]) => [v, k])), [codeByName]);
  const prefixMap = useMemo(() => ({ ...prefixByName, "Auto Detect": "AUTO" }), [prefixByName]);

  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("Auto Detect");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [availableTargetLanguages, setAvailableTargetLanguages] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [libraryMode, setLibraryMode] = useState(() => {
    let m = localStorage.getItem("textLibraryMode") || localStorage.getItem("libraryMode");
    if (m === "thk") m = "common";
    return m || "common";
  });
  const [translationHistory, setTranslationHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("translationHistory") || "[]"); }
    catch { return []; }
  });
  const historyRef = useRef(null);

  useEffect(() => {
    if (nameList.length === 0) return;
    setAvailableTargetLanguages(nameList);
    if (targetLanguage && !nameList.includes(targetLanguage)) setTargetLanguage("");
  }, [nameList]);

  useEffect(() => {
    try { localStorage.setItem("translationHistory", JSON.stringify(translationHistory)); }
    catch { /* ignore */ }
  }, [translationHistory]);

  useEffect(() => {
    const h = (e) => { if (historyRef.current && !historyRef.current.contains(e.target)) setShowHistory(false); };
    if (showHistory) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showHistory]);

  const updateTargets = (srcLang) => {
    let filtered = nameList.filter((l) => l !== srcLang);
    if (srcLang === "Chinese (Traditional)") filtered = filtered.filter((l) => l !== "Chinese (Simplified)");
    if (srcLang === "Chinese (Simplified)") filtered = filtered.filter((l) => l !== "Chinese (Traditional)");
    setAvailableTargetLanguages(filtered);
    if (targetLanguage && !filtered.includes(targetLanguage)) setTargetLanguage("");
  };

  const handleSourceChange = (lang) => {
    setSourceLanguage(lang);
    if (lang !== "Auto Detect") updateTargets(lang);
    else setAvailableTargetLanguages(nameList);
  };

  const handleSwap = () => {
    if (sourceLanguage === "Auto Detect" || !targetLanguage) return;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
    updateTargets(targetLanguage);
  };

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    if (!targetLanguage) { toast.warning("Please select a target language"); return; }
    setIsLoading(true);
    try {
      const payload = {
        source_text: sourceText,
        target_language: codeMap[targetLanguage],
        library_mode: libraryMode,
        ...(sourceLanguage !== "Auto Detect" && { source_language: codeMap[sourceLanguage] }),
      };
      const response = await translationService.translateText(payload);
      const translated = response.data.translated_text;
      const detected = response.data.source_language;
      setTranslatedText(translated);

      if (response.data.warning) {
        toast.warning(response.data.warning);
      }

      let detectedName = sourceLanguage;
      if (sourceLanguage === "Auto Detect" && detected) {
        detectedName = nameByCode[detected] || sourceLanguage;
        setSourceLanguage(detectedName);
      }

      setTranslationHistory((prev) => [{
        id: Date.now(),
        sourceText, translatedText: translated,
        sourceLanguage: detectedName, targetLanguage,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
      }, ...prev.slice(0, 19)]);
    } catch (error) {
      toast.error(error.response?.data?.error || "Translation failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLibraryChange = (v) => {
    localStorage.setItem("textLibraryMode", v);
    setLibraryMode(v);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Text Translation</h1>
      <p className="text-gray-400 text-sm mb-4">Translate snippets of text instantly using your glossary.</p>

      {/* Controls */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <LangSelect label="From" value={sourceLanguage} options={allSourceLanguages} onChange={handleSourceChange} prefixMap={prefixMap} />

          <button
            onClick={handleSwap}
            disabled={sourceLanguage === "Auto Detect" || !targetLanguage}
            className="p-2.5 rounded-full border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-5"
            title="Swap languages"
          >
            <MdSwapHoriz size={20} />
          </button>

          <LangSelect label="To" value={targetLanguage} options={availableTargetLanguages} onChange={setTargetLanguage} prefixMap={prefixMap} />

          <div className="ml-auto">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Glossary</p>
            <GlossaryToggle value={libraryMode} onChange={handleLibraryChange} />
          </div>
        </div>
      </div>

      {/* Text panels */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {/* Source */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm relative">
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Enter text to translate..."
            className="w-full h-72 resize-none p-5 pr-10 text-sm text-gray-800 placeholder-gray-300 bg-transparent rounded-2xl focus:outline-none"
          />
          {sourceText && (
            <button
              onClick={() => { setSourceText(""); setTranslatedText(""); }}
              className="absolute top-3 right-3 p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
            >
              <MdClose size={16} />
            </button>
          )}
          <div className="px-5 pb-3 text-right text-xs text-gray-300">{sourceText.length} / 5000</div>
        </div>

        {/* Target */}
        <div className="bg-gray-50 border border-gray-100 rounded-2xl shadow-sm relative">
          <div className="w-full h-72 p-5 pr-10 text-sm overflow-y-auto">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-gray-400">Translating...</span>
                </div>
              </div>
            ) : translatedText ? (
              <pre className="whitespace-pre-wrap text-gray-800 leading-relaxed">{translatedText}</pre>
            ) : (
              <span className="text-gray-300">Translation will appear here...</span>
            )}
          </div>
          {translatedText && (
            <button
              onClick={() => { navigator.clipboard.writeText(translatedText); toast.success("Copied!"); }}
              className="absolute top-3 right-3 p-1.5 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Copy translation"
            >
              <MdContentCopy size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleTranslate}
          disabled={!sourceText.trim() || isLoading}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-700 text-white rounded-full font-semibold text-sm hover:bg-indigo-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <MdAutoAwesome size={18} />
          Translate
        </button>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`flex items-center gap-2 px-4 py-2.5 border rounded-full font-medium text-sm transition-colors
            ${showHistory ? "bg-gray-100 border-gray-300 text-gray-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
        >
          <MdHistory size={18} />
          History
        </button>
      </div>

      {/* History drawer */}
      {showHistory && (
        <div
          ref={historyRef}
          className="fixed top-14 right-0 w-80 h-[calc(100vh-3.5rem)] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Translation History</h3>
            <button onClick={() => setShowHistory(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <MdClose size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {translationHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
                <MdHistory size={36} />
                <p className="text-sm">No history yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {translationHistory.map((item) => (
                  <div
                    key={item.id}
                    className="px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSourceText(item.sourceText);
                      setTranslatedText(item.translatedText);
                      setSourceLanguage(item.sourceLanguage);
                      setTargetLanguage(item.targetLanguage);
                      setShowHistory(false);
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium">
                        <span>{item.sourceLanguage}</span>
                        <span className="text-gray-300">→</span>
                        <span>{item.targetLanguage}</span>
                      </div>
                      <span className="text-xs text-gray-300">{item.date}</span>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 line-clamp-2">{item.sourceText}</p>
                      <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg p-2 line-clamp-2">{item.translatedText}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {translationHistory.length > 0 && (
            <div className="border-t border-gray-100 p-4">
              <button
                onClick={() => { setTranslationHistory([]); localStorage.removeItem("translationHistory"); }}
                className="w-full text-xs text-red-400 hover:text-red-600 hover:bg-red-50 py-2 rounded-lg transition-colors font-medium"
              >
                Clear all history
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TextTranslation;
