import { useState, useEffect, useMemo } from 'react';
import { languageService } from '../services/languageService';

/**
 * Derive a 2-letter display badge from an ISO language code.
 * zh-CN → "CN", zh-TW → "TW", vi → "VI", en → "EN", fr → "FR"
 */
const isoToPrefix = (code) => {
  if (!code) return '??';
  const i = code.lastIndexOf('-');
  const part = i >= 0 ? code.slice(i + 1) : code;
  return part.toUpperCase().slice(0, 2);
};

/**
 * Try to extract 2-letter code from a flag emoji (e.g. 🇫🇷 → "FR").
 * Returns null if the input is not a valid flag emoji.
 */
const flagEmojiToCode = (emoji) => {
  try {
    if (!emoji) return null;
    const points = [...emoji]
      .map(c => c.codePointAt(0))
      .filter(p => p >= 0x1F1E6 && p <= 0x1F1FF);
    if (points.length < 2) return null;
    return String.fromCharCode(points[0] - 0x1F1E6 + 65, points[1] - 0x1F1E6 + 65);
  } catch {
    return null;
  }
};

const getPrefix = (code, flagEmoji) =>
  flagEmojiToCode(flagEmoji) || isoToPrefix(code);

/**
 * Fetch ngôn ngữ enabled của company user đang đăng nhập.
 * Trả về:
 *   languages     — array [{ id, code, name, native_name, flag_emoji, sort_order }]
 *   codeByName    — map  { "Vietnamese": "vi", "Japanese": "ja", ... }
 *   nameList      — array ["Vietnamese", "Japanese", ...]  (dùng cho dropdown)
 *   prefixByName  — map  { "Vietnamese": "VN", "French": "FR", ... }  (badge hiển thị theo tên)
 *   prefixByCode  — map  { "vi": "VN", "fr": "FR", "zh-CN": "CN", ... }  (badge hiển thị theo ISO code)
 *   loading       — boolean
 */
export const useCompanyLanguages = () => {
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    languageService
      .getMyCompanyLanguages()
      .then(setLanguages)
      .catch(() => setLanguages([]))
      .finally(() => setLoading(false));
  }, []);

  const codeByName = useMemo(
    () => Object.fromEntries(languages.map(l => [l.name, l.code])),
    [languages]
  );

  const nameList = useMemo(() => languages.map(l => l.name), [languages]);

  const prefixByName = useMemo(
    () => Object.fromEntries(languages.map(l => [l.name, getPrefix(l.code, l.flag_emoji)])),
    [languages]
  );

  const prefixByCode = useMemo(
    () => Object.fromEntries(languages.map(l => [l.code, getPrefix(l.code, l.flag_emoji)])),
    [languages]
  );

  return useMemo(
    () => ({ languages, codeByName, nameList, prefixByName, prefixByCode, loading }),
    [languages, codeByName, nameList, prefixByName, prefixByCode, loading]
  );
};
