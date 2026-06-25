import { FiEdit2 } from "react-icons/fi";
import SuggestStatusBadge from "./SuggestStatusBadge";
import { useLibraryLanguages } from "../../../hooks/useLibraryLanguages";

const KeywordDetailModal = ({ keyword, onClose, onEdit }) => {
  const { libraryLanguages } = useLibraryLanguages();
  const t = keyword.translations || {};

  return (
    <div
      className="fixed inset-0 flex justify-center items-center z-50"
      style={{ backgroundColor: "rgba(255,255,255,0.7)" }}
      onClick={onClose}
    >
      <div
        className="bg-white p-6 rounded-lg shadow-xl w-11/12 max-h-[90vh] overflow-auto text-center"
        style={{ maxWidth: "1100px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-indigo-700 font-bold">KEYWORD DETAILS</h3>
          {keyword.suggestion_status && <SuggestStatusBadge status={keyword.suggestion_status} />}
        </div>

        <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
          <table className="min-w-max w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-indigo-700 text-white font-bold">
                <th className="p-3 text-center border-r border-white/20 sticky left-0 z-20 bg-indigo-700" style={{ width: "220px", minWidth: "220px", boxShadow: "3px 0 8px rgba(0,0,0,0.15)" }}>
                  English
                </th>
                {libraryLanguages.map((lang) => (
                  <th key={lang.code} className="p-3 text-center border-r border-white/20" style={{ width: "200px", minWidth: "200px" }}>
                    {lang.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-4 bg-white text-center font-medium text-gray-900 border-r border-gray-200 sticky left-0 z-10" style={{ boxShadow: "3px 0 8px rgba(0,0,0,0.05)" }}>
                  {t["en"] || <span className="text-gray-400 italic">—</span>}
                </td>
                {libraryLanguages.map((lang) => (
                  <td key={lang.code} className="p-4 bg-white text-center text-gray-700 border-r border-gray-200">
                    {t[lang.code] || <span className="text-gray-400 italic">—</span>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex justify-center gap-3 mt-6">
          <button className="px-6 py-2 bg-indigo-700 text-white rounded-lg hover:bg-indigo-800 transition-all duration-200 shadow-md font-medium" onClick={onClose}>
            Close
          </button>
          <button className="flex items-center gap-1.5 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-200 shadow-md font-medium" onClick={() => { onClose(); onEdit(keyword); }}>
            <FiEdit2 size={14} /> Edit
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeywordDetailModal;
