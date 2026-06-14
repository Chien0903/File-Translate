# Phase 3 Implementation Guide — Frontend Admin UI

> **Prerequisite:** Phase 2 hoàn thành (API endpoints hoạt động)  
> **Thời gian ước tính:** 2–3 ngày  
> **Kết quả:** Trang admin quản lý ngôn ngữ theo company, tích hợp vào sidebar hiện tại

---

## Tổng quan các bước

| # | Bước | File |
|---|------|------|
| 1 | Tạo `languageService.js` | `src/services/languageService.js` |
| 2 | Tạo `LanguageToggleCard.jsx` | `src/components/features/language/LanguageToggleCard.jsx` |
| 3 | Tạo `LanguageManagement.jsx` | `src/pages/admin/LanguageManagement.jsx` |
| 4 | Thêm route vào `App.jsx` | `src/App.jsx` |
| 5 | Thêm link vào Sidebar Admin | `src/components/layout/Sidebar.jsx` (hoặc tương đương) |
| 6 | Test UI | — |

---

## Bước 1 — Tạo `languageService.js`

**File:** `src/services/languageService.js` *(tạo mới)*

```javascript
import api from './api';  // axios instance hiện tại

export const languageService = {
  // Lấy tất cả ngôn ngữ hệ thống
  getAllLanguages: () =>
    api.get('/languages/').then(res => res.data),

  // Lấy ngôn ngữ của company
  getCompanyLanguages: (companyId) =>
    api.get(`/companies/${companyId}/languages/`).then(res => res.data),

  // Bật ngôn ngữ
  enableLanguage: (companyId, langId) =>
    api.post(`/companies/${companyId}/languages/${langId}/enable/`).then(res => res.data),

  // Tắt ngôn ngữ
  disableLanguage: (companyId, langId) =>
    api.post(`/companies/${companyId}/languages/${langId}/disable/`).then(res => res.data),

  // Đặt ngôn ngữ mặc định
  setDefaultLanguage: (companyId, langId) =>
    api.post(`/companies/${companyId}/languages/${langId}/set-default/`).then(res => res.data),

  // Lịch sử thao tác
  getAuditLog: (companyId) =>
    api.get(`/companies/${companyId}/languages/audit-log/`).then(res => res.data),
};
```

---

## Bước 2 — Tạo `LanguageToggleCard.jsx`

**File:** `src/components/features/language/LanguageToggleCard.jsx` *(tạo mới)*

```jsx
const LanguageToggleCard = ({ companyLanguage, onToggle, onSetDefault, loading }) => {
  const { language, is_enabled, is_default } = companyLanguage;

  return (
    <div className={`border rounded-lg p-4 flex items-center justify-between
      ${is_enabled ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}
    >
      {/* Left: language info */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">{language.flag_emoji}</span>
        <div>
          <div className="font-medium text-gray-800 flex items-center gap-2">
            {language.name}
            {is_default && (
              <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                Default
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500">{language.native_name} · {language.code}</div>
        </div>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-3">
        {is_enabled && !is_default && (
          <button
            onClick={() => onSetDefault(companyLanguage)}
            disabled={loading}
            className="text-xs text-blue-600 hover:underline disabled:opacity-50"
          >
            Set as Default
          </button>
        )}
        {/* Toggle switch */}
        <button
          onClick={() => onToggle(companyLanguage)}
          disabled={loading || is_default}
          title={is_default ? 'Cannot disable default language' : ''}
          className={`relative w-11 h-6 rounded-full transition-colors
            ${is_enabled ? 'bg-blue-600' : 'bg-gray-300'}
            ${(loading || is_default) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
            ${is_enabled ? 'translate-x-5' : 'translate-x-0.5'}`}
          />
        </button>
      </div>
    </div>
  );
};

export default LanguageToggleCard;
```

---

## Bước 3 — Tạo `LanguageManagement.jsx`

**File:** `src/pages/admin/LanguageManagement.jsx` *(tạo mới)*

```jsx
import { useState, useEffect } from 'react';
import LanguageToggleCard from '../../components/features/language/LanguageToggleCard';
import { languageService } from '../../services/languageService';

// Company ID mặc định — sau Phase 4 sẽ lấy từ user.company
const DEFAULT_COMPANY_ID = 1;

const LanguageManagement = () => {
  const [companyLanguages, setCompanyLanguages] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('languages'); // 'languages' | 'audit'
  const [error, setError] = useState('');

  const companyId = DEFAULT_COMPANY_ID;

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [langs, logs] = await Promise.all([
        languageService.getCompanyLanguages(companyId),
        languageService.getAuditLog(companyId),
      ]);
      setCompanyLanguages(langs);
      setAuditLogs(logs);
    } catch (err) {
      setError('Failed to load language data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleToggle = async (cl) => {
    setLoading(true);
    setError('');
    try {
      if (cl.is_enabled) {
        await languageService.disableLanguage(companyId, cl.language.id);
      } else {
        await languageService.enableLanguage(companyId, cl.language.id);
      }
      await fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Action failed.';
      setError(msg);
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
      const msg = err.response?.data?.detail || 'Action failed.';
      setError(msg);
      setLoading(false);
    }
  };

  const enabledCount = companyLanguages.filter(cl => cl.is_enabled).length;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Language Management</h1>
        <p className="text-gray-500 mt-1">
          {enabledCount} / {companyLanguages.length} languages enabled
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b mb-6">
        {['languages', 'audit'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 px-1 capitalize font-medium transition-colors
              ${activeTab === tab
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab === 'audit' ? 'Audit Log' : 'Languages'}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Tab: Languages */}
      {activeTab === 'languages' && (
        <div className="flex flex-col gap-3">
          {companyLanguages.map(cl => (
            <LanguageToggleCard
              key={cl.id}
              companyLanguage={cl}
              onToggle={handleToggle}
              onSetDefault={handleSetDefault}
              loading={loading}
            />
          ))}
        </div>
      )}

      {/* Tab: Audit Log */}
      {activeTab === 'audit' && (
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">Time</th>
                <th className="text-left px-4 py-3">Actor</th>
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3">Language</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map(log => (
                <tr key={log.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{log.actor_email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium
                      ${log.action === 'enable' ? 'bg-green-100 text-green-700' :
                        log.action === 'disable' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">{log.language_code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LanguageManagement;
```

---

## Bước 4 — Thêm route vào `App.jsx`

Tìm phần routes Admin trong `App.jsx` và thêm:

```jsx
import LanguageManagement from './pages/admin/LanguageManagement';

// Trong routes, cùng nhóm với các trang Admin:
<Route
  path="/admin/languages"
  element={
    <ProtectedRoute requiredRole="Admin">
      <LanguageManagement />
    </ProtectedRoute>
  }
/>
```

> Thay `ProtectedRoute` bằng tên component guard hiện tại trong project.

---

## Bước 5 — Thêm link vào Sidebar Admin

Tìm file Sidebar/Navigation dành cho Admin (thường là `Sidebar.jsx` hoặc `AdminLayout.jsx`) và thêm link:

```jsx
// Trong menu items của Admin sidebar:
{
  label: 'Language Management',
  path: '/admin/languages',
  icon: <GlobeIcon />  // dùng icon có sẵn trong project
}
```

---

## Bước 6 — Test UI

1. Đăng nhập với tài khoản Admin
2. Vào `/admin/languages`
3. Kiểm tra:
   - [ ] Danh sách ngôn ngữ hiển thị đúng (10 ngôn ngữ)
   - [ ] Badge "Default" hiển thị đúng trên Japanese
   - [ ] Toggle off một ngôn ngữ → card chuyển sang màu xám
   - [ ] Toggle off ngôn ngữ Default → toggle bị disabled, có tooltip
   - [ ] "Set as Default" thay đổi badge
   - [ ] Tab Audit Log hiển thị lịch sử
   - [ ] Error message hiển thị khi API trả lỗi
