import { FiSend, FiX, FiInfo } from "react-icons/fi";
import { useLibraryLanguages } from "../../../hooks/useLibraryLanguages";

const SuggestConfirmModal = ({ keywords, onConfirm, onCancel, isSubmitting }) => {
  const { libraryLanguages } = useLibraryLanguages();

  const allFields = [
    { code: "en", label: "EN", flagEmoji: "🇬🇧" },
    ...libraryLanguages.map((l) => ({ code: l.code, label: l.code.toUpperCase(), flagEmoji: l.flagEmoji })),
  ];

  // Only show columns with at least one non-empty value
  const activeFields = allFields.filter((f) =>
    keywords.some((kw) => (kw.translations || {})[f.code]?.trim())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.55)" }} onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-11/12 max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-full"><FiSend className="text-green-600" size={18} /></div>
            <div>
              <h3 className="text-base font-bold text-gray-800">Review Before Submitting</h3>
              <p className="text-xs text-gray-500">{keywords.length} keyword{keywords.length > 1 ? "s" : ""} will be submitted for Admin review</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><FiX size={20} /></button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="overflow-auto border border-gray-200 rounded-xl">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-indigo-700 text-white text-xs">
                  <th className="px-3 py-2.5 text-left font-semibold sticky left-0 z-10 bg-indigo-700 border-r border-white/20" style={{ minWidth: 28 }}>#</th>
                  {activeFields.map((f) => (
                    <th key={f.code} className="px-3 py-2.5 text-left font-semibold border-r border-white/20 whitespace-nowrap" style={{ minWidth: 150 }}>
                      {f.flagEmoji} {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keywords.map((kw, idx) => (
                  <tr key={kw.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-2.5 text-gray-400 sticky left-0 z-10 border-r border-gray-100 font-medium text-xs" style={{ backgroundColor: idx % 2 === 0 ? "white" : "#f9fafb" }}>
                      {idx + 1}
                    </td>
                    {activeFields.map((f) => {
                      const val = (kw.translations || {})[f.code]?.trim();
                      return (
                        <td key={f.code} className="px-3 py-2.5 border-r border-gray-100 break-words max-w-[200px]">
                          {val ? <span className="text-gray-800">{val}</span> : <span className="text-gray-300 italic text-xs">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-start gap-2 px-3 py-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
            <FiInfo size={14} className="shrink-0 mt-0.5" />
            <span>These keywords will be submitted with status <strong>Pending</strong>. Admin or Library Keeper will review and decide.</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onCancel} disabled={isSubmitting} className="px-5 py-2 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isSubmitting} className="flex items-center gap-2 px-6 py-2 rounded-full bg-green-600 text-white hover:bg-green-700 text-sm font-medium transition-colors disabled:opacity-60 shadow-sm">
            <FiSend size={14} />
            {isSubmitting ? "Submitting..." : `Confirm & Submit (${keywords.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuggestConfirmModal;
