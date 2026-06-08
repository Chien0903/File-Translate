import { FiSend, FiX, FiInfo } from "react-icons/fi";

const ALL_FIELDS = [
  { key: "english", label: "EN", flag: "🇺🇸" },
  { key: "japanese", label: "JA", flag: "🇯🇵" },
  { key: "vietnamese", label: "VI", flag: "🇻🇳" },
  { key: "chinese_traditional", label: "ZH-TW", flag: "🇹🇼" },
  { key: "chinese_simplified", label: "ZH-CN", flag: "🇨🇳" },
  { key: "thai", label: "TH", flag: "🇹🇭" },
  { key: "bengali", label: "BN", flag: "🇧🇩" },
  { key: "hindi", label: "HI", flag: "🇮🇳" },
  { key: "indonesian", label: "ID", flag: "🇮🇩" },
  { key: "oriya", label: "OR", flag: "🇮🇳" },
];

const SuggestConfirmModal = ({ keywords, onConfirm, onCancel, isSubmitting }) => {
  const activeFields = ALL_FIELDS.filter((f) =>
    keywords.some((kw) => kw[f.key]?.trim())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-11/12 max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-full">
              <FiSend className="text-green-600" size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800">Review Before Submitting</h3>
              <p className="text-xs text-gray-500">
                {keywords.length} keyword{keywords.length > 1 ? "s" : ""} will be submitted for Admin review
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <FiX size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="overflow-auto border border-gray-200 rounded-xl">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#004098] text-white text-xs">
                  <th
                    className="px-3 py-2.5 text-left font-semibold sticky left-0 z-10 bg-[#004098] border-r border-white/20"
                    style={{ minWidth: 28 }}
                  >
                    #
                  </th>
                  {activeFields.map((f) => (
                    <th
                      key={f.key}
                      className="px-3 py-2.5 text-left font-semibold border-r border-white/20 whitespace-nowrap"
                      style={{ minWidth: 150 }}
                    >
                      {f.flag} {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keywords.map((kw, idx) => (
                  <tr key={kw.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td
                      className="px-3 py-2.5 text-gray-400 sticky left-0 z-10 border-r border-gray-100 font-medium text-xs"
                      style={{ backgroundColor: idx % 2 === 0 ? "white" : "#f9fafb" }}
                    >
                      {idx + 1}
                    </td>
                    {activeFields.map((f) => (
                      <td key={f.key} className="px-3 py-2.5 border-r border-gray-100 break-words max-w-[200px]">
                        {kw[f.key]?.trim() ? (
                          <span className="text-gray-800">{kw[f.key]}</span>
                        ) : (
                          <span className="text-gray-300 italic text-xs">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-start gap-2 px-3 py-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
            <FiInfo size={14} className="shrink-0 mt-0.5" />
            <span>
              These keywords will be submitted with status <strong>Pending</strong>.
              Admin or Library Keeper will review and decide whether to add them to Common Library.
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2 rounded-full bg-green-600 text-white hover:bg-green-700 text-sm font-medium transition-colors disabled:opacity-60 shadow-sm"
          >
            <FiSend size={14} />
            {isSubmitting ? "Submitting..." : `Confirm & Submit (${keywords.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuggestConfirmModal;
