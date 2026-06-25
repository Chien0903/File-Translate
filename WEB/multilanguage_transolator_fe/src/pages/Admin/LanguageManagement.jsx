import { useState, useEffect, useCallback, useRef } from 'react';
import { languageService } from '../../services/languageService';
import { MdClose, MdAdd, MdSearch } from 'react-icons/md';

const DEFAULT_COMPANY_ID = 1;

const ACTION_META = {
  enable: { label: 'Enabled', cls: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
  disable: { label: 'Disabled', cls: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
  set_default: { label: 'Set as default', cls: 'bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
  add_language: { label: 'Added', cls: 'bg-purple-50 text-purple-700', dot: 'bg-purple-500' },
};

const GOOGLE_TRANSLATE_LANGUAGES = [
  { code: 'af', name: 'Afrikaans', native_name: 'Afrikaans', flag_emoji: '🇿🇦' },
  { code: 'sq', name: 'Albanian', native_name: 'Shqip', flag_emoji: '🇦🇱' },
  { code: 'am', name: 'Amharic', native_name: 'አማርኛ', flag_emoji: '🇪🇹' },
  { code: 'ar', name: 'Arabic', native_name: 'العربية', flag_emoji: '🇸🇦' },
  { code: 'hy', name: 'Armenian', native_name: 'Հայերեն', flag_emoji: '🇦🇲' },
  { code: 'az', name: 'Azerbaijani', native_name: 'Azərbaycan', flag_emoji: '🇦🇿' },
  { code: 'eu', name: 'Basque', native_name: 'Euskara', flag_emoji: '🇪🇸' },
  { code: 'be', name: 'Belarusian', native_name: 'Беларуская', flag_emoji: '🇧🇾' },
  { code: 'bn', name: 'Bengali', native_name: 'বাংলা', flag_emoji: '🇧🇩' },
  { code: 'bs', name: 'Bosnian', native_name: 'Bosanski', flag_emoji: '🇧🇦' },
  { code: 'bg', name: 'Bulgarian', native_name: 'Български', flag_emoji: '🇧🇬' },
  { code: 'ca', name: 'Catalan', native_name: 'Català', flag_emoji: '🇪🇸' },
  { code: 'ceb', name: 'Cebuano', native_name: 'Cebuano', flag_emoji: '🇵🇭' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', native_name: '简体中文', flag_emoji: '🇨🇳' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', native_name: '繁體中文', flag_emoji: '🇹🇼' },
  { code: 'co', name: 'Corsican', native_name: 'Corsu', flag_emoji: '🇫🇷' },
  { code: 'hr', name: 'Croatian', native_name: 'Hrvatski', flag_emoji: '🇭🇷' },
  { code: 'cs', name: 'Czech', native_name: 'Čeština', flag_emoji: '🇨🇿' },
  { code: 'da', name: 'Danish', native_name: 'Dansk', flag_emoji: '🇩🇰' },
  { code: 'nl', name: 'Dutch', native_name: 'Nederlands', flag_emoji: '🇳🇱' },
  { code: 'en', name: 'English', native_name: 'English', flag_emoji: '🇬🇧' },
  { code: 'eo', name: 'Esperanto', native_name: 'Esperanto', flag_emoji: '' },
  { code: 'et', name: 'Estonian', native_name: 'Eesti', flag_emoji: '🇪🇪' },
  { code: 'fi', name: 'Finnish', native_name: 'Suomi', flag_emoji: '🇫🇮' },
  { code: 'fr', name: 'French', native_name: 'Français', flag_emoji: '🇫🇷' },
  { code: 'fy', name: 'Frisian', native_name: 'Frysk', flag_emoji: '🇳🇱' },
  { code: 'gl', name: 'Galician', native_name: 'Galego', flag_emoji: '🇪🇸' },
  { code: 'ka', name: 'Georgian', native_name: 'ქართული', flag_emoji: '🇬🇪' },
  { code: 'de', name: 'German', native_name: 'Deutsch', flag_emoji: '🇩🇪' },
  { code: 'el', name: 'Greek', native_name: 'Ελληνικά', flag_emoji: '🇬🇷' },
  { code: 'gu', name: 'Gujarati', native_name: 'ગુજરાતી', flag_emoji: '🇮🇳' },
  { code: 'ht', name: 'Haitian Creole', native_name: 'Kreyòl ayisyen', flag_emoji: '🇭🇹' },
  { code: 'ha', name: 'Hausa', native_name: 'Hausa', flag_emoji: '🇳🇬' },
  { code: 'haw', name: 'Hawaiian', native_name: 'Ōlelo Hawaiʻi', flag_emoji: '🇺🇸' },
  { code: 'he', name: 'Hebrew', native_name: 'עברית', flag_emoji: '🇮🇱' },
  { code: 'hi', name: 'Hindi', native_name: 'हिन्दी', flag_emoji: '🇮🇳' },
  { code: 'hmn', name: 'Hmong', native_name: 'Hmong', flag_emoji: '' },
  { code: 'hu', name: 'Hungarian', native_name: 'Magyar', flag_emoji: '🇭🇺' },
  { code: 'is', name: 'Icelandic', native_name: 'Íslenska', flag_emoji: '🇮🇸' },
  { code: 'ig', name: 'Igbo', native_name: 'Igbo', flag_emoji: '🇳🇬' },
  { code: 'id', name: 'Indonesian', native_name: 'Bahasa Indonesia', flag_emoji: '🇮🇩' },
  { code: 'ga', name: 'Irish', native_name: 'Gaeilge', flag_emoji: '🇮🇪' },
  { code: 'it', name: 'Italian', native_name: 'Italiano', flag_emoji: '🇮🇹' },
  { code: 'ja', name: 'Japanese', native_name: '日本語', flag_emoji: '🇯🇵' },
  { code: 'jv', name: 'Javanese', native_name: 'Basa Jawa', flag_emoji: '🇮🇩' },
  { code: 'kn', name: 'Kannada', native_name: 'ಕನ್ನಡ', flag_emoji: '🇮🇳' },
  { code: 'kk', name: 'Kazakh', native_name: 'Қазақша', flag_emoji: '🇰🇿' },
  { code: 'km', name: 'Khmer', native_name: 'ខ្មែរ', flag_emoji: '🇰🇭' },
  { code: 'rw', name: 'Kinyarwanda', native_name: 'Kinyarwanda', flag_emoji: '🇷🇼' },
  { code: 'ko', name: 'Korean', native_name: '한국어', flag_emoji: '🇰🇷' },
  { code: 'ku', name: 'Kurdish', native_name: 'Kurdî', flag_emoji: '' },
  { code: 'ky', name: 'Kyrgyz', native_name: 'Кыргызча', flag_emoji: '🇰🇬' },
  { code: 'lo', name: 'Lao', native_name: 'ລາວ', flag_emoji: '🇱🇦' },
  { code: 'la', name: 'Latin', native_name: 'Latina', flag_emoji: '' },
  { code: 'lv', name: 'Latvian', native_name: 'Latviešu', flag_emoji: '🇱🇻' },
  { code: 'lt', name: 'Lithuanian', native_name: 'Lietuvių', flag_emoji: '🇱🇹' },
  { code: 'lb', name: 'Luxembourgish', native_name: 'Lëtzebuergesch', flag_emoji: '🇱🇺' },
  { code: 'mk', name: 'Macedonian', native_name: 'Македонски', flag_emoji: '🇲🇰' },
  { code: 'mg', name: 'Malagasy', native_name: 'Malagasy', flag_emoji: '🇲🇬' },
  { code: 'ms', name: 'Malay', native_name: 'Bahasa Melayu', flag_emoji: '🇲🇾' },
  { code: 'ml', name: 'Malayalam', native_name: 'മലയാളം', flag_emoji: '🇮🇳' },
  { code: 'mt', name: 'Maltese', native_name: 'Malti', flag_emoji: '🇲🇹' },
  { code: 'mi', name: 'Maori', native_name: 'Māori', flag_emoji: '🇳🇿' },
  { code: 'mr', name: 'Marathi', native_name: 'मराठी', flag_emoji: '🇮🇳' },
  { code: 'mn', name: 'Mongolian', native_name: 'Монгол', flag_emoji: '🇲🇳' },
  { code: 'my', name: 'Myanmar (Burmese)', native_name: 'မြန်မာ', flag_emoji: '🇲🇲' },
  { code: 'ne', name: 'Nepali', native_name: 'नेपाली', flag_emoji: '🇳🇵' },
  { code: 'no', name: 'Norwegian', native_name: 'Norsk', flag_emoji: '🇳🇴' },
  { code: 'ny', name: 'Nyanja', native_name: 'Chichewa', flag_emoji: '🇲🇼' },
  { code: 'or', name: 'Odia (Oriya)', native_name: 'ଓଡ଼ିଆ', flag_emoji: '🇮🇳' },
  { code: 'ps', name: 'Pashto', native_name: 'پښتو', flag_emoji: '🇦🇫' },
  { code: 'fa', name: 'Persian', native_name: 'فارسی', flag_emoji: '🇮🇷' },
  { code: 'pl', name: 'Polish', native_name: 'Polski', flag_emoji: '🇵🇱' },
  { code: 'pt', name: 'Portuguese', native_name: 'Português', flag_emoji: '🇵🇹' },
  { code: 'pa', name: 'Punjabi', native_name: 'ਪੰਜਾਬੀ', flag_emoji: '🇮🇳' },
  { code: 'ro', name: 'Romanian', native_name: 'Română', flag_emoji: '🇷🇴' },
  { code: 'ru', name: 'Russian', native_name: 'Русский', flag_emoji: '🇷🇺' },
  { code: 'sm', name: 'Samoan', native_name: 'Samoan', flag_emoji: '🇼🇸' },
  { code: 'gd', name: 'Scots Gaelic', native_name: 'Gàidhlig', flag_emoji: '' },
  { code: 'sr', name: 'Serbian', native_name: 'Српски', flag_emoji: '🇷🇸' },
  { code: 'st', name: 'Sesotho', native_name: 'Sesotho', flag_emoji: '🇱🇸' },
  { code: 'sn', name: 'Shona', native_name: 'Shona', flag_emoji: '🇿🇼' },
  { code: 'sd', name: 'Sindhi', native_name: 'سنڌي', flag_emoji: '🇵🇰' },
  { code: 'si', name: 'Sinhala', native_name: 'සිංහල', flag_emoji: '🇱🇰' },
  { code: 'sk', name: 'Slovak', native_name: 'Slovenčina', flag_emoji: '🇸🇰' },
  { code: 'sl', name: 'Slovenian', native_name: 'Slovenščina', flag_emoji: '🇸🇮' },
  { code: 'so', name: 'Somali', native_name: 'Soomaali', flag_emoji: '🇸🇴' },
  { code: 'es', name: 'Spanish', native_name: 'Español', flag_emoji: '🇪🇸' },
  { code: 'su', name: 'Sundanese', native_name: 'Basa Sunda', flag_emoji: '🇮🇩' },
  { code: 'sw', name: 'Swahili', native_name: 'Kiswahili', flag_emoji: '🇰🇪' },
  { code: 'sv', name: 'Swedish', native_name: 'Svenska', flag_emoji: '🇸🇪' },
  { code: 'tl', name: 'Filipino (Tagalog)', native_name: 'Filipino', flag_emoji: '🇵🇭' },
  { code: 'tg', name: 'Tajik', native_name: 'Тоҷикӣ', flag_emoji: '🇹🇯' },
  { code: 'ta', name: 'Tamil', native_name: 'தமிழ்', flag_emoji: '🇮🇳' },
  { code: 'tt', name: 'Tatar', native_name: 'Татарча', flag_emoji: '🇷🇺' },
  { code: 'te', name: 'Telugu', native_name: 'తెలుగు', flag_emoji: '🇮🇳' },
  { code: 'th', name: 'Thai', native_name: 'ภาษาไทย', flag_emoji: '🇹🇭' },
  { code: 'tr', name: 'Turkish', native_name: 'Türkçe', flag_emoji: '🇹🇷' },
  { code: 'tk', name: 'Turkmen', native_name: 'Türkmen', flag_emoji: '🇹🇲' },
  { code: 'uk', name: 'Ukrainian', native_name: 'Українська', flag_emoji: '🇺🇦' },
  { code: 'ur', name: 'Urdu', native_name: 'اردو', flag_emoji: '🇵🇰' },
  { code: 'ug', name: 'Uyghur', native_name: 'ئۇيغۇرچە', flag_emoji: '🇨🇳' },
  { code: 'uz', name: 'Uzbek', native_name: 'Oʻzbekcha', flag_emoji: '🇺🇿' },
  { code: 'vi', name: 'Vietnamese', native_name: 'Tiếng Việt', flag_emoji: '🇻🇳' },
  { code: 'cy', name: 'Welsh', native_name: 'Cymraeg', flag_emoji: '' },
  { code: 'xh', name: 'Xhosa', native_name: 'isiXhosa', flag_emoji: '🇿🇦' },
  { code: 'yi', name: 'Yiddish', native_name: 'ייִדיש', flag_emoji: '' },
  { code: 'yo', name: 'Yoruba', native_name: 'Yorùbá', flag_emoji: '🇳🇬' },
  { code: 'zu', name: 'Zulu', native_name: 'isiZulu', flag_emoji: '🇿🇦' },
];

const LanguageCard = ({ companyLanguage: cl, onRemove, onSetDefault, loading }) => {
  const { language, is_default } = cl;
  const codeUpper = language.code.replace('-', '').toUpperCase().slice(0, 2);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-start gap-4">
      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
        {language.flag_emoji ? (
          <span className="text-xl">{language.flag_emoji}</span>
        ) : (
          <span className="text-indigo-700 font-bold text-sm">{codeUpper}</span>
        )}
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
        <span className="inline-block mt-1.5 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded font-mono">
          {language.code}
        </span>
      </div>

      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <button
          onClick={() => !loading && !is_default && onRemove(cl)}
          disabled={loading || is_default}
          title={is_default ? 'Cannot remove default language' : 'Remove language'}
          className={`p-1.5 rounded-lg transition-colors
            ${is_default
              ? 'text-gray-200 cursor-not-allowed'
              : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}
        >
          <MdClose size={16} />
        </button>
        {!is_default && (
          <button
            onClick={() => !loading && onSetDefault(cl)}
            disabled={loading}
            className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline transition-colors disabled:opacity-40"
          >
            Set as default
          </button>
        )}
      </div>
    </div>
  );
};

const AddLanguageModal = ({ availableLanguages, onAdd, onClose, loading }) => {
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const filtered = availableLanguages.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      l.native_name.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Add Language</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <MdClose size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
            <MdSearch size={18} className="text-gray-400 flex-shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search languages..."
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                <MdClose size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Language list */}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">No languages found.</div>
          ) : (
            filtered.map((lang) => (
              <button
                key={lang.code}
                onClick={() => !loading && onAdd(lang)}
                disabled={loading}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors text-left disabled:opacity-50"
              >
                <span className="text-xl w-8 text-center flex-shrink-0">
                  {lang.flag_emoji || (
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 rounded px-1">
                      {lang.code.toUpperCase().slice(0, 2)}
                    </span>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{lang.name}</p>
                  {lang.native_name !== lang.name && (
                    <p className="text-xs text-gray-400 truncate">{lang.native_name}</p>
                  )}
                </div>
                <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                  {lang.code}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const LanguageManagement = () => {
  const [companyLanguages, setCompanyLanguages] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('languages');
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const companyId = DEFAULT_COMPANY_ID;

  const fetchData = useCallback(async () => {
    setError('');
    try {
      const [langs, logs] = await Promise.all([
        languageService.getCompanyLanguages(companyId),
        languageService.getAuditLog(companyId),
      ]);
      setCompanyLanguages(langs);
      setAuditLogs(logs);
    } catch {
      setError('Failed to load language data. Please try again.');
    }
  }, [companyId]);

  useEffect(() => {
    fetchData().finally(() => setInitialLoading(false));
  }, [fetchData]);

  const handleRemove = async (cl) => {
    setLoading(true);
    setError('');
    try {
      await languageService.disableLanguage(companyId, cl.language.id);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove language.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (cl) => {
    setLoading(true);
    setError('');
    try {
      await languageService.setDefaultLanguage(companyId, cl.language.id);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Action failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLanguage = async (lang) => {
    setLoading(true);
    setError('');
    try {
      await languageService.addLanguage(companyId, {
        code: lang.code,
        name: lang.name,
        native_name: lang.native_name,
        flag_emoji: lang.flag_emoji,
      });
      await fetchData();
      setShowAddModal(false);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add language.');
    } finally {
      setLoading(false);
    }
  };

  const enabledLanguages = companyLanguages.filter((cl) => cl.is_enabled);
  const enabledCodes = new Set(enabledLanguages.map((cl) => cl.language.code));
  const availableLanguages = GOOGLE_TRANSLATE_LANGUAGES.filter((l) => !enabledCodes.has(l.code));

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Language Management</h1>
          <p className="text-gray-400 text-sm mt-1">{enabledLanguages.length} languages enabled</p>
        </div>
        {activeTab === 'languages' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-700 text-white rounded-xl text-sm font-medium hover:bg-indigo-800 transition-colors"
          >
            <MdAdd size={18} />
            Add Language
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {[{ k: 'languages', label: 'Languages' }, { k: 'audit', label: 'Audit Log' }].map((t) => (
          <button
            key={t.k}
            onClick={() => setActiveTab(t.k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === t.k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center justify-between p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
          <span>{error}</span>
          <button onClick={() => setError('')} className="p-1 hover:bg-red-100 rounded-lg">
            <MdClose size={16} />
          </button>
        </div>
      )}

      {/* Languages tab */}
      {activeTab === 'languages' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {enabledLanguages.map((cl) => (
            <LanguageCard
              key={cl.id}
              companyLanguage={cl}
              onRemove={handleRemove}
              onSetDefault={handleSetDefault}
              loading={loading}
            />
          ))}
          {enabledLanguages.length === 0 && (
            <div className="col-span-2 py-16 text-center text-gray-300 text-sm">
              No languages enabled. Click &ldquo;Add Language&rdquo; to get started.
            </div>
          )}
        </div>
      )}

      {/* Audit log tab */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {auditLogs.length === 0 ? (
            <div className="py-12 text-center text-gray-300 text-sm">No audit log entries yet.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {auditLogs.map((log) => {
                const meta = ACTION_META[log.action] || { label: log.action, cls: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
                return (
                  <div key={log.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${meta.dot}`} />
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                    <span className="text-sm text-gray-800 font-medium">{log.language_name || log.language_code}</span>
                    <span className="text-xs text-gray-400 flex-1 truncate">{log.actor_email}</span>
                    <span className="text-xs text-gray-300 whitespace-nowrap flex-shrink-0">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Language Modal */}
      {showAddModal && (
        <AddLanguageModal
          availableLanguages={availableLanguages}
          onAdd={handleAddLanguage}
          onClose={() => setShowAddModal(false)}
          loading={loading}
        />
      )}
    </div>
  );
};

export default LanguageManagement;
