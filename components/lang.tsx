"use client";
import { createContext, useCallback, useContext } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, translate, type Lang, type Translate } from "@/lib/i18n";

// The root layout picks the language on the server; client components read it here.
const LangContext = createContext<Lang>("en");
export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}
export const useLang = () => useContext(LangContext);
export function useT(): Translate {
  const lang = useLang();
  return useCallback((text, vars) => translate(lang, text, vars), [lang]);
}

export function LanguageSwitch() {
  const lang = useLang();
  const t = useT();
  const router = useRouter();
  return (
    <div
      role="group"
      aria-label={t("Language")}
      className="flex shrink-0 rounded-md border border-line"
    >
      {(["ms", "en"] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={lang === value}
          onClick={() => {
            document.cookie = `${LANG_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
            router.refresh();
          }}
          className={`min-h-11 min-w-11 px-3 text-xs font-semibold ${lang === value ? "bg-accent text-on-accent" : "text-muted"}`}
        >
          {value === "ms" ? "BM" : "EN"}
        </button>
      ))}
    </div>
  );
}
