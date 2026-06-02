import PropTypes from "prop-types";

const ALL_LANGUAGES = [
    { key: 'japanese', label: 'Japanese', emoji: '🇯🇵' },
    { key: 'vietnamese', label: 'Vietnamese', emoji: '🇻🇳' },
    { key: 'chinese_traditional', label: 'Chinese Traditional', emoji: '🇹🇼' },
    { key: 'chinese_simplified', label: 'Chinese Simplified', emoji: '🇨🇳' },
    { key: 'bengali', label: 'Bengali', emoji: '🇧🇩' },
    { key: 'indonesian', label: 'Indonesian', emoji: '🇮🇩' },
    { key: 'hindi', label: 'Hindi', emoji: '🇮🇳' },
    { key: 'oriya', label: 'Oriya', emoji: '🇮🇳' },
    { key: 'thai', label: 'Thai', emoji: '🇹🇭' }
];

const KeywordEditModal = ({
    keyword,
    onChange,
    onSave,
    onClose,
}) => {
    if (!keyword) return null;

    return (
        <div
            className="fixed inset-0 flex justify-center items-center z-50"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.7)" }}
            onClick={onClose}
        >
            <div
                className="bg-white p-6 rounded-lg shadow-xl w-11/12 max-h-[90vh] overflow-auto text-center"
                style={{ maxWidth: '1100px' }}
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg text-[#004098] font-bold mb-4 text-center">
                    EDIT KEYWORD
                </h3>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        onSave();
                    }}
                >
                    <div className="flex-1 overflow-auto border border-gray-200 rounded-lg mb-6">
                        <table className="min-w-max w-full border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-[#004098] text-white font-bold">
                                    <th className="p-3 text-center border-r border-white/20 sticky left-0 z-20 bg-[#004098]" style={{ width: '220px', minWidth: '220px', boxShadow: '3px 0 8px rgba(0,0,0,0.15)' }}>
                                        English
                                    </th>
                                    {ALL_LANGUAGES.map((lang) => (
                                        <th key={lang.key} className="p-3 text-center border-r border-white/20" style={{ width: '200px', minWidth: '200px' }}>
                                            {lang.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="p-0 border-r border-gray-200 sticky left-0 z-10 bg-white" style={{ boxShadow: '3px 0 8px rgba(0,0,0,0.05)' }}>
                                        <textarea
                                            name="english"
                                            value={keyword.english || ""}
                                            onChange={onChange}
                                            className="w-full h-full p-3 border-none resize-y text-center min-h-[120px] focus:ring-2 focus:ring-inset focus:ring-blue-200 outline-none bg-transparent"
                                            placeholder="Enter English text..."
                                        />
                                    </td>
                                    {ALL_LANGUAGES.map((lang) => (
                                        <td key={lang.key} className="p-0 border-r border-gray-200 bg-white">
                                            <textarea
                                                name={lang.key}
                                                value={keyword[lang.key] || ""}
                                                onChange={onChange}
                                                className="w-full h-full p-3 border-none resize-y text-center min-h-[120px] focus:ring-2 focus:ring-inset focus:ring-blue-200 outline-none bg-transparent"
                                                placeholder={`Enter ${lang.label}...`}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-6 flex justify-center gap-3">
                        <button
                            type="submit"
                            className="px-6 py-2 bg-[#004098] text-white rounded-lg hover:bg-[#003875] transition-all duration-200 shadow-md hover:shadow-lg font-medium"
                        >
                            Save Changes
                        </button>
                        <button
                            type="button"
                            className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

KeywordEditModal.propTypes = {
    keyword: PropTypes.object,
    onChange: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
};

export default KeywordEditModal;
