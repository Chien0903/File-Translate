import { useState } from "react";
import { FiX, FiRefreshCw } from "react-icons/fi";
import { MdHourglassEmpty, MdCheckCircle, MdCancel } from "react-icons/md";
import SuggestStatusBadge from "./SuggestStatusBadge";
import { EMPTY_KEYWORD } from "./constants";
import { useLibraryLanguages } from "../../../hooks/useLibraryLanguages";

const WARNING_CONFIG = {
  pending: {
    text: "This keyword is pending review. Editing the content will reset its status — you will need to suggest it again.",
    color: "bg-yellow-50 border-yellow-300 text-yellow-800",
    icon: <MdHourglassEmpty className="text-yellow-600 shrink-0 mt-0.5" size={16} />,
  },
  approved: {
    text: "This keyword has been approved into Common Library. Editing the content will reset the 'In Library' status.",
    color: "bg-green-50 border-green-300 text-green-800",
    icon: <MdCheckCircle className="text-green-600 shrink-0 mt-0.5" size={16} />,
  },
  rejected: {
    text: "This keyword was rejected. Editing the content will reset its status — you can suggest it again after saving.",
    color: "bg-red-50 border-red-300 text-red-800",
    icon: <MdCancel className="text-red-500 shrink-0 mt-0.5" size={16} />,
  },
};

const KeywordFormModal = ({ initial, onSave, onClose, title, suggestionStatus }) => {
  const { libraryLanguages } = useLibraryLanguages();
  const [form, setForm] = useState(initial || EMPTY_KEYWORD);

  const translations = form.translations || {};
  const handleChange = (code, value) =>
    setForm((f) => ({ ...f, translations: { ...(f.translations || {}), [code]: value } }));

  const allCodes = ["en", ...libraryLanguages.map((l) => l.code)];
  const isValid = allCodes.some((c) => (translations[c] || "").trim() !== "");
  const hasContentChanged = allCodes.some((c) => (translations[c] || "") !== ((initial?.translations || {})[c] || ""));
  const willResetStatus = suggestionStatus && hasContentChanged;
  const warning = WARNING_CONFIG[suggestionStatus];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-11/12 max-w-5xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-indigo-700">{title}</h3>
            {suggestionStatus && !willResetStatus && <SuggestStatusBadge status={suggestionStatus} />}
            {willResetStatus && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-300 text-xs font-medium">
                <FiRefreshCw size={11} /> Status will reset
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FiX size={20} /></button>
        </div>

        {warning && willResetStatus && (
          <div className={`mx-4 mt-3 px-4 py-3 rounded-lg border flex items-start gap-2 text-sm ${warning.color}`}>
            {warning.icon}
            <span>{warning.text}</span>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4">
          <div className="overflow-auto border border-gray-200 rounded-lg">
            <table className="min-w-max w-full border-collapse">
              <thead>
                <tr className="bg-indigo-700 text-white">
                  <th className="p-3 text-center border-r border-white/20 sticky left-0 z-10 bg-indigo-700" style={{ width: 220, minWidth: 220 }}>
                    English
                  </th>
                  {libraryLanguages.map((lang) => (
                    <th key={lang.code} className="p-3 text-center border-r border-white/20" style={{ width: 180, minWidth: 180 }}>
                      {lang.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-0 border-r border-gray-200 sticky left-0 z-10 bg-white" style={{ boxShadow: "3px 0 8px rgba(0,0,0,0.05)" }}>
                    <textarea
                      value={translations["en"] || ""}
                      onChange={(e) => handleChange("en", e.target.value)}
                      className="w-full p-3 border-none resize-y min-h-[100px] focus:ring-2 focus:ring-inset focus:ring-blue-200 outline-none bg-transparent text-sm"
                      placeholder="Enter English..."
                    />
                  </td>
                  {libraryLanguages.map((lang) => (
                    <td key={lang.code} className="p-0 border-r border-gray-200 bg-white">
                      <textarea
                        value={translations[lang.code] || ""}
                        onChange={(e) => handleChange(lang.code, e.target.value)}
                        className="w-full p-3 border-none resize-y min-h-[100px] focus:ring-2 focus:ring-inset focus:ring-blue-200 outline-none bg-transparent text-sm"
                        placeholder={`Enter ${lang.label}...`}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-5 py-2 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={() => isValid && onSave(form)}
            disabled={!isValid}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${isValid ? "bg-indigo-700 text-white hover:bg-[#003276]" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeywordFormModal;
