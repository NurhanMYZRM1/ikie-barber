"use client";
// Announce save results and show field errors without relying only on color.
// Server and validation messages arrive in English and are translated here.
import type { ActionResult } from "@/lib/types";
import { useT } from "./lang";
export function Feedback({ result }: { result: ActionResult | null }) {
  const t = useT();
  return result ? (
    <p
      role={result.ok ? "status" : "alert"}
      className={`rounded-md p-3 text-sm ${result.ok ? "bg-accent/10 text-accent" : "bg-red-500/10 text-red-700 dark:text-red-300"}`}
    >
      {t(result.message)}
    </p>
  ) : null;
}
export function FieldError({ message, id }: { message?: string; id?: string }) {
  const t = useT();
  return message ? (
    <p id={id} className="field-error">
      {t(message)}
    </p>
  ) : null;
}
