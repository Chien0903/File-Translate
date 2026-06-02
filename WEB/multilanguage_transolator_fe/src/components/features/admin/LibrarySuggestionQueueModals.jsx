import React, { useEffect, useState } from "react";
import { FiX, FiUsers, FiCheck, FiTrash2, FiSearch, FiAlertTriangle, FiEyeOff } from "react-icons/fi";
import { FaExclamationTriangle } from "react-icons/fa";
import Pagination from "../../Pagination";

const LANG_ROWS = [
  { key: "japanese", label: "Japanese" },
  { key: "english", label: "English" },
  { key: "vietnamese", label: "Vietnamese" },
  { key: "chinese_traditional", label: "Chinese (Trad.)" },
  { key: "chinese_simplified", label: "Chinese (Simp.)" },
  { key: "bengali", label: "Bengali" },
  { key: "indonesian", label: "Indonesian" },
  { key: "hindi", label: "Hindi" },
  { key: "oriya", label: "Oriya" },
  { key: "thai", label: "Thai" },
];

const modalShell =
  "rounded-xl border border-gray-200 shadow-xl overflow-hidden flex flex-col bg-white";

export function QueueThresholdModal({
  isOpen,
  onClose,
  minSuggesters,
  onSave,
  saving,
}) {
  const [value, setValue] = useState(String(minSuggesters ?? 2));
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValue(String(minSuggesters ?? 2));
      setShowConfirm(false);
    }
  }, [isOpen, minSuggesters]);

  if (!isOpen) return null;

  const parsedValue = parseInt(value, 10);
  const isChanged = parsedValue !== (minSuggesters ?? 2);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
      <div className={`${modalShell} max-w-md w-full`}>
        <div className="flex justify-between items-center px-5 py-4 bg-[#004098] text-white">
          <h3 className="text-base font-semibold tracking-tight">
            Queue threshold
          </h3>
          <button
            type="button"
            onClick={() => { setShowConfirm(false); onClose(); }}
            className="p-1.5 rounded-full hover:bg-white/15 text-white/90 transition-colors"
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </div>
        <div className="p-5 bg-white">
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            Default is <strong>2</strong>: a suggestion is{" "}
            <strong>automatically added to the library</strong> when at least{" "}
            <strong>n different users</strong> submit the{" "}
            <strong>same language pair</strong> (same two cells, e.g. English +
            Japanese). If it duplicates an existing entry, admin/keeper will be
            notified instead. Minimum value is <strong>2</strong>.
          </p>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
            Minimum suggesters
          </label>
          <input
            type="number"
            min={2}
            max={9999}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 mb-5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0477BF] focus:border-transparent"
            value={value}
            onChange={(e) => { setValue(e.target.value); setShowConfirm(false); }}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowConfirm(false); onClose(); }}
              className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setShowConfirm(true)}
              className="px-5 py-2 rounded-full bg-[#004098] text-white text-sm font-medium hover:bg-[#003875] disabled:opacity-50 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Confirm popup — z-[110] to sit above the threshold modal */}
      {showConfirm && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center p-4 bg-black/30 backdrop-blur-[1px] rounded-xl">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-amber-500 text-white">
              <span className="text-xl">⚠️</span>
              <h4 className="font-semibold text-base">Confirm threshold change</h4>
            </div>
            <div className="px-5 py-4 text-sm text-gray-700 space-y-2">
              <p>
                Set minimum suggesters to{" "}
                <strong className="text-gray-900 text-base">{parsedValue}</strong>
                {isChanged && (
                  <span className="text-gray-500 ml-1">
                    (was <strong>{minSuggesters ?? 2}</strong>)
                  </span>
                )}?
              </p>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                All existing pending suggestions will be re-evaluated against the new threshold immediately.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => { setShowConfirm(false); onSave(parsedValue); }}
                className="px-5 py-2 rounded-full bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function LangTable({ data }) {
  return (
    <div className="text-xs border border-gray-200 rounded-lg overflow-hidden max-h-52 overflow-y-auto bg-gray-50/50">
      <table className="w-full">
        <tbody>
          {LANG_ROWS.map(({ key, label }) => {
            const v = data?.[key];
            if (!v || String(v).trim() === "") return null;
            return (
              <tr key={key} className="border-b border-gray-100 last:border-0">
                <td className="p-2 bg-white font-medium text-gray-500 w-[38%] border-r border-gray-100">
                  {label}
                </td>
                <td className="p-2 text-gray-900 break-words bg-white">{v}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SuggestionQueueModal({
  isOpen,
  onClose,
  items,
  total,
  page,
  pageSize,
  totalPages,
  loading,
  searchQuery,
  onSearchChange,
  onPageChange,
  onApprove,
  onReject,
  approvingId,
  onOpenDuplicateAlerts,
  duplicateAlertCount,
}) {
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const searchInputRef = React.useRef(null);
  const [userQuery, setUserQuery] = React.useState("");
  const [selectedUser, setSelectedUser] = React.useState("");
  const [keywordQuery, setKeywordQuery] = React.useState("");

  const candidateUsers = React.useMemo(() => {
    const map = new Map();
    (items || []).forEach((row) => {
      const key = (row.user_display || row.user_email || "").trim();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: row.user_display || row.user_email,
          email: row.user_email || "",
        });
      }
    });
    return Array.from(map.values());
  }, [items]);

  const filteredUsers = React.useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return candidateUsers;
    return candidateUsers.filter((u) => {
      const label = String(u.label || "").toLowerCase();
      const email = String(u.email || "").toLowerCase();
      return label.includes(q) || email.includes(q);
    });
  }, [candidateUsers, userQuery]);

  const composedSearch = React.useMemo(() => {
    // Step 1 (no selected user): allow backend query by user text
    // so we can discover matching users, but UI still stays in "select user" mode.
    if (!selectedUser) return userQuery.trim();
    return keywordQuery.trim()
      ? `${selectedUser}, ${keywordQuery.trim()}`
      : selectedUser;
  }, [selectedUser, userQuery, keywordQuery]);

  React.useEffect(() => {
    onSearchChange(composedSearch);
  }, [composedSearch, onSearchChange]);

  // Restore focus to search input after loading finishes
  React.useEffect(() => {
    if (!loading) {
      searchInputRef.current?.focus();
    }
  }, [loading]);

  // Auto-focus input when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setUserQuery("");
      setSelectedUser("");
      setKeywordQuery("");
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
      <div
        className={`${modalShell} max-w-5xl w-full h-[90vh] min-h-0`}
      >
        <div className="flex justify-between items-start gap-3 px-5 py-4 bg-[#004098] text-white shrink-0">
          <div>
            <h3 className="text-base font-semibold tracking-tight">
              Suggestion search
            </h3>
            <p className="text-sm text-white/85 mt-1">
              Step 1: search/chọn <strong className="text-white">user</strong>. Step 2: dùng cùng ô search để lọc{" "}
              <strong className="text-white">keyword</strong> của user đó.
              Words that meet the queue threshold are auto-added to the library.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onOpenDuplicateAlerts && (
              <button
                type="button"
                onClick={() => { onClose(); onOpenDuplicateAlerts(); }}
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors shadow-sm"
                title="Suggestions that conflict with existing library entries"
              >
                <FaExclamationTriangle size={14} className="shrink-0" />
                Duplicate alerts
                {typeof duplicateAlertCount === "number" && duplicateAlertCount > 0 && (
                  <span className="absolute -top-1.5 -right-1 min-w-[1.35rem] h-[1.35rem] px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-bold ring-2 ring-[#004098]">
                    {duplicateAlertCount > 99 ? "99+" : duplicateAlertCount}
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/15 text-white/90 transition-colors"
              aria-label="Close"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 px-5 pt-4 pb-3 border-b border-gray-200 bg-[#f8fafc]">
            <div className="max-w-lg">
              <div className="relative">
                {loading ? (
                  <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2">
                    <div className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-gray-300 border-t-[#0477BF]" />
                  </div>
                ) : (
                  <FiSearch
                    className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400"
                    size={18}
                    aria-hidden
                  />
                )}
                <input
                  ref={searchInputRef}
                  type="search"
                  placeholder={
                    selectedUser
                      ? "Step 2: Search keyword for selected user"
                      : "Step 1: Search user name or email"
                  }
                  className={`w-full border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-[#0477BF] focus:outline-none focus:ring-2 focus:ring-[#0477BF]/25 ${
                    !selectedUser && filteredUsers.length > 0 ? "rounded-t-2xl rounded-b-md" : "rounded-full"
                  }`}
                  value={selectedUser ? keywordQuery : userQuery}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (selectedUser) setKeywordQuery(v);
                    else setUserQuery(v);
                  }}
                />
              </div>

              {!selectedUser && filteredUsers.length > 0 && (
                <div className="-mt-px max-h-64 overflow-auto rounded-b-2xl border border-t-0 border-gray-200 bg-white shadow-sm">
                  <ul className="divide-y divide-gray-100">
                    {filteredUsers.slice(0, 30).map((u) => (
                      <li key={u.key}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUser(u.key);
                            setKeywordQuery("");
                            setUserQuery("");
                            setTimeout(() => searchInputRef.current?.focus(), 0);
                          }}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 focus:bg-gray-50"
                          title={u.email || u.label}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
                            {String(u.label || "?").trim().charAt(0).toUpperCase() || "U"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-gray-800">
                              {u.label}
                            </span>
                            {u.email && (
                              <span className="block truncate text-xs text-gray-500">
                                {u.email}
                              </span>
                            )}
                          </div>
                          <span className="text-gray-300">›</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {selectedUser && (
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-[#E6F1F8] text-[#004098] font-medium">
                  User: {selectedUser}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser("");
                    setKeywordQuery("");
                    setUserQuery("");
                    setTimeout(() => searchInputRef.current?.focus(), 0);
                  }}
                  className="px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                >
                  Change user
                </button>
              </div>
            )}

            {(() => {
              const activeQuery = composedSearch.trim();
              if (!activeQuery || loading) return null;
              return (
                <p className="mt-2 text-xs text-gray-500">
                  {total > 0 ? (
                    <>
                      Rows <strong className="text-gray-700">{rangeStart}</strong>–
                      <strong className="text-gray-700">{rangeEnd}</strong> of{" "}
                      <strong className="text-gray-700">{total}</strong> matching
                      · Page <strong className="text-gray-700">{page}</strong> / {totalPages}
                    </>
                  ) : (
                    <span>No pending suggestions found.</span>
                  )}
                </p>
              );
            })()}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8fafc]">
            <div className="flex-1 p-5">
              <div className="h-[360px] overflow-auto">
              {!selectedUser ? (
                <div className="text-center py-16 text-gray-400 text-sm border border-dashed border-gray-300 rounded-xl bg-white">
                  <FiSearch size={28} className="mx-auto mb-3 text-gray-300" />
                  {userQuery.trim()
                    ? "No matching user found. Try another name/email."
                    : "Step 1: Enter and select a user to start searching suggestions."}
                </div>
              ) : loading ? (
                <div className="text-center py-16 text-gray-500 text-sm">
                  Loading…
                </div>
              ) : total === 0 ? (
                <div className="text-center py-16 text-gray-500 text-sm border border-dashed border-amber-200 rounded-xl bg-amber-50/80">
                  No pending suggestions found matching &ldquo;{composedSearch.trim()}&rdquo;.
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-16 text-gray-500 text-sm border border-dashed border-amber-200 rounded-xl bg-amber-50/80">
                  No results on this page. Try another page.
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((row) => {
                    const busy = approvingId === row.id;
                    return (
                      <div
                        key={row.id}
                        className="border border-gray-200 rounded-xl p-4 flex flex-col lg:flex-row gap-4 bg-white shadow-sm"
                      >
                        <div className="flex shrink-0 flex-col gap-2 text-sm lg:w-[11rem]">
                          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#E6F1F8] px-2.5 py-1 text-xs font-semibold text-[#004098]">
                            <FiUsers className="shrink-0" size={14} />
                            {row.user_display || row.user_email || "Unknown"}
                          </span>
                          <span className="text-xs text-gray-500">
                            Suggestion #{row.id}
                          </span>
                          {row.created_at && (
                            <span className="text-[11px] text-gray-400">
                              {new Date(row.created_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs border border-gray-200 rounded-lg overflow-hidden bg-gray-50/50">
                            <table className="w-full">
                              <tbody>
                                {LANG_ROWS.map(({ key, label }) => {
                                  const v = row[key];
                                  if (!v || String(v).trim() === "") return null;
                                  return (
                                    <tr key={key} className="border-b border-gray-100 last:border-0">
                                      <td className="p-2 bg-white font-medium text-gray-500 w-[38%] border-r border-gray-100">
                                        {label}
                                      </td>
                                      <td className="p-2 text-gray-900 break-words bg-white">
                                        {v}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-row justify-end gap-2 lg:flex-col">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onApprove(row.id)}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-[#359740] text-white text-sm font-medium hover:bg-[#2e8237] disabled:opacity-50 transition-colors"
                          >
                            <FiCheck size={16} /> Approve
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onReject(row.id)}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-full border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            <FiTrash2 size={16} /> Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            </div>

            {!loading && total > 0 && totalPages > 1 && (
              <div className="shrink-0 border-t border-gray-200 bg-white px-3 py-2">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={onPageChange}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DuplicateLibraryCompareModal({
  isOpen,
  onClose,
  existingApproved,
  pendingSuggestion,
  duplicates,
  onKeepLibrary,
  onUseSuggestion,
  busy,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]">
      <div className={`${modalShell} max-w-4xl w-full max-h-[92vh]`}>
        <div className="flex justify-between items-start gap-3 px-5 py-4 bg-[#b45309] text-white shrink-0">
          <div>
            <h3 className="text-base font-semibold tracking-tight">
              Duplicate in library
            </h3>
            <p className="text-sm text-white/90 mt-1 leading-relaxed">
              This suggestion overlaps an approved keyword in THK Library.
              Keep the current library entry or replace it with the suggested
              content.
            </p>
            {duplicates?.length > 0 && (
              <p className="text-xs text-amber-100 mt-2 font-mono">
                Overlap:{" "}
                {duplicates.map((d) => `${d.field} = "${d.value}"`).join("; ")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/15 text-white/90 shrink-0 transition-colors"
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5 bg-[#f8fafc]">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 pb-2 border-b border-gray-100">
              In library (approved)
            </h4>
            <LangTable data={existingApproved} />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm ring-2 ring-[#0477BF]/20">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[#004098] mb-3 pb-2 border-b border-gray-100">
              Pending suggestion
            </h4>
            <LangTable data={pendingSuggestion} />
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 flex flex-wrap justify-end gap-2 bg-white">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Close
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onKeepLibrary}
            className="px-4 py-2 rounded-full border border-gray-400 text-gray-800 text-sm font-medium hover:bg-gray-100 disabled:opacity-50"
          >
            Keep library version
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onUseSuggestion}
            className="px-5 py-2 rounded-full bg-[#004098] text-white text-sm font-medium hover:bg-[#003875] disabled:opacity-50"
          >
            Use suggestion (update library)
          </button>
        </div>
      </div>
    </div>
  );
}


export function DuplicateAlertsModal({
  isOpen,
  onClose,
  alerts,
  loading,
  onApprove,
  onDismiss,
  busyId,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
      <div
        className={`${modalShell} max-w-5xl w-full max-h-[90vh] min-h-0`}
      >
        <div className="flex justify-between items-start gap-3 px-5 py-4 bg-[#b45309] text-white shrink-0">
          <div>
            <h3 className="text-base font-semibold tracking-tight flex items-center gap-2">
              <FiAlertTriangle size={18} /> Duplicate alerts
            </h3>
            <p className="text-sm text-white/85 mt-1">
              Suggestions that reached the threshold but conflict with existing
              library entries. Compare both versions and choose to{" "}
              <strong className="text-white">keep the library version</strong>{" "}
              or <strong className="text-white">replace with the suggestion</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/15 text-white/90 shrink-0 transition-colors"
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8fafc]">
          <div className="min-h-0 flex-1 overflow-auto p-5">
            {loading ? (
              <div className="text-center py-16 text-gray-500 text-sm">
                Loading…
              </div>
            ) : !alerts || alerts.length === 0 ? (
              <div className="text-center py-16 text-gray-500 text-sm border border-dashed border-gray-300 rounded-xl bg-white">
                No duplicate alerts at the moment.
              </div>
            ) : (
              <div className="space-y-4">
                {alerts.map((alert) => {
                  const s = alert.suggestion;
                  const ex = alert.existing_library;
                  const busy = busyId === alert.notification_id;
                  const suggestionGone = !s || s.status !== "pending";

                  return (
                    <div
                      key={alert.notification_id}
                      className="border border-amber-200 rounded-xl bg-white shadow-sm overflow-hidden"
                    >
                      <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-start justify-between gap-3">
                        <div className="text-sm text-amber-900">
                          {alert.message}
                          {alert.created_at && (
                            <span className="ml-2 text-xs text-amber-600">
                              {new Date(alert.created_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {suggestionGone ? (
                        <div className="p-4 text-sm text-gray-500 italic">
                          The pending suggestion has already been processed or removed.
                          You can dismiss this alert.
                        </div>
                      ) : (
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {ex && (
                            <div className="rounded-lg border border-gray-200 p-3">
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 pb-1.5 border-b border-gray-100">
                                In library (approved)
                              </h4>
                              <LangTable data={ex} />
                            </div>
                          )}
                          <div className="rounded-lg border border-gray-200 p-3 ring-2 ring-[#0477BF]/20">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-[#004098] mb-2 pb-1.5 border-b border-gray-100">
                              Pending suggestion #{s?.id}
                            </h4>
                            <LangTable data={s} />
                          </div>
                        </div>
                      )}

                      <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap justify-end gap-2 bg-gray-50/80">
                        {suggestionGone ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onDismiss(alert.notification_id)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 disabled:opacity-50 transition-colors"
                          >
                            <FiEyeOff size={15} /> Dismiss
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                onApprove(s.id, "keep_library", alert.notification_id)
                              }
                              className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-400 text-gray-800 text-sm font-medium hover:bg-gray-100 disabled:opacity-50 transition-colors"
                            >
                              Keep library version
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                onApprove(s.id, "use_pending", alert.notification_id)
                              }
                              className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#004098] text-white text-sm font-medium hover:bg-[#003875] disabled:opacity-50 transition-colors"
                            >
                              Use suggestion (update library)
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
