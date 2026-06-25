const LanguageToggleCard = ({ companyLanguage: cl, onToggle, onSetDefault, loading }) => {
  const { language, is_enabled, is_default } = cl;
  const codeUpper = language.code.replace("-", "").toUpperCase().slice(0, 2);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-start gap-4">
      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
        <span className="text-indigo-700 font-bold text-sm">{codeUpper}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-900 text-sm">{language.name}</span>
          {is_default && (
            <span className="px-2 py-0.5 bg-indigo-700 text-white text-xs rounded-full font-medium">Default</span>
          )}
        </div>
        {language.native_name && (
          <p className="text-gray-400 text-xs mt-0.5">{language.native_name}</p>
        )}
        <span className="inline-block mt-1.5 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded font-mono">{language.code}</span>
      </div>

      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <button
          onClick={() => !loading && onToggle(cl)}
          disabled={loading || is_default}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none
            ${is_enabled ? "bg-green-500" : "bg-gray-200"}
            ${loading || is_default ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          title={is_default ? "Cannot disable default language" : is_enabled ? "Disable" : "Enable"}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
              ${is_enabled ? "translate-x-5" : "translate-x-0"}`}
          />
        </button>

        {is_enabled && !is_default && (
          <button
            onClick={() => !loading && onSetDefault(cl)}
            disabled={loading}
            className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline transition-colors disabled:opacity-40"
          >
            Set as default
          </button>
        )}
        {is_default && (
          <span className="text-xs text-gray-300">Cannot disable</span>
        )}
      </div>
    </div>
  );
};

export default LanguageToggleCard;
