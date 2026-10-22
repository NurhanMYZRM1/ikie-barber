import "server-only";
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, translate, type Lang, type Translate } from "./i18n";

// The visitor's saved choice wins; otherwise their phone/browser's first language.
export async function getLang(): Promise<Lang> {
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  if (saved === "en" || saved === "ms") return saved;
  const first = (await headers()).get("accept-language")?.split(",")[0]?.trim().toLowerCase();
  return first?.startsWith("ms") ? "ms" : "en";
}
export async function getT(): Promise<Translate> {
  const lang = await getLang();
  return (text, vars) => translate(lang, text, vars);
}
