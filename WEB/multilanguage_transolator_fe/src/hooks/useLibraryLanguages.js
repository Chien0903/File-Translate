import { useMemo } from "react";
import { useEnabledLanguages } from "./useEnabledLanguages";

/**
 * Returns enabled company languages for use in keyword library tables.
 * English (en) is excluded — callers render it as the sticky first column.
 *
 * Each item: { code: "ja", label: "Japanese", flagEmoji: "🇯🇵" }
 *
 * Since keyword.translations uses ISO codes directly, no field-name mapping needed.
 */
export const useLibraryLanguages = () => {
  const { languages, loading } = useEnabledLanguages();

  const libraryLanguages = useMemo(
    () =>
      languages
        .filter((l) => l.code !== "en")
        .map((l) => ({
          code: l.code,
          label: l.name,
          flagEmoji: l.flag_emoji || "",
        })),
    [languages]
  );

  const englishEnabled = useMemo(
    () => languages.some((l) => l.code === "en"),
    [languages]
  );

  return { libraryLanguages, englishEnabled, loading };
};
