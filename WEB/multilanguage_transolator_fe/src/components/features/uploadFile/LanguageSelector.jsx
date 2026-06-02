import { useState, useRef, useEffect } from "react";
import { buttonStyles } from "../../../styles/buttonStyles";

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

const LanguageSelector = ({
  selectedOriginLanguage,
  onOriginLanguageChange,
  selectedTargetLanguages,
  onTargetLanguagesChange,
  availableTargetLanguages,
  onAvailableTargetLanguagesChange,
}) => {
  const [showLanguages, setShowLanguages] = useState(false);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const targetDropdownRef = useRef(null);
  const originDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        targetDropdownRef.current &&
        !targetDropdownRef.current.contains(event.target)
      ) {
        setShowTargetDropdown(false);
      }
      if (
        originDropdownRef.current &&
        !originDropdownRef.current.contains(event.target)
      ) {
        setShowLanguages(false);
      }
    }

    if (showTargetDropdown || showLanguages) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showTargetDropdown, showLanguages]);

  const handleOriginLanguageSelect = (language) => {
    onOriginLanguageChange(language);
    setShowLanguages(false);

    // Filter out the selected origin language and handle Chinese variants
    let filtered = Object.keys(LANGUAGE_CODES).filter((l) => l !== language);

    if (language === "Chinese (Traditional)") {
      filtered = filtered.filter((l) => l !== "Chinese (Simplified)");
    }
    if (language === "Chinese (Simplified)") {
      filtered = filtered.filter((l) => l !== "Chinese (Traditional)");
    }
    onAvailableTargetLanguagesChange(filtered);
    onTargetLanguagesChange([]);
  };

  const handleTargetLanguageSelect = (language) => {
    onTargetLanguagesChange((prev) =>
      prev.includes(language)
        ? prev.filter((l) => l !== language)
        : [...prev, language]
    );
  };

  return (
    <div className="flex flex-row justify-between w-full">
      <div className="relative" ref={originDropdownRef}>
        <button
          className={`${buttonStyles.secondaryFixed} text-sm`}
          onClick={() => setShowLanguages(!showLanguages)}
        >
          <span className="mx-auto">{selectedOriginLanguage}</span>
        </button>
        {showLanguages && (
          <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-md w-48 z-10 overflow-hidden">
            <ul className="py-1">
              {Object.keys(LANGUAGE_CODES).map((lang, index) => (
                <li
                  key={lang}
                  className={`py-2.5 px-2 cursor-pointer text-center ${
                    selectedOriginLanguage === lang
                      ? "bg-[#F0F7FF] text-[#0066CC]"
                      : "hover:bg-[#F8FBFF] text-gray-700"
                  } ${index !== 0 ? "border-t border-[#E6F0FF]" : ""}`}
                  onClick={() => handleOriginLanguageSelect(lang)}
                >
                  <span className="text-sm block w-full">{lang}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          className={`${buttonStyles.secondaryFixed} text-sm`}
          onClick={() => setShowTargetDropdown(!showTargetDropdown)}
        >
          <span className="mx-auto">Target Language</span>
        </button>
        {showTargetDropdown && (
          <div
            ref={targetDropdownRef}
            className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-md w-48 z-10 overflow-hidden"
          >
            <ul className="py-1">
              {availableTargetLanguages.map((lang, index) => (
                <li
                  key={lang}
                  className={`py-3 px-2 cursor-pointer flex items-center ${
                    selectedTargetLanguages.includes(lang)
                      ? "bg-[#F0F7FF] text-[#0066CC]"
                      : "hover:bg-[#F8FBFF] text-gray-700"
                  } ${index !== 0 ? "border-t border-[#E6F0FF]" : ""}`}
                  onClick={() => handleTargetLanguageSelect(lang)}
                >
                  <div
                    className={`w-5 h-5 flex items-center justify-center mr-3 ${
                      selectedTargetLanguages.includes(lang)
                        ? "text-[#0066CC]"
                        : "text-gray-300"
                    }`}
                  >
                    {selectedTargetLanguages.includes(lang) ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-5 h-5"
                      >
                        <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z" />
                        <path
                          d="M10 17l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                          fill="white"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-5 h-5"
                      >
                        <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm">{lang}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default LanguageSelector;
